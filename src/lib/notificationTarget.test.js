import { test } from "node:test";
import assert from "node:assert/strict";

import { parseNotificationTarget } from "./notificationTarget.js";

test("plain module key yields module and no target", () => {
  assert.deepEqual(parseNotificationTarget("lead-store"), {
    moduleKey: "lead-store",
    targetType: null,
    targetId: null,
    leadId: null,
  });
});

test("encoded actionModule yields the lead id (back-compat leadId)", () => {
  assert.deepEqual(parseNotificationTarget("lead-store#lead:abc123"), {
    moduleKey: "lead-store",
    targetType: "lead",
    targetId: "abc123",
    leadId: "abc123",
  });
});

test("lead id with special chars (cuid) is preserved", () => {
  assert.deepEqual(parseNotificationTarget("lead-store#lead:ckr_9-ZzZ"), {
    moduleKey: "lead-store",
    targetType: "lead",
    targetId: "ckr_9-ZzZ",
    leadId: "ckr_9-ZzZ",
  });
});

test("calendar event target is resolved; leadId stays null", () => {
  assert.deepEqual(parseNotificationTarget("calendar#event:evt_123"), {
    moduleKey: "calendar",
    targetType: "event",
    targetId: "evt_123",
    leadId: null,
  });
});

test("support ticket target is resolved; leadId stays null", () => {
  assert.deepEqual(parseNotificationTarget("help#ticket:tkt_9"), {
    moduleKey: "help",
    targetType: "ticket",
    targetId: "tkt_9",
    leadId: null,
  });
});

test("falls back to the message marker when actionModule has no target", () => {
  const out = parseNotificationTarget(
    "lead-store",
    "Follow up today: Jane. LEAD_FOLLOWUP:lead-77:20261109:TODAY"
  );
  assert.deepEqual(out, {
    moduleKey: "lead-store",
    targetType: "lead",
    targetId: "lead-77",
    leadId: "lead-77",
  });
});

test("actionModule target wins over message marker", () => {
  const out = parseNotificationTarget(
    "lead-store#lead:fromModule",
    "LEAD_FOLLOWUP:fromMessage:x:TODAY"
  );
  assert.equal(out.leadId, "fromModule");
  assert.equal(out.targetId, "fromModule");
});

test("empty/garbage input is safe", () => {
  assert.deepEqual(parseNotificationTarget(null), {
    moduleKey: "",
    targetType: null,
    targetId: null,
    leadId: null,
  });
  assert.deepEqual(parseNotificationTarget(""), {
    moduleKey: "",
    targetType: null,
    targetId: null,
    leadId: null,
  });
  assert.deepEqual(parseNotificationTarget("settings"), {
    moduleKey: "settings",
    targetType: null,
    targetId: null,
    leadId: null,
  });
});

test("malformed suffix (no colon) does not produce a target", () => {
  assert.deepEqual(parseNotificationTarget("calendar#event"), {
    moduleKey: "calendar",
    targetType: null,
    targetId: null,
    leadId: null,
  });
});
