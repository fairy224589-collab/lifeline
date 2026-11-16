import test from "node:test";
import assert from "node:assert";
import { apiSuccess, apiError } from "../lib/apiResponse.ts";

test("apiSuccess: formats success response with HTTP status", async () => {
  const response = apiSuccess({ donors: [] }, 200);
  assert.strictEqual(response.status, 200);

  const json = await response.json();
  assert.strictEqual(json.success, true);
  assert.deepStrictEqual(json.donors, []);
});

test("apiError: formats error response with error code, message and status", async () => {
  const response = apiError(
    "Invalid payload",
    "VALIDATION_ERROR",
    400,
    ["field 'name' is required"]
  );
  assert.strictEqual(response.status, 400);

  const json = await response.json();
  assert.strictEqual(json.success, false);
  assert.strictEqual(json.error, "Invalid payload");
  assert.strictEqual(json.code, "VALIDATION_ERROR");
  assert.deepStrictEqual(json.details, ["field 'name' is required"]);
});

test("apiError: handles conflict and unauthorized statuses correctly", async () => {
  const conflict = apiError("Already confirmed", "CONFLICT", 409);
  assert.strictEqual(conflict.status, 409);
  const conflictJson = await conflict.json();
  assert.strictEqual(conflictJson.code, "CONFLICT");

  const unauth = apiError("Authentication required", "UNAUTHORIZED", 401);
  assert.strictEqual(unauth.status, 401);
  const unauthJson = await unauth.json();
  assert.strictEqual(unauthJson.code, "UNAUTHORIZED");
});
