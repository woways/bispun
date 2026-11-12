import { test } from "node:test";
import assert from "node:assert/strict";

import { parseNotificationTarget } from "./notificationTarget.js";

test("plain module key yields module and no leadId", () => {
  assert.deepEqual(parseNotificationTarget("lead-store"), {
    moduleKey: "lead-store",
    leadId: null,
  });
});

test("encoded actionModule yields the lead id", () => {
  assert.deepEqual(parseNotificationTarget("lead-store#lead:abc123"), {
    moduleKey: "lead-store",
    leadId: "abc123",
  });
});

test("lead id with special chars (cuid) is preserved", () => {
  assert.deepEqual(parseNotificationTarget("lead-store#lead:ckr_9-ZzZ"), {
    moduleKey: "lead-store",
    leadId: "ckr_9-ZzZ",
  });
});

test("falls back to the message marker when actionModule has no target", () => {
  const out = parseNotificationTarget(
    "lead-store",
    "Follow up today: Jane. LEAD_FOLLOWUP:lead-77:20261109:TODAY"
  );
  assert.deepEqual(out, { moduleKey: "lead-store", leadId: "lead-77" });
});

test("actionModule target wins over message marker", () => {
  const out = parseNotificationTarget(
    "lead-store#lead:fromModule",
    "LEAD_FOLLOWUP:fromMessage:x:TODAY"
  );
  assert.equal(out.leadId, "fromModule");
});

test("empty/garbage input is safe", () => {
  assert.deepEqual(parseNotificationTarget(null), { moduleKey: "", leadId: null });
  assert.deepEqual(parseNotificationTarget(""), { moduleKey: "", leadId: null });
  assert.deepEqual(parseNotificationTarget("settings"), {
    moduleKey: "settings",
    leadId: null,
  });
});
