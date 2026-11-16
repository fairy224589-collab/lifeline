import { z } from "zod";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const BloodGroupSchema = z.enum(BLOOD_GROUPS);
export type BloodGroup = z.infer<typeof BloodGroupSchema>;

export const URGENCY_LEVELS = ["critical", "high", "medium"] as const;
export const UrgencyLevelSchema = z.enum(URGENCY_LEVELS);
export type UrgencyLevel = z.infer<typeof UrgencyLevelSchema>;

export const LocationSchema = z.object({
  lat: z
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lng: z
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  label: z
    .string()
    .trim()
    .min(1, "Location label cannot be empty")
    .max(255, "Location label too long"),
});
export type Location = z.infer<typeof LocationSchema>;

// Donor registration body validation – consent is now optional (default false)
export const DonorRegistrationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Donor name must be at least 2 characters")
    .max(100, "Donor name must not exceed 100 characters"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-]{8,20}$/, "Invalid phone number format. Must be 8-20 characters with optional country code"),
  bloodGroup: BloodGroupSchema,
  location: LocationSchema,
  available: z.boolean().optional().default(true),
  // Optional consent – defaults to false; server will set timestamp on grant
  consentEmergencyContact: z.boolean().optional().default(false),
});
export type DonorRegistrationInput = z.infer<typeof DonorRegistrationSchema>;

// Public donor search query validation
export const DonorQuerySchema = z.object({
  bloodGroup: BloodGroupSchema.optional(),
  available: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  lat: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? Number(val) : undefined))
    .pipe(z.number().min(-90).max(90).optional()),
  lng: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? Number(val) : undefined))
    .pipe(z.number().min(-180).max(180).optional()),
  radiusKm: z
    .string()
    .optional()
    .transform((val) => (val !== undefined ? Number(val) : undefined))
    .pipe(z.number().positive().max(500).optional()),
  includeDemo: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Blood request creation validation
export const BloodRequestCreateSchema = z.object({
  hospitalName: z
    .string()
    .trim()
    .min(2, "Hospital name must be at least 2 characters")
    .max(100, "Hospital name must not exceed 100 characters"),
  bloodGroup: BloodGroupSchema,
  unitsNeeded: z
    .number()
    .int("Units must be an integer")
    .min(1, "At least 1 unit must be requested")
    .max(50, "Maximum 50 units can be requested per emergency batch"),
  urgency: UrgencyLevelSchema,
  location: LocationSchema,
  includeDemo: z.boolean().optional().default(false),
});
export type BloodRequestCreateInput = z.infer<typeof BloodRequestCreateSchema>;

// Match confirmation validation
export const MatchConfirmSchema = z.object({
  requestId: z
    .string()
    .trim()
    .min(3, "Invalid request ID format")
    .max(128, "Request ID too long"),
  confirmedSourceId: z
    .string()
    .trim()
    .min(2, "Invalid source ID format")
    .max(128, "Source ID too long"),
});
export type MatchConfirmInput = z.infer<typeof MatchConfirmSchema>;

// Bank inventory query validation
export const BankInventoryQuerySchema = z.object({
  bloodGroup: BloodGroupSchema.optional(),
  bankId: z.string().trim().optional(),
  includeDemo: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

// Helper for formatted validation errors
export function formatZodErrors(error: z.ZodError): string[] {
  const issues = (error as any).errors || (error as any).issues || [];
  return issues.map((e: any) => {
    const field = Array.isArray(e.path) ? e.path.join(".") : "";
    return field ? `${field}: ${e.message}` : e.message;
  });
}

/**
 * Validates role assignment during onboarding.
 * Self-registration as "admin" is strictly rejected.
 */
export function sanitizeSelfRegistrationRole(requestedRole?: string): "donor" | "hospital" | "bank" {
  if (requestedRole === "hospital" || requestedRole === "bank") {
    return requestedRole;
  }
  return "donor";
}
