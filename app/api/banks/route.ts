import type { NextRequest } from "next/server";
import { getBankUnits } from "../../../lib/store.ts";
import { BankInventoryQuerySchema, formatZodErrors } from "../../../lib/validations.ts";
import { generateRegionalDemoCandidates } from "../../../lib/demoData.ts";
import { apiSuccess, apiError } from "../../../lib/apiResponse.ts";

/**
 * GET /api/banks
 * Returns verified blood bank inventory. Expired units are excluded by default.
 * Demo/simulated units are strictly returned under `demoBankUnits` and NEVER merged into `bankUnits`.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parsedQuery = BankInventoryQuerySchema.safeParse({
      bloodGroup: searchParams.get("bloodGroup") || undefined,
      bankId: searchParams.get("bankId") || undefined,
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

    const { bloodGroup, bankId, includeDemo } = parsedQuery.data;

    let bankUnitsList = await getBankUnits({
      bloodGroup,
      excludeExpired: true,
    });

    if (bankId) {
      bankUnitsList = bankUnitsList.filter((u) => u.bankId === bankId);
    }

    let demoUnits: any[] = [];
    if (includeDemo) {
      const demo = generateRegionalDemoCandidates({
        lat: 28.6139,
        lng: 77.209,
        label: "Default Regional Center",
      });
      demoUnits = demo.demoBankUnits;
      if (bloodGroup) {
        demoUnits = demoUnits.filter((u) => u.bloodGroup === bloodGroup);
      }
    }

    return apiSuccess({
      bankUnits: bankUnitsList, // Verified real database inventory ONLY
      demoBankUnits: demoUnits, // Completely separated simulated inventory
      totalCount: bankUnitsList.length,
      realCount: bankUnitsList.length,
      demoCount: demoUnits.length,
    });
  } catch (err: any) {
    console.error("GET /api/banks error:", err);
    return apiError(
      "Failed to fetch bank inventory stock.",
      "INTERNAL_SERVER_ERROR",
      500
    );
  }
}
