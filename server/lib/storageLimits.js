// Per-plan storage cap + per-company usage accounting.
//
// Usage is kept as a cached counter (Company.storageBytesUsed) rather than
// scanning S3 on every upload — enforcement is then a single cheap read. The
// counter is bumped up on upload and down on delete (see s3Storage.js), and can
// be reconciled from S3 at any time via scripts/backfillStorageUsage.js.
//
// A plan's storageLimitMb of null/0 means UNLIMITED (no cap).

import prisma from "./prisma.js";

export const BYTES_PER_MB = 1024 * 1024;

// Resolve the company's current plan storage limit (MB), or null for unlimited.
export async function getPlanStorageLimitMb(companyId) {
  if (!companyId) return null;
  try {
    const sub = await prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
    const mb = sub?.plan?.storageLimitMb;
    return Number.isFinite(mb) && mb > 0 ? mb : null;
  } catch {
    return null;
  }
}

export async function getStorageStatus(companyId) {
  const [company, limitMb] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: { storageBytesUsed: true },
    }),
    getPlanStorageLimitMb(companyId),
  ]);

  const usedBytes = Number(company?.storageBytesUsed || 0);
  const limitBytes = limitMb ? limitMb * BYTES_PER_MB : null;

  return {
    usedBytes,
    limitMb,
    limitBytes,
    unlimited: limitBytes == null,
    remainingBytes: limitBytes == null ? null : Math.max(0, limitBytes - usedBytes),
    usedPercent: limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0,
  };
}

// Throws a typed error (statusCode 413, code STORAGE_LIMIT_EXCEEDED) when the
// incoming upload would push the company over its plan's storage limit.
export async function assertCanUpload(companyId, incomingBytes) {
  if (!companyId || !incomingBytes) return;
  const { limitBytes, usedBytes } = await getStorageStatus(companyId);
  if (limitBytes != null && usedBytes + incomingBytes > limitBytes) {
    const error = new Error(
      "Storage limit reached. Delete some files or upgrade your plan to upload more."
    );
    error.statusCode = 413;
    error.code = "STORAGE_LIMIT_EXCEEDED";
    throw error;
  }
}

export async function addStorageUsage(companyId, bytes) {
  const amount = Math.max(0, Math.round(Number(bytes) || 0));
  if (!companyId || !amount) return;
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { storageBytesUsed: { increment: BigInt(amount) } },
    });
  } catch (error) {
    console.warn("addStorageUsage failed:", error?.message);
  }
}

export async function subtractStorageUsage(companyId, bytes) {
  const amount = Math.max(0, Math.round(Number(bytes) || 0));
  if (!companyId || !amount) return;
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { storageBytesUsed: true },
    });
    const current = BigInt(company?.storageBytesUsed || 0);
    const dec = BigInt(amount);
    const next = current > dec ? current - dec : 0n;
    await prisma.company.update({
      where: { id: companyId },
      data: { storageBytesUsed: next },
    });
  } catch (error) {
    console.warn("subtractStorageUsage failed:", error?.message);
  }
}
