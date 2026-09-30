import crypto from "crypto";
import { Router } from "express";

import prisma from "../lib/prisma.js";
import {
  getRazorpayClient,
  getRazorpayConfig,
} from "../lib/razorpay.js";
import {
  finalizeCapturedPayment,
} from "../lib/subscriptions.js";
import {
  requireClientUser,
} from "../middleware/clientAuth.js";

const router = Router();

const GST_RATE = 18;

router.use(requireClientUser);

function ensureClientAdmin(req, res) {
  if (
    req.clientUser.role !==
    "CLIENT_ADMIN"
  ) {
    res.status(403).json({
      success: false,
      message:
        "Only the Client Admin can manage subscription payments",
    });

    return false;
  }

  return true;
}

function safeEqualHex(a, b) {
  try {
    const aBuffer =
      Buffer.from(a, "hex");
    const bBuffer =
      Buffer.from(b, "hex");

    return (
      aBuffer.length ===
        bBuffer.length &&
      crypto.timingSafeEqual(
        aBuffer,
        bBuffer
      )
    );
  } catch {
    return false;
  }
}

function paymentAmount(plan) {
  return plan.yearlyPrice !== null &&
    plan.yearlyPrice !== undefined
    ? Number(plan.yearlyPrice)
    : null;
}

router.get("/", async (req, res) => {
  try {
    const companyId =
      req.clientUser.companyId;

    const [
      subscription,
      plans,
      payments,
    ] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          companyId,
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),

      prisma.plan.findMany({
        where: {
          active: true,
        },
        orderBy: {
          yearlyPrice: "asc",
        },
      }),

      prisma.paymentTransaction.findMany({
        where: {
          companyId,
        },
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
    ]);

    return res.json({
      success: true,

      subscription:
        subscription
          ? {
              id: subscription.id,
              status:
                subscription.status,
              billingCycle:
                "YEARLY",
              amount: Number(
                subscription.amount || 0
              ),
              listPrice: Number(
                subscription.listPrice ||
                  subscription.plan?.yearlyPrice ||
                  0
              ),
              discountAmount: Number(
                subscription.discountAmount || 0
              ),
              finalAmount: Number(
                subscription.amount || 0
              ),
              startDate:
                subscription.startDate,
              renewalDate:
                subscription.renewalDate,
              endDate:
                subscription.endDate,
              plan: {
                id:
                  subscription.plan.id,
                key:
                  subscription.plan.key,
                name:
                  subscription.plan.name,
              },
            }
          : null,

      plans: plans.map(
        (plan) => ({
          id: plan.id,
          key: plan.key,
          name: plan.name,
          tagline:
            plan.tagline || "",
          description:
            plan.description || "",
          yearlyPrice:
            plan.yearlyPrice !== null
              ? Number(
                  plan.yearlyPrice
                )
              : null,
        })
      ),

      payments: payments.map(
        (payment) => ({
          id: payment.id,
          status: payment.status,
          billingCycle:
            "YEARLY",
          amount: Number(
            payment.amount
          ),
          listPrice: Number(
            payment.listPrice ||
              payment.plan?.yearlyPrice ||
              payment.amount
          ),
          discountAmount: Number(
            payment.discountAmount || 0
          ),
          finalAmount: Number(
            payment.amount
          ),
          currency:
            payment.currency,
          providerOrderId:
            payment.providerOrderId,
          providerPaymentId:
            payment.providerPaymentId,
          receipt:
            payment.receipt,
          paidAt:
            payment.paidAt,
          createdAt:
            payment.createdAt,
          plan: {
            key:
              payment.plan.key,
            name:
              payment.plan.name,
          },
        })
      ),
    });
  } catch (error) {
    console.error(
      "Load client billing failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load subscription billing",
    });
  }
});

