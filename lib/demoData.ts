import type { Donor, BankInventoryUnit, Location, BloodRequest } from "./types.ts";

export interface DemoDonor extends Donor {
  is_demo: true;
  demo_disclaimer: string;
}

export interface DemoBankInventoryUnit extends BankInventoryUnit {
  is_demo: true;
  demo_disclaimer: string;
}

export const DEMO_DISCLAIMER =
  "SIMULATED DATA FOR TESTING & DEMONSTRATION ONLY — NOT REAL DONOR OR HOSPITAL AVAILABILITY";

/**
 * In-memory simulation store for demonstration and offline college presentations.
 * Completely isolated from real production database tables.
 */
class DemoSimulationStore {
  private demoRequests: Map<string, BloodRequest> = new Map();
  private demoReservations: Map<string, { requestId: string; unitId: string; lockedAt: string }> = new Map();

  saveRequest(req: BloodRequest): BloodRequest {
    const demoReq: BloodRequest = {
      ...req,
      id: req.id.startsWith("demo_req_") ? req.id : `demo_req_${Date.now()}`,
    };
    this.demoRequests.set(demoReq.id, demoReq);
    return demoReq;
  }

  getRequest(id: string): BloodRequest | null {
    return this.demoRequests.get(id) || null;
  }

  confirmReservation(requestId: string, confirmedSourceId: string) {
    const existingReq = this.demoRequests.get(requestId);
    if (!existingReq) {
      // Create on the fly if needed for frontend demo tests
      const syntheticReq: BloodRequest = {
        id: requestId,
        hospitalName: "[DEMO] Presentation Hospital",
        bloodGroup: "O+",
        unitsNeeded: 1,
        urgency: "high",
        location: { lat: 28.6139, lng: 77.209, label: "Presentation Center" },
        status: "confirmed",
        createdAt: new Date().toISOString(),
      };
      this.demoRequests.set(requestId, syntheticReq);
    } else {
      existingReq.status = "confirmed";
    }

    const reservation = {
      requestId,
      unitId: confirmedSourceId,
      lockedAt: new Date().toISOString(),
    };
    this.demoReservations.set(requestId, reservation);

    return {
      success: true,
      requestId,
      confirmedSourceId,
      status: "confirmed",
      lockedAt: reservation.lockedAt,
      is_demo: true,
      demo_disclaimer: DEMO_DISCLAIMER,
      message: "Simulation lock applied in isolated memory store. No live inventory affected.",
    };
  }

  clear() {
    this.demoRequests.clear();
    this.demoReservations.clear();
  }
}

export const demoStore = new DemoSimulationStore();

/**
 * Generates synthetic candidates around a specific coordinate for UI demonstrations.
 * Every entity is strictly tagged with `is_demo: true` and prefixed with [DEMO].
 */
export function generateRegionalDemoCandidates(location: Location): {
  demoDonors: DemoDonor[];
  demoBankUnits: DemoBankInventoryUnit[];
} {
  const offsets = [
    { name: "[DEMO] Regional Red Cross Blood Bank", type: "bank", dLat: 0.018, dLng: -0.015, bg: "O+", units: 5, days: 6 },
    { name: "[DEMO] District General Hospital Reserve", type: "bank", dLat: -0.024, dLng: 0.021, bg: "B+", units: 3, days: 14 },
    { name: "[DEMO] City Care Blood Center", type: "bank", dLat: 0.035, dLng: 0.012, bg: "A+", units: 4, days: 22 },
    { name: "[DEMO] Volunteer Donor Alpha", type: "donor", dLat: -0.012, dLng: -0.009, bg: "O-", reliability: 0.95 },
    { name: "[DEMO] Volunteer Donor Beta", type: "donor", dLat: 0.015, dLng: 0.025, bg: "B+", reliability: 0.88 },
    { name: "[DEMO] Volunteer Donor Gamma", type: "donor", dLat: -0.029, dLng: 0.018, bg: "A-", reliability: 0.91 },
    { name: "[DEMO] Volunteer Donor Delta", type: "donor", dLat: 0.008, dLng: -0.032, bg: "AB+", reliability: 0.85 },
  ];

  const demoDonors: DemoDonor[] = [];
  const demoBankUnits: DemoBankInventoryUnit[] = [];

  offsets.forEach((item, idx) => {
    const candLocation: Location = {
      lat: Number((location.lat + item.dLat).toFixed(4)),
      lng: Number((location.lng + item.dLng).toFixed(4)),
      label: `[DEMO Area] Near ${location.label.split(",")[0]}`,
    };

    if (item.type === "donor") {
      demoDonors.push({
        id: `demo_donor_${idx}`,
        name: item.name,
        phone: "+91 00000 0000" + idx, // Non-routable dummy number
        bloodGroup: item.bg as any,
        location: candLocation,
        available: true,
        reliabilityScore: item.reliability || 0.85,
        lastDonationDate: "2026-06-15",
        is_demo: true,
        demo_disclaimer: DEMO_DISCLAIMER,
      });
    } else {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + (item.days || 15));
      demoBankUnits.push({
        id: `demo_unit_${idx}`,
        bankId: `demo_bank_${idx}`,
        bankName: item.name,
        location: candLocation,
        bloodGroup: item.bg as any,
        unitsAvailable: item.units || 4,
        expiryDate: expDate.toISOString(),
        is_demo: true,
        demo_disclaimer: DEMO_DISCLAIMER,
      });
    }
  });

  return { demoDonors, demoBankUnits };
}

/**
 * Guards against demo records being persisted or confirmed in production database tables.
 */
export function isDemoId(id: string): boolean {
  if (typeof id !== "string") return false;
  return id.startsWith("demo_") || id.startsWith("dyn_");
}
