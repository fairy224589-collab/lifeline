import test from "node:test";
import assert from "node:assert";
import { isCompatible, distanceKm, matchRequest } from "../lib/matchingEngine.ts";
import type { BloodRequest, Donor, BankInventoryUnit } from "../lib/types.ts";

test("isCompatible: validates ABO and Rh compatibility rules correctly", () => {
  // Recipient O- can only receive from O-
  assert.strictEqual(isCompatible("O-", "O-"), true);
  assert.strictEqual(isCompatible("O-", "O+"), false); // Rh- recipient cannot receive from Rh+

  // Recipient O+ can receive from O- and O+
  assert.strictEqual(isCompatible("O+", "O-"), true);
  assert.strictEqual(isCompatible("O+", "O+"), true);

  // Recipient A+ can receive from O- and A+
  assert.strictEqual(isCompatible("A+", "O-"), true);
  assert.strictEqual(isCompatible("A+", "A+"), true);

  // Recipient AB+ (universal recipient) can receive from any group
  assert.strictEqual(isCompatible("AB+", "O-"), true);
  assert.strictEqual(isCompatible("AB+", "A-"), true);
  assert.strictEqual(isCompatible("AB+", "B+"), true);
  assert.strictEqual(isCompatible("AB+", "AB+"), true);

  // Incompatibilities: Recipient cannot receive incompatible antigens
  assert.strictEqual(isCompatible("A+", "B+"), false);
  assert.strictEqual(isCompatible("B+", "A+"), false);
  assert.strictEqual(isCompatible("O+", "AB+"), false);
});

test("distanceKm: computes distance accurately using Haversine formula", () => {
  // Sarita Vihar, Delhi: 28.5355, 77.2831
  // Connaught Place, Delhi: 28.6315, 77.2167
  const dist = distanceKm(28.5355, 77.2831, 28.6315, 77.2167);
  // Distance should be roughly 12-14 km
  assert.ok(dist > 10 && dist < 16, `Distance should be ~12-14km, got ${dist}`);
});

test("matchRequest: ranks compatible candidates by urgency, proximity, reliability", () => {
  const request: BloodRequest = {
    id: "req_test",
    hospitalName: "City Hospital",
    location: { lat: 28.6139, lng: 77.209, label: "Center" },
    bloodGroup: "A+",
    unitsNeeded: 2,
    urgency: "critical",
    status: "open",
    createdAt: new Date().toISOString(),
  };

  const donors: Donor[] = [
    {
      id: "d_close",
      name: "Close Donor",
      phone: "+91 99999 11111",
      bloodGroup: "A+",
      location: { lat: 28.615, lng: 77.21, label: "Close" }, // ~0.2 km
      available: true,
      reliabilityScore: 0.9,
      lastDonationDate: "2026-05-01",
    },
    {
      id: "d_far",
      name: "Far Donor",
      phone: "+91 99999 22222",
      bloodGroup: "A+",
      location: { lat: 28.9, lng: 77.5, label: "Far" }, // ~40 km
      available: true,
      reliabilityScore: 0.9,
      lastDonationDate: "2026-05-01",
    },
    {
      id: "d_incompatible",
      name: "Incompatible Donor",
      phone: "+91 99999 33333",
      bloodGroup: "B+", // Incompatible with A+ recipient
      location: { lat: 28.615, lng: 77.21, label: "Close" },
      available: true,
      reliabilityScore: 1.0,
      lastDonationDate: "2026-05-01",
    },
  ];

  const bankUnits: BankInventoryUnit[] = [];

  const matches = matchRequest(request, { donors, bankUnits });

  // Incompatible donor should be excluded
  assert.ok(!matches.some((m) => m.sourceId === "d_incompatible"));

  // Close donor should score higher than far donor
  assert.strictEqual(matches.length, 2);
  assert.strictEqual(matches[0].sourceId, "d_close");
  assert.ok(matches[0].score > matches[1].score);
});
