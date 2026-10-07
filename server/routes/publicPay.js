import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import { getRazorpayClient, getRazorpayConfig } from "../lib/razorpay.js";
import { finalizeCapturedPayment } from "../lib/subscriptions.js";

const router = Router();

const GST_RATE = 18;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

function safeEqualHex(a, b) {
  try {
    const aBuffer = Buffer.from(a, "hex");
    const bBuffer = Buffer.from(b, "hex");
    return (
      aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer)
    );
  } catch {
    return false;
  }
}

// Resolve the pay token -> its PaymentTransaction (with company + plan).
async function loadFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  } catch {
    return { error: "This payment link is invalid or has expired" };
  }
  if (payload?.typ !== "pay" || !payload?.t) {
    return { error: "This payment link is invalid" };
  }

  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: payload.t },
    include: {
      plan: true,
      company: {
        select: { id: true, name: true, brandName: true, email: true, phone: true, city: true },
      },
      subscription: {
        select: { id: true, status: true, billingCycle: true, startDate: true, renewalDate: true, endDate: true },
      },
    },
  });

  if (!payment) return { error: "Payment not found for this link" };
  return { payment };
}

// Invoice/receipt shape — matches clientBilling.js /receipts so the PDF and
// on-screen receipt are identical whether paid via portal or via a link.
function buildReceipt(payment) {
  const listPrice = Number(payment.listPrice || payment.plan?.yearlyPrice || payment.amount);
  const discountAmount = Number(payment.discountAmount || 0);
  const subtotal = Math.round((listPrice - discountAmount) * 100) / 100;
  const amount = Number(payment.amount);
  const gstAmount = Math.max(0, Math.round((amount - subtotal) * 100) / 100);
  return {
    id: payment.id,
    receiptNumber: payment.receipt,
    status: payment.status,
    amount,
    listPrice,
    discountAmount,
    subtotal,
    gstRate: gstAmount > 0 ? GST_RATE : 0,
    gstAmount,
    finalAmount: amount,
    currency: payment.currency,
    billingCycle: "YEARLY",
    provider: payment.provider,
    providerOrderId: payment.providerOrderId,
    providerPaymentId: payment.providerPaymentId,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    plan: { key: payment.plan.key, name: payment.plan.name },
    company: payment.company,
    subscription: payment.subscription,
  };
}

/**
 * GET /api/public/pay/:token
 * Returns what the public pay page needs to open Razorpay Checkout,
 * or the receipt if this link was already paid.
 */
router.get("/:token", async (req, res) => {
  try {
    const { payment, error } = await loadFromToken(req.params.token);
    if (error) return res.status(404).json({ success: false, message: error });

    if (payment.status === "CAPTURED") {
      return res.json({ success: true, paid: true, receipt: buildReceipt(payment) });
    }

    const { keyId } = getRazorpayConfig();
    const amount = Number(payment.amount);
    const listPrice = Number(payment.listPrice || payment.plan?.yearlyPrice || amount);
    const discountAmount = Number(payment.discountAmount || 0);
    const subtotal = Math.round((listPrice - discountAmount) * 100) / 100;
    const gstAmount = Math.max(0, Math.round((amount - subtotal) * 100) / 100);

    return res.json({
      success: true,
      paid: false,
      keyId,
      order: {
        id: payment.providerOrderId,
        amount: Math.round(amount * 100),
        currency: payment.currency,
      },
      plan: { key: payment.plan.key, name: payment.plan.name },
      company: { name: payment.company?.name || "" },
      prefill: {
        name: payment.company?.name || "",
        email: payment.company?.email || "",
        contact: payment.company?.phone || "",
      },
      breakdown: {
        listPrice,
        discount: discountAmount,
        subtotal,
        gstRate: gstAmount > 0 ? GST_RATE : 0,
        gstAmount,
        finalAmount: amount,
      },
    });
  } catch (error) {
    console.error("Public pay info failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load this payment" });
  }
});

/**
 * POST /api/public/pay/:token/verify
 * Verifies the Razorpay signature and finalises the subscription.
 * (The webhook also finalises independently, so a closed tab still activates.)
 */
router.post("/:token/verify", async (req, res) => {
  try {
    const { payment, error } = await loadFromToken(req.params.token);
    if (error) return res.status(404).json({ success: false, message: error });

    const orderId = String(req.body?.razorpay_order_id || "").trim();
    const paymentId = String(req.body?.razorpay_payment_id || "").trim();
    const signature = String(req.body?.razorpay_signature || "").trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, message: "Incomplete payment details" });
    }

    if (orderId !== payment.providerOrderId) {
      return res.status(400).json({ success: false, message: "Payment does not match this link" });
    }

    const { keySecret } = getRazorpayConfig();
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (!safeEqualHex(expected, signature)) {
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    const razorpay = getRazorpayClient();
    const providerPayment = await razorpay.payments.fetch(paymentId);

    if (
      providerPayment.order_id !== orderId ||
      Number(providerPayment.amount) !== Math.round(Number(payment.amount) * 100) ||
      providerPayment.currency !== payment.currency
    ) {
      return res.status(400).json({ success: false, message: "Payment details do not match the order" });
    }

    if (providerPayment.status === "captured") {
      await finalizeCapturedPayment({ transactionId: payment.id, providerPaymentId: paymentId });
      const paid = await prisma.paymentTransaction.findUnique({
        where: { id: payment.id },
        include: {
          plan: true,
          company: { select: { id: true, name: true, brandName: true, email: true, phone: true, city: true } },
          subscription: { select: { id: true, status: true, billingCycle: true, startDate: true, renewalDate: true, endDate: true } },
        },
      });
      return res.json({ success: true, captured: true, receipt: buildReceipt(paid) });
    }

    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: providerPayment.status === "authorized" ? "AUTHORIZED" : payment.status,
        providerPaymentId: paymentId,
      },
    });

    return res.status(202).json({
      success: true,
      captured: false,
      message: "Payment received and awaiting capture. It will activate automatically.",
    });
  } catch (error) {
    console.error("Public pay verify failed:", error);
    return res.status(500).json({ success: false, message: "Unable to verify payment" });
  }
});

export default router;
