import { Router } from "express";
import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { writeSuperAdminAudit } from "../lib/adminAuditLog.js";
import { normalizeCouponCode, seedCoupons } from "../lib/coupons.js";

// All coupon-management endpoints require a Super Admin session. Server-side
// authorization — hiding the UI is not sufficient.
const router = Router();
router.use(requireSuperAdmin);

async function actor(req) {
  return prisma.user.findUnique({
    where: { id: req.admin.userId },
    select: { id: true, name: true, email: true },
  });
}

function formatCoupon(c) {
  return {
    id: c.id,
    code: c.code,
    description: c.description || "",
    finalAmount: c.finalAmount != null ? Number(c.finalAmount) : null,
    currency: c.currency,
    active: c.active,
    validFrom: c.validFrom || null,
    validUntil: c.validUntil || null,
    maxRedemptions: c.maxRedemptions ?? null,
    perCustomerLimit: c.perCustomerLimit ?? null,
    usedCount: c.usedCount,
    remaining:
      c.maxRedemptions != null ? Math.max(0, c.maxRedemptions - c.usedCount) : null,
    eligiblePlanKeys: c.eligiblePlanKeys || [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function parseDate(value, { endOfDay = false } = {}) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const d = new Date(
    dateOnly ? `${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+05:30` : raw
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseOptionalInt(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return undefined; // undefined = invalid
  return n;
}

async function validEligiblePlanKeys(keys) {
  if (!Array.isArray(keys)) return [];
  const norm = [...new Set(keys.map((k) => String(k || "").trim().toLowerCase()).filter(Boolean))];
  if (norm.length === 0) return [];
  const plans = await prisma.plan.findMany({
    where: { key: { in: norm } },
    select: { key: true },
  });
  const existing = new Set(plans.map((p) => p.key));
  return norm.filter((k) => existing.has(k));
}

// GET / — list coupons. Optional ?q= (code/description) and ?active=true|false.
router.get("/", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const where = {};
    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    if (req.query.active === "true") where.active = true;
    if (req.query.active === "false") where.active = false;

    const coupons = await prisma.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return res.json({ success: true, coupons: coupons.map(formatCoupon) });
  } catch (e) {
    console.error("List coupons failed:", e);
    return res.status(500).json({ success: false, message: "Unable to fetch coupons" });
  }
});

// GET /:id/redemptions — redemption history for one coupon.
router.get("/:id/redemptions", async (req, res) => {
  try {
    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });
    const redemptions = await prisma.couponRedemption.findMany({
      where: { couponId: coupon.id },
      orderBy: { reservedAt: "desc" },
      take: 200,
    });
    return res.json({
      success: true,
      redemptions: redemptions.map((r) => ({
        id: r.id,
        status: r.status,
        providerOrderId: r.providerOrderId,
        planKey: r.planKey,
        customerEmail: r.customerEmail,
        companyId: r.companyId,
        amount: r.amount != null ? Number(r.amount) : null,
        reservedAt: r.reservedAt,
        consumedAt: r.consumedAt,
        releasedAt: r.releasedAt,
      })),
    });
  } catch (e) {
    console.error("Coupon redemptions failed:", e);
    return res.status(500).json({ success: false, message: "Unable to fetch redemptions" });
  }
});

