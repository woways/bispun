// Pure coupon pricing helpers — NO database import, so this is unit-testable
// without a DATABASE_URL. The DB-backed logic (validate/reserve/consume/seed)
// lives in coupons.js and re-exports these.

// Keep in sync with GST_RATE in selfServeOnboard.js (18%).
export const GST_RATE = 18;

// The four initial signup coupons. finalAmount is the GST-INCLUSIVE total the
// customer pays. Authoritative config is stored in the DB (seeded from this).
export const SEED_COUPONS = [
  { code: "CBSPN2W9W5K0C", finalAmount: 29500 },
  { code: "CBSPN2W5W0K0C", finalAmount: 25000 },
  { code: "CBSPN2W2W5K0C", finalAmount: 22500 },
  { code: "CBSPN2W0W0K0C", finalAmount: 20000 },
];

export class CouponError extends Error {
  constructor(message, status = 400, code = "COUPON_ERROR") {
    super(message);
    this.name = "CouponError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeCouponCode(value) {
  return String(value || "").trim().toUpperCase();
}

/**
 * Split a GST-INCLUSIVE total into taxable base + GST using integer paise, so
 * base + gst === total exactly and GST is never added on top (no double-GST).
 */
export function splitGstInclusive(finalAmount, gstRate = GST_RATE) {
  const finalPaise = Math.round(Number(finalAmount) * 100);
  const basePaise = Math.round(finalPaise / (1 + gstRate / 100));
  const gstPaise = finalPaise - basePaise;
  return {
    finalPaise,
    basePaise,
    gstPaise,
    finalAmount: finalPaise / 100,
    subtotal: basePaise / 100,
    gstAmount: gstPaise / 100,
    gstRate,
  };
}

/**
 * Pricing breakdown when a coupon is applied to a plan. The coupon's finalAmount
 * is the authoritative GST-inclusive total; discount is the reduction vs the
 * plan's pre-GST list price. amountPaise is what the Razorpay order is created for.
 */
export function computeCouponPricing(plan, coupon) {
  const split = splitGstInclusive(coupon.finalAmount);
  const listPrice = Number(plan?.yearlyPrice) || 0;
  const discount = Math.max(
    0,
    Math.round((listPrice - split.subtotal) * 100) / 100
  );
  return {
    listPrice,
    discount,
    subtotal: split.subtotal,
    gstRate: split.gstRate,
    gstAmount: split.gstAmount,
    finalAmount: split.finalAmount,
    couponCode: coupon.code,
    amountPaise: split.finalPaise,
  };
}
