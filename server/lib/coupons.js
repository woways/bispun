import prisma from "./prisma.js";
import { computeSelfServePricing } from "./selfServeOnboard.js";
import {
  CouponError,
  SEED_COUPONS,
  normalizeCouponCode,
  splitGstInclusive,
  computeCouponPricing,
} from "./couponPricing.js";

// Re-export the pure helpers so existing imports from "./coupons.js" keep working.
export {
  CouponError,
  SEED_COUPONS,
  normalizeCouponCode,
  splitGstInclusive,
  computeCouponPricing,
};

/**
 * Validate a coupon against a plan (and optionally a customer) and return the
 * coupon row. Throws CouponError with a safe, user-facing message otherwise.
 * Never leaks internal config (exact limits, other codes, etc.).
 */
export async function validateCoupon({ code, planKey, customerEmail, db = prisma }) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) throw new CouponError("Enter a coupon code");

  const coupon = await db.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.active) {
    throw new CouponError("This coupon code is not valid", 400, "COUPON_INVALID");
  }

  const now = new Date();
  if (coupon.validFrom && new Date(coupon.validFrom) > now) {
    throw new CouponError("This coupon is not active yet", 400, "COUPON_NOT_STARTED");
  }
  if (coupon.validUntil && new Date(coupon.validUntil) < now) {
    throw new CouponError("This coupon has expired", 400, "COUPON_EXPIRED");
  }

  const planKeyNorm = String(planKey || "").trim().toLowerCase();
  const eligible = (coupon.eligiblePlanKeys || []).map((k) =>
    String(k).toLowerCase()
  );
  if (!planKeyNorm || !eligible.includes(planKeyNorm)) {
    throw new CouponError(
      "This coupon can't be used for the selected plan",
      400,
      "COUPON_PLAN_INELIGIBLE"
    );
  }

  if (coupon.maxRedemptions != null && coupon.usedCount >= coupon.maxRedemptions) {
    throw new CouponError(
      "This coupon has reached its usage limit",
      400,
      "COUPON_EXHAUSTED"
    );
  }

  if (coupon.perCustomerLimit != null && customerEmail) {
    const used = await db.couponRedemption.count({
      where: {
        couponId: coupon.id,
        customerEmail: String(customerEmail).trim().toLowerCase(),
        status: "CONSUMED",
      },
    });
    if (used >= coupon.perCustomerLimit) {
      throw new CouponError(
        "You have already used this coupon",
        400,
        "COUPON_CUSTOMER_LIMIT"
      );
    }
  }

  return coupon;
}

/**
 * Validate the coupon AND confirm it is a genuine discount on this plan (its
 * GST-inclusive total is below the plan's normal GST-inclusive total). Guards
 * against a misconfigured coupon raising the price or unlocking a pricier plan.
 * Returns { coupon, pricing }.
 */
export async function quoteCoupon({ code, planKey, customerEmail, db = prisma }) {
  const planKeyNorm = String(planKey || "").trim().toLowerCase();
  const plan = await db.plan.findUnique({ where: { key: planKeyNorm } });
  if (!plan || !plan.active) {
    throw new CouponError("Selected plan is unavailable", 404, "PLAN_UNAVAILABLE");
  }

  const coupon = await validateCoupon({ code, planKey: planKeyNorm, customerEmail, db });
  const pricing = computeCouponPricing(plan, coupon);

  const planNormal = computeSelfServePricing(plan);
  if (pricing.finalAmount >= Number(planNormal.finalAmount)) {
    // Not a discount for this plan — refuse rather than charge more.
    throw new CouponError(
      "This coupon can't be used for the selected plan",
      400,
      "COUPON_PLAN_INELIGIBLE"
    );
  }

  return { coupon, plan, pricing };
}

/**
 * Reserve a redemption for one order. Idempotent on providerOrderId, and
 * enforces maxRedemptions atomically inside a transaction (counts RESERVED +
 * CONSUMED) so concurrent signups can't oversell a limited coupon. Throws
 * CouponError("…usage limit") when the cap is reached.
 */
