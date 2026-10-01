import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { REFERRAL_SLABS, getReferralRewardSummary } from "../lib/referralRewards.js";

const router = Router();
router.use(requireSuperAdmin);

function payoutBreakdown(totalEarnings, requests) {
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
    outstandingLiability: Math.max(0, Number(totalEarnings || 0) - paidAmount),
  };
}

router.get("/", async (req, res) => {
  try {
    const [rows, payoutRequests] = await Promise.all([
      prisma.crmReferral.findMany({
        include: {
          referrer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              referralCode: true,
              company: { select: { id: true, name: true } },
            },
          },
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
        include: {
          referrer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              referralCode: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { requestedAt: "desc" },
      }),
    ]);

    const grouped = new Map();
    for (const row of rows) {
      const key = row.referrerId;
      if (!grouped.has(key)) {
        grouped.set(key, { referrer: row.referrer, referrals: [] });
      }
      grouped.get(key).referrals.push(row);
    }

    // Also include users who have a payout history even if referral rows were later removed.
    for (const payout of payoutRequests) {
      if (!grouped.has(payout.referrerId)) {
        grouped.set(payout.referrerId, { referrer: payout.referrer, referrals: [] });
      }
    }

    const referrers = Array.from(grouped.values()).map((entry) => {
      const successful = entry.referrals.filter((item) => item.status === "SUCCESSFUL");
      const summary = getReferralRewardSummary(successful.length);
      const userPayouts = payoutRequests.filter((item) => item.referrerId === entry.referrer.id);
      const payouts = payoutBreakdown(summary.totalEarnings, userPayouts);

      return {
        referrer: entry.referrer,
        summary: { ...summary, ...payouts },
        referrals: entry.referrals.map((item) => ({
          id: item.id,
          status: item.status,
          referralCode: item.referralCode,
          createdAt: item.createdAt,
          qualifiedAt: item.qualifiedAt,
          referredCompany: {
            id: item.referredCompany.id,
            name: item.referredCompany.name,
            ownerName: item.referredCompany.ownerName,
            email: item.referredCompany.email,
            planName: item.referredCompany.subscriptions?.[0]?.plan?.name || null,
            amount: Number(item.referredCompany.subscriptions?.[0]?.amount || 0),
          },
        })),
      };
    });

    const totalSuccessful = rows.filter((row) => row.status === "SUCCESSFUL").length;
    const totalRewards = referrers.reduce(
      (sum, item) => sum + Number(item.summary.totalEarnings || 0),
      0
    );
    const totalPaid = payoutRequests
      .filter((item) => item.status === "PAID")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendingPayouts = payoutRequests
      .filter((item) => item.status === "PENDING")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const approvedPayouts = payoutRequests
      .filter((item) => item.status === "APPROVED")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return res.json({
      success: true,
      slabs: REFERRAL_SLABS,
      totals: {
        successful: totalSuccessful,
        referrers: referrers.length,
        rewards: totalRewards,
        paid: totalPaid,
        pending: pendingPayouts,
        approved: approvedPayouts,
        outstanding: Math.max(0, totalRewards - totalPaid),
      },
      referrers,
      payoutRequests: payoutRequests.map((item) => ({
        id: item.id,
        amount: item.amount,
        status: item.status,
        paymentReference: item.paymentReference,
        adminNote: item.adminNote,
        requestedAt: item.requestedAt,
        processedAt: item.processedAt,
        paidAt: item.paidAt,
        referrer: item.referrer,
      })),
    });
  } catch (error) {
    console.error("Failed to load admin referrals:", error);
    return res.status(500).json({ success: false, message: "Unable to load referrals" });
  }
});

router.patch("/payouts/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const status = String(req.body?.status || "").trim().toUpperCase();
    const paymentReference = String(req.body?.paymentReference || "").trim();
    const adminNote = String(req.body?.adminNote || "").trim();

    if (!["APPROVED", "PAID", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be APPROVED, PAID or REJECTED",
      });
    }

    const existing = await prisma.referralPayoutRequest.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Payout request not found" });
    }
    if (existing.status === "PAID") {
      return res.status(409).json({ success: false, message: "Paid payout requests cannot be changed" });
    }
    if (existing.status === "REJECTED") {
      return res.status(409).json({ success: false, message: "Rejected payout requests cannot be changed" });
    }
    if (status === "PAID" && existing.status !== "APPROVED") {
      return res.status(409).json({
        success: false,
        message: "Approve the payout request before marking it as paid",
      });
    }
    if (status === "PAID" && !paymentReference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required before marking a payout as paid",
      });
    }

    const now = new Date();
    const updated = await prisma.referralPayoutRequest.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote || existing.adminNote,
        paymentReference:
          status === "PAID" ? paymentReference : paymentReference || existing.paymentReference,
        processedAt: now,
        paidAt: status === "PAID" ? now : null,
      },
      include: {
        referrer: {
          select: { id: true, name: true, email: true, referralCode: true },
        },
      },
    });

    return res.json({ success: true, payout: updated });
  } catch (error) {
    console.error("Failed to update referral payout:", error);
    return res.status(500).json({ success: false, message: "Unable to update payout request" });
  }
});

export default router;
