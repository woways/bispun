import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { aggregateUsageByCompany } from "../lib/s3Storage.js";

/* ------------------------------------------------------------------ */
/*  Super-admin S3 storage usage + cost panel.                        */
/*  Scans the Bispun bucket, groups by company (first key segment),   */
/*  and estimates monthly storage cost in INR.                        */
/*  Note: this reflects STORAGE only. Data-transfer (download/egress) */
/*  is the main cost driver and is billed by AWS separately.          */
/* ------------------------------------------------------------------ */

const router = Router();

router.use(requireSuperAdmin);

const GB = 1024 * 1024 * 1024;

router.get("/", async (req, res) => {
  try {
    // ₹/GB-month storage rate (S3 Standard, Mumbai ≈ ₹2.1). Overridable.
    const storageRateInr = Number(
      process.env.S3_STORAGE_RATE_INR_PER_GB || 2.1
    );

    const { totalBytes, totalObjects, byCompany } =
      await aggregateUsageByCompany();

    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
    });
    const nameById = new Map(companies.map((c) => [c.id, c.name]));

    const rows = Object.entries(byCompany)
      .map(([companyId, { bytes, objects }]) => {
        const gb = bytes / GB;
        return {
          companyId,
          companyName: nameById.get(companyId) || "(unknown / deleted)",
          bytes,
          gb: Number(gb.toFixed(4)),
          fileCount: objects,
          estMonthlyStorageInr: Number((gb * storageRateInr).toFixed(2)),
        };
      })
      .sort((a, b) => b.bytes - a.bytes);

    const totalGb = totalBytes / GB;

    return res.json({
      success: true,
      storageRateInr,
      totals: {
        bytes: totalBytes,
        gb: Number(totalGb.toFixed(4)),
        fileCount: totalObjects,
        estMonthlyStorageInr: Number((totalGb * storageRateInr).toFixed(2)),
        companyCount: rows.length,
      },
      companies: rows,
    });
  } catch (error) {
    console.error("S3 usage report failed:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Unable to load storage usage",
    });
  }
});

export default router;
