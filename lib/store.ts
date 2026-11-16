import { supabase, isSupabaseConfigured } from "./supabaseClient.ts";
import { createServerClient } from "./serverAuth.ts";
import type { Donor, BankInventoryUnit, BloodRequest } from "./types.ts";

// Helper mapper functions to convert database flat structures to matching engine shapes

export function mapDonorFromDb(row: any): Donor {
  return {
    id: String(row.id),
    name: row.name || "Anonymous Donor",
    phone: row.phone || "",
    bloodGroup: row.blood_group as any,
    location: {
      lat: Number(row.lat) || 0,
      lng: Number(row.lng) || 0,
      label: row.location_label || "Unknown Location",
    },
    available: Boolean(row.available),
    reliabilityScore:
      row.reliability_score !== null && row.reliability_score !== undefined
        ? Number(row.reliability_score)
        : 0,
    lastDonationDate: row.last_donation_date || "",
    // Optional consent fields – defaults if DB columns missing
    consentEmergencyContact: row.consent_emergency_contact ?? false,
    consentTimestamp: row.consent_timestamp ?? null,
  };
}

export function mapDonorToDb(donor: Donor) {
  return {
    id: donor.id,
    name: donor.name,
    phone: donor.phone,
    blood_group: donor.bloodGroup,
    lat: donor.location.lat,
    lng: donor.location.lng,
    location_label: donor.location.label,
    available: donor.available,
    reliability_score: donor.reliabilityScore || 0,
    last_donation_date: donor.lastDonationDate || null,
    consent_emergency_contact: donor.consentEmergencyContact ?? false,
    consent_timestamp: donor.consentTimestamp ?? null,
  };
}

export function mapBankUnitFromDb(row: any): BankInventoryUnit {
  return {
    id: String(row.id),
    bankId: String(row.bank_id || ""),
    bankName: row.bank_name || "Blood Bank",
    location: {
      lat: Number(row.lat) || 0,
      lng: Number(row.lng) || 0,
      label: row.location_label || "Unknown Location",
    },
    bloodGroup: row.blood_group as any,
    unitsAvailable: Number(row.units_available) || 0,
    expiryDate: row.expiry_date || new Date().toISOString(),
  };
}

export function mapBankUnitToDb(unit: BankInventoryUnit) {
  return {
    id: unit.id,
    bank_id: unit.bankId,
    bank_name: unit.bankName,
    blood_group: unit.bloodGroup,
    lat: unit.location.lat,
    lng: unit.location.lng,
    location_label: unit.location.label,
    units_available: unit.unitsAvailable,
    expiry_date: unit.expiryDate,
  };
}

export function mapRequestFromDb(row: any): BloodRequest {
  return {
    id: String(row.id),
    hospitalName: row.hospital_name || "Hospital",
    location: {
      lat: Number(row.lat) || 0,
      lng: Number(row.lng) || 0,
      label: row.location_label || "Unknown Location",
    },
    bloodGroup: row.blood_group as any,
    unitsNeeded: Number(row.units_needed) || 1,
    urgency: row.urgency as any,
    status: row.status as any,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export function mapRequestToDb(req: BloodRequest) {
  return {
    id: req.id,
    hospital_name: req.hospitalName,
    blood_group: req.bloodGroup,
    units_needed: req.unitsNeeded,
    urgency: req.urgency,
    lat: req.location.lat,
    lng: req.location.lng,
    location_label: req.location.label,
    status: req.status,
    created_at: req.createdAt,
  };
}

// Database query wrappers with error handling & offline safety

/**
 * Creates a donor record using the authenticated user's access token so
 * Supabase Row Level Security is evaluated for the actual caller.
 */
export async function addDonor(donor: Donor, accessToken: string): Promise<Donor> {
  if (!isSupabaseConfigured) {
    throw new Error("Cannot save donor: Supabase connection is not configured.");
  }
  if (!accessToken) {
    throw new Error("Cannot save donor: authentication token is required.");
  }

  const client = createServerClient(accessToken);
  const { error } = await client.from("donors").insert(mapDonorToDb(donor));

  if (error) {
    console.error("Database query error in addDonor:", error.message);
    throw new Error(error.message);
  }
  return donor;
}

export async function getDonors(): Promise<Donor[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase.from("donors").select("*");

  if (error) {
    console.error("Database query error in getDonors:", error.message);
    return [];
  }
  return (data || []).map(mapDonorFromDb);
}

export async function updateDonorConsent(id: string, consent: boolean, timestamp: string | null): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase not configured; cannot update consent.');
  }
  const updates: any = {
    consent_emergency_contact: consent,
    consent_timestamp: timestamp,
  };
  const { error } = await supabase.from('donors').update(updates).eq('id', id);
  if (error) {
    console.error('Database error updating donor consent:', error.message);
    throw new Error(error.message);
  }
}


export interface BankUnitQueryOptions {
  bloodGroup?: string;
  excludeExpired?: boolean;
}

export async function getBankUnits(options: BankUnitQueryOptions = { excludeExpired: true }): Promise<BankInventoryUnit[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  let query = supabase.from("bank_inventory").select("*");

  if (options.bloodGroup) {
    query = query.eq("blood_group", options.bloodGroup);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Database query error in getBankUnits:", error.message);
    return [];
  }

  const units = (data || []).map(mapBankUnitFromDb);

  if (options.excludeExpired) {
    const today = new Date().toISOString().split("T")[0];
    return units.filter((u) => !u.expiryDate || u.expiryDate >= today);
  }

  return units;
}

export async function addRequest(req: BloodRequest): Promise<BloodRequest> {
  if (!isSupabaseConfigured) {
    throw new Error("Cannot save request: Supabase connection is not configured.");
  }

  const { error } = await supabase.from("requests").insert(mapRequestToDb(req));

  if (error) {
    console.error("Database query error in addRequest:", error.message);
    throw new Error(error.message);
  }
  return req;
}

export async function getRequestById(id: string): Promise<BloodRequest | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Database query error in getRequestById:", error.message);
    return null;
  }
  return data ? mapRequestFromDb(data) : null;
}

export async function updateRequestStatus(id: string, status: string): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error("Cannot update request status: Supabase connection is not configured.");
  }

  const { error } = await supabase
    .from("requests")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("Database query error in updateRequestStatus:", error.message);
    throw new Error(error.message);
  }
}
