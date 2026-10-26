import { test } from "node:test";
import assert from "node:assert/strict";

import {
  maskToken,
  buildPushMessage,
  classifyTokenError,
} from "./pushService.js";

test("maskToken never reveals the full token", () => {
  const token = "abcdefghijklmnopqrstuvwxyz0123456789";
  const masked = maskToken(token);
  assert.equal(masked, "***456789");
  assert.ok(!masked.includes(token));
  assert.equal(maskToken("short"), "***");
  assert.equal(maskToken(null), "***");
});

test("buildPushMessage targets the token and shapes a safe payload", () => {
  const notification = {
    id: "ntf_1",
    title: "New lead assigned",
    message: "Priya Sharma was assigned to you",
    type: "LEAD",
    actionModule: "leads",
  };
  const msg = buildPushMessage({ notification, token: "device-token-123" });

  assert.equal(msg.token, "device-token-123");
  assert.equal(msg.notification.title, "New lead assigned");
  assert.equal(msg.notification.body, "Priya Sharma was assigned to you");
  // data values must all be strings for FCM, and carry nav info only.
  assert.equal(msg.data.notificationId, "ntf_1");
  assert.equal(msg.data.type, "LEAD");
  assert.equal(msg.data.actionModule, "leads");
  for (const value of Object.values(msg.data)) {
    assert.equal(typeof value, "string");
  }
  assert.equal(msg.android.priority, "high");
});

test("buildPushMessage tolerates missing fields without throwing", () => {
  const msg = buildPushMessage({ notification: {}, token: "t" });
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
