// ============================================================================
// provisionQaTestCompany.js
//
// Creates ONE isolated QA test company + one CLIENT_ADMIN, inside a single
// transaction. No OTP, no Razorpay, no payment side-effects. Dry-run by
// default; pass --execute to write.
//
// SAFETY: a host-guard aborts unless the resolved DATABASE_URL host matches
// QA_EXPECTED_DB_HOST (default "localhost") and is NOT a Neon host. This script
// must never run against production (pond / ep-weathered-*) or the shared dev DB
// (blue-mouse / ep-blue-mouse-*).
//
// Env: DATABASE_URL, QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD, QA_EXPECTED_DB_HOST,
//      QA_COMPANY_SLUG (optional, default "qa-test-co").
//
// NOTE: This script was absent from the approved baseline (HEAD 59a9908); it is
// recreated here on the qa-fix/e2e-20261112 branch to support isolated QA.
// ============================================================================
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const EXECUTE = process.argv.includes("--execute");

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

// ---- Host guard -----------------------------------------------------------
const FORBIDDEN = /neon\.tech|ep-weathered|ep-blue-mouse|pond|blue-mouse/i;
function assertSafeHost() {
  const expected = (process.env.QA_EXPECTED_DB_HOST || "localhost").trim();
  const raw = requiredEnv("DATABASE_URL");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }
  if (FORBIDDEN.test(raw)) {
    throw new Error(
      `ABORT: DATABASE_URL points at a forbidden (Neon prod/dev) host. Refusing to run.`
    );
  }
  if (url.hostname !== expected) {
    throw new Error(
      `ABORT: DATABASE_URL host "${url.hostname}" != QA_EXPECTED_DB_HOST "${expected}". Refusing to run.`
    );
  }
  console.log(`[guard] OK — host=${url.hostname} db=${url.pathname} (expected ${expected})`);
  return { host: url.hostname, db: url.pathname.replace(/^\//, "") };
}

const connectionString = requiredEnv("DATABASE_URL");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  assertSafeHost();

  const slug = (process.env.QA_COMPANY_SLUG || "qa-test-co").trim();
  const adminEmail = requiredEnv("QA_ADMIN_EMAIL").toLowerCase();
  const adminPassword = requiredEnv("QA_ADMIN_PASSWORD");

  console.log(`\n[provision] mode=${EXECUTE ? "EXECUTE (writes)" : "DRY-RUN (no writes)"}`);
  console.log(`[provision] company slug=${slug}, admin=${adminEmail}`);

  // Pro plan + its modules must exist (seed baseline). Enable all plan modules
  // on the new company so every feature area is testable.
  const proPlan = await prisma.plan.findUnique({
    where: { key: "pro" },
    include: { planModules: true },
  });
  if (!proPlan) {
    throw new Error("Pro plan not found — run `node prisma/seed.js` first.");
  }

  const existingCompany = await prisma.company.findUnique({ where: { slug } });
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  console.log(
    `[provision] existing company: ${existingCompany ? existingCompany.id : "none"}; existing admin user: ${existingUser ? existingUser.id : "none"}`
  );

  if (!EXECUTE) {
    console.log(
      `\n[dry-run] Would create: Company(slug=${slug}, status=ACTIVE), ` +
        `CompanySettings, ${proPlan.planModules.length} CompanyModule rows, ` +
        `1 ACTIVE YEARLY Subscription, and CLIENT_ADMIN user(${adminEmail}). ` +
        `No OTP / Razorpay / payment. Re-run with --execute to write.`
    );
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const renewalDate = new Date();
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { slug },
      update: { status: "ACTIVE", name: "QA Test Co" },
      create: {
        name: "QA Test Co",
        slug,
        brandName: "QA Test CRM",
        shortName: "QA",
        business: "Education Consultancy",
        ownerName: "QA Owner",
        city: "Testville",
        primaryColor: "indigo",
        status: "ACTIVE",
      },
    });

    await tx.companySettings.upsert({
      where: { companyId: company.id },
      update: {},
      create: {
        companyId: company.id,
        portalName: "QA Test CRM",
        primaryColor: "indigo",
        timezone: "Asia/Kolkata",
        currency: "INR",
        dateFormat: "DD/MM/YYYY",
        emailNotifications: true,
        smsNotifications: false,
      },
    });

    for (const pm of proPlan.planModules) {
      await tx.companyModule.upsert({
        where: {
          companyId_moduleId: { companyId: company.id, moduleId: pm.moduleId },
        },
        update: { enabled: true },
        create: { companyId: company.id, moduleId: pm.moduleId, enabled: true },
      });
    }

    const activeSub = await tx.subscription.findFirst({
      where: { companyId: company.id, status: "ACTIVE" },
    });
    if (!activeSub) {
      await tx.subscription.create({
        data: {
          companyId: company.id,
          planId: proPlan.id,
          status: "ACTIVE",
          billingCycle: "YEARLY",
          startDate: new Date(),
          renewalDate,
          amount: 54000,
        },
      });
    }

    const admin = await tx.user.upsert({
      where: { email: adminEmail },
      update: { role: "CLIENT_ADMIN", active: true, companyId: company.id },
      create: {
        name: "QA Client Admin",
        email: adminEmail,
        passwordHash,
        role: "CLIENT_ADMIN",
        active: true,
        companyId: company.id,
        canManageUsers: true,
        canManageSettings: true,
        canManageBilling: true,
        canViewAnalytics: true,
        canManageAdmissions: true,
        canManageRevenue: true,
        canManageLeads: true,
        canManageSupport: true,
        canViewTeamTargets: true,
      },
    });

    return { companyId: company.id, adminId: admin.id };
  });

  console.log(
    `\n[provision] DONE — companyId=${result.companyId}, adminId=${result.adminId}`
  );
}

main()
  .catch((error) => {
    console.error("\n[provision] FAILED:");
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
