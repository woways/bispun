import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import {
  REFERRAL_SLABS,
  getReferralRewardSummary,
  getReferralCreditState,
  resolveCreditAmount,
} from "../lib/referralRewards.js";
import { createReferralCreditedNotification } from "../lib/notifications.js";

const router = Router();
router.use(requireSuperAdmin);

// Credited money is the sum of PAID payout records (both legacy client-requested
// payouts and Super-Admin-initiated credits). PDF §11 "Credited" == money the
// Super Admin has confirmed.
async function sumCreditedAmount(tx, referrerId) {
  const paid = await tx.referralPayoutRequest.aggregate({
    _sum: { amount: true },
    where: { referrerId, status: "PAID" },
  });
  return Number(paid._sum.amount || 0);
}

// Amounts tied up by legacy, still-open client payout requests (PENDING/APPROVED).
// These are excluded from what a new Super-Admin credit may add, so that paying
// a legacy request later can never push total credited above total earned
// (prevents double-crediting across the old and new flows).
async function sumReservedAmount(tx, referrerId) {
  const reserved = await tx.referralPayoutRequest.aggregate({
    _sum: { amount: true },
    where: { referrerId, status: { in: ["PENDING", "APPROVED"] } },
  });
  return Number(reserved._sum.amount || 0);
}

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
      const earned = entry.referrals.filter((item) => item.status === "EARNED");
      const summary = getReferralRewardSummary(earned.length);
      const userPayouts = payoutRequests.filter((item) => item.referrerId === entry.referrer.id);
      const payouts = payoutBreakdown(summary.totalEarnings, userPayouts);
      const creditState = getReferralCreditState({
        totalEarnings: summary.totalEarnings,
        creditedAmount: payouts.paidAmount,
      });
      // Amount a new credit action may add now (excludes legacy reserved amounts).
      const creditable = Math.max(0, creditState.pendingCredit - Number(payouts.reservedAmount || 0));

      return {
        referrer: entry.referrer,
        summary: { ...summary, ...payouts, ...creditState, creditable },
        referrals: entry.referrals.map((item) => ({
          id: item.id,
          status: item.status,
          referralCode: item.referralCode,
          createdAt: item.createdAt,
          qualifiedAt: item.qualifiedAt,
          // Null for REFERRED (pre-payment) rows; fall back to captured identity.
          referredCompany: item.referredCompany
            ? {
                id: item.referredCompany.id,
                name: item.referredCompany.name,
                ownerName: item.referredCompany.ownerName,
                email: item.referredCompany.email,
                planName: item.referredCompany.subscriptions?.[0]?.plan?.name || null,
                amount: Number(item.referredCompany.subscriptions?.[0]?.amount || 0),
              }
            : null,
          referredName: item.referredName || null,
          referredEmail: item.referredEmail || null,
        })),
      };
    });

    const totalSuccessful = rows.filter((row) => row.status === "EARNED").length;
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

