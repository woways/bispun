import { Router } from "express";

import prisma from "../lib/prisma.js";
import {
  requireSuperAdmin,
} from "../middleware/adminAuth.js";

const router = Router();
const GST_RATE = 18;

router.use(requireSuperAdmin);

function startOfDay(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999+05:30`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function paymentBreakdown(payment) {
  const listPrice = Number(
    payment.listPrice || payment.plan?.yearlyPrice || payment.amount || 0
  );
  const discountAmount = Number(payment.discountAmount || 0);
  const subtotal = Math.max(0, Math.round((listPrice - discountAmount) * 100) / 100);
  const amount = Number(payment.amount || 0);
  const gstAmount = Math.max(0, Math.round((amount - subtotal) * 100) / 100);

  return {
    listPrice,
    discountAmount,
    subtotal,
    gstRate: gstAmount > 0 ? GST_RATE : 0,
    gstAmount,
    finalAmount: amount,
  };
}

function serializePayment(payment) {
  const breakdown = paymentBreakdown(payment);

  return {
    id: payment.id,
    status: payment.status,
    billingCycle: payment.billingCycle,
    provider: payment.provider,
    amount: Number(payment.amount),
    ...breakdown,
    currency: payment.currency,
    receipt: payment.receipt,
    providerOrderId: payment.providerOrderId,
    providerPaymentId: payment.providerPaymentId,
    failureCode: payment.failureCode,
    failureReason: payment.failureReason,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    company: payment.company,
    plan: payment.plan,
    initiatedBy: payment.initiatedByUser || null,
  };
}

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 200, 1),
      1000
    );

    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();
    const companyId = String(req.query.companyId || "").trim();
    const planKey = String(req.query.planKey || "").trim().toLowerCase();
    const dateFrom = startOfDay(String(req.query.dateFrom || "").trim());
    const dateTo = endOfDay(String(req.query.dateTo || "").trim());

    const where = {};

    if (companyId) where.companyId = companyId;

    if (["CREATED", "AUTHORIZED", "CAPTURED", "FAILED", "REFUNDED"].includes(status)) {
      where.status = status;
    }

    if (planKey) {
      where.plan = { is: { key: planKey } };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const include = {
      company: {
        select: {
          id: true,
          name: true,
          brandName: true,
          slug: true,
          email: true,
          phone: true,
          city: true,
        },
      },
      plan: {
        select: {
          id: true,
          key: true,
          name: true,
          yearlyPrice: true,
        },
      },
      initiatedByUser: {
        select: {
          name: true,
          email: true,
        },
      },
    };

    const capturedSummaryWhere =
      where.status && where.status !== "CAPTURED"
        ? null
        : { ...where, status: "CAPTURED" };

    const [payments, grouped, capturedForSummary] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.paymentTransaction.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      capturedSummaryWhere
        ? prisma.paymentTransaction.findMany({
            where: capturedSummaryWhere,
            select: {
              amount: true,
              listPrice: true,
              discountAmount: true,
              plan: {
                select: { yearlyPrice: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const summary = grouped.reduce(
      (result, item) => {
        result.total += item._count._all;
        result.byStatus[item.status] = {
          count: item._count._all,
          amount: Number(item._sum.amount || 0),
        };
        if (item.status === "CAPTURED") {
          result.capturedValue = Number(item._sum.amount || 0);
        }
        return result;
      },
      { total: 0, capturedValue: 0, byStatus: {} }
    );

    const serialized = payments.map(serializePayment);
    const capturedBreakdowns = capturedForSummary.map(paymentBreakdown);
    summary.subtotalValue = capturedBreakdowns.reduce(
      (sum, payment) => sum + Number(payment.subtotal || 0),
      0
    );
    summary.gstValue = capturedBreakdowns.reduce(
      (sum, payment) => sum + Number(payment.gstAmount || 0),
      0
    );

    return res.json({
      success: true,
      summary,
      payments: serialized,
    });
  } catch (error) {
    console.error("Load admin payment transactions failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load payment transactions",
    });
  }
});

router.get("/:paymentId/receipt", async (req, res) => {
  try {
    const payment = await prisma.paymentTransaction.findUnique({
      where: { id: req.params.paymentId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            brandName: true,
            email: true,
            phone: true,
            city: true,
          },
        },
        plan: true,
        subscription: {
          select: {
            id: true,
            status: true,
            billingCycle: true,
            startDate: true,
            renewalDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment receipt not found",
      });
    }

    const breakdown = paymentBreakdown(payment);

    return res.json({
      success: true,
      receipt: {
        id: payment.id,
        receiptNumber: payment.receipt,
        status: payment.status,
        amount: Number(payment.amount),
        ...breakdown,
        currency: payment.currency,
        billingCycle: "YEARLY",
        provider: payment.provider,
        providerOrderId: payment.providerOrderId,
        providerPaymentId: payment.providerPaymentId,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        plan: {
          key: payment.plan.key,
          name: payment.plan.name,
        },
        company: payment.company,
        subscription: payment.subscription,
      },
    });
  } catch (error) {
    console.error("Load admin payment receipt failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load payment receipt",
    });
  }
});

export default router;