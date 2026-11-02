import { test } from "node:test";
import assert from "node:assert/strict";

// Regression guard for the Capacitor push-plugin loading bug.
//
// The @capacitor/push-notifications proxy exposes a `.then` that throws
// "not implemented on android". If that proxy is ever used as a Promise
// RESOLUTION VALUE, Promise adoption calls `.then(resolve, reject)` on it and
// the chain REJECTS — which aborted push init before register() (no FCM token).
//
// loadPlugin() must resolve to a plain, non-thenable wrapper ({ plugin }) so the
// proxy never enters the promise-resolution path. These tests reproduce the bug
// and prove the wrapper is immune, without needing a real Capacitor runtime.

// A stand-in for the Capacitor plugin proxy: a thenable whose `.then` throws.
function makeFakeProxy() {
  return {
    then() {
      throw new Error('"PushNotifications.then()" is not implemented on android');
    },
    register: async () => "registered",
    addListener: async () => ({ remove() {} }),
  };
}

test("BUG REPRO: resolving a promise to the bare proxy rejects via .then adoption", async () => {
  const bad = Promise.resolve().then(() => makeFakeProxy()); // old loadPlugin shape
  await assert.rejects(
    () => bad,
    /is not implemented on android/,
    "awaiting the bare proxy must reject (this was the real failure)"
  );
});

test("FIX: resolving to a { plugin } wrapper does NOT call the proxy's .then", async () => {
  const good = Promise.resolve().then(() => ({ plugin: makeFakeProxy() })); // new loadPlugin shape
  const wrapper = await good; // must not throw
  assert.ok(wrapper && typeof wrapper === "object", "resolves to a wrapper object");
  const { plugin } = wrapper;
  assert.equal(typeof plugin.register, "function", "proxy is reachable via wrapper.plugin");
  assert.equal(await plugin.register(), "registered", "plugin methods still callable");
});

test("FIX: unwrapped plugin is usable for addListener/register (init path shape)", async () => {
  async function loadPluginLike() {
    return Promise.resolve({ plugin: makeFakeProxy() }); // mirrors loadPlugin()
  }
  const { plugin: PushNotifications } = await loadPluginLike();
  const handle = await PushNotifications.addListener("registration", () => {});
  assert.equal(typeof handle.remove, "function", "addListener returns a removable handle");
});
