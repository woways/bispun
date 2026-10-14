import { Router } from "express";

import prisma from "../lib/prisma.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);

router.use(
  requireClientPermission(
    "canManageRevenue",
    "You do not have permission to access revenue"
  )
);

/* =========================================================
   Helpers
========================================================= */

function parseYear(value) {
  if (!value || value === "all") return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

function yearRange(year) {
  if (!year) return null;
  return {
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1),
  };
}

function num(value) {
  return Number(value || 0);
}

// Suggested starting ladders (used only to pre-fill the editor on the client;
// nothing is written to the DB until the admin saves).
const DEFAULT_COLLEGE_SLABS = [
  { minAdmissions: 1, maxAdmissions: 2, amount: 30000 },
  { minAdmissions: 3, maxAdmissions: 5, amount: 35000 },
  { minAdmissions: 6, maxAdmissions: null, amount: 40000 },
];

const DEFAULT_EMPLOYEE_SLABS = [
  { minAdmissions: 1, maxAdmissions: 5, amount: 2000 },
  { minAdmissions: 6, maxAdmissions: 10, amount: 2500 },
  { minAdmissions: 11, maxAdmissions: 15, amount: 3000 },
  { minAdmissions: 16, maxAdmissions: 20, amount: 3500 },
  { minAdmissions: 21, maxAdmissions: 25, amount: 4000 },
  { minAdmissions: 26, maxAdmissions: null, amount: 5000 },
];

// Pick the band an admission count falls into (highest matching min wins).
function applicableSlab(slabs, count) {
  return (
    [...slabs]
      .sort((a, b) => b.minAdmissions - a.minAdmissions)
      .find((slab) => {
        const meetsMin = count >= slab.minAdmissions;
        const meetsMax =
          slab.maxAdmissions === null ||
          slab.maxAdmissions === undefined ||
          count <= slab.maxAdmissions;
        return meetsMin && meetsMax;
      }) || null
  );
}

function slabLabel(slab) {
  if (!slab) return null;
  return slab.maxAdmissions
    ? `${slab.minAdmissions}-${slab.maxAdmissions}`
    : `${slab.minAdmissions}+`;
}

// Validate + normalise a slab array coming from the client.
function cleanSlabs(raw) {
  if (!Array.isArray(raw)) {
    throw new Error("Slabs must be a list");
  }

  const cleaned = raw
    .map((slab) => {
      const minAdmissions = Number(slab?.minAdmissions);
      const hasMax =
        slab?.maxAdmissions !== null &&
        slab?.maxAdmissions !== undefined &&
        slab?.maxAdmissions !== "";
      const maxAdmissions = hasMax ? Number(slab.maxAdmissions) : null;
      const amount = Number(slab?.amount);

      if (!Number.isInteger(minAdmissions) || minAdmissions < 1) {
        throw new Error("Each slab needs a 'from' count of 1 or more");
      }
      if (maxAdmissions !== null) {
        if (!Number.isInteger(maxAdmissions) || maxAdmissions < minAdmissions) {
          throw new Error(
            "Each slab's 'to' count must be empty or greater than or equal to its 'from' count"
          );
        }
      }
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Each slab's rate must be zero or more");
      }

      return { minAdmissions, maxAdmissions, amount };
    })
    .sort((a, b) => a.minAdmissions - b.minAdmissions);

  // Reject duplicate / overlapping bands.
  for (let i = 0; i < cleaned.length; i += 1) {
    const current = cleaned[i];
    const previous = cleaned[i - 1];
    if (previous) {
      const prevMax =
        previous.maxAdmissions === null
          ? Number.POSITIVE_INFINITY
          : previous.maxAdmissions;
      if (current.minAdmissions <= prevMax) {
        throw new Error("Slab bands must not overlap");
      }
    }
  }

  return cleaned;
}

/* =========================================================
   GET /  -> computed college revenue + employee incentives
========================================================= */

