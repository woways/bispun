import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";
import { REFERRAL_SLABS, getReferralRewardSummary } from "../lib/referralRewards.js";

const router = Router();
router.use(requireClientUser);

const STAGE_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "COUNSELLING", "ADMITTED"];

function stageIndex(stage) {
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? 0 : i;
}

function makeCode(name) {
  const base = String(name || "USER")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8) || "USER";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${suffix}`;
}

async function ensureCode(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, referralCode: true },
  });
  if (!user) return null;
  if (user.referralCode) return user.referralCode;

  for (let i = 0; i < 5; i += 1) {
    const code = makeCode(user.name);
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode;
    } catch {
      // Unique collision: retry with a new suffix.
    }
  }
  return null;
}

function formatReferral(ref) {
  const lead = ref.lead || {};
  const stage = lead.stage || "NEW";
  return {
    id: ref.id,
    createdAt: ref.createdAt,
    lead: {
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      course: lead.course,
      stage,
      stageIndex: stageIndex(stage),
      isLost: stage === "LOST",
    },
  };
}

function buildPayoutSummary(totalEarnings, requests) {
  const paidAmount = requests
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pendingAmount = requests
    .filter((item) => item.status === "PENDING")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const approvedAmount = requests
    .filter((item) => item.status === "APPROVED")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const reservedAmount = pendingAmount + approvedAmount;
  return {
    paidAmount,
    pendingAmount,
    approvedAmount,
    reservedAmount,
    availableToRedeem: Math.max(0, Number(totalEarnings || 0) - paidAmount - reservedAmount),
  };
}

async function canViewTeam(req) {
  if (req.clientUser.role === "CLIENT_ADMIN") return true;
  const actor = await prisma.user.findUnique({
    where: { id: req.clientUser.userId },
    select: { canViewTeamTargets: true, active: true, companyId: true },
  });
  return Boolean(
    actor &&
      actor.active &&
      actor.companyId === req.clientUser.companyId &&
      actor.canViewTeamTargets
  );
}

router.get("/me", async (req, res) => {
  try {
    const code = await ensureCode(req.clientUser.userId);

    const [referrals, rewardReferrals, payoutRequests] = await Promise.all([
      prisma.referral.findMany({
        where: {
          companyId: req.clientUser.companyId,
          referrerId: req.clientUser.userId,
        },
        include: { lead: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.crmReferral.findMany({
        where: { referrerId: req.clientUser.userId },
        include: {
          referredCompany: {
            include: {
              subscriptions: {
                include: { plan: true },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.referralPayoutRequest.findMany({
        where: { referrerId: req.clientUser.userId },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

    const formatted = referrals.map(formatReferral);
    const total = formatted.length;
    const admitted = formatted.filter((r) => r.lead.stage === "ADMITTED").length;
    const inProgress = formatted.filter(
      (r) => !["ADMITTED", "LOST"].includes(r.lead.stage)
    ).length;

    const successfulRewards = rewardReferrals.filter(
      (item) => item.status === "SUCCESSFUL"
    );
    const rewardSummary = getReferralRewardSummary(successfulRewards.length);
    const payoutSummary = buildPayoutSummary(rewardSummary.totalEarnings, payoutRequests);

    return res.json({
      success: true,
      code,
      referrals: formatted,
      stats: { total, admitted, inProgress },
      stageOrder: STAGE_ORDER,
      rewardProgram: {
        slabs: REFERRAL_SLABS,
        summary: { ...rewardSummary, ...payoutSummary },
        referrals: rewardReferrals.map((item) => ({
          id: item.id,
          status: item.status,
          referralCode: item.referralCode,
          qualifiedAt: item.qualifiedAt,
          createdAt: item.createdAt,
          company: {
            id: item.referredCompany.id,
            name: item.referredCompany.name,
            ownerName: item.referredCompany.ownerName,
            planName: item.referredCompany.subscriptions?.[0]?.plan?.name || null,
          },
        })),
        payouts: payoutRequests.map((item) => ({
          id: item.id,
          amount: item.amount,
          status: item.status,
          paymentReference: item.paymentReference,
          adminNote: item.adminNote,
          requestedAt: item.requestedAt,
          processedAt: item.processedAt,
          paidAt: item.paidAt,
        })),
      },
    });
  } catch (error) {
    console.error("Failed to load referrals:", error);
    return res.status(500).json({ success: false, message: "Unable to load referrals" });
  }
});

router.post("/redeem", async (req, res) => {
  try {
    const requestedAmount = Number(req.body?.amount);
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0 || !Number.isInteger(requestedAmount)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid redemption amount in whole rupees",
      });
    }

    const payout = await prisma.$transaction(async (tx) => {
      const [successfulCount, existingRequests] = await Promise.all([
        tx.crmReferral.count({
          where: { referrerId: req.clientUser.userId, status: "SUCCESSFUL" },
        }),
        tx.referralPayoutRequest.findMany({
          where: { referrerId: req.clientUser.userId },
          select: { amount: true, status: true },
        }),
      ]);

      const rewardSummary = getReferralRewardSummary(successfulCount);
      const payoutSummary = buildPayoutSummary(rewardSummary.totalEarnings, existingRequests);

      if (requestedAmount > payoutSummary.availableToRedeem) {
        const error = new Error("Requested amount is greater than your available referral balance");
        error.statusCode = 400;
        throw error;
      }

      return tx.referralPayoutRequest.create({
        data: {
          referrerId: req.clientUser.userId,
          amount: requestedAmount,
          status: "PENDING",
        },
      });
    });

    return res.status(201).json({
      success: true,
      message: "Redemption request sent to Bispun Super Admin",
      payout,
    });
  } catch (error) {
    console.error("Failed to request referral payout:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to submit redemption request",
    });
  }
});

router.post("/tag", async (req, res) => {
  try {
    const leadId = String(req.body?.leadId || "");
    if (!leadId) {
      return res.status(400).json({ success: false, message: "leadId is required" });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, companyId: req.clientUser.companyId },
      select: { id: true },
    });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    let referrerId = req.clientUser.userId;
    const requested = String(req.body?.referrerId || "").trim();
    if (requested && requested !== req.clientUser.userId) {
      const allowed = await canViewTeam(req);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "You cannot tag referrals for other users",
        });
      }
      const referrer = await prisma.user.findFirst({
        where: {
          id: requested,
          companyId: req.clientUser.companyId,
          active: true,
        },
        select: { id: true },
      });
      if (!referrer) {
        return res.status(404).json({ success: false, message: "Referrer not found" });
      }
      referrerId = requested;
    }

    const existing = await prisma.referral.findUnique({ where: { leadId } });
    if (existing) {
      return res.status(409).json({ success: false, message: "This lead is already referred" });
    }

    const ref = await prisma.referral.create({
      data: {
        companyId: req.clientUser.companyId,
        referrerId,
        leadId,
      },
      include: { lead: true },
    });

    return res.json({ success: true, referral: formatReferral(ref) });
  } catch (error) {
    console.error("Failed to tag referral:", error);
    return res.status(500).json({ success: false, message: "Unable to tag referral" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const allowed = await canViewTeam(req);
    if (!allowed) {
      return res.status(403).json({ success: false, message: "Not allowed" });
    }
    const users = await prisma.user.findMany({
      where: { companyId: req.clientUser.companyId, active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    return res.json({ success: true, users });
  } catch (error) {
    console.error("Failed to load users:", error);
    return res.status(500).json({ success: false, message: "Unable to load users" });
  }
});

router.get("/leads", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();

    const leads = await prisma.lead.findMany({
      where: {
        companyId: req.clientUser.companyId,
        referral: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        course: true,
        stage: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return res.json({ success: true, leads });
  } catch (error) {
    console.error("Failed to search leads:", error);
    return res.status(500).json({ success: false, message: "Unable to search leads" });
  }
});

export default router;
