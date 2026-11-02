import { test } from "node:test";
import assert from "node:assert/strict";

// Keep the transaction-settle delay at 0 for fast, deterministic tests.
process.env.PUSH_TX_SETTLE_MS = "0";

import {
  selectDeliverableTokens,
  dispatchNotificationPush,
} from "./pushDispatch.js";

function makePrisma({ persisted, tokens }) {
  const calls = { findUnique: 0, findMany: 0, updateMany: 0 };
  return {
    calls,
    notification: {
      findUnique: async () => {
        calls.findUnique += 1;
        return persisted ? { id: "ntf" } : null;
      },
    },
    deviceToken: {
      findMany: async () => {
        calls.findMany += 1;
        return tokens || [];
      },
      updateMany: async () => {
        calls.updateMany += 1;
      },
    },
  };
}

const NOTIF = { id: "ntf", companyId: "co1", userId: "u1" };

test("selectDeliverableTokens keeps only active, unique tokens", () => {
  const rows = [
    { token: "a", active: true },
    { token: "b", active: false },
    { token: "a", active: true }, // duplicate
    { token: "c", active: true },
    { token: "", active: true }, // empty
    null,
  ];
  assert.deepEqual(selectDeliverableTokens(rows).sort(), ["a", "c"]);
});

test("selectDeliverableTokens handles empty / missing input", () => {
  assert.deepEqual(selectDeliverableTokens([]), []);
  assert.deepEqual(selectDeliverableTokens(undefined), []);
});

test("rollback guard: a vanished (rolled-back) notification is NOT pushed", async () => {
  const prisma = makePrisma({ persisted: false });
  await dispatchNotificationPush(prisma, NOTIF);
  assert.equal(prisma.calls.findUnique, 1); // existence re-checked
  assert.equal(prisma.calls.findMany, 0); // never looked up tokens -> no push
});

test("committed notification proceeds to token lookup", async () => {
  const prisma = makePrisma({ persisted: true, tokens: [] });
  await dispatchNotificationPush(prisma, NOTIF);
  assert.equal(prisma.calls.findUnique, 1);
  assert.equal(prisma.calls.findMany, 1); // confirmed -> tokens looked up
});

test("dispatch skips safely when the notification has no target user", async () => {
  const prisma = makePrisma({ persisted: true, tokens: [] });
  await dispatchNotificationPush(prisma, { id: "ntf", companyId: "co1" });
  assert.equal(prisma.calls.findUnique, 0); // returned before any DB work
  assert.equal(prisma.calls.findMany, 0);
});