// POST / — create a coupon.
router.post("/", async (req, res) => {
  try {
    const code = normalizeCouponCode(req.body?.code);
    if (!code) return res.status(400).json({ success: false, message: "Coupon code is required" });
    if (!/^[A-Z0-9]{4,40}$/.test(code)) {
      return res.status(400).json({ success: false, message: "Code must be 4–40 letters/digits" });
    }

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) return res.status(409).json({ success: false, message: "A coupon with this code already exists" });

    const finalAmount = Number(req.body?.finalAmount);
    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({ success: false, message: "Enter a valid final amount (incl. GST)" });
    }

    const maxRedemptions = parseOptionalInt(req.body?.maxRedemptions);
    if (maxRedemptions === undefined) return res.status(400).json({ success: false, message: "Invalid max redemptions" });
    const perCustomerLimit = parseOptionalInt(req.body?.perCustomerLimit);
    if (perCustomerLimit === undefined) return res.status(400).json({ success: false, message: "Invalid per-customer limit" });

    const eligiblePlanKeys = await validEligiblePlanKeys(req.body?.eligiblePlanKeys);

    const coupon = await prisma.coupon.create({
      data: {
        code,
        description: req.body?.description ? String(req.body.description).trim() : null,
        finalAmount,
        active: req.body?.active === true,
        validFrom: parseDate(req.body?.validFrom),
        validUntil: parseDate(req.body?.validUntil, { endOfDay: true }),
        maxRedemptions,
        perCustomerLimit,
        eligiblePlanKeys,
        createdByUserId: req.admin.userId,
      },
    });

    const a = await actor(req);
    await writeSuperAdminAudit({
      req,
      actor: a,
      action: "COUPON_CREATED",
      entityType: "COUPON",
      entityId: coupon.id,
      summary: `${a?.name || "Super Admin"} created coupon ${coupon.code}.`,
      metadata: { code: coupon.code, finalAmount, eligiblePlanKeys, active: coupon.active },
    });

    return res.status(201).json({ success: true, message: "Coupon created", coupon: formatCoupon(coupon) });
  } catch (e) {
    console.error("Create coupon failed:", e);
    return res.status(500).json({ success: false, message: "Unable to create coupon" });
  }
});

// PATCH /:id — update coupon config (including active). Code is immutable.
router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ success: false, message: "Coupon not found" });

    const data = {};
    if (req.body.description !== undefined)
      data.description = req.body.description ? String(req.body.description).trim() : null;
    if (req.body.finalAmount !== undefined) {
      const v = Number(req.body.finalAmount);
      if (!Number.isFinite(v) || v <= 0) return res.status(400).json({ success: false, message: "Invalid final amount" });
      data.finalAmount = v;
    }
    if (typeof req.body.active === "boolean") data.active = req.body.active;
    if (req.body.validFrom !== undefined) data.validFrom = parseDate(req.body.validFrom);
    if (req.body.validUntil !== undefined) data.validUntil = parseDate(req.body.validUntil, { endOfDay: true });
    if (req.body.maxRedemptions !== undefined) {
      const v = parseOptionalInt(req.body.maxRedemptions);
      if (v === undefined) return res.status(400).json({ success: false, message: "Invalid max redemptions" });
      data.maxRedemptions = v;
    }
    if (req.body.perCustomerLimit !== undefined) {
      const v = parseOptionalInt(req.body.perCustomerLimit);
      if (v === undefined) return res.status(400).json({ success: false, message: "Invalid per-customer limit" });
      data.perCustomerLimit = v;
    }
    if (req.body.eligiblePlanKeys !== undefined) {
      data.eligiblePlanKeys = await validEligiblePlanKeys(req.body.eligiblePlanKeys);
    }

    const updated = await prisma.coupon.update({ where: { id: existing.id }, data });

    const a = await actor(req);
    await writeSuperAdminAudit({
      req,
      actor: a,
      action: "COUPON_UPDATED",
      entityType: "COUPON",
      entityId: updated.id,
      summary: `${a?.name || "Super Admin"} updated coupon ${updated.code}.`,
      metadata: { code: updated.code, changedFields: Object.keys(data), active: updated.active },
    });

    return res.json({ success: true, message: "Coupon updated", coupon: formatCoupon(updated) });
  } catch (e) {
    console.error("Update coupon failed:", e);
    return res.status(500).json({ success: false, message: "Unable to update coupon" });
  }
});

// POST /seed — idempotently seed the four initial coupons (never overwrites).
router.post("/seed", async (req, res) => {
  try {
    const results = await seedCoupons();
    const a = await actor(req);
    await writeSuperAdminAudit({
      req,
      actor: a,
      action: "COUPON_SEEDED",
      entityType: "COUPON",
      entityId: "seed",
      summary: `${a?.name || "Super Admin"} ran coupon seeding.`,
      metadata: { results },
    });
    return res.json({ success: true, results });
  } catch (e) {
    console.error("Coupon seed failed:", e);
    return res.status(500).json({ success: false, message: "Unable to seed coupons" });
  }
});

export default router;
