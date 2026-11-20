import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getSectionKey,
  recordSectionModule,
  resolveSectionModule,
} from "./sectionMemory.js";

test("getSectionKey maps admissions markets at market granularity", () => {
  assert.equal(getSectionKey("domestic-counselling"), "admissions:domestic");
  assert.equal(getSectionKey("domestic-admissions"), "admissions:domestic");
  assert.equal(
    getSectionKey("international-walkins"),
    "admissions:international"
  );
});

test("getSectionKey groups overall admissions modules together", () => {
  assert.equal(getSectionKey("admissions"), "admissions:overall");
  assert.equal(getSectionKey("walkins"), "admissions:overall");
  assert.equal(getSectionKey("counselling"), "admissions:overall");
});

test("getSectionKey maps finance + insights, others to themselves", () => {
  assert.equal(getSectionKey("revenue"), "finance");
  assert.equal(getSectionKey("analytics"), "insights");
  assert.equal(getSectionKey("lead-store"), "lead-store");
  assert.equal(getSectionKey("dashboard"), "dashboard");
});

test("getSectionKey is null-safe", () => {
  assert.equal(getSectionKey(undefined), "");
  assert.equal(getSectionKey(null), "");
});

test("recordSectionModule stores fine + coarse admissions keys", () => {
  const mem = {};
  recordSectionModule(mem, "domestic-counselling");
  assert.equal(mem["admissions:domestic"], "domestic-counselling");
  // Coarse key lets the mobile bottom-nav Admissions tab restore across markets.
  assert.equal(mem.admissions, "domestic-counselling");
});

test("recordSectionModule does not set coarse admissions for non-admissions", () => {
  const mem = {};
  recordSectionModule(mem, "revenue");
  assert.equal(mem.finance, "revenue");
  assert.equal(mem.admissions, undefined);
});

test("recordSectionModule ignores empty keys and returns the map", () => {
  const mem = { finance: "revenue" };
  const out = recordSectionModule(mem, "");
  assert.equal(out, mem);
  assert.deepEqual(out, { finance: "revenue" });
});

test("resolveSectionModule prefers remembered page over fallback", () => {
  const mem = { "admissions:domestic": "domestic-counselling" };
  assert.equal(
    resolveSectionModule(mem, "admissions:domestic", "domestic-admissions"),
    "domestic-counselling"
  );
});

test("resolveSectionModule falls back when nothing remembered", () => {
  assert.equal(
    resolveSectionModule({}, "admissions:international", "international-admissions"),
    "international-admissions"
  );
  assert.equal(
    resolveSectionModule(null, "finance", "revenue"),
    "revenue"
  );
});

test("record then resolve round-trips the last visited sub-tab", () => {
  const mem = {};
  recordSectionModule(mem, "domestic-admissions");
  recordSectionModule(mem, "domestic-counselling"); // user moved to counselling
  assert.equal(
    resolveSectionModule(mem, "admissions:domestic", "domestic-admissions"),
    "domestic-counselling"
  );
});
