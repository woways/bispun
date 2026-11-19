import { test } from "node:test";
import assert from "node:assert/strict";

import { isTransientDbError, withDbRetry } from "./dbRetry.js";

test("isTransientDbError: true for known transient DB codes", () => {
  for (const code of ["P1001", "P2024", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "P1017"]) {
    assert.equal(isTransientDbError({ code }), true, `code ${code} should be transient`);
  }
});

test("isTransientDbError: true for transient messages", () => {
  assert.equal(isTransientDbError(new Error("Timed out fetching a new connection")), true);
  assert.equal(isTransientDbError(new Error("Can't reach database server at ...")), true);
  assert.equal(isTransientDbError(new Error("Connection terminated unexpectedly")), true);
});

test("isTransientDbError: FALSE for auth/validation/other errors (so they are never retried or masked)", () => {
  assert.equal(isTransientDbError(null), false);
  assert.equal(isTransientDbError(new Error("jwt expired")), false);
  assert.equal(isTransientDbError(new Error("invalid signature")), false);
  assert.equal(isTransientDbError({ code: "P2002" }), false); // unique constraint — a real error, not transient
  assert.equal(isTransientDbError(new Error("Unauthorized")), false);
});

test("withDbRetry: returns immediately on success (no added latency, no retries)", async () => {
  let calls = 0;
  const r = await withDbRetry(async () => { calls += 1; return "ok"; });
  assert.equal(r, "ok");
  assert.equal(calls, 1);
});

test("withDbRetry: retries transient errors then succeeds", async () => {
  let calls = 0;
  const r = await withDbRetry(
    async () => {
      calls += 1;
      if (calls < 3) { const e = new Error("cold start"); e.code = "P1001"; throw e; }
      return "warm";
    },
    { retries: 2, baseDelayMs: 1 }
  );
  assert.equal(r, "warm");
  assert.equal(calls, 3);
});

test("withDbRetry: re-throws a non-transient error WITHOUT retrying", async () => {
  let calls = 0;
  await assert.rejects(
    withDbRetry(async () => { calls += 1; throw new Error("jwt expired"); }, { retries: 2, baseDelayMs: 1 }),
    /jwt expired/
  );
  assert.equal(calls, 1, "non-transient errors must not be retried");
});

test("withDbRetry: gives up after exhausting retries on a persistent transient error", async () => {
  let calls = 0;
  await assert.rejects(
    withDbRetry(async () => { calls += 1; const e = new Error("timeout"); e.code = "P2024"; throw e; }, { retries: 2, baseDelayMs: 1 }),
    /timeout/
  );
  assert.equal(calls, 3); // initial + 2 retries
});
