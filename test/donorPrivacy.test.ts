import test from "node:test";
import assert from "node:assert";
import {
  maskPhoneNumber,
  approximateLocation,
  sanitizeDonorForPublic,
  sanitizeDonorsForPublic,
} from "../lib/donorPrivacy.ts";
import type { Donor } from "../lib/types.ts";

test("maskPhoneNumber: correctly masks digits", () => {
  const masked1 = maskPhoneNumber("+91 98765 43210");
  assert.strictEqual(masked1, "+91 ••••• ••210");
  assert.ok(!masked1.includes("98765"));

  const masked2 = maskPhoneNumber("9876543210");
  assert.strictEqual(masked2, "••••• ••210");

  const maskedShort = maskPhoneNumber("123");
  assert.strictEqual(maskedShort, "••••");
});

test("approximateLocation: rounds coordinates to 2 decimal places and sanitizes street addresses", () => {
  const rawLocation = {
    lat: 28.6139485,
    lng: 77.2090212,
    label: "Flat 402, Street 12, South Extension, New Delhi",
  };

  const approx = approximateLocation(rawLocation);
  assert.strictEqual(approx.lat, 28.61);
  assert.strictEqual(approx.lng, 77.21);
  assert.strictEqual(approx.isApproximate, true);
  assert.ok(!approx.label.includes("Flat 402"));
  assert.ok(!approx.label.includes("Street 12"));
});

test("sanitizeDonorForPublic: strips raw phone number and obfuscates location", () => {
  const donor: Donor = {
    id: "d_test_1",
    name: "Dr. Alok Verma",
    phone: "+91 98111 22233",
    bloodGroup: "O+",
    location: {
      lat: 28.535512,
      lng: 77.283145,
      label: "House 15, Sarita Vihar, Delhi",
    },
    available: true,
    reliabilityScore: 0.85,
    lastDonationDate: "2026-05-10",
  };

  const publicDonor = sanitizeDonorForPublic(donor);

  // Assert that raw phone property is NOT present
  assert.strictEqual((publicDonor as any).phone, undefined);
  // Assert that masked phone is present and sanitized
  assert.strictEqual(publicDonor.phoneMasked, "+91 ••••• ••233");
  // Assert coordinates are rounded
  assert.strictEqual(publicDonor.location.lat, 28.54);
  assert.strictEqual(publicDonor.location.lng, 77.28);
  assert.strictEqual(publicDonor.location.isApproximate, true);
});

test("sanitizeDonorsForPublic: batch sanitizes array of donors", () => {
  const donors: Donor[] = [
    {
      id: "d1",
      name: "Donor One",
      phone: "+91 91111 11111",
      bloodGroup: "A+",
      location: { lat: 28.12345, lng: 77.54321, label: "Area 1" },
      available: true,
      reliabilityScore: 0,
      lastDonationDate: "2026-01-01",
    },
    {
      id: "d2",
      name: "Donor Two",
      phone: "+91 92222 22222",
      bloodGroup: "B-",
      location: { lat: 28.98765, lng: 77.12345, label: "Area 2" },
      available: true,
      reliabilityScore: 0,
      lastDonationDate: "2026-02-01",
    },
  ];

  const sanitized = sanitizeDonorsForPublic(donors);
  assert.strictEqual(sanitized.length, 2);
  sanitized.forEach((d) => {
    assert.strictEqual((d as any).phone, undefined);
    assert.ok(d.phoneMasked.includes("•••••"));
    assert.strictEqual(d.location.isApproximate, true);
  });
});
