import test from "node:test";
import assert from "node:assert";
import { POST as matchPOST } from "../app/api/match/route.ts";
import { GET as banksGET } from "../app/api/banks/route.ts";
import { PATCH as confirmPATCH } from "../app/api/match/confirm/route.ts";
import { demoStore, isDemoId } from "../lib/demoData.ts";

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

test("Demo Isolation: POST /api/match with includeDemo=true operates purely in-memory and returns demoMatches", async () => {
  demoStore.clear();

  const demoReq = createMockRequest({
    method: "POST",
    url: "http://localhost:3000/api/match",
    body: {
      hospitalName: "College Demo Hospital",
      bloodGroup: "O-",
      unitsNeeded: 1,
      urgency: "high",
      location: { lat: 28.6139, lng: 77.209, label: "Presentation Hall" },
      includeDemo: true, // Demo simulation mode
    },
  });

  const res = await matchPOST(demoReq);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.isDemoSimulation, true);
  assert.ok(data.request.id.startsWith("demo_req_"));

  // Verify that the request is saved in the demoStore memory store
  const stored = demoStore.getRequest(data.request.id);
  assert.ok(stored !== null, "Demo request must be saved in isolated in-memory demoStore");
  assert.strictEqual(stored?.hospitalName, "[DEMO] College Demo Hospital");

  // Verify that realMatches is empty and demoMatches are populated
  assert.strictEqual(data.realMatchCount, 0);
  assert.ok(data.demoMatchCount > 0);
});

test("Demo Isolation: GET /api/banks NEVER mixes demo units into real bankUnits array", async () => {
  const req = createMockRequest({
    method: "GET",
    url: "http://localhost:3000/api/banks?includeDemo=true",
  });

  const res = await banksGET(req);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);

  // Assert that bankUnits does not contain any demo units
  data.bankUnits.forEach((unit: any) => {
    assert.strictEqual(isDemoId(unit.id), false, "Real bankUnits must NEVER contain demo units");
    assert.strictEqual(unit.is_demo, undefined);
  });

  // Assert that demoBankUnits is returned as a separate property
  assert.ok(Array.isArray(data.demoBankUnits));
  data.demoBankUnits.forEach((unit: any) => {
    assert.strictEqual(unit.is_demo, true);
    assert.ok(isDemoId(unit.id));
  });
});

test("Demo Isolation: PATCH /api/match/confirm routes demo confirmations strictly to demoStore", async () => {
  demoStore.clear();

  const demoConfirmReq = createMockRequest({
    method: "PATCH",
    url: "http://localhost:3000/api/match/confirm",
    body: {
      requestId: "demo_req_9999",
      confirmedSourceId: "demo_unit_0",
    },
  });

  const res = await confirmPATCH(demoConfirmReq);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.is_demo, true);
  assert.strictEqual(data.status, "confirmed");
});
