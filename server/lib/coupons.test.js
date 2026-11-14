import { test } from "node:test";
import assert from "node:assert/strict";

import {
  splitGstInclusive,
  computeCouponPricing,
  normalizeCouponCode,
  SEED_COUPONS,
} from "./couponPricing.js";

// Expected GST-inclusive splits for each coupon (18% GST, integer paise).
// base = round(finalPaise / 1.18); gst = finalPaise - base; base + gst === final.
const EXPECTED = {
  29500: { subtotal: 25000.0, gstAmount: 4500.0 },
  25000: { subtotal: 21186.44, gstAmount: 3813.56 },
  22500: { subtotal: 19067.8, gstAmount: 3432.2 },
  20000: { subtotal: 16949.15, gstAmount: 3050.85 },
};

test("splitGstInclusive splits each coupon total exactly, no double GST", () => {
  for (const { finalAmount } of SEED_COUPONS) {
    const s = splitGstInclusive(finalAmount);
    const exp = EXPECTED[finalAmount];
    assert.equal(s.finalAmount, finalAmount, `final ${finalAmount}`);
    assert.equal(s.subtotal, exp.subtotal, `subtotal for ${finalAmount}`);
    assert.equal(s.gstAmount, exp.gstAmount, `gst for ${finalAmount}`);
    // base + gst must equal the total to the paise — the customer pays exactly
    // the coupon amount, GST is carved out, never added on top.
    assert.equal(s.basePaise + s.gstPaise, s.finalPaise, `paise sum ${finalAmount}`);
    assert.equal(s.finalPaise, Math.round(finalAmount * 100), `paise ${finalAmount}`);
  }
});

test("computeCouponPricing: Razorpay amount equals the exact coupon total", () => {
  const plan = { yearlyPrice: 68644.07 }; // Advanced base (~₹81,000 incl GST)
  for (const coupon of SEED_COUPONS) {
    const p = computeCouponPricing(plan, coupon);
    assert.equal(p.finalAmount, coupon.finalAmount);
    assert.equal(p.amountPaise, Math.round(coupon.finalAmount * 100));
    assert.equal(
      Math.round((p.subtotal + p.gstAmount) * 100) / 100,
      coupon.finalAmount,
      "subtotal + gst === final"
    );
    assert.equal(p.gstRate, 18);
    assert.ok(p.discount >= 0, "discount is never negative");
  }
});

test("29500 coupon yields a clean 25000 + 4500 split", () => {
  const s = splitGstInclusive(29500);
  assert.equal(s.subtotal, 25000);
  assert.equal(s.gstAmount, 4500);
});

test("normalizeCouponCode trims and uppercases", () => {
  assert.equal(normalizeCouponCode("  cbspn2w5w0k0c "), "CBSPN2W5W0K0C");
  assert.equal(normalizeCouponCode(null), "");
});
