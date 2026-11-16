import test from "node:test";
import assert from "node:assert";
import {
  DonorRegistrationSchema,
  BloodRequestCreateSchema,
  MatchConfirmSchema,
  sanitizeSelfRegistrationRole,
} from "../lib/validations.ts";

test("DonorRegistrationSchema: accepts valid donor registration payload", () => {
  const valid = {
    name: "John Doe",
    phone: "+91 98765 43210",
    bloodGroup: "O+",
    location: {
      lat: 28.6139,
      lng: 77.209,
      label: "Connaught Place, New Delhi",
    },
    available: true,
    consentEmergencyContact: true,
  };
  const result = DonorRegistrationSchema.safeParse(valid);
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.name, "John Doe");
    assert.strictEqual(result.data.bloodGroup, "O+");
    assert.strictEqual(result.data.consentEmergencyContact, true);
  }
});

test("DonorRegistrationSchema: rejects registration without explicit consent", () => {
  const noConsent = {
    name: "John Doe",
    phone: "+91 98765 43210",
    bloodGroup: "O+",
    location: { lat: 28.6, lng: 77.2, label: "Delhi" },
    consentEmergencyContact: false,
  };
  const result = DonorRegistrationSchema.safeParse(noConsent);
  assert.strictEqual(result.success, false);
});

test("DonorRegistrationSchema: rejects invalid blood group", () => {
  const invalid = {
    name: "John Doe",
    phone: "+91 98765 43210",
    bloodGroup: "XYZ", // Invalid
    location: { lat: 28.6, lng: 77.2, label: "Delhi" },
  };
  const result = DonorRegistrationSchema.safeParse(invalid);
  assert.strictEqual(result.success, false);
});

test("DonorRegistrationSchema: rejects out-of-bounds coordinates", () => {
  const invalid = {
    name: "John Doe",
    phone: "+91 98765 43210",
    bloodGroup: "A+",
    location: { lat: 105.0, lng: 77.2, label: "Invalid Lat" }, // Lat > 90
  };
  const result = DonorRegistrationSchema.safeParse(invalid);
  assert.strictEqual(result.success, false);
});

test("DonorRegistrationSchema: rejects invalid phone number", () => {
  const invalid = {
    name: "John Doe",
    phone: "abc-not-a-number",
    bloodGroup: "B+",
    location: { lat: 28.6, lng: 77.2, label: "Delhi" },
  };
  const result = DonorRegistrationSchema.safeParse(invalid);
  assert.strictEqual(result.success, false);
});

test("BloodRequestCreateSchema: accepts valid request payload", () => {
  const valid = {
    hospitalName: "Apollo Hospital",
    bloodGroup: "AB-",
    unitsNeeded: 3,
    urgency: "critical",
    location: { lat: 28.5355, lng: 77.2831, label: "Sarita Vihar, Delhi" },
    includeDemo: false,
  };
  const result = BloodRequestCreateSchema.safeParse(valid);
  assert.strictEqual(result.success, true);
});

test("BloodRequestCreateSchema: rejects invalid unit numbers (0 or >50)", () => {
  const zeroUnits = {
    hospitalName: "Apollo Hospital",
    bloodGroup: "O+",
    unitsNeeded: 0,
    urgency: "high",
    location: { lat: 28.5, lng: 77.2, label: "Delhi" },
  };
  assert.strictEqual(BloodRequestCreateSchema.safeParse(zeroUnits).success, false);

  const excessiveUnits = {
    ...zeroUnits,
    unitsNeeded: 100, // max 50
  };
  assert.strictEqual(BloodRequestCreateSchema.safeParse(excessiveUnits).success, false);
});

test("MatchConfirmSchema: validates confirmation parameters", () => {
  const valid = {
    requestId: "req_1234567890",
    confirmedSourceId: "bank_unit_42",
  };
  assert.strictEqual(MatchConfirmSchema.safeParse(valid).success, true);

  const emptySource = {
    requestId: "req_1234567890",
    confirmedSourceId: "",
  };
  assert.strictEqual(MatchConfirmSchema.safeParse(emptySource).success, false);
});

test("sanitizeSelfRegistrationRole: prevents privilege escalation to admin", () => {
  assert.strictEqual(sanitizeSelfRegistrationRole("admin"), "donor");
  assert.strictEqual(sanitizeSelfRegistrationRole("superadmin"), "donor");
  assert.strictEqual(sanitizeSelfRegistrationRole("hospital"), "hospital");
  assert.strictEqual(sanitizeSelfRegistrationRole("bank"), "bank");
  assert.strictEqual(sanitizeSelfRegistrationRole(undefined), "donor");
});
