// ============================================================================
// backfillStorageUsage.js
//
// Reconciles each company's cached Company.storageBytesUsed counter with the
// ACTUAL bytes stored in S3 (scanned via aggregateUsageByCompany). The counter
// is what the storage-cap enforcement reads, so run this:
//   • once right after applying 0014_add_storage_limits.sql (to seed usage), and
//   • periodically (e.g. nightly cron) to correct any drift from edge cases.
//
// Usage:  node scripts/backfillStorageUsage.js
//
// Safe & idempotent: it only SETS storageBytesUsed to the measured value.
// ============================================================================

import prisma from "../server/lib/prisma.js";
import { aggregateUsageByCompany, isS3Configured } from "../server/lib/s3Storage.js";

async function main() {
  if (!isS3Configured()) {
    console.warn(
      "S3 is not configured; skipping S3 scan. (Local-dev storage is not reconciled by this script.)"
    );
    await prisma.$disconnect();
    return;
  }

  const { byCompany } = await aggregateUsageByCompany();
  const entries = Object.entries(byCompany || {});

  // Reset companies that have NO objects in S3 to 0, then set measured ones.
  const measured = new Map(
    entries.map(([companyId, info]) => [
      companyId,
      Math.max(0, Math.round(Number(info?.bytes || 0))),
    ])
  );

  const companies = await prisma.company.findMany({ select: { id: true } });
  let updated = 0;

  for (const { id } of companies) {
    const bytes = measured.get(id) || 0;
    try {
      await prisma.company.update({
        where: { id },
        data: { storageBytesUsed: BigInt(bytes) },
      });
      updated += 1;
    } catch (error) {
      console.warn(`skip ${id}:`, error?.message);
    }
  }

  console.log(`Reconciled storageBytesUsed for ${updated} companies.`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("backfillStorageUsage failed:", error);
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
