import { test } from "node:test";
import assert from "node:assert/strict";

import {
  maskToken,
  buildPushMessage,
  classifyTokenError,
  isSensitiveType,
} from "./pushService.js";

test("maskToken never reveals the full token", () => {
  const token = "abcdefghijklmnopqrstuvwxyz0123456789";
  const masked = maskToken(token);
  assert.equal(masked, "***456789");
  assert.ok(!masked.includes(token));
  assert.equal(maskToken("short"), "***");
  assert.equal(maskToken(null), "***");
});

test("sensitive notifications get a GENERIC lock-screen payload (no PII)", () => {
  const notification = {
    id: "ntf_1",
    title: "New lead assigned",
    message: "Priya Sharma (+91 98765 43210) was assigned to you",
    type: "LEAD", // not in SAFE_PREVIEW_TYPES -> sensitive
    actionModule: "leads",
  };
  const msg = buildPushMessage({ notification, token: "device-token-123" });

  assert.equal(msg.token, "device-token-123");
  // The customer name/phone must NOT appear on the lock screen.
  assert.equal(msg.notification.title, "Bispun");
  assert.ok(!msg.notification.body.includes("Priya"));
  assert.ok(!msg.notification.body.includes("98765"));
  assert.equal(msg.android.notification.visibility, "private");
  // Navigation data still flows (module key only, never customer data).
  assert.equal(msg.data.notificationId, "ntf_1");
  assert.equal(msg.data.type, "LEAD");
  assert.equal(msg.data.actionModule, "leads");
  for (const value of Object.values(msg.data)) {
    assert.equal(typeof value, "string");
  }
  assert.equal(msg.android.priority, "high");
});

test("safe-preview types keep their full title/body", () => {
  const notification = {
    id: "ntf_2",
    title: "System maintenance",
    message: "Bispun will be briefly unavailable tonight.",
    type: "SYSTEM",
    actionModule: "",
  };
  const msg = buildPushMessage({ notification, token: "t" });
  assert.equal(msg.notification.title, "System maintenance");
  assert.equal(msg.notification.body, "Bispun will be briefly unavailable tonight.");
  assert.equal(msg.android.notification.visibility, "public");
});

test("isSensitiveType: unknown/empty types are treated as sensitive", () => {
  assert.equal(isSensitiveType("SYSTEM"), false);
  assert.equal(isSensitiveType("system"), false);
  assert.equal(isSensitiveType("LEAD"), true);
  assert.equal(isSensitiveType("REVENUE"), true);
  assert.equal(isSensitiveType(""), true);
  assert.equal(isSensitiveType(null), true);
});

test("buildPushMessage tolerates missing fields without throwing", () => {
  const msg = buildPushMessage({ notification: {}, token: "t" });
  // Missing type -> sensitive default -> generic.
  assert.equal(msg.notification.title, "Bispun");
  assert.equal(msg.data.actionModule, "");
});

test("classifyTokenError flags only permanently-invalid tokens", () => {
  assert.equal(
    classifyTokenError({ code: "messaging/registration-token-not-registered" })
      .invalidToken,
    true
  );
  assert.equal(
    classifyTokenError({ code: "messaging/invalid-registration-token" })
      .invalidToken,
    true
  );
  // A transient/server error must NOT deactivate the token.
  assert.equal(
    classifyTokenError({ code: "messaging/internal-error" }).invalidToken,
    false
  );
  assert.equal(classifyTokenError(new Error("boom")).invalidToken, false);
});
