-- ============================================================================
-- LIFELINE PHASE 2 DATABASE SPECIFICATION (REVISED V2)
-- Migration File: 20261113_phase2_security_hardening_v2.sql
-- Status: PREPARED FOR REVIEW (DO NOT EXECUTE UNTIL EXPLICITLY APPROVED)
-- Purpose: Hardens database security, implements least-privilege RLS,
--          secures role management, protects donor PII, enforces atomic
--          multi-unit concurrency locking, and establishes immutable audit logging.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SAFE EXTENSIONS & ENUMS
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE public.blood_group_enum AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.blood_component_enum AS ENUM ('whole_blood', 'prbc', 'platelets', 'ffp', 'cryoprecipitate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.inventory_status_enum AS ENUM ('available', 'reserved', 'quarantined', 'expired', 'transfused', 'discarded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.request_status_enum AS ENUM ('open', 'matched', 'partially_reserved', 'confirmed', 'fulfilled', 'cancelled', 'escalated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.urgency_enum AS ENUM ('critical', 'high', 'medium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.app_role_enum AS ENUM ('donor', 'hospital', 'blood_bank', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. SECURE ROLE MANAGEMENT & FACILITY VERIFICATION
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role_enum NOT NULL DEFAULT 'donor',
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;

-- Pure schema-qualified security definer helpers with empty search_path
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.app_role_enum
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT role FROM public.app_roles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.app_roles
        WHERE user_id = auth.uid() AND role = 'admin' AND is_verified = TRUE
    );
$$;

-- RLS for app_roles
DROP POLICY IF EXISTS "Users can read own role" ON public.app_roles;
CREATE POLICY "Users can read own role"
    ON public.app_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Only admins can modify roles" ON public.app_roles;
CREATE POLICY "Only admins can modify roles"
    ON public.app_roles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Automated signup trigger: DEFAULT ALL NEW USERS TO DONOR
-- Never trust client raw_user_meta_data for privileged roles
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- All self-registrations default strictly to 'donor'
    -- Facility and Admin roles require authorized administrative onboarding
    INSERT INTO public.app_roles (user_id, role, is_verified)
    VALUES (
        NEW.id,
        'donor'::public.app_role_enum,
        FALSE
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
-- 3. DONOR PRIVACY ARCHITECTURE & MANDATORY CONSENT
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT chk_donor_consent CHECK (consent_emergency_contact = TRUE)
);

ALTER TABLE public.donor_private_profiles ENABLE ROW LEVEL SECURITY;

-- Public availability table containing safe, non-identifying data
CREATE TABLE IF NOT EXISTS public.donor_public_availability (
    donor_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    blood_group public.blood_group_enum NOT NULL,
    approx_lat NUMERIC(5,2) NOT NULL, -- Rounded to 2 decimals (~1.1 km area grid)
    approx_lng NUMERIC(5,2) NOT NULL,
    general_region TEXT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    last_donation_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.donor_public_availability ENABLE ROW LEVEL SECURITY;

-- RLS: Donors read/write own private profile; Admins have read access
DROP POLICY IF EXISTS "Donors manage own private profile" ON public.donor_private_profiles;
CREATE POLICY "Donors manage own private profile"
    ON public.donor_private_profiles FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- RLS: Public can view active availability
DROP POLICY IF EXISTS "Public can view donor availability" ON public.donor_public_availability;
CREATE POLICY "Public can view donor availability"
    ON public.donor_public_availability FOR SELECT
    TO public
    USING (is_available = TRUE);

DROP POLICY IF EXISTS "Donors update own availability" ON public.donor_public_availability;
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.medical_facilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view verified facilities" ON public.medical_facilities;
CREATE POLICY "Public can view verified facilities"
    ON public.medical_facilities FOR SELECT
    TO public
    USING (is_verified = TRUE);

DROP POLICY IF EXISTS "Facility owners manage own facility data" ON public.medical_facilities;
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
    blood_group public.blood_group_enum NOT NULL,
    component public.blood_component_enum NOT NULL DEFAULT 'whole_blood',
    collection_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status public.inventory_status_enum NOT NULL DEFAULT 'available',
    reserved_for_request_id UUID,
    reserved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    CONSTRAINT valid_dates CHECK (expiry_date >= collection_date)
);

ALTER TABLE public.blood_inventory_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Facilities read own stock" ON public.blood_inventory_units;
CREATE POLICY "Facilities read own stock"
    ON public.blood_inventory_units FOR SELECT
    TO authenticated
    USING (
        facility_id IN (SELECT id FROM public.medical_facilities WHERE user_id = auth.uid())
        OR public.is_admin()
    );

-- ----------------------------------------------------------------------------
-- 6. RESTRICTED EMERGENCY REQUEST ACCESS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.emergency_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requesting_facility_id UUID NOT NULL REFERENCES public.medical_facilities(id) ON DELETE RESTRICT,
    patient_clinical_reference TEXT NOT NULL, -- Encrypted clinical token (no plain text PII)
    blood_group public.blood_group_enum NOT NULL,
    component public.blood_component_enum NOT NULL DEFAULT 'whole_blood',
    units_needed INT NOT NULL CHECK (units_needed > 0 AND units_needed <= 50),
    units_reserved INT NOT NULL DEFAULT 0 CHECK (units_reserved >= 0 AND units_reserved <= units_needed),
    urgency public.urgency_enum NOT NULL DEFAULT 'high',
    status public.request_status_enum NOT NULL DEFAULT 'open',
    hospital_lat NUMERIC(9,6) NOT NULL,
    hospital_lng NUMERIC(9,6) NOT NULL,
    location_label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.emergency_requests ENABLE ROW LEVEL SECURITY;

-- Restrict SELECT on emergency requests strictly to authorized clinical entities
DROP POLICY IF EXISTS "Hospitals and admins read requests" ON public.emergency_requests;
CREATE POLICY "Hospitals and admins read requests"
    ON public.emergency_requests FOR SELECT
    TO authenticated
    USING (
        requesting_facility_id IN (SELECT id FROM public.medical_facilities WHERE user_id = auth.uid())
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Verified hospitals create requests" ON public.emergency_requests;
CREATE POLICY "Verified hospitals create requests"
    ON public.emergency_requests FOR INSERT
    TO authenticated
    WITH CHECK (
        requesting_facility_id IN (
            SELECT id FROM public.medical_facilities
            WHERE user_id = auth.uid() AND is_verified = TRUE
        )
    );

-- ----------------------------------------------------------------------------
-- 7. IMMUTABLE PLATFORM AUDIT LOGGING (TAMPER-PROOF)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_id UUID REFERENCES auth.users(id),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;

-- Tamper-proofing trigger: STRICTLY PREVENTS UPDATE OR DELETE
CREATE OR REPLACE FUNCTION public.fn_prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are strictly append-only and cannot be modified or deleted.' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON public.platform_audit_logs;
CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON public.platform_audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_audit_modification();

-- Admins can only read audit logs
DROP POLICY IF EXISTS "Admins read audit logs" ON public.platform_audit_logs;
CREATE POLICY "Admins read audit logs"
    ON public.platform_audit_logs FOR SELECT
    TO authenticated
    USING (public.is_admin());

REVOKE UPDATE, DELETE, TRUNCATE ON public.platform_audit_logs FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8. ATOMIC MULTI-UNIT RESERVATION FUNCTION WITH OWNERSHIP VALIDATION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_reserve_blood_unit(
    p_request_id UUID,
    p_unit_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_unit RECORD;
    v_req RECORD;
    v_caller_id UUID;
    v_caller_owns_request BOOLEAN;
    v_new_reserved_count INT;
    v_new_status public.request_status_enum;
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
        RAISE EXCEPTION 'Emergency request % not found.', p_request_id USING ERRCODE = 'P0002';
    END IF;

    -- Ownership validation: caller must own requesting hospital or be admin
    SELECT EXISTS (
        SELECT 1 FROM public.medical_facilities
        WHERE id = v_req.requesting_facility_id AND user_id = v_caller_id
    ) OR public.is_admin() INTO v_caller_owns_request;

    IF NOT v_caller_owns_request THEN
        RAISE EXCEPTION 'Forbidden: Caller does not own emergency request %.', p_request_id USING ERRCODE = '42501';
    END IF;

    -- Multi-unit validation: check if request is already fully fulfilled
    IF v_req.status = 'fulfilled' OR v_req.status = 'confirmed' AND v_req.units_reserved >= v_req.units_needed THEN
        RAISE EXCEPTION 'Request % is already fully reserved (% of % units).', p_request_id, v_req.units_reserved, v_req.units_needed USING ERRCODE = '23505';
    END IF;

    -- Lock inventory unit FOR UPDATE
    SELECT * INTO v_unit
    FROM public.blood_inventory_units
    WHERE id = p_unit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Blood unit % not found.', p_unit_id USING ERRCODE = 'P0002';
    END IF;

    IF v_unit.status != 'available' THEN
        RAISE EXCEPTION 'Blood unit % is not available (current status: %)', p_unit_id, v_unit.status USING ERRCODE = '55000';
    END IF;

    IF v_unit.expiry_date < pg_catalog.CURRENT_DATE THEN
        RAISE EXCEPTION 'Blood unit % expired on %', p_unit_id, v_unit.expiry_date USING ERRCODE = '22023';
    END IF;

    -- Calculate multi-unit partial vs complete status
    v_new_reserved_count := v_req.units_reserved + 1;
    IF v_new_reserved_count >= v_req.units_needed THEN
        v_new_status := 'confirmed'::public.request_status_enum;
    ELSE
        v_new_status := 'partially_reserved'::public.request_status_enum;
    END IF;

    -- Atomic updates
    UPDATE public.blood_inventory_units
    SET status = 'reserved',
        reserved_for_request_id = p_request_id,
        reserved_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_unit_id;

    UPDATE public.emergency_requests
    SET units_reserved = v_new_reserved_count,
        status = v_new_status,
        updated_at = pg_catalog.now()
    WHERE id = p_request_id;

    -- Insert immutable audit log
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
            'unit_identifier', v_unit.unit_identifier,
            'blood_group', v_unit.blood_group,
            'units_reserved', v_new_reserved_count,
            'units_needed', v_req.units_needed,
            'request_status', v_new_status
        )
    );

    v_result := jsonb_build_object(
        'success', TRUE,
        'request_id', p_request_id,
        'unit_id', p_unit_id,
        'units_reserved', v_new_reserved_count,
        'units_needed', v_req.units_needed,
        'status', v_new_status,
        'timestamp', pg_catalog.now()
    );

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_reserve_blood_unit(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_reserve_blood_unit(UUID, UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 9. SAFE DATA BACKFILL PROCEDURES (NON-DESTRUCTIVE)
-- ----------------------------------------------------------------------------

-- Procedure to safely backfill legacy donor records into new normalized tables
CREATE OR REPLACE FUNCTION public.fn_backfill_legacy_data()
RETURNS TABLE (
    donors_migrated INT,
    inventory_migrated INT,
    requests_migrated INT,
    validation_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_donors_count INT := 0;
    v_inventory_count INT := 0;
    v_requests_count INT := 0;
BEGIN
    -- 1. Backfill Donors
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'donors') THEN
        INSERT INTO public.donor_public_availability (
            donor_id,
            blood_group,
            approx_lat,
            approx_lng,
            general_region,
            is_available,
            last_donation_date
        )
        SELECT 
            pg_catalog.gen_random_uuid(),
            blood_group::public.blood_group_enum,
            pg_catalog.round(lat::numeric, 2),
            pg_catalog.round(lng::numeric, 2),
            location_label,
            available,
            last_donation_date::date
        FROM public.donors
        ON CONFLICT DO NOTHING;
        
        GET DIAGNOSTICS v_donors_count = ROW_COUNT;
    END IF;

    -- Return migration audit summary
    RETURN QUERY SELECT 
        v_donors_count,
        v_inventory_count,
        v_requests_count,
        'LEGACY DATA BACKFILLED SAFELY — NO TABLES DROPPED'::TEXT;
END;
$$;

-- ============================================================================
-- END OF SPECIFICATION V2 — SAVED TO MIGRATION STORE (NOT EXECUTED)
-- ============================================================================
