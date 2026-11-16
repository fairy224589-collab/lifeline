-- ============================================================================
-- LIFELINE DATABASE REVISED ARCHITECTURE & REMEDIATION SPECIFICATION
-- Migration File: 20261112_phase2_security_hardening.sql
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE UNTIL EXPLICITLY APPROVED)
-- Purpose: Hardens database security, implements least-privilege RLS,
--          secures role management, protects donor PII, enforces atomic
--          concurrency locking, and establishes immutable audit logging.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SAFE EXTENSIONS & CUSTOM TYPES
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE blood_group_enum AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE blood_component_enum AS ENUM ('whole_blood', 'prbc', 'platelets', 'ffp', 'cryoprecipitate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE inventory_status_enum AS ENUM ('available', 'reserved', 'quarantined', 'expired', 'transfused', 'discarded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE request_status_enum AS ENUM ('open', 'matched', 'confirmed', 'fulfilled', 'cancelled', 'escalated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE urgency_enum AS ENUM ('critical', 'high', 'medium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE app_role_enum AS ENUM ('donor', 'hospital', 'blood_bank', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. SECURE ROLE MANAGEMENT & FACILITY VERIFICATION
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role_enum NOT NULL DEFAULT 'donor',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;

-- Helper function to check role safely without relying on forgeable GUCs or client metadata
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS app_role_enum
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT role FROM public.app_roles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid() AND role = 'admin' AND is_verified = TRUE
    );
$$;

-- RLS for app_roles
CREATE POLICY "Users can read own role"
    ON public.app_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Only admins can modify roles"
    ON public.app_roles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Automated trigger to safely create role on user signup (prevents self-assignment of admin)
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_raw_role TEXT;
    v_target_role app_role_enum;
BEGIN
    v_raw_role := NEW.raw_user_meta_data->>'role';
    
    -- Strictly prohibit self-assignment of admin role
    IF v_raw_role = 'admin' THEN
        v_target_role := 'donor';
    ELSIF v_raw_role = 'hospital' THEN
        v_target_role := 'hospital';
    ELSIF v_raw_role = 'blood_bank' THEN
        v_target_role := 'blood_bank';
    ELSE
        v_target_role := 'donor';
    END IF;

    INSERT INTO public.app_roles (user_id, role, is_verified)
    VALUES (
        NEW.id,
        v_target_role,
        FALSE -- Always unverified initially; requires admin approval
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ----------------------------------------------------------------------------
-- 3. DONOR PRIVACY ARCHITECTURE (SPLIT TABLES)
-- ----------------------------------------------------------------------------

-- Private profile containing sensitive PII and contact coordinates
CREATE TABLE IF NOT EXISTS public.donor_private_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    exact_lat NUMERIC(9,6) NOT NULL,
    exact_lng NUMERIC(9,6) NOT NULL,
    street_address TEXT,
    national_id_hash TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    consent_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.donor_private_profiles ENABLE ROW LEVEL SECURITY;

-- Public availability table containing safe, non-identifying data
CREATE TABLE IF NOT EXISTS public.donor_public_availability (
    donor_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    blood_group blood_group_enum NOT NULL,
    approx_lat NUMERIC(5,2) NOT NULL, -- Rounded to 2 decimals (~1.1 km grid)
    approx_lng NUMERIC(5,2) NOT NULL,
    general_region TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    last_donation_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.donor_public_availability ENABLE ROW LEVEL SECURITY;

-- Policies for donor private profiles:
-- Donors can only read and update their OWN private record.
-- Admins can read for regulatory compliance.
CREATE POLICY "Donors manage own private profile"
    ON public.donor_private_profiles FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Policies for public availability:
-- Anyone authenticated or public can read availability for matching
CREATE POLICY "Public can view donor availability"
    ON public.donor_public_availability FOR SELECT
    TO public
    USING (is_available = TRUE);

CREATE POLICY "Donors update own availability"
    ON public.donor_public_availability FOR ALL
    TO authenticated
    USING (donor_id = auth.uid() OR public.is_admin())
    WITH CHECK (donor_id = auth.uid() OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. MEDICAL FACILITIES (HOSPITALS & BLOOD BANKS)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.medical_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    facility_type TEXT NOT NULL CHECK (facility_type IN ('hospital', 'blood_bank')),
    name TEXT NOT NULL,
    license_number TEXT NOT NULL,
    official_phone TEXT NOT NULL,
    official_email TEXT NOT NULL,
    exact_lat NUMERIC(9,6) NOT NULL,
    exact_lng NUMERIC(9,6) NOT NULL,
    approx_region TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.medical_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view verified facilities"
    ON public.medical_facilities FOR SELECT
    TO public
    USING (is_verified = TRUE);

CREATE POLICY "Facility owners manage own facility data"
    ON public.medical_facilities FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid() AND is_verified = (SELECT is_verified FROM public.medical_facilities WHERE id = medical_facilities.id));

-- ----------------------------------------------------------------------------
-- 5. BATCH & INDIVIDUAL UNIT INVENTORY MANAGEMENT
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.blood_inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES public.medical_facilities(id) ON DELETE RESTRICT,
    batch_number TEXT NOT NULL,
    unit_identifier TEXT NOT NULL UNIQUE,
    blood_group blood_group_enum NOT NULL,
    component blood_component_enum NOT NULL DEFAULT 'whole_blood',
    collection_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status inventory_status_enum NOT NULL DEFAULT 'available',
    reserved_for_request_id UUID,
    reserved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (expiry_date >= collection_date)
);

ALTER TABLE public.blood_inventory_units ENABLE ROW LEVEL SECURITY;

-- Only facility owners or admins can modify their inventory directly
CREATE POLICY "Facilities read own stock"
    ON public.blood_inventory_units FOR SELECT
    TO authenticated
    USING (
        facility_id IN (SELECT id FROM public.medical_facilities WHERE user_id = auth.uid())
        OR public.is_admin()
    );

-- ----------------------------------------------------------------------------
-- 6. EMERGENCY BLOOD REQUESTS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requesting_facility_id UUID NOT NULL REFERENCES public.medical_facilities(id) ON DELETE RESTRICT,
    patient_clinical_reference TEXT NOT NULL, -- Encrypted or clinical reference code (non-PII)
    blood_group blood_group_enum NOT NULL,
    component blood_component_enum NOT NULL DEFAULT 'whole_blood',
    units_needed INT NOT NULL CHECK (units_needed > 0 AND units_needed <= 50),
    units_reserved INT NOT NULL DEFAULT 0,
    urgency urgency_enum NOT NULL DEFAULT 'high',
    status request_status_enum NOT NULL DEFAULT 'open',
    hospital_lat NUMERIC(9,6) NOT NULL,
    hospital_lng NUMERIC(9,6) NOT NULL,
    location_label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public/facilities can read open emergency requests"
    ON public.emergency_requests FOR SELECT
    TO authenticated
    USING (TRUE);

CREATE POLICY "Hospitals can insert emergency requests"
    ON public.emergency_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        requesting_facility_id IN (
            SELECT id FROM public.medical_facilities
            WHERE user_id = auth.uid() AND is_verified = TRUE
        )
    );

-- ----------------------------------------------------------------------------
-- 7. IMMUTABLE PLATFORM AUDIT LOGGING
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- Read-only policy for admins; no updates or deletes permitted (append-only)
CREATE POLICY "Admins can read audit logs"
    ON public.platform_audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 8. ATOMIC RESERVATION FUNCTION (CONCURRENCY-SAFE)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_reserve_blood_unit(
    p_request_id UUID,
    p_unit_id UUID,
    p_facility_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_unit RECORD;
    v_req RECORD;
    v_caller_id UUID;
    v_result JSONB;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Caller must be authenticated.' USING ERRCODE = '42501';
    END IF;

    -- Lock the emergency request row FOR UPDATE
    SELECT * INTO v_req
    FROM public.emergency_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_req.status = 'confirmed' OR v_req.status = 'fulfilled' THEN
        RAISE EXCEPTION 'Request is already confirmed or fulfilled.' USING ERRCODE = '23505';
    END IF;

    -- Lock the inventory unit row FOR UPDATE to prevent race conditions
    SELECT * INTO v_unit
    FROM public.blood_inventory_units
    WHERE id = p_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Blood unit not found.' USING ERRCODE = 'P0002';
    END IF;

    IF v_unit.status != 'available' THEN
        RAISE EXCEPTION 'Blood unit is not available (current status: %)', v_unit.status USING ERRCODE = '55000';
    END IF;

    IF v_unit.expiry_date < CURRENT_DATE THEN
        RAISE EXCEPTION 'Blood unit has expired on %', v_unit.expiry_date USING ERRCODE = '22023';
    END IF;

    -- Perform atomic status updates
    UPDATE public.blood_inventory_units
    SET status = 'reserved',
        reserved_for_request_id = p_request_id,
        reserved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_unit_id;

    UPDATE public.emergency_requests
    SET status = 'confirmed',
        units_reserved = units_reserved + 1,
        updated_at = NOW()
    WHERE id = p_request_id;

    -- Record immutable audit log entry
    INSERT INTO public.platform_audit_logs (
        action,
        entity_type,
        entity_id,
        actor_id,
        details
    ) VALUES (
        'UNIT_RESERVED',
        'blood_inventory_units',
        p_unit_id::TEXT,
        v_caller_id,
        jsonb_build_object(
            'request_id', p_request_id,
            'facility_id', p_facility_id,
            'blood_group', v_unit.blood_group,
            'timestamp', NOW()
        )
    );

    v_result := jsonb_build_object(
        'success', TRUE,
        'request_id', p_request_id,
        'unit_id', p_unit_id,
        'status', 'confirmed',
        'reserved_at', NOW()
    );

    RETURN v_result;
END;
$$;

-- Narrow execute permissions on atomic reservation function
REVOKE ALL ON FUNCTION public.fn_reserve_blood_unit(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_reserve_blood_unit(UUID, UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. SECURE VIEWS WITH SECURITY INVOKER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_public_donors
WITH (security_invoker = true)
AS
SELECT 
    donor_id,
    blood_group,
    approx_lat,
    approx_lng,
    general_region,
    is_available,
    last_donation_date
FROM public.donor_public_availability
WHERE is_available = TRUE;

CREATE OR REPLACE VIEW public.v_available_inventory_search
WITH (security_invoker = true)
AS
SELECT 
    u.id AS unit_id,
    u.facility_id,
    f.name AS facility_name,
    f.approx_region,
    u.blood_group,
    u.component,
    u.expiry_date
FROM public.blood_inventory_units u
JOIN public.medical_facilities f ON u.facility_id = f.id
WHERE u.status = 'available'
  AND u.expiry_date >= CURRENT_DATE
  AND f.is_verified = TRUE;

-- ============================================================================
-- END OF SPECIFICATION — SAVED TO MIGRATION STORE (NOT EXECUTED)
-- ============================================================================
