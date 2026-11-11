export const REFERRAL_SLABS = [
  { key: "SLAB_1", min: 1, max: 5, rate: 2500, label: "1–5" },
  { key: "SLAB_2", min: 6, max: 10, rate: 3000, label: "6–10" },
  { key: "SLAB_3", min: 11, max: null, rate: 4000, label: "11+" },
];

// Referral lifecycle statuses (PDF §11). REFERRED = verified signup/order started;
// EARNED = payment captured + account activated. Rewards count EARNED only.
export const REFERRAL_STATUS = { REFERRED: "REFERRED", EARNED: "EARNED" };

export function isEarnedStatus(status) {
  return String(status || "").trim().toUpperCase() === REFERRAL_STATUS.EARNED;
}

export function countEarned(referrals) {
  return (Array.isArray(referrals) ? referrals : []).filter((r) => isEarnedStatus(r?.status)).length;
}

// Pure decision for whether a signup should be attributed to a referrer. Keeps
// the self-referral / invalid-code / inactive-referrer rules testable without a DB.
export function shouldAttributeReferral({
  referralCode,
  referrerFound,
  referrerActive,
  referrerEmail,
  referredEmail,
} = {}) {
  if (!String(referralCode || "").trim()) return { ok: false, reason: "NO_CODE" };
  if (!referrerFound) return { ok: false, reason: "UNKNOWN_CODE" };
  if (referrerActive === false) return { ok: false, reason: "INACTIVE_REFERRER" };
  if (
    String(referrerEmail || "").trim().toLowerCase() ===
    String(referredEmail || "").trim().toLowerCase()
  ) {
    return { ok: false, reason: "SELF_REFERRAL" };
  }
  return { ok: true };
}

// User-facing credit expectation (PDF 11.5). This is an expectation shown to
// referrers, NOT an authorization to auto-pay — crediting is a manual Super
// Admin action (11.6/11.7).
export const CREDIT_EXPECTATION_DAYS = { min: 5, max: 8 };

// Aggregate credit state for a referrer. Earnings are an aggregate of
// count x slab-rate, so credit is tracked as an amount, not per referral:
//   earned        = total reward the referrer has qualified for
//   credited      = amount Super Admin has already marked credited (sum of PAID)
//   pendingCredit  = earned still awaiting a Super Admin credit action
export function getReferralCreditState({ totalEarnings, creditedAmount } = {}) {
  const earned = Math.max(0, Math.round(Number(totalEarnings) || 0));
  const credited = Math.max(0, Math.round(Number(creditedAmount) || 0));
  const pendingCredit = Math.max(0, earned - credited);
  return { earned, credited, pendingCredit };
}

// Resolve + validate how much a Super Admin credit action should record.
// Omitting requestedAmount credits the full outstanding balance. Returns a
// discriminated result so callers (and tests) can assert the guard without a DB.
export function resolveCreditAmount({ requestedAmount, pendingCredit } = {}) {
  const outstanding = Math.max(0, Math.round(Number(pendingCredit) || 0));
  if (outstanding <= 0) {
    return { ok: false, reason: "NOTHING_TO_CREDIT", amount: 0 };
  }

  let amount = outstanding;
  if (requestedAmount !== undefined && requestedAmount !== null && requestedAmount !== "") {
    const requested = Number(requestedAmount);
    if (!Number.isFinite(requested) || !Number.isInteger(requested) || requested <= 0) {
      return { ok: false, reason: "INVALID_AMOUNT", amount: 0 };
    }
    if (requested > outstanding) {
      return { ok: false, reason: "EXCEEDS_OUTSTANDING", amount: 0 };
    }
    amount = requested;
  }

  return { ok: true, amount };
}

export function getReferralRewardSummary(successfulCount) {
  const parsed = Number(successfulCount);
  const count = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;

  if (count === 0) {
    return {
      successfulCount: 0,
      slab: null,
      rate: 0,
      totalEarnings: 0,
      nextSlabAt: 1,
    };
  }

  const slab =
    REFERRAL_SLABS.find(
      (item) => count >= item.min && (item.max === null || count <= item.max)
    ) || REFERRAL_SLABS[REFERRAL_SLABS.length - 1];

  return {
    successfulCount: count,
    slab,
    rate: slab.rate,
    totalEarnings: count * slab.rate,
    nextSlabAt:
      slab.max === null ? null : slab.max + 1,
  };
}
