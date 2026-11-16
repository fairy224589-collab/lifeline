import type { NextRequest } from "next/server";
import { matchRequest } from "../../../lib/matchingEngine.ts";
import { getDonors, getBankUnits, addRequest } from "../../../lib/store.ts";
import type { BloodRequest, Donor, BankInventoryUnit } from "../../../lib/types.ts";
import { BloodRequestCreateSchema, formatZodErrors } from "../../../lib/validations.ts";
import { generateRegionalDemoCandidates, demoStore, DEMO_DISCLAIMER } from "../../../lib/demoData.ts";
import { apiSuccess, apiError } from "../../../lib/apiResponse.ts";
import { verifyRole, verifyAuth } from "../../../lib/serverAuth.ts";

/**
 * POST /api/match
 * Evaluates blood compatibility and generates priority matches for emergency requests.
 * Production emergency requests require verified hospital or administrator authentication.
 * Demo simulation (includeDemo: true) uses isolated in-memory simulation and never pollutes production tables.
 */
export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError("Malformed JSON payload.", "VALIDATION_ERROR", 400);
    }

    const validation = BloodRequestCreateSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError(
        "Invalid emergency blood request data.",
        "VALIDATION_ERROR",
        400,
        formatZodErrors(validation.error)
      );
    }

    const { hospitalName, bloodGroup, unitsNeeded, urgency, location, includeDemo } =
      validation.data;

    // Authorization check:
    // If not demo mode, strictly enforce authenticated hospital or admin session
    if (!includeDemo) {
      const auth = await verifyAuth(req);
      if (!auth.authenticated || !auth.user) {
        return apiError("Authentication required to create emergency blood requests.", "UNAUTHORIZED", 401);
      }

      const roleCheck = await verifyRole(req, ["hospital", "admin"]);
      if (!roleCheck.authorized) {
        return apiError(
          roleCheck.error || "Access denied. Only verified hospital facilities or administrators can dispatch emergency matching.",
          "FORBIDDEN",
          403
        );
      }
    }

    // Handle Demo Mode (100% isolated in-memory simulation)
    if (includeDemo) {
      const demoRequest: BloodRequest = {
        id: `demo_req_${Date.now()}`,
        hospitalName: `[DEMO] ${hospitalName}`,
        bloodGroup,
        unitsNeeded,
        urgency,
        location,
        status: "open",
        createdAt: new Date().toISOString(),
      };

      // Save exclusively to in-memory simulation store (NEVER database)
      demoStore.saveRequest(demoRequest);

      const { demoDonors, demoBankUnits } = generateRegionalDemoCandidates(location);
      const rawDemoMatches = matchRequest(demoRequest, {
        donors: demoDonors,
        bankUnits: demoBankUnits,
      });

      const enrichedDemoMatches = rawDemoMatches.map((m) => {
        let sourceLoc = null;
        if (m.sourceType === "donor") {
          const d = demoDonors.find((item) => item.id === m.sourceId);
          if (d) sourceLoc = d.location;
        } else {
          const u = demoBankUnits.find((item) => item.id === m.sourceId);
          if (u) sourceLoc = u.location;
        }
        return {
          ...m,
          location: sourceLoc,
          is_demo: true,
          demo_disclaimer: DEMO_DISCLAIMER,
        };
      });

      return apiSuccess({
        request: demoRequest,
        matches: enrichedDemoMatches, // Returned for UI demo visualization
        demoMatches: enrichedDemoMatches,
        realMatches: [],
        realMatchCount: 0,
        demoMatchCount: enrichedDemoMatches.length,
        escalated: enrichedDemoMatches.length === 0,
        isDemoSimulation: true,
        demoDisclaimer: DEMO_DISCLAIMER,
      });
    }

    // Real Production Mode (Verified database only)
    const newRequest: BloodRequest = {
      id: `req_${Date.now()}`,
      hospitalName,
      bloodGroup,
      unitsNeeded,
      urgency,
      location,
      status: "open",
      createdAt: new Date().toISOString(),
    };

    // Load verified active candidates from database
    const dbDonors = await getDonors();
    const dbBankUnits = await getBankUnits({ excludeExpired: true });

    // Persist real request to database
    await addRequest(newRequest);

    const matches = matchRequest(newRequest, {
      donors: dbDonors,
      bankUnits: dbBankUnits,
    });

    const enrichedMatches = matches.map((m) => {
      let sourceLoc = null;
      if (m.sourceType === "donor") {
        const d = dbDonors.find((item) => item.id === m.sourceId);
        if (d) sourceLoc = d.location;
      } else {
        const u = dbBankUnits.find((item) => item.id === m.sourceId);
        if (u) sourceLoc = u.location;
      }
      return {
        ...m,
        location: sourceLoc,
        is_demo: false,
      };
    });

    return apiSuccess({
      request: newRequest,
      matches: enrichedMatches,
      realMatches: enrichedMatches,
      demoMatches: [],
      realMatchCount: enrichedMatches.length,
      demoMatchCount: 0,
      escalated: enrichedMatches.length === 0,
      isDemoSimulation: false,
    });
  } catch (err: any) {
    console.error("POST /api/match error:", err);
    return apiError(
      "Failed to process emergency blood match.",
      "INTERNAL_SERVER_ERROR",
      500
    );
  }
}
