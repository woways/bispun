export const REFERRAL_SLABS = [
  { key: "SLAB_1", min: 1, max: 5, rate: 2500, label: "1–5" },
  { key: "SLAB_2", min: 6, max: 10, rate: 3000, label: "6–10" },
  { key: "SLAB_3", min: 11, max: null, rate: 4000, label: "11+" },
];

export function getReferralRewardSummary(successfulCount) {
  const count = Math.max(0, Number(successfulCount || 0));

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
