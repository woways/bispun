import test from "node:test";
import assert from "node:assert/strict";

import { buildReferralSignupUrl, readRefFromSearch } from "./referralLink.js";

test("uses configured base when provided", () => {
  assert.equal(
    buildReferralSignupUrl({ configuredBase: "https://bispun.com/signup", code: "ABC123" }),
    "https://bispun.com/signup?ref=ABC123"
  );
});

test("falls back to origin + /signup when no configured base (Dev)", () => {
  assert.equal(
    buildReferralSignupUrl({ origin: "http://localhost:5173", code: "RAVI99" }),
    "http://localhost:5173/signup?ref=RAVI99"
  );
});

test("never hard-codes production; trailing slashes normalized", () => {
  assert.equal(
    buildReferralSignupUrl({ configuredBase: "https://bispun.com/signup/", code: "X1" }),
    "https://bispun.com/signup?ref=X1"
  );
});

test("appends with & when base already has a query", () => {
  assert.equal(
    buildReferralSignupUrl({ configuredBase: "https://bispun.com/signup?plan=pro", code: "X1" }),
    "https://bispun.com/signup?plan=pro&ref=X1"
  );
});

test("no code -> base URL without ref", () => {
  assert.equal(
    buildReferralSignupUrl({ configuredBase: "https://bispun.com/signup" }),
    "https://bispun.com/signup"
  );
});

test("code is URL-safe already but encoded defensively", () => {
  assert.equal(
    buildReferralSignupUrl({ configuredBase: "https://x/signup", code: "A B" }),
    "https://x/signup?ref=A%20B"
  );
});

test("readRefFromSearch extracts and sanitizes the code", () => {
  assert.equal(readRefFromSearch("?ref=ravi99"), "RAVI99");
  assert.equal(readRefFromSearch("?ref=RA-VI_99&x=1"), "RAVI99");
  assert.equal(readRefFromSearch("?x=1"), "");
  assert.equal(readRefFromSearch(""), "");
});

test("readRefFromSearch caps length (no abuse)", () => {
  const long = "A".repeat(100);
  assert.equal(readRefFromSearch(`?ref=${long}`).length, 32);
});
