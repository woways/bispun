import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sweepStaleCouponReservations,
  orderHasLivePayment,
  reservationTtlMs,
} from "./couponReservationSweeper.js";

/**
 * In-memory fake of the Prisma surface the sweeper uses. Each redemption row is
 * { id, providerOrderId, status, reservedAt }. updateMany honours the status
 * guard so we can exercise the race/idempotency behaviour.
 */
function makeDb({ redemptions = [], pendings = {}, txns = {} } = {}) {
  const rows = redemptions.map((r) => ({ ...r }));
  return {
    _rows: rows,
    couponRedemption: {
      async findMany({ where, take }) {
        const cutoff = where.reservedAt?.lt;
        return rows
          .filter(
            (r) =>
              r.status === where.status &&
              (!cutoff || r.reservedAt < cutoff)
          )
          .slice(0, take ?? rows.length)
          .map((r) => ({ id: r.id, providerOrderId: r.providerOrderId }));
      },
      async findUnique({ where }) {
        const r = rows.find((x) => x.providerOrderId === where.providerOrderId);
        return r ? { status: r.status } : null;
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const r of rows) {
          if (r.id === where.id && r.status === where.status) {
            r.status = data.status;
            r.releasedAt = data.releasedAt;
            count += 1;
          }
        }
        return { count };
      },
    },
    pendingSignup: {
      async findUnique({ where }) {
        return pendings[where.providerOrderId] || null;
      },
    },
    paymentTransaction: {
      async findUnique({ where }) {
        return txns[where.providerOrderId] || null;
      },
    },
  };
}

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 1, 12, 0, 0);
const OLD = new Date(NOW - 3 * HOUR); // comfortably past any TTL
const FRESH = new Date(NOW - 5 * 60 * 1000); // 5 min old

test("releases a stale, provably-unpaid reservation (abandoned checkout)", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "order_abandoned", status: "RESERVED", reservedAt: OLD },
    ],
  });
  // Razorpay reports no payments at all for the order.
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async () => [],
  });
  assert.equal(summary.released, 1);
  assert.equal(summary.keptPaid, 0);
  assert.equal(summary.keptUnknown, 0);
  assert.equal(db._rows[0].status, "RELEASED");
  assert.ok(db._rows[0].releasedAt instanceof Date);
});

test("never releases a reservation with a captured Razorpay payment", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "order_paid", status: "RESERVED", reservedAt: OLD },
    ],
  });
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async () => [{ status: "captured" }],
  });
  assert.equal(summary.released, 0);
  assert.equal(summary.keptPaid, 1);
  assert.equal(db._rows[0].status, "RESERVED");
});

test("never releases when an AUTHORIZED (in-flight) payment exists", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "order_inflight", status: "RESERVED", reservedAt: OLD },
    ],
  });
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async () => [{ status: "failed" }, { status: "authorized" }],
  });
  assert.equal(summary.released, 0);
  assert.equal(summary.keptPaid, 1);
  assert.equal(db._rows[0].status, "RESERVED");
});

test("does NOT touch reservations younger than the TTL", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "order_fresh", status: "RESERVED", reservedAt: FRESH },
    ],
  });
  let called = false;
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async () => {
      called = true;
      return [];
    },
  });
  assert.equal(summary.scanned, 0);
  assert.equal(summary.released, 0);
  assert.equal(called, false, "fresh rows must not even be looked up");
  assert.equal(db._rows[0].status, "RESERVED");
});

test("delayed webhook / Razorpay error -> status unknown -> kept, never released", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "order_unknown", status: "RESERVED", reservedAt: OLD },
    ],
  });
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async () => {
      throw new Error("razorpay timeout");
    },
  });
  assert.equal(summary.released, 0);
  assert.equal(summary.keptUnknown, 1);
  assert.equal(db._rows[0].status, "RESERVED");
});

