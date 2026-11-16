import test from "node:test";
import assert from "node:assert";
import {
  extractBearerToken,
  resolveServerRole,
  sanitizeSelfRegistrationRole,
} from "../lib/serverAuth.ts";
import type { User } from "@supabase/supabase-js";

function createMockRequest(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] || null;
      },
    },
    cookies: {
      get(name: string) {
        return null;
      },
    },
  } as any;
}

test("extractBearerToken: extracts token from standard Authorization header", () => {
  const reqWithToken = createMockRequest({
    authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legit-token",
  });
  const token = extractBearerToken(reqWithToken);
  assert.strictEqual(token, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.legit-token");

  const reqWithoutToken = createMockRequest({});
  assert.strictEqual(extractBearerToken(reqWithoutToken), null);
});

test("REGRESSION TEST: x-test-user-id and x-test-role headers CANNOT authenticate a user", () => {
  const backdoorAttempt = createMockRequest({
    "x-test-user-id": "hacker_admin",
    "x-test-role": "admin",
  });
  const token = extractBearerToken(backdoorAttempt);
  // Must return null: test headers must never produce an auth token
  assert.strictEqual(token, null);
});

test("resolveServerRole: STRICTLY IGNORES client-supplied user_metadata.role", () => {
  // Attacker created user with raw_user_meta_data = { role: "admin" }
  const maliciousUser: User = {
    id: "usr_attacker",
    email: "attacker@evil.com",
    app_metadata: {}, // Server app_metadata has no role
    user_metadata: { role: "admin" }, // Attacker-injected role
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const resolved = resolveServerRole(maliciousUser);
  // Must resolve to "donor", NOT "admin"!
  assert.strictEqual(resolved.role, "donor");
  assert.strictEqual(resolved.isVerifiedFacility, false);
});

test("resolveServerRole: grants elevated role ONLY from trusted server-controlled app_metadata", () => {
  const verifiedAdmin: User = {
    id: "usr_admin",
    email: "admin@lifeline.gov",
    app_metadata: { role: "admin", is_verified: true },
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const resolved = resolveServerRole(verifiedAdmin);
  assert.strictEqual(resolved.role, "admin");
  assert.strictEqual(resolved.isVerifiedFacility, true);
});

test("resolveServerRole: unverified hospital role has isVerifiedFacility=false", () => {
  const unverifiedHospital: User = {
    id: "usr_hosp_unverified",
    email: "hosp@clinic.com",
    app_metadata: { role: "hospital", is_verified: false },
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  };

  const resolved = resolveServerRole(unverifiedHospital);
  assert.strictEqual(resolved.role, "hospital");
  assert.strictEqual(resolved.isVerifiedFacility, false);
});

test("sanitizeSelfRegistrationRole: sanitizes self-registration roles", () => {
  assert.strictEqual(sanitizeSelfRegistrationRole("admin"), "donor");
  assert.strictEqual(sanitizeSelfRegistrationRole("hospital"), "hospital");
  assert.strictEqual(sanitizeSelfRegistrationRole("bank"), "bank");
  assert.strictEqual(sanitizeSelfRegistrationRole("unknown"), "donor");
});