router.post(
  "/create-order",
  async (req, res) => {
    try {
      if (!ensureClientAdmin(req, res)) {
        return;
      }

      const planKey = String(
        req.body?.planKey || ""
      )
        .trim()
        .toLowerCase();

      const requestedBillingCycle = String(
        req.body?.billingCycle ||
          "YEARLY"
      )
        .trim()
        .toUpperCase();

      if (requestedBillingCycle !== "YEARLY") {
        return res.status(400).json({
          success: false,
          message:
            "Only annual billing is available",
        });
      }

      const billingCycle = "YEARLY";

      const plan =
        await prisma.plan.findUnique({
          where: {
            key: planKey,
          },
        });

      if (!plan || !plan.active) {
        return res.status(404).json({
          success: false,
          message:
            "Selected plan is unavailable",
        });
      }

      const listPrice =
        paymentAmount(plan);

      if (
        listPrice === null ||
        !Number.isFinite(listPrice) ||
        listPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Annual pricing is unavailable for this plan",
        });
      }

      // Carry the discount the Super Admin set on this company's current
      // subscription, but only while it still applies to the same plan.
      const currentSubscription =
        await prisma.subscription.findFirst({
          where: {
            companyId:
              req.clientUser.companyId,
          },
          orderBy: {
            createdAt: "desc",
          },
        });

      let discountAmount = 0;
      if (
        currentSubscription &&
        currentSubscription.planId ===
          plan.id &&
        currentSubscription.discountAmount
      ) {
        discountAmount =
          Number(
            currentSubscription.discountAmount
          ) || 0;
      }
      if (discountAmount < 0)
        discountAmount = 0;
      if (discountAmount > listPrice)
        discountAmount = listPrice;
      discountAmount =
        Math.round(
          discountAmount * 100
        ) / 100;

      // GST is charged on the discounted subscription value.
      const subtotal =
        Math.round(
          (listPrice - discountAmount) * 100
        ) / 100;

      const gstAmount =
        Math.round(
          subtotal * (GST_RATE / 100) * 100
        ) / 100;

      // Final amount actually charged = subtotal + 18% GST.
      const amount =
        Math.round(
          (subtotal + gstAmount) * 100
        ) / 100;

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payable amount is invalid after discount",
        });
      }

      const amountPaise =
        Math.round(
          amount * 100
        );

      const receipt =
        `cb_${Date.now()}_${req.clientUser.companyId.slice(-6)}`.slice(
          0,
          40
        );

      const razorpay =
        getRazorpayClient();

      const order =
        await razorpay.orders.create({
          amount:
            amountPaise,
          currency: "INR",
          receipt,
          notes: {
            companyId:
              req.clientUser.companyId,
            userId:
              req.clientUser.userId,
            planKey:
              plan.key,
            billingCycle,
          },
        });

      const transaction =
        await prisma.paymentTransaction.create({
          data: {
            companyId:
              req.clientUser.companyId,
            planId: plan.id,
            initiatedByUserId:
              req.clientUser.userId,
            provider: "RAZORPAY",
            status: "CREATED",
            billingCycle,
            listPrice,
            discountAmount,
            amount,
            currency: "INR",
            providerOrderId:
              order.id,
            receipt,
          },
        });

      const { keyId } =
        getRazorpayConfig();

      return res.status(201).json({
        success: true,
        transactionId:
          transaction.id,
        keyId,
        order: {
          id: order.id,
          amount:
            order.amount,
          currency:
            order.currency,
        },
        plan: {
          key: plan.key,
          name: plan.name,
        },
        billingCycle,
      });
    } catch (error) {
      console.error(
        "Create Razorpay order failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to start payment",
      });
    }
  }
);

