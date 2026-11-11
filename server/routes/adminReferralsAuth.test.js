// Authorization guard tests for the Super Admin referral routes (incl. the new
// POST /api/admin/referrals/credit). These exercise requireSuperAdmin's
// rejection paths, which return BEFORE any database query, so no DB is touched.
// A dummy DATABASE_URL only satisfies the import-time check in lib/prisma.js.
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://u:p@localhost:5432/none";
process.env.JWT_SECRET = "test-secret-referrals";

import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

import { requireSuperAdmin } from "./../middleware/adminAuth.js";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function run(req) {
  const res = mockRes();
  let nextCalled = false;
  await requireSuperAdmin(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("rejects an unauthenticated request with 401 (no token)", async () => {
  const { res, nextCalled } = await run({ headers: {}, cookies: {} });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(res.body.success, false);
});

test("rejects a valid non-super-admin token with 401 (CLIENT_ADMIN)", async () => {
  const token = jwt.sign({ sub: "user-1", role: "CLIENT_ADMIN" }, process.env.JWT_SECRET, {
    algorithm: "HS256",
  });
  const { res, nextCalled } = await run({ headers: { authorization: `Bearer ${token}` }, cookies: {} });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects a MANAGER token with 401", async () => {
  const token = jwt.sign({ sub: "user-2", role: "MANAGER" }, process.env.JWT_SECRET, { algorithm: "HS256" });
  const { res, nextCalled } = await run({ headers: { authorization: `Bearer ${token}` }, cookies: {} });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects a malformed / forged token with 401", async () => {
  const { res, nextCalled } = await run({ headers: { authorization: "Bearer not-a-real-jwt" }, cookies: {} });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});

test("rejects a token signed with the wrong secret with 401", async () => {
  const token = jwt.sign({ sub: "user-3", role: "SUPER_ADMIN" }, "attacker-secret", { algorithm: "HS256" });
  const { res, nextCalled } = await run({ headers: { authorization: `Bearer ${token}` }, cookies: {} });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});
