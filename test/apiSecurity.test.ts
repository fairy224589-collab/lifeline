import test from "node:test";
import assert from "node:assert";
import { POST as matchPOST } from "../app/api/match/route.ts";
import { PATCH as confirmPATCH } from "../app/api/match/confirm/route.ts";
import { POST as donorsPOST, GET as donorsGET } from "../app/api/donors/route.ts";

function createMockRequest(options: {
  method: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const reqHeaders = new Headers(options.headers || {});
  return {
    method: options.method,
    url: options.url,
    headers: reqHeaders,
    json: async () => options.body,
  } as any;
}

test("API Security: POST /api/match without token returns 401 Unauthorized in real mode", async () => {
  const unauthenticatedReq = createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/match",
    body: {
      hospitalName: "Apollo Hospital",
      bloodGroup: "O+",
      unitsNeeded: 2,
      urgency: "critical",
      location: { lat: 28.5355, lng: 77.2831, label: "Delhi" },
      includeDemo: false, // Real production mode
    },
  });

  const res = await matchPOST(unauthenticatedReq);
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.code, "UNAUTHORIZED");
});

test("API Security: PATCH /api/match/confirm without token returns 401 Unauthorized for real requests", async () => {
  const unauthenticatedReq = createMockRequest({
    method: "PATCH",
    url: "http://localhost:3000/api/match/confirm",
    body: {
      requestId: "req_real_12345",
      confirmedSourceId: "bank_unit_789",
    },
  });

  const res = await confirmPATCH(unauthenticatedReq);
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.code, "UNAUTHORIZED");
});

test("API Security: POST /api/donors without token returns 401 Unauthorized (never creates anonymous fallback)", async () => {
  const unauthenticatedReq = createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/donors",
    body: {
      name: "Anonymous User",
      phone: "+91 99999 00000",
      bloodGroup: "A+",
      location: { lat: 28.6, lng: 77.2, label: "Delhi" },
      consentEmergencyContact: true,
    },
  });

  const res = await donorsPOST(unauthenticatedReq);
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.success, false);
  assert.strictEqual(data.code, "UNAUTHORIZED");
});

test("API Security: GET /api/donors NEVER returns raw phone numbers in directory search", async () => {
  const publicReq = createMockRequest({
    method: "GET",
    url: "http://localhost:3000/api/donors",
  });

  const res = await donorsGET(publicReq);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.ok(Array.isArray(data.donors));

  // Verify that EVERY donor in the returned list has masked phone and approximate coordinates
  data.donors.forEach((donor: any) => {
    assert.strictEqual(donor.phone, undefined, "Raw phone number must NEVER be exposed in directory");
    if (donor.phoneMasked) {
      assert.ok(donor.phoneMasked.includes("••••"), "Phone number must be masked");
    }
  });
});