// PDF 11.7: Super Admin marks a referrer's earned referral money as credited.
// Idempotent + race-safe: a per-referrer advisory lock serializes concurrent
// credit actions, and the outstanding balance is recomputed inside the
// transaction, so a double-click (or retry) credits nothing the second time.
router.post("/credit", async (req, res) => {
  try {
    const referrerId = String(req.body?.referrerId || "").trim();
    if (!referrerId) {
      return res.status(400).json({ success: false, message: "referrerId is required" });
    }

    const paymentReference = String(req.body?.paymentReference || "").trim();
    const adminNote = String(req.body?.adminNote || "").trim();
    const requestedAmount = req.body?.amount;

    const referrer = await prisma.user.findUnique({
      where: { id: referrerId },
      select: { id: true, companyId: true },
    });
    if (!referrer) {
      return res.status(404).json({ success: false, message: "Referrer not found" });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Serialize concurrent credit actions for this referrer.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${referrerId}))`;

      const [successfulCount, creditedAmount, reservedAmount] = await Promise.all([
        tx.crmReferral.count({ where: { referrerId, status: "EARNED" } }),
        sumCreditedAmount(tx, referrerId),
        sumReservedAmount(tx, referrerId),
      ]);

      const reward = getReferralRewardSummary(successfulCount);
      // Creditable = earned − already-credited − reserved-by-legacy-requests.
      const { pendingCredit } = getReferralCreditState({
        totalEarnings: reward.totalEarnings,
        creditedAmount: creditedAmount + reservedAmount,
      });

      const resolved = resolveCreditAmount({ requestedAmount, pendingCredit });
      if (!resolved.ok) {
        const map = {
          NOTHING_TO_CREDIT: "There is no earned amount awaiting credit for this referrer",
          INVALID_AMOUNT: "Enter a valid credit amount in whole rupees",
          EXCEEDS_OUTSTANDING: "Credit amount is greater than the earned amount awaiting credit",
        };
        const error = new Error(map[resolved.reason] || "Unable to credit referral");
        error.statusCode = resolved.reason === "INVALID_AMOUNT" ? 400 : 409;
        throw error;
      }

      const now = new Date();
      const record = await tx.referralPayoutRequest.create({
        data: {
          referrerId,
          amount: resolved.amount,
          status: "PAID",
          source: "ADMIN_CREDIT",
          creditedById: req.admin.userId,
          paymentReference: paymentReference || null,
          adminNote: adminNote || null,
          requestedAt: now,
          processedAt: now,
          paidAt: now,
          notifiedAt: now,
        },
      });

      return { record, companyId: referrer.companyId, amount: resolved.amount };
    });

    // Notify outside the transaction; failures must not roll back the credit
    // (notifiedAt is already stamped, so this never double-fires on retry).
    await createReferralCreditedNotification({
      companyId: result.companyId,
      userId: referrerId,
      amount: result.amount,
    });

    return res.status(201).json({ success: true, payout: result.record });
  } catch (error) {
    console.error("Failed to credit referral:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Unable to credit referral",
    });
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

    // Safety guard: paying a legacy request must never push total credited above
    // total earned (defends against over-credit if the new credit flow was also
    // used for this referrer).
    if (status === "PAID") {
      const [successfulCount, alreadyPaid] = await Promise.all([
        prisma.crmReferral.count({ where: { referrerId: existing.referrerId, status: "EARNED" } }),
        prisma.referralPayoutRequest.aggregate({
          _sum: { amount: true },
          where: { referrerId: existing.referrerId, status: "PAID" },
        }),
      ]);
      const earned = getReferralRewardSummary(successfulCount).totalEarnings;
      const paid = Number(alreadyPaid._sum.amount || 0);
      if (paid + Number(existing.amount || 0) > earned) {
        return res.status(409).json({
          success: false,
          message: "Crediting this payout would exceed the referrer's earned balance",
        });
      }
    }

    const now = new Date();
    const willNotify = status === "PAID" && !existing.notifiedAt;
    const updated = await prisma.referralPayoutRequest.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote || existing.adminNote,
        paymentReference:
          status === "PAID" ? paymentReference : paymentReference || existing.paymentReference,
        processedAt: now,
        paidAt: status === "PAID" ? now : null,
        notifiedAt: status === "PAID" ? existing.notifiedAt || now : existing.notifiedAt,
      },
      include: {
        referrer: {
          select: { id: true, name: true, email: true, referralCode: true, companyId: true },
        },
      },
    });

    // PDF 11.8: notify the referrer once when their money is credited (PAID).
    if (willNotify && updated.referrer?.companyId) {
      await createReferralCreditedNotification({
        companyId: updated.referrer.companyId,
        userId: updated.referrer.id,
        amount: updated.amount,
      });
    }

    return res.json({ success: true, payout: updated });
  } catch (error) {
    console.error("Failed to update referral payout:", error);
    return res.status(500).json({ success: false, message: "Unable to update payout request" });
  }
});

export default router;
