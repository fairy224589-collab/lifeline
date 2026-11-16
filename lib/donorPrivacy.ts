import type { Donor, Location } from "./types.ts";

export interface PublicDonor {
  id: string;
  name: string;
  bloodGroup: Donor["bloodGroup"];
  location: {
    lat: number;
    lng: number;
    label: string;
    isApproximate: boolean;
  };
  available: boolean;
  reliabilityScore: number;
  lastDonationDate: string;
  phoneMasked: string;
}

/**
 * Masks a phone number so sensitive digits are not exposed to public/anonymous viewers.
 * Example: "+91 98765 43210" -> "+91 ••••• ••210"
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return "[REDACTED]";
  const cleaned = phone.trim();
  if (cleaned.length <= 4) return "••••";
  const suffix = cleaned.slice(-3);
  const prefix = cleaned.startsWith("+") ? cleaned.slice(0, 3) + " " : "";
  return `${prefix}••••• ••${suffix}`;
}

/**
 * Approximates coordinates by rounding to 2 decimal places (~1.1 km precision at the equator).
 * Prevents exact residential triangulation of donors.
 */
export function approximateLocation(location: Location): Location & { isApproximate: boolean } {
  return {
    lat: Number(location.lat.toFixed(2)),
    lng: Number(location.lng.toFixed(2)),
    label: location.label.replace(/\b(House|Flat|Apt|Street|Plot|Lane)\s+[A-Za-z0-9#-]+/gi, "[Area]"),
    isApproximate: true,
  };
}

/**
 * Converts a raw database donor record into a privacy-safe public representation.
 * Raw phone numbers and exact GPS coordinates are stripped.
 */
export function sanitizeDonorForPublic(donor: Donor): PublicDonor {
  return {
    id: donor.id,
    name: donor.name,
    bloodGroup: donor.bloodGroup,
    location: approximateLocation(donor.location),
    available: donor.available,
    reliabilityScore: donor.reliabilityScore,
    lastDonationDate: donor.lastDonationDate,
    phoneMasked: maskPhoneNumber(donor.phone),
  };
}

/**
 * Batch sanitizes an array of donors for public presentation.
 */
export function sanitizeDonorsForPublic(donors: Donor[]): PublicDonor[] {
  return donors.map(sanitizeDonorForPublic);
}
