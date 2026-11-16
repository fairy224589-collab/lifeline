import type { NextRequest } from "next/server";
import { getRequestById, updateRequestStatus } from "../../../../lib/store.ts";
import { MatchConfirmSchema, formatZodErrors } from "../../../../lib/validations.ts";
import { isDemoId, demoStore } from "../../../../lib/demoData.ts";
import { apiSuccess, apiError } from "../../../../lib/apiResponse.ts";
import { verifyAuth, verifyRole } from "../../../../lib/serverAuth.ts";

/**
 * PATCH /api/match/confirm
 * Confirms an emergency match and locks the blood request.
 * Real production confirmations require authenticated hospital or administrator credentials.
 * Demo confirmations are routed strictly to the isolated in-memory simulation store.
 */
export async function PATCH(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON payload.", "VALIDATION_ERROR", 400);
    }

    const validation = MatchConfirmSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError(
        "Invalid match confirmation parameters.",
        "VALIDATION_ERROR",
        400,
        formatZodErrors(validation.error)
      );
    }

    const { requestId, confirmedSourceId } = validation.data;

    // Check if this is a simulation / demo confirmation
    if (isDemoId(requestId) || isDemoId(confirmedSourceId)) {
      const demoResult = demoStore.confirmReservation(requestId, confirmedSourceId);
      return apiSuccess(demoResult);
    }

    // Real production confirmation: strictly enforce authentication & authorization
    const auth = await verifyAuth(req);
    if (!auth.authenticated || !auth.user) {
      return apiError("Authentication required to confirm emergency reservations.", "UNAUTHORIZED", 401);
    }

    const roleCheck = await verifyRole(req, ["hospital", "admin"]);
    if (!roleCheck.authorized) {
      return apiError(
        roleCheck.error || "Access denied. Only authorized medical facilities can confirm blood reservations.",
        "FORBIDDEN",
        403
      );
    }

    const request = await getRequestById(requestId);

    if (!request) {
      return apiError("Blood request not found.", "NOT_FOUND", 404);
    }

    if (request.status === "confirmed") {
      return apiError(
        "This request has already been confirmed. First-confirmed lock active.",
        "CONFLICT",
        409,
        {
          requestId,
          currentStatus: request.status,
        }
      );
    }

    // Apply first-confirmed-lock in database
    await updateRequestStatus(requestId, "confirmed");

    return apiSuccess({
      requestId,
      confirmedSourceId,
      status: "confirmed",
      lockedAt: new Date().toISOString(),
      message: "Match locked. All other candidates auto-released.",
      is_demo: false,
    });
  } catch (err: any) {
    console.error("PATCH /api/match/confirm error:", err);
    return apiError(
      "Failed to confirm match reservation.",
      "INTERNAL_SERVER_ERROR",
      500
    );
  }
}
