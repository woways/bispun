import assert from "node:assert/strict";
import test from "node:test";
process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
const { maskSecret, normalizeTelephonyConfig, resolveTelephonyRuntime } = await import("./telephonyConfig.js");

test("telephony config rejects unknown modes and sanitizes caller id", () => {
  const config = normalizeTelephonyConfig({ enabled: true, mode: "unknown", callerId: "+91 (40) 1234-5678 extension" });
  assert.equal(config.mode, "DEVICE_DIAL");
  assert.equal(config.callerId, "+914012345678");
});

test("telephony secrets are masked", () => {
  assert.equal(maskSecret("abcdefghijkl"), "••••••••ijkl");
  assert.equal(maskSecret(""), "");
});

test("disabled telephony always falls back to device dial", () => {
  const runtime = resolveTelephonyRuntime({ enabled: false, mode: "OWN_MSG91", authKey: "secret", callerId: "919999999999", consentConfirmed: true });
  assert.equal(runtime.mode, "DEVICE_DIAL");
  assert.equal(runtime.ready, false);
});