export async function reserveCouponRedemption({
  couponId,
  providerOrderId,
  planKey,
  customerEmail,
  amount,
  db = prisma,
}) {
  return db.$transaction(async (tx) => {
    const existing = await tx.couponRedemption.findUnique({
      where: { providerOrderId },
    });
    if (existing) return existing; // idempotent retry

    // Serialize concurrent reservations for THIS coupon by taking a row lock on
    // the Coupon first. Without it, the count-then-create below runs under
    // Read Committed and two simultaneous checkouts near the cap can both pass
    // the count and both insert, overselling a limited coupon.
    await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${couponId} FOR UPDATE`;

    const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
    if (!coupon || !coupon.active) {
      throw new CouponError("This coupon code is not valid", 400, "COUPON_INVALID");
    }
    const emailNorm = customerEmail
      ? String(customerEmail).trim().toLowerCase()
      : null;
    if (coupon.maxRedemptions != null) {
      const held = await tx.couponRedemption.count({
        where: { couponId, status: { in: ["RESERVED", "CONSUMED"] } },
      });
      if (held >= coupon.maxRedemptions) {
        throw new CouponError(
          "This coupon has reached its usage limit",
          400,
          "COUPON_EXHAUSTED"
        );
      }
    }
    // Enforce the per-customer limit inside the same lock (counting both held
    // reservations and consumed redemptions), so concurrent/duplicate signups by
    // the same customer can't both slip past the quote-time CONSUMED-only check.
    if (coupon.perCustomerLimit != null && emailNorm) {
      const usedByCustomer = await tx.couponRedemption.count({
        where: {
          couponId,
          customerEmail: emailNorm,
          status: { in: ["RESERVED", "CONSUMED"] },
        },
      });
      if (usedByCustomer >= coupon.perCustomerLimit) {
        throw new CouponError(
          "You have already used this coupon",
          400,
          "COUPON_CUSTOMER_LIMIT"
        );
      }
    }

    return tx.couponRedemption.create({
      data: {
        couponId,
        providerOrderId,
        planKey: String(planKey || "").trim().toLowerCase(),
        customerEmail: emailNorm,
        amount,
        status: "RESERVED",
      },
    });
  });
}

/**
 * Mark a reserved redemption CONSUMED and bump the coupon's usedCount, inside a
 * transaction. Idempotent: a second call for the same order is a no-op. Only a
 * verified successful payment should call this.
 */
export async function consumeCouponRedemption({ providerOrderId, companyId, db = prisma }) {
  return db.$transaction(async (tx) => {
    const red = await tx.couponRedemption.findUnique({ where: { providerOrderId } });
    if (!red) return null;
    if (red.status === "CONSUMED") return red; // already counted — idempotent
    const updated = await tx.couponRedemption.update({
      where: { providerOrderId },
      data: {
        status: "CONSUMED",
        consumedAt: new Date(),
        companyId: companyId || red.companyId || null,
      },
    });
    await tx.coupon.update({
      where: { id: red.couponId },
      data: { usedCount: { increment: 1 } },
    });
    return updated;
  });
}

/** Release a still-reserved redemption (payment failed/cancelled/expired). */
export async function releaseCouponRedemption({ providerOrderId, db = prisma }) {
  const red = await db.couponRedemption
    .findUnique({ where: { providerOrderId } })
    .catch(() => null);
  if (!red || red.status !== "RESERVED") return red || null;
  return db.couponRedemption.update({
    where: { providerOrderId },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
}

/**
 * How long a redemption may stay RESERVED before it is treated as an abandoned
 * checkout. Deliberately generous: Razorpay sets no short order TTL here and its
 * webhooks can retry for hours, so a short window risks releasing a slot while a
 * legitimate (slow or delayed-webhook) payment is still in flight. Paid orders
 * are protected independently of this window (see releaseStaleCouponReservations).
 * Override with COUPON_RESERVATION_TTL_MS. Default: 24h.
 */
export function couponReservationTtlMs() {
  const v = Number(process.env.COUPON_RESERVATION_TTL_MS);
  return Number.isFinite(v) && v > 0 ? v : 24 * 60 * 60 * 1000;
}

/**
 * C2 — release coupon reservations from checkouts that were abandoned (the
 * customer never paid and neither the capture nor the failure webhook ever
 * arrived), so a limited coupon is not permanently "used up" by dead holds.
 *
 * Safe by construction:
 *  - only RESERVED rows older than the TTL are candidates (recent/active holds
 *    are left alone);
 *  - a row is released ONLY when its PendingSignup is not "CONSUMED" — i.e. the
 *    order never finalized/paid. A paid order (even one whose coupon-consume
 *    webhook is still in flight) is therefore never released;
 *  - it reuses releaseCouponRedemption, which acts only on RESERVED rows, so the
 *    sweep is idempotent and a late capture webhook still converges to CONSUMED.
 *
 * Returns the number of reservations released.
 */
export async function releaseStaleCouponReservations({ olderThanMs, db = prisma } = {}) {
  const ttl =
    Number.isFinite(olderThanMs) && olderThanMs > 0
      ? olderThanMs
      : couponReservationTtlMs();
  const cutoff = new Date(Date.now() - ttl);

  const stale = await db.couponRedemption.findMany({
    where: { status: "RESERVED", reservedAt: { lt: cutoff } },
    select: { providerOrderId: true },
  });
  if (!stale.length) return 0;

  let released = 0;
  for (const { providerOrderId } of stale) {
    // Never release a paid order: if the signup finalized (CONSUMED), skip it
    // even if the coupon-consume webhook has not landed yet.
    const pending = await db.pendingSignup
      .findUnique({
        where: { providerOrderId },
        select: { status: true },
      })
      .catch(() => null);
    if (pending && pending.status === "CONSUMED") continue;

    const result = await releaseCouponRedemption({ providerOrderId, db });
    if (result && result.status === "RELEASED") released += 1;
  }
  return released;
}

/**
 * Idempotently seed the four initial coupons, eligible for the Advanced plan.
 * Never overwrites an existing coupon (preserves Super Admin edits + usedCount).
 */
export async function seedCoupons({ db = prisma } = {}) {
  const advanced = await db.plan.findFirst({
    where: {
      OR: [
        { key: "advanced" },
        { name: { contains: "Advanced", mode: "insensitive" } },
      ],
    },
    orderBy: { yearlyPrice: "desc" },
  });
  const planKey = advanced?.key || "advanced";

  const results = [];
  for (const c of SEED_COUPONS) {
    const existing = await db.coupon.findUnique({ where: { code: c.code } });
    if (existing) {
      results.push({ code: c.code, action: "kept" });
      continue;
    }
    await db.coupon.create({
      data: {
        code: c.code,
        finalAmount: c.finalAmount,
        active: true,
        eligiblePlanKeys: [planKey],
        description: `Advanced plan promo — ₹${c.finalAmount.toLocaleString(
          "en-IN"
        )} all-inclusive`,
      },
    });
    results.push({ code: c.code, action: "created", planKey });
  }
  return results;
}
