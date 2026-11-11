import test from "node:test";
import assert from "node:assert/strict";

import {
  REFERRAL_SLABS,
  CREDIT_EXPECTATION_DAYS,
  getReferralRewardSummary,
  getReferralCreditState,
  resolveCreditAmount,
} from "./referralRewards.js";

test("no successful referrals earns nothing and targets slab 1", () => {
  const s = getReferralRewardSummary(0);
  assert.equal(s.successfulCount, 0);
  assert.equal(s.rate, 0);
  assert.equal(s.totalEarnings, 0);
  assert.equal(s.nextSlabAt, 1);
  assert.equal(s.slab, null);
});

test("slab 1 (1-5) uses the configured rate and multiplies by count", () => {
  const s = getReferralRewardSummary(3);
  assert.equal(s.slab.key, "SLAB_1");
  assert.equal(s.rate, 2500);
  assert.equal(s.totalEarnings, 3 * 2500);
});

test("slab boundaries select the correct tier", () => {
  assert.equal(getReferralRewardSummary(5).slab.key, "SLAB_1");
  assert.equal(getReferralRewardSummary(6).slab.key, "SLAB_2");
  assert.equal(getReferralRewardSummary(10).slab.key, "SLAB_2");
  assert.equal(getReferralRewardSummary(11).slab.key, "SLAB_3");
  assert.equal(getReferralRewardSummary(50).slab.key, "SLAB_3");
});

test("top slab has no next threshold", () => {
  assert.equal(getReferralRewardSummary(11).nextSlabAt, null);
});

test("negative / junk counts are clamped to zero", () => {
  assert.equal(getReferralRewardSummary(-4).totalEarnings, 0);
  assert.equal(getReferralRewardSummary("abc").totalEarnings, 0);
});

test("slab config stays as the approved business rule", () => {
  // Guards against accidental edits to money rules.
  assert.deepEqual(
    REFERRAL_SLABS.map((s) => [s.min, s.max, s.rate]),
    [
      [1, 5, 2500],
      [6, 10, 3000],
      [11, null, 4000],
    ]
  );
});

test("credit state splits earned into credited and pending", () => {
  assert.deepEqual(getReferralCreditState({ totalEarnings: 10000, creditedAmount: 4000 }), {
    earned: 10000,
    credited: 4000,
    pendingCredit: 6000,
  });
});

test("credit state never goes negative when over-credited or empty", () => {
  assert.equal(getReferralCreditState({ totalEarnings: 2000, creditedAmount: 5000 }).pendingCredit, 0);
  assert.equal(getReferralCreditState({}).pendingCredit, 0);
});

test("resolveCreditAmount defaults to the full outstanding balance", () => {
  assert.deepEqual(resolveCreditAmount({ pendingCredit: 6000 }), { ok: true, amount: 6000 });
});

test("resolveCreditAmount rejects when nothing is outstanding (double-credit guard)", () => {
  assert.deepEqual(resolveCreditAmount({ pendingCredit: 0 }), {
    ok: false,
    reason: "NOTHING_TO_CREDIT",
    amount: 0,
  });
});

test("resolveCreditAmount rejects amounts above the outstanding balance", () => {
  assert.equal(resolveCreditAmount({ requestedAmount: 9000, pendingCredit: 6000 }).ok, false);
  assert.equal(resolveCreditAmount({ requestedAmount: 9000, pendingCredit: 6000 }).reason, "EXCEEDS_OUTSTANDING");
});

test("resolveCreditAmount rejects non-positive / non-integer amounts", () => {
  assert.equal(resolveCreditAmount({ requestedAmount: 0, pendingCredit: 6000 }).reason, "INVALID_AMOUNT");
  assert.equal(resolveCreditAmount({ requestedAmount: -100, pendingCredit: 6000 }).reason, "INVALID_AMOUNT");
  assert.equal(resolveCreditAmount({ requestedAmount: 12.5, pendingCredit: 6000 }).reason, "INVALID_AMOUNT");
});

test("resolveCreditAmount accepts a valid partial credit", () => {
  assert.deepEqual(resolveCreditAmount({ requestedAmount: 2500, pendingCredit: 6000 }), {
    ok: true,
    amount: 2500,
  });
});

test("credit expectation window is the PDF 11.5 range", () => {
  assert.deepEqual(CREDIT_EXPECTATION_DAYS, { min: 5, max: 8 });
});

test("a new credit excludes legacy reserved amounts (no double-credit)", () => {
  // Models POST /credit: creditable = earned − (already-paid + reserved-by-legacy).
  const earned = 10000;
  const paid = 0;
  const reserved = 4000; // a legacy PENDING/APPROVED payout request still open
  const { pendingCredit } = getReferralCreditState({
    totalEarnings: earned,
    creditedAmount: paid + reserved,
  });
  assert.equal(pendingCredit, 6000);
  assert.deepEqual(resolveCreditAmount({ pendingCredit }), { ok: true, amount: 6000 });
});
