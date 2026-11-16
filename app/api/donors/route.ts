import type { NextRequest } from "next/server";
import { getDonors, addDonor } from "../../../lib/store.ts";
import type { Donor } from "../../../lib/types.ts";
import {
  DonorRegistrationSchema,
  DonorQuerySchema,
  formatZodErrors,
} from "../../../lib/validations.ts";
import { sanitizeDonorsForPublic } from "../../../lib/donorPrivacy.ts";
import { apiSuccess, apiError } from "../../../lib/apiResponse.ts";
import { extractBearerToken, verifyAuth } from "../../../lib/serverAuth.ts";

/**
 * GET /api/donors
 * Public availability search.
 * To protect donors against stalking, bulk scraping, and unauthorized marketing,
 * this directory endpoint ALWAYS masks contact phone numbers and fuzzes exact coordinates (~1.1km grid).
 * Full unmasked contact information is NEVER exposed in directory lookups;
 * it requires an active confirmed match ticket via GET /api/donors/[id]/contact.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = DonorQuerySchema.safeParse({
      bloodGroup: searchParams.get("bloodGroup") || undefined,
      available: searchParams.get("available") || undefined,
      lat: searchParams.get("lat") || undefined,
      lng: searchParams.get("lng") || undefined,
      radiusKm: searchParams.get("radiusKm") || undefined,
      includeDemo: searchParams.get("includeDemo") || undefined,
    });

    if (!parsedQuery.success) {
      return apiError(
        "Invalid query parameters.",
        "VALIDATION_ERROR",
        400,
        formatZodErrors(parsedQuery.error)
      );
    }

    const allDonors = await getDonors();

    let filtered = allDonors;
    if (parsedQuery.data.bloodGroup) {
      filtered = filtered.filter((d) => d.bloodGroup === parsedQuery.data.bloodGroup);
    }
    if (parsedQuery.data.available !== undefined) {
      filtered = filtered.filter((d) => d.available === parsedQuery.data.available);
    }

    // Always sanitize directory listings for all users to prevent bulk harvesting
    const sanitized = sanitizeDonorsForPublic(filtered);

    return apiSuccess({
      donors: sanitized,
      totalCount: sanitized.length,
    });
  } catch (err: any) {
    console.error("GET /api/donors error:", err);
    return apiError(
      "Failed to fetch donors list.",
      "INTERNAL_SERVER_ERROR",
      500
    );
  }
}

/**
 * POST /api/donors
 * Registers a new donor profile.
 * Strictly requires authentication and explicit consent. Never accepts anonymous fallback registrations.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Authentication: Anonymous fallback registration is strictly prohibited
    const auth = await verifyAuth(req);
    if (!auth.authenticated || !auth.user) {
      return apiError(
        "Authentication required to register as a blood donor. Please sign in or create an account first.",
        "UNAUTHORIZED",
        401
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON payload.", "VALIDATION_ERROR", 400);
    }

    // 2. Enforce Zod validation including mandatory explicit consent
    const validation = DonorRegistrationSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError(
        "Invalid donor registration data.",
        "VALIDATION_ERROR",
        400,
        formatZodErrors(validation.error)
      );
    }

    const { name, phone, bloodGroup, location, available, consentEmergencyContact } = validation.data;

    // Donor record is strictly bound to the authenticated user's ID
    const newDonor: Donor = {
      id: auth.user.id,
      name,
      phone,
      bloodGroup,
      location,
      available: available ?? true,
      reliabilityScore: 0, // Starts at 0 until verified donations occur
      lastDonationDate: new Date().toISOString().split("T")[0],
      consentEmergencyContact,
      consentTimestamp: consentEmergencyContact ? new Date().toISOString() : null,
    };

    const accessToken = extractBearerToken(req);
    if (!accessToken) {
      return apiError("Authentication token is required.", "UNAUTHORIZED", 401);
    }

    await addDonor(newDonor, accessToken);

    return apiSuccess(
      {
        donor: {
          id: newDonor.id,
          name: newDonor.name,
          bloodGroup: newDonor.bloodGroup,
          location: newDonor.location,
          available: newDonor.available,
        },
        message: "Donor profile successfully registered with verified consent.",
      },
      201
    );
  } catch (err: any) {
    console.error("POST /api/donors error:", err);
    return apiError(
      err.message || "Failed to register donor.",
      "INTERNAL_SERVER_ERROR",
      500
    );
  }
}
