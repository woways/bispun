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

    // Optional upload-date window (YYYY-MM-DD). "to" is made inclusive of the
    // whole day. These filter by each file's upload time, not historical totals.
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    let to = req.query.to ? new Date(String(req.query.to)) : null;
    if (to && !Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
    }
    const dateFilter = {};
    if (from && !Number.isNaN(from.getTime())) dateFilter.from = from;
    if (to && !Number.isNaN(to.getTime())) dateFilter.to = to;

    const { totalBytes, totalObjects, byCompany } =
      await aggregateUsageByCompany(dateFilter);

    // Full company list drives the filter dropdown, so newly onboarded
    // clients appear automatically even before they store any files.
    const companies = await prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const nameById = new Map(companies.map((c) => [c.id, c.name]));

    const rows = Object.entries(byCompany)
      .map(([companyId, { bytes, objects }]) => {
        const gb = bytes / GB;
        return {
          companyId,
          companyName: nameById.get(companyId) || "(unknown / deleted)",
          bytes,
          gb: Number(gb.toFixed(6)),
          fileCount: objects,
          estMonthlyStorageInr: Number((gb * storageRateInr).toFixed(4)),
        };
      })
      .sort((a, b) => b.bytes - a.bytes);

    const totalGb = totalBytes / GB;

    return res.json({
      success: true,
      storageRateInr,
      filters: {
        from: req.query.from || null,
        to: req.query.to || null,
      },
      allCompanies: companies.map((c) => ({ id: c.id, name: c.name })),
      totals: {
        bytes: totalBytes,
        gb: Number(totalGb.toFixed(6)),
        fileCount: totalObjects,
        estMonthlyStorageInr: Number((totalGb * storageRateInr).toFixed(4)),
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