router.post(
  "/verify-payment",
  async (req, res) => {
    try {
      if (!ensureClientAdmin(req, res)) {
        return;
      }

      const orderId =
        String(
          req.body?.razorpay_order_id ||
            ""
        ).trim();

      const paymentId =
        String(
          req.body?.razorpay_payment_id ||
            ""
        ).trim();

      const signature =
        String(
          req.body?.razorpay_signature ||
            ""
        ).trim();

      if (
        !orderId ||
        !paymentId ||
        !signature
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Incomplete payment verification details",
        });
      }

      const transaction =
        await prisma.paymentTransaction.findFirst({
          where: {
            companyId:
              req.clientUser.companyId,
            providerOrderId:
              orderId,
          },
        });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message:
            "Payment transaction not found",
        });
      }

      const { keySecret } =
        getRazorpayConfig();

      const expectedSignature =
        crypto
          .createHmac(
            "sha256",
            keySecret
          )
          .update(
            `${orderId}|${paymentId}`
          )
          .digest("hex");

      if (
        !safeEqualHex(
          expectedSignature,
          signature
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment signature verification failed",
        });
      }

      const razorpay =
        getRazorpayClient();

      const providerPayment =
        await razorpay.payments.fetch(
          paymentId
        );

      if (
        providerPayment.order_id !==
          orderId ||
        Number(
          providerPayment.amount
        ) !==
          Math.round(
            Number(
              transaction.amount
            ) * 100
          ) ||
        providerPayment.currency !==
          transaction.currency
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment details do not match the order",
        });
      }

      if (
        providerPayment.status ===
        "captured"
      ) {
        await finalizeCapturedPayment({
          transactionId:
            transaction.id,
          providerPaymentId:
            paymentId,
        });

        const paidTransaction =
          await prisma.paymentTransaction.findUnique({
            where: {
              id: transaction.id,
            },
            include: {
              plan: true,
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
              subscription: {
                select: {
                  id: true,
                  startDate: true,
                  renewalDate: true,
                  endDate: true,
                  billingCycle: true,
                  status: true,
                },
              },
            },
          });

        await prisma.notification.create({
          data: {
            companyId:
              req.clientUser.companyId,
            userId:
              req.clientUser.userId,
            title:
              "Subscription payment successful",
            message:
              `${paidTransaction?.plan?.name || "Bispun"} annual subscription payment of ₹${Number(transaction.amount).toLocaleString("en-IN")} was received successfully.`,
            type:
              "SUCCESS",
            actionModule:
              "settings",
            actionLabel:
              "View billing",
          },
        });

        return res.json({
          success: true,
          captured: true,
          message:
            "Payment verified and subscription activated successfully",
          receipt: paidTransaction
            ? {
                id:
                  paidTransaction.id,
                receiptNumber:
                  paidTransaction.receipt,
                status:
                  paidTransaction.status,
                amount:
                  Number(paidTransaction.amount),
                subtotal:
                  Math.round(
                    (Number(paidTransaction.listPrice || paidTransaction.amount) -
                      Number(paidTransaction.discountAmount || 0)) * 100
                  ) / 100,
                gstRate: GST_RATE,
                gstAmount:
                  Math.max(
                    0,
                    Math.round(
                      (Number(paidTransaction.amount) -
                        (Number(paidTransaction.listPrice || paidTransaction.amount) -
                          Number(paidTransaction.discountAmount || 0))) * 100
                    ) / 100
                  ),
                currency:
                  paidTransaction.currency,
                billingCycle:
                  "YEARLY",
                provider:
                  paidTransaction.provider,
                providerOrderId:
                  paidTransaction.providerOrderId,
                providerPaymentId:
                  paidTransaction.providerPaymentId,
                paidAt:
                  paidTransaction.paidAt,
                createdAt:
                  paidTransaction.createdAt,
                plan: {
                  key:
                    paidTransaction.plan.key,
                  name:
                    paidTransaction.plan.name,
                },
                company:
                  paidTransaction.company,
                subscription:
                  paidTransaction.subscription,
              }
            : null,
        });
      }

      await prisma.paymentTransaction.update({
        where: {
          id: transaction.id,
        },
        data: {
          status:
            providerPayment.status ===
            "authorized"
              ? "AUTHORIZED"
              : transaction.status,
          providerPaymentId:
            paymentId,
        },
      });

      return res.status(202).json({
        success: true,
        captured: false,
        message:
          "Payment verified and is awaiting capture. The subscription will activate automatically after Razorpay confirms capture.",
      });
    } catch (error) {
      console.error(
        "Verify Razorpay payment failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to verify payment",
      });
    }
  }
);


router.get(
  "/receipts/:paymentId",
  async (req, res) => {
    try {
      const payment =
        await prisma.paymentTransaction.findFirst({
          where: {
            id: req.params.paymentId,
            companyId:
              req.clientUser.companyId,
          },
          include: {
            plan: true,
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
          message:
            "Payment receipt not found",
        });
      }

      return res.json({
        success: true,
        receipt: {
          id:
            payment.id,
          receiptNumber:
            payment.receipt,
          status:
            payment.status,
          amount:
            Number(payment.amount),
          // Invoice breakdown: original price, discount, and total paid.
          listPrice:
            Number(
              payment.listPrice ||
                payment.plan?.yearlyPrice ||
                payment.amount
            ),
          discountAmount:
            Number(
              payment.discountAmount || 0
            ),
          subtotal:
            Math.round(
              (Number(
                payment.listPrice ||
                  payment.plan?.yearlyPrice ||
                  payment.amount
              ) - Number(payment.discountAmount || 0)) * 100
            ) / 100,
          gstRate:
            Number(payment.amount) >
            Number(
              payment.listPrice ||
                payment.plan?.yearlyPrice ||
                payment.amount
            ) - Number(payment.discountAmount || 0)
              ? GST_RATE
              : 0,
          gstAmount:
            Math.max(
              0,
              Math.round(
                (Number(payment.amount) -
                  (Number(
                    payment.listPrice ||
                      payment.plan?.yearlyPrice ||
                      payment.amount
                  ) - Number(payment.discountAmount || 0))) * 100
              ) / 100
            ),
          finalAmount:
            Number(payment.amount),
          currency:
            payment.currency,
          billingCycle:
            "YEARLY",
          provider:
            payment.provider,
          providerOrderId:
            payment.providerOrderId,
          providerPaymentId:
            payment.providerPaymentId,
          paidAt:
            payment.paidAt,
          createdAt:
            payment.createdAt,
          plan: {
            key:
              payment.plan.key,
            name:
              payment.plan.name,
          },
          company:
            payment.company,
          subscription:
            payment.subscription,
        },
      });
    } catch (error) {
      console.error(
        "Load payment receipt failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load payment receipt",
      });
    }
  }
);

export default router;