router.get("/", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const selectedYear = parseYear(req.query.year);
    const dateFilter = selectedYear
      ? { admissionDate: yearRange(selectedYear) }
      : {};

    const admissionWhere = {
      companyId,
      status: { not: "CANCELLED" },
      ...dateFilter,
    };

    const [
      partners,
      partnerGroups,
      employeeGroups,
      revenueSlabs,
      employeeSlabs,
    ] = await Promise.all([
      prisma.admissionPartner.findMany({
        where: { companyId, active: true },
        select: { id: true, name: true, slug: true },
        orderBy: { sortOrder: "asc" },
      }),

      prisma.admission.groupBy({
        by: ["partnerId", "revenueStatus", "amountStatus"],
        where: admissionWhere,
        _count: { id: true },
      }),

      prisma.admission.groupBy({
        by: ["counsellorName"],
        where: admissionWhere,
        _count: { id: true },
      }),

      prisma.admissionRevenueSlab.findMany({
        where: { companyId },
        orderBy: { minAdmissions: "asc" },
      }),

      prisma.employeeIncentiveSlab.findMany({
        where: { companyId },
        orderBy: { minAdmissions: "asc" },
      }),
    ]);

    // ---- Slab lookup maps ----
    const slabsByPartner = new Map();
    for (const slab of revenueSlabs) {
      const list = slabsByPartner.get(slab.partnerId) || [];
      list.push({
        id: slab.id,
        minAdmissions: slab.minAdmissions,
        maxAdmissions: slab.maxAdmissions,
        amount: num(slab.amount),
      });
      slabsByPartner.set(slab.partnerId, list);
    }

    const slabsByEmployee = new Map();
    for (const slab of employeeSlabs) {
      const list = slabsByEmployee.get(slab.counsellorName) || [];
      list.push({
        id: slab.id,
        minAdmissions: slab.minAdmissions,
        maxAdmissions: slab.maxAdmissions,
        amount: num(slab.amount),
      });
      slabsByEmployee.set(slab.counsellorName, list);
    }

    // ---- Admission counts per college (partner) ----
    const countsByPartner = new Map();
    for (const group of partnerGroups) {
      if (!group.partnerId) continue; // unassigned admissions have no college card
      const current =
        countsByPartner.get(group.partnerId) || {
          inBucket: 0,
          bufferZone: 0,
          received: 0,
          pending: 0,
        };
      const n = group._count.id;
      if (group.revenueStatus === "IN_BUCKET") {
        current.inBucket += n;
        if (group.amountStatus === "RECEIVED") current.received += n;
        else current.pending += n;
      } else {
        current.bufferZone += n;
      }
      countsByPartner.set(group.partnerId, current);
    }

    const colleges = partners.map((partner) => {
      const counts =
        countsByPartner.get(partner.id) || {
          inBucket: 0,
          bufferZone: 0,
          received: 0,
          pending: 0,
        };
      const slabs = slabsByPartner.get(partner.id) || [];
      const totalAdmissions = counts.inBucket + counts.bufferZone;
      const slab = applicableSlab(slabs, totalAdmissions);
      const rate = slab ? slab.amount : 0;

      return {
        id: partner.id,
        name: partner.name,
        slug: partner.slug,
        totalAdmissions,
        inBucketAdmissions: counts.inBucket,
        bufferZoneAdmissions: counts.bufferZone,
        receivedAdmissions: counts.received,
        pendingAdmissions: counts.pending,
        hasSlabs: slabs.length > 0,
        slabs,
        applicableSlab: slab,
        slabLabel: slabLabel(slab),
        rate,
        inBucketRevenue: counts.inBucket * rate,
        bufferZoneRevenue: counts.bufferZone * rate,
        receivedRevenue: counts.received * rate,
        pendingRevenue: counts.pending * rate,
        totalPotential: totalAdmissions * rate,
      };
    });

    // ---- Employee incentives ----
    const employees = employeeGroups
      .filter((group) => group.counsellorName && group.counsellorName.trim())
      .map((group) => {
        const name = group.counsellorName;
        const admissions = group._count.id;
        const slabs = slabsByEmployee.get(name) || [];
        const slab = applicableSlab(slabs, admissions);
        const rate = slab ? slab.amount : 0;
        return {
          name,
          admissions,
          hasSlabs: slabs.length > 0,
          slabs,
          applicableSlab: slab,
          slabLabel: slabLabel(slab),
          rate,
          incentiveAmount: admissions * rate,
        };
      })
      .sort((a, b) => b.admissions - a.admissions);

    const totals = {
      inBucketRevenue: colleges.reduce((t, c) => t + c.inBucketRevenue, 0),
      bufferZoneRevenue: colleges.reduce((t, c) => t + c.bufferZoneRevenue, 0),
      totalPotential: colleges.reduce((t, c) => t + c.totalPotential, 0),
      receivedRevenue: colleges.reduce((t, c) => t + c.receivedRevenue, 0),
      pendingRevenue: colleges.reduce((t, c) => t + c.pendingRevenue, 0),
      totalIncentives: employees.reduce((t, e) => t + e.incentiveAmount, 0),
    };

    return res.json({
      colleges,
      employees,
      totals,
      defaults: {
        college: DEFAULT_COLLEGE_SLABS,
        employee: DEFAULT_EMPLOYEE_SLABS,
      },
    });
  } catch (error) {
    console.error("Failed to load revenue slabs:", error);
    return res
      .status(500)
      .json({ message: "Unable to load revenue slabs" });
  }
});

