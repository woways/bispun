import { test } from "node:test";
import assert from "node:assert/strict";

import { releaseStaleCouponReservations } from "./coupons.js";

// Minimal in-memory fake of the Prisma delegate surface the sweep touches.
function makeDb(reservations, pendings = []) {
  return {
    _reservations: reservations,
    couponRedemption: {
      async findMany({ where }) {
        const lt = where.reservedAt.lt;
        return reservations
          .filter((r) => r.status === where.status && r.reservedAt < lt)
          .map((r) => ({ providerOrderId: r.providerOrderId }));
      },
      async findUnique({ where }) {
        return (
          reservations.find((r) => r.providerOrderId === where.providerOrderId) ||
          null
        );
      },
      async update({ where, data }) {
        const r = reservations.find(
          (x) => x.providerOrderId === where.providerOrderId
        );
        Object.assign(r, data);
        return r;
      },
    },
    pendingSignup: {
      async findUnique({ where }) {
        return (
          pendings.find((p) => p.providerOrderId === where.providerOrderId) || null
        );
      },
    },
  };
}

const OLD = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago
const RECENT = new Date(Date.now() - 5 * 60 * 1000); // 5 min ago

test("releases an abandoned (old, unpaid) RESERVED redemption", async () => {
  const res = [{ providerOrderId: "o1", status: "RESERVED", reservedAt: OLD }];
  const db = makeDb(res, [{ providerOrderId: "o1", status: "PENDING" }]);
  const n = await releaseStaleCouponReservations({ db });
  assert.equal(n, 1);
  assert.equal(res[0].status, "RELEASED");
  assert.ok(res[0].releasedAt instanceof Date);
});

test("leaves a recent RESERVED redemption untouched", async () => {
  const res = [{ providerOrderId: "o2", status: "RESERVED", reservedAt: RECENT }];
  const db = makeDb(res, [{ providerOrderId: "o2", status: "PENDING" }]);
  const n = await releaseStaleCouponReservations({ db });
  assert.equal(n, 0);
  assert.equal(res[0].status, "RESERVED");
});

test("never releases a paid order (PendingSignup CONSUMED), even if old", async () => {
  const res = [{ providerOrderId: "o3", status: "RESERVED", reservedAt: OLD }];
  const db = makeDb(res, [{ providerOrderId: "o3", status: "CONSUMED" }]);
  const n = await releaseStaleCouponReservations({ db });
  assert.equal(n, 0);
  assert.equal(res[0].status, "RESERVED");
});

test("releases an old reservation with no PendingSignup row (abandoned)", async () => {
  const res = [{ providerOrderId: "o4", status: "RESERVED", reservedAt: OLD }];
  const db = makeDb(res, []);
  const n = await releaseStaleCouponReservations({ db });
  assert.equal(n, 1);
  assert.equal(res[0].status, "RELEASED");
});

test("is idempotent: a second sweep releases nothing", async () => {
  const res = [{ providerOrderId: "o5", status: "RESERVED", reservedAt: OLD }];
  const db = makeDb(res, [{ providerOrderId: "o5", status: "PENDING" }]);
  assert.equal(await releaseStaleCouponReservations({ db }), 1);
  assert.equal(await releaseStaleCouponReservations({ db }), 0);
  assert.equal(res[0].status, "RELEASED");
});

test("already-CONSUMED redemptions are never candidates", async () => {
  const res = [{ providerOrderId: "o6", status: "CONSUMED", reservedAt: OLD }];
  const db = makeDb(res, [{ providerOrderId: "o6", status: "CONSUMED" }]);
  const n = await releaseStaleCouponReservations({ db });
  assert.equal(n, 0);
  assert.equal(res[0].status, "CONSUMED");
});

test("custom olderThanMs window is honored", async () => {
  // Reserved 10 min ago; a 5-min window makes it stale.
  const res = [
    {
      providerOrderId: "o7",
      status: "RESERVED",
      reservedAt: new Date(Date.now() - 10 * 60 * 1000),
    },
  ];
  const db = makeDb(res, [{ providerOrderId: "o7", status: "PENDING" }]);
  const n = await releaseStaleCouponReservations({
    db,
    olderThanMs: 5 * 60 * 1000,
  });
  assert.equal(n, 1);
  assert.equal(res[0].status, "RELEASED");
});
