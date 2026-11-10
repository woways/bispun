import { test } from "node:test";
import assert from "node:assert/strict";

import { buildLeadsBySource } from "./leadsBySource.js";

const LABELS = { WEBSITE: "Website", REFERRAL: "Referral" };

test("mixed sources are counted and sorted by volume desc", () => {
  const { leadsBySource, leadsBySourceTotal } = buildLeadsBySource(
    [
      { source: "WEBSITE" },
      { source: "WEBSITE" },
      { source: "REFERRAL" },
    ],
    0,
    LABELS
  );
  assert.deepEqual(leadsBySource, [
    { name: "Website", value: 2 },
    { name: "Referral", value: 1 },
  ]);
  assert.equal(leadsBySourceTotal, 3);
});

test("blank/missing source falls into the Unspecified bucket", () => {
  const { leadsBySource, leadsBySourceTotal } = buildLeadsBySource(
    [{ source: "" }, { source: null }, { source: "WEBSITE" }],
    0,
    LABELS
  );
  const unspecified = leadsBySource.find((r) => r.name === "Unspecified");
  assert.equal(unspecified.value, 2);
  assert.equal(leadsBySourceTotal, 3);
});

test("zero data yields an empty breakdown and zero total", () => {
  const { leadsBySource, leadsBySourceTotal } = buildLeadsBySource([], 0, LABELS);
  assert.deepEqual(leadsBySource, []);
  assert.equal(leadsBySourceTotal, 0);
});

test("direct admissions are a bucket AND included in the total (reconciles donut)", () => {
  const { leadsBySource, leadsBySourceTotal } = buildLeadsBySource(
    [{ source: "WEBSITE" }, { source: "WEBSITE" }],
    3,
    LABELS
  );
  const direct = leadsBySource.find((r) => r.name === "Direct Admission");
  assert.equal(direct.value, 3);
  // center total (leadsBySourceTotal) MUST equal the sum of the slices
  const sliceSum = leadsBySource.reduce((s, r) => s + r.value, 0);
  assert.equal(leadsBySourceTotal, sliceSum);
  assert.equal(leadsBySourceTotal, 5);
});

test("no direct admissions means no Direct Admission bucket", () => {
  const { leadsBySource } = buildLeadsBySource([{ source: "WEBSITE" }], 0, LABELS);
  assert.equal(
    leadsBySource.find((r) => r.name === "Direct Admission"),
    undefined
  );
});
