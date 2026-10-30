import { test } from "node:test";
import assert from "node:assert/strict";
import { performLogout } from "./logoutFlow.js";

function harness(overrides = {}) {
  const events = [];
  const base = {
    unregisterPush: async () => { events.push("unregister"); },
    serverLogout: async () => { events.push("logout"); },
    clearToken: () => { events.push("clearToken"); },
    navigate: () => { events.push("navigate"); },
    onError: (stage) => { events.push(`error:${stage}`); },
    timeoutMs: 2500,
  };
  return { events, opts: { ...base, ...overrides } };
}

test("success: both cleanup calls run, token cleared, then navigate", async () => {
  const { events, opts } = harness();
  await performLogout(opts);
  assert.ok(events.includes("unregister"), "unregister ran");
  assert.ok(events.includes("logout"), "serverLogout ran");
  assert.ok(events.indexOf("clearToken") < events.indexOf("navigate"), "clearToken before navigate");
  assert.equal(events.filter((e) => e === "clearToken").length, 1, "token cleared exactly once");
});

// THE regression: a hung push-unregister must NOT block the server logout.
test("hung unregisterPush: serverLogout still dispatched, token cleared, navigates", async () => {
  const { events, opts } = harness({
    timeoutMs: 50,
    unregisterPush: () => new Promise(() => {}), // never resolves (hang)
  });
  const start = Date.now();
  await performLogout(opts);
  const elapsed = Date.now() - start;
  assert.ok(events.includes("logout"), "serverLogout dispatched despite hung unregister");
  assert.ok(events.includes("clearToken"), "token cleared despite hung unregister");
  assert.ok(events.includes("navigate"), "navigated despite hung unregister");
  assert.ok(elapsed < 1000, `navigated promptly (${elapsed}ms)`);
});

test("401 on logout: token still cleared and navigation still happens", async () => {
  const { events, opts } = harness({
    serverLogout: async () => { const e = new Error("Request failed (401)"); e.status = 401; throw e; },
  });
  await performLogout(opts);
  assert.ok(events.includes("error:logout"), "logout error reported after retry");
  assert.ok(events.includes("clearToken"), "token cleared despite 401");
  assert.ok(events.includes("navigate"), "navigates despite 401");
});

test("network failure on unregister: serverLogout still runs, token cleared, navigate", async () => {
  const { events, opts } = harness({
    unregisterPush: async () => { throw new Error("Failed to fetch"); },
  });
  await performLogout(opts);
  assert.ok(events.includes("error:unregister"), "unregister failure reported");
  assert.ok(events.includes("logout"), "serverLogout still ran");
  assert.ok(events.includes("clearToken"), "token cleared");
  assert.ok(events.includes("navigate"), "navigates");
});

test("logout timeout: slow/never-resolving serverLogout still navigates within bound", async () => {
  const { events, opts } = harness({
    timeoutMs: 20,
    serverLogout: () => new Promise(() => {}), // never resolves
  });
  const start = Date.now();
  await performLogout(opts);
  assert.ok(Date.now() - start < 1000, "navigated promptly on timeout");
  assert.ok(events.includes("clearToken"), "token cleared on timeout");
  assert.ok(events.includes("navigate"), "navigates on timeout");
});

test("both fail: token cleared and navigation still happen", async () => {
  const { events, opts } = harness({
    unregisterPush: async () => { throw new Error("boom"); },
    serverLogout: async () => { throw new Error("boom"); },
  });
  await performLogout(opts);
  assert.ok(events.includes("clearToken"), "token cleared even when both fail");
  assert.ok(events.includes("navigate"), "navigates even when both fail");
});

test("token is never cleared more than once (no double clear on late settle)", async () => {
  let resolveLogout;
  const { events, opts } = harness({
    timeoutMs: 10,
    serverLogout: () => new Promise((r) => { resolveLogout = r; }),
  });
  await performLogout(opts);
  resolveLogout && resolveLogout();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(events.filter((e) => e === "clearToken").length, 1, "cleared exactly once");
});
