import test from "node:test";
import assert from "node:assert/strict";

import { donutCenterTotal } from "./donutCenterTotal.js";

const sliceSum = (slices) =>
  slices.reduce((sum, item) => sum + Number(item.value || 0), 0);

// 1. All leads have a source: leadsBySourceTotal equals the slice sum and is
//    what gets displayed (no sourceless leads, so it also equals the grand
//    total — but the helper must read the grouped field, not a grand total).
test("all leads sourced: returns the source-grouped total (== slice sum)", () => {
  const slices = [
    { name: "Website", value: 4 },
    { name: "Referral", value: 3 },
    { name: "Walk-in", value: 2 },
  ];
  const data = { leadsBySource: slices, leadsBySourceTotal: sliceSum(slices) };
  assert.equal(donutCenterTotal(data), 9);
  assert.equal(donutCenterTotal(data), sliceSum(slices));
});

// 2. Some leads have NO source: the grand total (summary.totalLeads) would be
//    larger than the slice sum. The center must show the slice-matching
//    grouped total, never the grand total.
test("some leads sourceless: center matches slices, not the grand total", () => {
  const slices = [
    { name: "Website", value: 4 },
    { name: "Referral", value: 3 },
  ];
  const grandTotal = 10; // 3 leads had no source bucket
  const data = {
    leadsBySource: slices,
    leadsBySourceTotal: sliceSum(slices), // 7
    summary: { totalLeads: grandTotal },
  };
  assert.equal(donutCenterTotal(data), 7);
  assert.equal(donutCenterTotal(data), sliceSum(slices));
  assert.notEqual(donutCenterTotal(data), grandTotal);
});

// 3. The source-grouped total always equals the sum of the displayed slices
//    (the core invariant this fix restores).
test("center total equals the sum of the drawn slices", () => {
  const slices = [
    { name: "Instagram", value: 11 },
    { name: "Google", value: 6 },
    { name: "Direct", value: 1 },
  ];
  const data = { leadsBySource: slices, leadsBySourceTotal: sliceSum(slices) };
  assert.equal(donutCenterTotal(data), sliceSum(slices));
});

// 4. Zero leads: a legitimate 0 must be preserved (regression guard for `??`
//    vs `||` — `||` would wrongly fall through on 0).
test("zero leads: preserves a legitimate 0", () => {
  const data = { leadsBySource: [], leadsBySourceTotal: 0 };
  assert.equal(donutCenterTotal(data), 0);
});

// 5. Missing/undefined grouped total: fall back to summing the slices so the
//    label still renders correctly.
test("missing grouped total: falls back to the slice sum", () => {
  const slices = [
    { name: "Website", value: 5 },
    { name: "Referral", value: 2 },
  ];
  assert.equal(donutCenterTotal({ leadsBySource: slices }), 7); // undefined
  assert.equal(
    donutCenterTotal({ leadsBySource: slices, leadsBySourceTotal: null }),
    7
  );
});

// Defensive: completely empty/undefined data must not throw.
test("empty data: returns 0 without throwing", () => {
  assert.equal(donutCenterTotal({}), 0);
  assert.equal(donutCenterTotal(undefined), 0);
});
