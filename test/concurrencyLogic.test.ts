import test from "node:test";
import assert from "node:assert";

/**
 * Pure Unit Tests for Reservation and Concurrency Business Logic.
 * NOTE: These test the mathematical and state-transition rules in application memory.
 * Live PostgreSQL row locking (SELECT ... FOR UPDATE) and RLS must be verified
 * against a real Supabase/PostgreSQL instance during Phase 2.
 */

interface MockRequest {
  id: string;
  facilityId: string;
  unitsNeeded: number;
  unitsReserved: number;
  status: "open" | "partially_reserved" | "confirmed" | "fulfilled";
}

interface MockUnit {
  id: string;
  status: "available" | "reserved" | "expired";
  reservedForRequestId?: string;
}

function simulateUnitReservation(
  request: MockRequest,
  unit: MockUnit,
  callerFacilityId: string,
  isAdmin = false
): { success: boolean; newStatus?: MockRequest["status"]; error?: string } {
  // 1. Ownership check
  if (!isAdmin && request.facilityId !== callerFacilityId) {
    return { success: false, error: "Caller does not own this emergency request" };
  }

  // 2. Multi-unit capacity check
  if (request.unitsReserved >= request.unitsNeeded || request.status === "confirmed" || request.status === "fulfilled") {
    return { success: false, error: "Request is already fully reserved" };
  }

  // 3. Unit availability check
  if (unit.status !== "available") {
    return { success: false, error: `Unit is already ${unit.status}` };
  }

  // 4. Apply reservation
  unit.status = "reserved";
  unit.reservedForRequestId = request.id;
  request.unitsReserved += 1;

  if (request.unitsReserved >= request.unitsNeeded) {
    request.status = "confirmed";
  } else {
    request.status = "partially_reserved";
  }

  return { success: true, newStatus: request.status };
}

test("Multi-Unit Reservation Logic: allows partial reservations until unitsNeeded is reached", () => {
  const request: MockRequest = {
    id: "req_multi",
    facilityId: "fac_apollo",
    unitsNeeded: 3,
    unitsReserved: 0,
    status: "open",
  };

  const unit1: MockUnit = { id: "u1", status: "available" };
  const unit2: MockUnit = { id: "u2", status: "available" };
  const unit3: MockUnit = { id: "u3", status: "available" };

  // Reserve Unit 1
  const res1 = simulateUnitReservation(request, unit1, "fac_apollo");
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.newStatus, "partially_reserved");
  assert.strictEqual(request.unitsReserved, 1);
  assert.strictEqual(unit1.status, "reserved");

  // Reserve Unit 2
  const res2 = simulateUnitReservation(request, unit2, "fac_apollo");
  assert.strictEqual(res2.success, true);
  assert.strictEqual(res2.newStatus, "partially_reserved");
  assert.strictEqual(request.unitsReserved, 2);

  // Reserve Unit 3 (Final unit)
  const res3 = simulateUnitReservation(request, unit3, "fac_apollo");
  assert.strictEqual(res3.success, true);
  assert.strictEqual(res3.newStatus, "confirmed");
  assert.strictEqual(request.unitsReserved, 3);

  // Attempting 4th reservation on completed request must fail
  const unit4: MockUnit = { id: "u4", status: "available" };
  const res4 = simulateUnitReservation(request, unit4, "fac_apollo");
  assert.strictEqual(res4.success, false);
  assert.strictEqual(res4.error, "Request is already fully reserved");
  assert.strictEqual(unit4.status, "available"); // Unit untouched
});

test("Duplicate Unit Reservation: prevents reserving the same blood unit twice", () => {
  const request1: MockRequest = {
    id: "req_1",
    facilityId: "fac_apollo",
    unitsNeeded: 1,
    unitsReserved: 0,
    status: "open",
  };
  const request2: MockRequest = {
    id: "req_2",
    facilityId: "fac_max",
    unitsNeeded: 1,
    unitsReserved: 0,
    status: "open",
  };

  const sharedUnit: MockUnit = { id: "u_shared", status: "available" };

  // Hospital 1 reserves the unit
  const first = simulateUnitReservation(request1, sharedUnit, "fac_apollo");
  assert.strictEqual(first.success, true);
  assert.strictEqual(sharedUnit.status, "reserved");
  assert.strictEqual(sharedUnit.reservedForRequestId, "req_1");

  // Hospital 2 attempts to reserve the same unit simultaneously
  const second = simulateUnitReservation(request2, sharedUnit, "fac_max");
  assert.strictEqual(second.success, false);
  assert.strictEqual(second.error, "Unit is already reserved");
  assert.strictEqual(request2.unitsReserved, 0);
});

test("Ownership Verification: rejects reservation attempts from unauthorized facilities", () => {
  const request: MockRequest = {
    id: "req_private",
    facilityId: "fac_aiims",
    unitsNeeded: 2,
    unitsReserved: 0,
    status: "open",
  };
  const unit: MockUnit = { id: "u_test", status: "available" };

  // Rogue hospital facility attempts to reserve AIIMS's request
  const unauthorized = simulateUnitReservation(request, unit, "fac_rogue_clinic");
  assert.strictEqual(unauthorized.success, false);
  assert.strictEqual(unauthorized.error, "Caller does not own this emergency request");
  assert.strictEqual(unit.status, "available"); // Unit left available

  // Admin override is permitted
  const adminOverride = simulateUnitReservation(request, unit, "fac_rogue_clinic", true);
  assert.strictEqual(adminOverride.success, true);
});
