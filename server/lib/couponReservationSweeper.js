import prisma from "./prisma.js";
import { getRazorpayClient } from "./razorpay.js";

/**
 * C2 — Stale coupon-reservation cleanup.
 *
 * A coupon redemption is RESERVED the moment a Razorpay order is created for a
 * coupon-bearing self-serve signup (see publicOnboard.js /start). It becomes:
 *   - CONSUMED  — on a verified successful payment (webhook `payment.captured`
 *                 or verify endpoint -> finalizeSelfServeSignup ->
 *                 consumeCouponRedemption), which also increments usedCount; or
 *   - RELEASED  — on `payment.failed` (razorpayWebhook releases it).
 *
 * The gap this worker closes: a customer who starts checkout but NEVER pays and
 * NEVER triggers a `payment.failed` webhook (they just close the tab). Razorpay
 * sends no event, so the row stays RESERVED forever and keeps counting against
 * the coupon's maxRedemptions and per-customer limit — eventually making a
 * perfectly valid coupon look "exhausted" / stop working for real buyers.
 *
 * SAFETY (this worker must never cost a paying customer their redemption):
 *   - Only rows still RESERVED and older than the TTL are even considered.
 *   - Before releasing, payment status is established AUTHORITATIVELY:
 *       1. cheap DB signals (PendingSignup CONSUMED / PaymentTransaction
 *          CAPTURED / redemption already non-RESERVED) -> treat as live, skip;
 *       2. otherwise ask Razorpay directly for the order's payments — if ANY is
 *          `captured` or `authorized` (in-flight), skip.
 *   - If payment status CANNOT be established (Razorpay/DB error), the row is
 *     SKIPPED, never released blindly.
 *   - Release is a conditional, idempotent `updateMany(status: RESERVED ->
 *     RELEASED)`: a concurrent consume that already flipped the row to CONSUMED
 *     wins and we touch zero rows. Running the sweep twice is harmless.
 *
 * EXPIRY POLICY: `COUPON_RESERVATION_TTL_MINUTES` (default 60, floor 15). The
 * floor matches Razorpay's standard-checkout payment-session window (~15 min);
 * the default leaves generous room for a slow payer. Crucially, the TTL is NOT
 * what protects a paid order — the live Razorpay check is — so Razorpay's long
 * webhook-retry window (up to ~24h) can never produce a wrongful release even
 * though the TTL is short.
 */

const DEFAULT_TTL_MINUTES = 60;
const MIN_TTL_MINUTES = 15;
const WORKER_INTERVAL_MS = 10 * 60 * 1000; // sweep every 10 minutes
const MAX_BATCH = 200;

let workerTimer = null;
let workerRunning = false;

export function reservationTtlMs() {
  const raw = Number(process.env.COUPON_RESERVATION_TTL_MINUTES);
  const minutes =
    Number.isFinite(raw) && raw >= MIN_TTL_MINUTES ? raw : DEFAULT_TTL_MINUTES;
  return minutes * 60 * 1000;
}

/** Default live-payment lookup: ask Razorpay for the order's payments. */
async function defaultFetchOrderPayments(providerOrderId) {
  const razorpay = getRazorpayClient();
  const result = await razorpay.orders.fetchPayments(providerOrderId);
  return Array.isArray(result?.items) ? result.items : [];
}

/**
 * True when the order has a successful or in-flight payment and its reservation
 * must be kept. Throws if status cannot be established (caller then skips).
 */
export async function orderHasLivePayment({
  providerOrderId,
  db = prisma,
  fetchOrderPayments = defaultFetchOrderPayments,
}) {
  // 1) Cheap, authoritative DB signals first.
  const redemption = await db.couponRedemption.findUnique({
    where: { providerOrderId },
    select: { status: true },
  });
  // Already consumed or released by the normal flow — nothing to clean up.
  if (redemption && redemption.status !== "RESERVED") return true;

  const pending = await db.pendingSignup
    .findUnique({ where: { providerOrderId }, select: { status: true } })
    .catch(() => null);
  if (pending && pending.status === "CONSUMED") return true;
  // An explicitly FAILED signup means payment did not succeed -> releasable
  // without an external call.
  if (pending && pending.status === "FAILED") return false;

  const txn = await db.paymentTransaction
    .findUnique({ where: { providerOrderId }, select: { status: true } })
    .catch(() => null);
  if (txn && txn.status === "CAPTURED") return true;

  // 2) Not conclusively dead from the DB -> ask Razorpay directly. A throw here
  // propagates so the caller SKIPS this row (never release on unknown status).
  const payments = await fetchOrderPayments(providerOrderId);
  return payments.some(
    (p) => p && (p.status === "captured" || p.status === "authorized")
  );
}

/**
 * Release stale, provably-unpaid RESERVED coupon redemptions. Returns a summary
 * counting what was released vs. kept (paid/in-flight) vs. kept (status unknown).
 */
export async function sweepStaleCouponReservations({
  now = Date.now(),
  db = prisma,
  fetchOrderPayments = defaultFetchOrderPayments,
  ttlMs = reservationTtlMs(),
  batchSize = MAX_BATCH,
} = {}) {
  if (workerRunning) return { released: 0, skipped: true };
  workerRunning = true;
  try {
    const cutoff = new Date(now - ttlMs);
    const stale = await db.couponRedemption.findMany({
      where: { status: "RESERVED", reservedAt: { lt: cutoff } },
      select: { id: true, providerOrderId: true },
      orderBy: { reservedAt: "asc" },
      take: batchSize,
    });

    let released = 0;
    let keptPaid = 0;
    let keptUnknown = 0;

    for (const row of stale) {
      let live;
      try {
        live = await orderHasLivePayment({
          providerOrderId: row.providerOrderId,
          db,
          fetchOrderPayments,
        });
      } catch (error) {
        keptUnknown += 1; // cannot establish status -> never release blindly
        console.error(
          `Coupon sweep: kept ${row.providerOrderId} (payment status unknown): ${error?.message}`
        );
        continue;
      }

      if (live) {
        keptPaid += 1;
        continue;
      }

      // Conditional + idempotent: only flips rows STILL reserved, so a racing
      // consume (RESERVED -> CONSUMED) always wins and we update 0 rows.
      const result = await db.couponRedemption.updateMany({
        where: { id: row.id, status: "RESERVED" },
        data: { status: "RELEASED", releasedAt: new Date(now) },
      });
      released += result.count;
    }

    return { released, keptPaid, keptUnknown, scanned: stale.length, skipped: false };
  } finally {
    workerRunning = false;
  }
}

export function startCouponReservationSweeper() {
  if (workerTimer) return workerTimer;

  sweepStaleCouponReservations().catch((error) => {
    console.error("Coupon reservation sweeper failed:", error);
  });

  workerTimer = setInterval(() => {
    sweepStaleCouponReservations().catch((error) => {
      console.error("Coupon reservation sweeper failed:", error);
    });
  }, WORKER_INTERVAL_MS);

  workerTimer.unref?.();
  return workerTimer;
}
