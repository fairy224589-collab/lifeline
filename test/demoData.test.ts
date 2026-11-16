import test from "node:test";
import assert from "node:assert";
import {
  generateRegionalDemoCandidates,
  isDemoId,
  DEMO_DISCLAIMER,
} from "../lib/demoData.ts";

test("generateRegionalDemoCandidates: produces segregated demo entities with required tags", () => {
  const center = { lat: 28.6139, lng: 77.209, label: "Delhi Central" };
  const { demoDonors, demoBankUnits } = generateRegionalDemoCandidates(center);

  assert.ok(demoDonors.length > 0);
  assert.ok(demoBankUnits.length > 0);

  demoDonors.forEach((d) => {
    assert.strictEqual(d.is_demo, true);
    assert.strictEqual(d.demo_disclaimer, DEMO_DISCLAIMER);
    assert.ok(d.name.startsWith("[DEMO]"));
    assert.ok(d.id.startsWith("demo_donor_"));
    // Dummy non-routable phone
    assert.ok(d.phone.startsWith("+91 00000 0000"));
  });

  demoBankUnits.forEach((b) => {
    assert.strictEqual(b.is_demo, true);
    assert.strictEqual(b.demo_disclaimer, DEMO_DISCLAIMER);
    assert.ok(b.bankName.startsWith("[DEMO]"));
    assert.ok(b.id.startsWith("demo_unit_"));
  });
});

test("isDemoId: correctly identifies simulated vs real IDs", () => {
  assert.strictEqual(isDemoId("demo_donor_0"), true);
  assert.strictEqual(isDemoId("demo_unit_1"), true);
  assert.strictEqual(isDemoId("dyn_d_0"), true);
  assert.strictEqual(isDemoId("dyn_b_0"), true);
  assert.strictEqual(isDemoId("user_uuid_1234"), false);
  assert.strictEqual(isDemoId("bank_inventory_55"), false);
});
