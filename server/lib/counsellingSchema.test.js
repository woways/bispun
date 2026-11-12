// Regression guard for the P1 where server/routes/clientCounselling.js wrote
// `studentAltPhone` to CounsellingSession but the Prisma model lacked the column,
// causing every counselling create/update/phone-search to fail with
// PrismaClientValidationError (HTTP 500).
//
// This test asserts the CounsellingSession model declares every field the
// counselling route persists. It FAILS without the schema fix (studentAltPhone
// missing) and PASSES with it. Pure schema check — no database required.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "..", "..", "prisma", "schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

function modelBlock(name) {
  const m = schema.match(new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(m, `model ${name} not found in schema.prisma`);
  return m[1];
}

// Fields the counselling route (clientCounselling.js) writes on create/update.
const REQUIRED_FIELDS = [
  "companyId", "market", "leadId",
  "studentName", "studentPhone", "studentAltPhone", "studentEmail",
  "course", "counsellorName", "mode", "meetingLink", "accompaniedBy",
  "scheduledAt", "status", "remarks", "followUpAt", "converted",
];

test("CounsellingSession model declares studentAltPhone (P1 regression)", () => {
  const block = modelBlock("CounsellingSession");
  assert.match(block, /\bstudentAltPhone\b/, "CounsellingSession must declare studentAltPhone");
});

test("CounsellingSession model declares every field the route persists", () => {
  const block = modelBlock("CounsellingSession");
  const missing = REQUIRED_FIELDS.filter((f) => !new RegExp(`\\b${f}\\b`).test(block));
  assert.deepEqual(missing, [], `CounsellingSession missing fields used by clientCounselling.js: ${missing.join(", ")}`);
});
