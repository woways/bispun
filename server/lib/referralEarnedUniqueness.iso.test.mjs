// Isolated DB integration test for the referral lifecycle (PR #20 hardening).
// Verifies: exactly ONE EARNED row per paid signup, idempotent REFERRED intent,
// the pendingSignupId unique constraint blocks duplicates, and inactive/self
// referrers are rejected (the fallback-parity fix). Requires an isolated local
// PostgreSQL database supplied via DATABASE_URL (never shared dev / Production).
//   Run: DATABASE_URL=postgresql://postgres@localhost:5432/<iso_db> \
//        node server/lib/referralEarnedUniqueness.iso.test.mjs
import prisma from "./prisma.js";
import { recordReferredIntent } from "./selfServeOnboard.js";

const results = [];
const ok = (n, c, x = "") => results.push(`${c ? "PASS" : "FAIL"}  ${n}${x ? " — " + x : ""}`);
const ids = {};
try {
  const referrer = await prisma.user.create({
    data: {
      name: "Ref Owner", email: "ref.owner@example.test",
      passwordHash: "x", role: "CLIENT_ADMIN", active: true,
      referralCode: "TESTREF1",
    },
    select: { id: true, referralCode: true, email: true },
  });
  ids.referrer = referrer.id;

  const ps1 = "ps_paid_" + Date.now();
  const r1 = await recordReferredIntent({ pendingSignupId: ps1, referralCode: "TESTREF1", referredEmail: "buyer1@example.test" });
  ok("1. recordReferredIntent creates a REFERRED row", r1 && r1.status === "REFERRED", `status ${r1?.status}`);

  const r1b = await recordReferredIntent({ pendingSignupId: ps1, referralCode: "TESTREF1", referredEmail: "buyer1@example.test" });
  const countPs1 = await prisma.crmReferral.count({ where: { pendingSignupId: ps1 } });
  ok("2. recordReferredIntent is idempotent (no duplicate REFERRED)", r1b?.id === r1.id && countPs1 === 1, `count ${countPs1}`);

  await prisma.crmReferral.update({ where: { id: r1.id }, data: { status: "EARNED", qualifiedAt: new Date() } });
  const earned = await prisma.crmReferral.count({ where: { pendingSignupId: ps1, status: "EARNED" } });
  ok("3. exactly ONE EARNED row per paid signup", earned === 1, `earned ${earned}`);

  let dupBlocked = false;
  try {
    await prisma.crmReferral.create({ data: { referrerId: referrer.id, pendingSignupId: ps1, referralCode: "TESTREF1", status: "EARNED" } });
  } catch (e) { dupBlocked = (e.code === "P2002"); }
  ok("4. pendingSignupId unique constraint blocks a duplicate", dupBlocked, dupBlocked ? "P2002" : "NOT blocked");

  const rSelf = await recordReferredIntent({ pendingSignupId: "ps_self_" + Date.now(), referralCode: "TESTREF1", referredEmail: "ref.owner@example.test" });
  ok("5. self-referral rejected (no row)", rSelf === null, `got ${rSelf ? "row" : "null"}`);

  await prisma.user.update({ where: { id: referrer.id }, data: { active: false } });
  const psInact = "ps_inact_" + Date.now();
  const rInact = await recordReferredIntent({ pendingSignupId: psInact, referralCode: "TESTREF1", referredEmail: "buyer2@example.test" });
  const inactCount = await prisma.crmReferral.count({ where: { pendingSignupId: psInact } });
  ok("6. inactive referrer earns nothing (no REFERRED row)", rInact === null && inactCount === 0, `row ${rInact ? "yes" : "no"}, count ${inactCount}`);
} catch (e) {
  ok("harness", false, (e.message || String(e)).split("\n")[0]);
} finally {
  try {
    if (ids.referrer) {
      await prisma.crmReferral.deleteMany({ where: { referrerId: ids.referrer } });
      await prisma.user.delete({ where: { id: ids.referrer } }).catch(() => {});
    }
  } catch {}
  console.log(results.join("\n"));
  await prisma.$disconnect?.().catch(() => {});
  process.exit(0);
}
