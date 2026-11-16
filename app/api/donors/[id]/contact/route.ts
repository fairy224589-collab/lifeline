import type { NextRequest } from "next/server";
import { getDonors, getRequestById } from "../../../../../lib/store.ts";
import { apiSuccess, apiError } from "../../../../../lib/apiResponse.ts";
import { verifyAuth, verifyRole } from "../../../../../lib/serverAuth.ts";

/**
 * GET /api/donors/[id]/contact?requestId=<requestId>
 * Protected endpoint for clinical contact access during active medical emergencies.
 * To access an individual donor's direct telephone number and coordinate details:
 *   1. Caller must be authenticated as a hospital or admin.
 *   2. An active, confirmed or matched emergency request must exist.
 *   3. The caller must be authorized to act on that emergency request.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: donorId } = await context.params;

    // 1. Enforce Authentication and Clinical Role
    const auth = await verifyAuth(req);
    if (!auth.authenticated || !auth.user) {
      return apiError("Authentication required.", "UNAUTHORIZED", 401);
    }

    const roleCheck = await verifyRole(req, ["hospital", "admin"]);
    if (!roleCheck.authorized) {
      return apiError(
        "Access denied. Only authorized hospitals managing an active emergency dispatch may access donor contact information.",
        "FORBIDDEN",
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get("requestId");

    if (!requestId) {
      return apiError(
        "Missing required 'requestId' query parameter verifying clinical emergency relationship.",
        "VALIDATION_ERROR",
        400
      );
    }

    // 2. Verify Emergency Request Existence and Active Status
    const request = await getRequestById(requestId);
    if (!request) {
      return apiError("Emergency blood request not found.", "NOT_FOUND", 404);
    }

    if (request.status !== "matched" && request.status !== "confirmed") {
      return apiError(
        `Contact information cannot be released. Request status is '${request.status}' (must be 'matched' or 'confirmed').`,
        "FORBIDDEN",
        403
      );
    }

    // 3. Find the Donor Profile
    const allDonors = await getDonors();
    const donor = allDonors.find((d) => d.id === donorId);

    if (!donor) {
      return apiError("Donor not found.", "NOT_FOUND", 404);
    }

    // Return unmasked medical dispatch contact details strictly for this matched ticket
    return apiSuccess({
      relationshipVerified: true,
      requestId: request.id,
      donor: {
        id: donor.id,
        name: donor.name,
        phone: donor.phone,
        bloodGroup: donor.bloodGroup,
        location: donor.location,
      },
    });
  } catch (err: any) {
    console.error("GET /api/donors/[id]/contact error:", err);
    return apiError(
      "Failed to retrieve donor contact details.",
      "INTERNAL_SERVER_ERROR",
      500
    );
  }
}
