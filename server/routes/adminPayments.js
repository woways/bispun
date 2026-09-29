import { Router } from "express";

import prisma from "../lib/prisma.js";
import {
  requireSuperAdmin,
} from "../middleware/adminAuth.js";

const router = Router();

router.use(requireSuperAdmin);

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 50,
        1
      ),
      200
    );

    const status =
      String(
        req.query.status || ""
      )
        .trim()
        .toUpperCase();

    const companyId =
      String(
        req.query.companyId || ""
      ).trim();

    const where = {};

    if (
      companyId
    ) {
      where.companyId =
        companyId;
    }

    if (
      [
        "CREATED",
        "AUTHORIZED",
        "CAPTURED",
        "FAILED",
        "REFUNDED",
      ].includes(status)
    ) {
      where.status =
        status;
    }

    const [
      payments,
      grouped,
    ] =
      await Promise.all([
        prisma.paymentTransaction.findMany({
          where,
          include: {
            company: {
              select: {
                id: true,
                name: true,
                brandName: true,
                slug: true,
              },
            },
            plan: {
              select: {
                key: true,
                name: true,
              },
            },
            initiatedByUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: limit,
        }),

        prisma.paymentTransaction.groupBy({
          by: [
            "status",
          ],
          where,
          _count: {
            _all: true,
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

    const summary =
      grouped.reduce(
        (result, item) => {
          result.total +=
            item._count._all;

          result.byStatus[
            item.status
          ] = {
            count:
              item._count._all,
            amount:
              Number(
                item._sum.amount ||
                  0
              ),
          };

          if (
            item.status ===
            "CAPTURED"
          ) {
            result.capturedValue =
              Number(
                item._sum.amount ||
                  0
              );
          }

          return result;
        },
        {
          total: 0,
          capturedValue: 0,
          byStatus: {},
        }
      );

    return res.json({
      success: true,
      summary,
      payments: payments.map(
        (payment) => ({
          id: payment.id,
          status: payment.status,
          billingCycle:
            payment.billingCycle,
          provider:
            payment.provider,
          amount: Number(
            payment.amount
          ),
          listPrice:
            payment.listPrice
              ? Number(payment.listPrice)
              : Number(payment.amount),
          discountAmount:
            payment.discountAmount
              ? Number(payment.discountAmount)
              : 0,
          finalAmount: Number(
            payment.amount
          ),
          currency:
            payment.currency,
          providerOrderId:
            payment.providerOrderId,
          providerPaymentId:
            payment.providerPaymentId,
          failureCode:
            payment.failureCode,
          failureReason:
            payment.failureReason,
          paidAt:
            payment.paidAt,
          createdAt:
            payment.createdAt,
          company:
            payment.company,
          plan:
            payment.plan,
          initiatedBy:
            payment.initiatedByUser,
        })
      ),
    });
  } catch (error) {
    console.error(
      "Load admin payment transactions failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load payment transactions",
    });
  }
});

export default router;