test("an explicitly FAILED PendingSignup is released without any Razorpay call", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "order_failed", status: "RESERVED", reservedAt: OLD },
    ],
    pendings: { order_failed: { status: "FAILED" } },
  });
  let called = false;
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async () => {
      called = true;
      return [];
    },
  });
  assert.equal(summary.released, 1);
  assert.equal(called, false, "FAILED signup is conclusive; no external call needed");
  assert.equal(db._rows[0].status, "RELEASED");
});

test("a CONSUMED PendingSignup (paid) is kept without a Razorpay call", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "order_consumed", status: "RESERVED", reservedAt: OLD },
    ],
    pendings: { order_consumed: { status: "CONSUMED" } },
  });
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async () => {
      throw new Error("should not be called");
    },
  });
  assert.equal(summary.released, 0);
  assert.equal(summary.keptPaid, 1);
  assert.equal(db._rows[0].status, "RESERVED");
});

test("release is idempotent + race-safe: a concurrent consume wins", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "order_race", status: "RESERVED", reservedAt: OLD },
    ],
  });
  // Simulate a consume flipping the row to CONSUMED between findMany and update.
  const racingFetch = async () => {
    db._rows[0].status = "CONSUMED";
    return [];
  };
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: racingFetch,
  });
  // orderHasLivePayment re-reads the redemption first and sees CONSUMED -> kept.
  assert.equal(summary.released, 0);
  assert.equal(db._rows[0].status, "CONSUMED");

  // Running the sweep again does nothing (idempotent).
  const again = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async () => [],
  });
  assert.equal(again.released, 0);
});

test("mixed batch: releases only the provably-unpaid ones", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "o_paid", status: "RESERVED", reservedAt: OLD },
      { id: "r2", providerOrderId: "o_abandoned", status: "RESERVED", reservedAt: OLD },
      { id: "r3", providerOrderId: "o_unknown", status: "RESERVED", reservedAt: OLD },
      { id: "r4", providerOrderId: "o_fresh", status: "RESERVED", reservedAt: FRESH },
    ],
  });
  const summary = await sweepStaleCouponReservations({
    now: NOW,
    db,
    fetchOrderPayments: async (orderId) => {
      if (orderId === "o_paid") return [{ status: "captured" }];
      if (orderId === "o_abandoned") return [];
      if (orderId === "o_unknown") throw new Error("boom");
      return [];
    },
  });
  assert.equal(summary.scanned, 3, "fresh row excluded by TTL");
  assert.equal(summary.released, 1);
  assert.equal(summary.keptPaid, 1);
  assert.equal(summary.keptUnknown, 1);
  assert.equal(db._rows.find((r) => r.id === "r1").status, "RESERVED");
  assert.equal(db._rows.find((r) => r.id === "r2").status, "RELEASED");
  assert.equal(db._rows.find((r) => r.id === "r3").status, "RESERVED");
  assert.equal(db._rows.find((r) => r.id === "r4").status, "RESERVED");
});

test("orderHasLivePayment: already-RELEASED row is treated as not needing cleanup", async () => {
  const db = makeDb({
    redemptions: [
      { id: "r1", providerOrderId: "o_rel", status: "RELEASED", reservedAt: OLD },
    ],
  });
  const live = await orderHasLivePayment({
    providerOrderId: "o_rel",
    db,
    fetchOrderPayments: async () => {
      throw new Error("should not be called");
    },
  });
  assert.equal(live, true);
});

test("reservationTtlMs honours the env floor and default", () => {
  const prev = process.env.COUPON_RESERVATION_TTL_MINUTES;
  try {
    delete process.env.COUPON_RESERVATION_TTL_MINUTES;
    assert.equal(reservationTtlMs(), 60 * 60 * 1000);
    process.env.COUPON_RESERVATION_TTL_MINUTES = "5"; // below floor -> default
    assert.equal(reservationTtlMs(), 60 * 60 * 1000);
    process.env.COUPON_RESERVATION_TTL_MINUTES = "90";
    assert.equal(reservationTtlMs(), 90 * 60 * 1000);
  } finally {
    if (prev === undefined) delete process.env.COUPON_RESERVATION_TTL_MINUTES;
    else process.env.COUPON_RESERVATION_TTL_MINUTES = prev;
  }
});
