/**
 * One-time backfill for the granular page-access feature.
 *
 * Existing non-admin users have pageAccess = null, which the new code treats as
 * an EMPTY scope (they would see zero admissions / sections). This script gives
 * every such user a pageAccess that mirrors the access they already had via the
 * legacy boolean flags, so their experience does not change until an admin
 * deliberately narrows them.
 *
 *   admissions.all  = canManageAdmissions
 *   finance.all     = canManageRevenue   (+ all sections)
 *   insights.all    = canViewAnalytics   (+ all sections)
 *
 * Safe to re-run: it only touches users whose pageAccess is still null.
 * CLIENT_ADMIN and SUPER_ADMIN are skipped (admins are always full access).
 *
 * Run from the project root AFTER `npx prisma generate && npx prisma db push`:
 *   node scripts/backfillPageAccess.js
 */
import prisma from "../server/lib/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: { notIn: ["SUPER_ADMIN", "CLIENT_ADMIN"] },
      pageAccess: { equals: null },
    },
    select: {
      id: true,
      name: true,
      email: true,
      canManageAdmissions: true,
      canManageRevenue: true,
      canViewAnalytics: true,
    },
  });

  console.log(`Found ${users.length} user(s) needing backfill.`);

  let updated = 0;
  for (const u of users) {
    const pageAccess = {
      admissions: {
        all: u.canManageAdmissions === true,
        markets: [],
        streamIds: [],
        collegeIds: [],
        branchIds: [],
      },
      finance: {
        all: u.canManageRevenue === true,
        sections: u.canManageRevenue === true
          ? ["overview", "expenses", "incentives"]
          : [],
      },
      insights: {
        all: u.canViewAnalytics === true,
        sections: u.canViewAnalytics === true
          ? ["overview", "comparison"]
          : [],
      },
    };

    await prisma.user.update({ where: { id: u.id }, data: { pageAccess } });
    updated += 1;
    console.log(`  ✓ ${u.name} <${u.email}>`);
  }

  console.log(`\nDone. Updated ${updated} user(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
