import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateDeletionRequest,
  buildDeletionRequestEmail,
  DELETION_POLICY_TEXT,
  DELETION_STATUSES,
  normalizeDeletionStatus,
  buildDeletionRecordData,
} from "./accountDeletion.js";

test("valid request normalizes email (trim+lowercase) and trims reason", () => {
  const r = validateDeletionRequest({ email: "  User@Example.COM ", reason: "  please delete  " });
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
  assert.equal(r.normalized.email, "user@example.com");
  assert.equal(r.normalized.reason, "please delete");
});

test("reason is optional", () => {
  const r = validateDeletionRequest({ email: "a@b.com" });
  assert.equal(r.ok, true);
  assert.equal(r.normalized.reason, "");
});

test("missing or malformed email fails", () => {
  assert.equal(validateDeletionRequest({ email: "" }).ok, false);
  assert.equal(validateDeletionRequest({ email: "not-an-email" }).ok, false);
  assert.equal(validateDeletionRequest({}).ok, false);
});

test("over-long reason fails with a clear error", () => {
  const r = validateDeletionRequest({ email: "a@b.com", reason: "x".repeat(2001) });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /reason/i.test(e)));
});

test("buildDeletionRequestEmail includes requester email, source, and reason; no undefined", () => {
  const { subject, text } = buildDeletionRequestEmail({
    email: "user@example.com",
    reason: "leaving",
    source: "public",
  });
  assert.match(subject, /account deletion/i);
  assert.match(text, /user@example\.com/);
  assert.match(text, /public/);
  assert.match(text, /leaving/);
  assert.doesNotMatch(text, /undefined/);
});

test("buildDeletionRequestEmail notes verified identity for in-app requests", () => {
  const { text } = buildDeletionRequestEmail({
    email: "emp@example.com",
    reason: "",
    source: "in-app",
    actor: { userId: "u1", companyId: "c1", role: "CLIENT_ADMIN" },
  });
  assert.match(text, /in-app/);
  assert.match(text, /c1/); // company context present for processing
  assert.match(text, /verified/i);
});

test("DELETION_POLICY_TEXT describes deletion, retention and processing", () => {
  assert.match(DELETION_POLICY_TEXT, /delet/i);
  assert.match(DELETION_POLICY_TEXT, /retain|retention|legal|billing/i);
});

test("normalizeDeletionStatus accepts known statuses and falls back otherwise", () => {
  assert.deepEqual(DELETION_STATUSES, ["PENDING", "VERIFIED", "PROCESSED", "REJECTED"]);
  assert.equal(normalizeDeletionStatus("processed"), "PROCESSED");
  assert.equal(normalizeDeletionStatus("REJECTED"), "REJECTED");
  assert.equal(normalizeDeletionStatus("bogus"), "PENDING");
  assert.equal(normalizeDeletionStatus("", "VERIFIED"), "VERIFIED");
});

test("buildDeletionRecordData shapes a public request (no company/user)", () => {
  const data = buildDeletionRecordData({
    email: "user@example.com",
    reason: "leaving",
    source: "public",
  });
  assert.equal(data.email, "user@example.com");
  assert.equal(data.reason, "leaving");
  assert.equal(data.source, "public");
  assert.equal(data.status, "PENDING");
  assert.equal(data.companyId, null);
  assert.equal(data.userId, null);
});

test("buildDeletionRecordData carries verified identity for in-app requests", () => {
  const data = buildDeletionRecordData({
    email: "emp@example.com",
    reason: "",
    source: "in-app",
    actor: { userId: "u1", companyId: "c1", role: "CLIENT_ADMIN" },
  });
  assert.equal(data.source, "in-app");
  assert.equal(data.companyId, "c1");
  assert.equal(data.userId, "u1");
  assert.equal(data.status, "PENDING");
  assert.equal(data.reason, null); // empty reason stored as null
});