/* =========================================================
   PUT /college/:partnerId  -> replace a college's slabs
========================================================= */

router.put("/college/:partnerId", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const { partnerId } = req.params;

    const partner = await prisma.admissionPartner.findFirst({
      where: { id: partnerId, companyId },
      select: { id: true },
    });
    if (!partner) {
      return res.status(404).json({ message: "College not found" });
    }

    let slabs;
    try {
      slabs = cleanSlabs(req.body?.slabs);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    await prisma.$transaction([
      prisma.admissionRevenueSlab.deleteMany({
        where: { companyId, partnerId },
      }),
      prisma.admissionRevenueSlab.createMany({
        data: slabs.map((slab) => ({
          companyId,
          partnerId,
          minAdmissions: slab.minAdmissions,
          maxAdmissions: slab.maxAdmissions,
          amount: slab.amount,
        })),
      }),
    ]);

    return res.json({ message: "Slabs saved", count: slabs.length });
  } catch (error) {
    console.error("Failed to save college slabs:", error);
    return res.status(500).json({ message: "Unable to save slabs" });
  }
});

/* =========================================================
   PUT /employee  -> replace an employee's incentive slabs
   body: { counsellorName, slabs: [...] }
========================================================= */

router.put("/employee", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const counsellorName = String(req.body?.counsellorName || "").trim();

    if (!counsellorName) {
      return res.status(400).json({ message: "Employee name is required" });
    }

    let slabs;
    try {
      slabs = cleanSlabs(req.body?.slabs);
    } catch (validationError) {
      return res.status(400).json({ message: validationError.message });
    }

    await prisma.$transaction([
      prisma.employeeIncentiveSlab.deleteMany({
        where: { companyId, counsellorName },
      }),
      prisma.employeeIncentiveSlab.createMany({
        data: slabs.map((slab) => ({
          companyId,
          counsellorName,
          minAdmissions: slab.minAdmissions,
          maxAdmissions: slab.maxAdmissions,
          amount: slab.amount,
        })),
      }),
    ]);

    return res.json({ message: "Incentive slabs saved", count: slabs.length });
  } catch (error) {
    console.error("Failed to save employee incentive slabs:", error);
    return res.status(500).json({ message: "Unable to save incentive slabs" });
  }
});

export default router;
