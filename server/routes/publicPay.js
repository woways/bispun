import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import { getRazorpayClient, getRazorpayConfig } from "../lib/razorpay.js";
import { finalizeCapturedPayment } from "../lib/subscriptions.js";
import { buildSelfServeReceipt, finalizeSelfServeSignup } from "../lib/selfServeOnboard.js";

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

async function loadPaymentTransaction(transactionId) {
  return prisma.paymentTransaction.findUnique({
    where: { id: transactionId },
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
}

// Resolve the public pay token. Existing-client links point to a
// PaymentTransaction. Pre-onboarding links point to PendingSignup so the real
// Company/User/Subscription can be created only after a captured payment.
async function loadFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  } catch {
    return { error: "This payment link is invalid or has expired" };
  }

  if (payload?.typ === "pay" && payload?.t) {
    const payment = await loadPaymentTransaction(payload.t);
    if (!payment) return { error: "Payment not found for this link" };
    return { kind: "payment", payment };
  }

  if (payload?.typ === "onboard_pay" && payload?.p) {
    const pending = await prisma.pendingSignup.findUnique({
      where: { id: payload.p },
    });

    if (!pending || (payload.o && payload.o !== pending.providerOrderId)) {
      return { error: "This payment link is invalid" };
    }

    if (pending.status === "CANCELLED" || pending.status === "FAILED") {
      return { error: "This payment link is no longer active" };
    }

    if (pending.status === "CONSUMED") {
      const paid = await prisma.paymentTransaction.findUnique({
        where: { providerOrderId: pending.providerOrderId },
      });
      if (!paid) return { error: "Payment was completed but the receipt is unavailable" };
      const payment = await loadPaymentTransaction(paid.id);
      return { kind: "payment", payment };
    }

    const plan = await prisma.plan.findUnique({ where: { id: pending.planId } });
    if (!plan || !plan.active) return { error: "The selected plan is unavailable" };

    return { kind: "pending", pending, plan };
  }

  return { error: "This payment link is invalid" };
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

function pendingBreakdown(pending, plan) {
  const payload = pending.payload || {};
  const listPrice = Number(pending.listPrice || plan?.yearlyPrice || pending.amount || 0);
  let discount = Number(payload.discountAmount || 0);
  if (!Number.isFinite(discount) || discount < 0) discount = 0;
  if (discount > listPrice) discount = listPrice;
  discount = Math.round(discount * 100) / 100;
  const subtotal = Math.round((listPrice - discount) * 100) / 100;
  const finalAmount = Math.round(Number(pending.amount || 0) * 100) / 100;
  const gstAmount = Math.max(0, Math.round((finalAmount - subtotal) * 100) / 100);
  return {
    listPrice,
    discount,
    subtotal,
    gstRate: gstAmount > 0 ? GST_RATE : 0,
    gstAmount,
    finalAmount,
  };
}

/**
 * GET /api/public/pay/:token
 * Returns what the public pay page needs to open Razorpay Checkout,
 * or the receipt if this link was already paid.
 */
router.get("/:token", async (req, res) => {
  try {
    const loaded = await loadFromToken(req.params.token);
    if (loaded.error) return res.status(404).json({ success: false, message: loaded.error });

    if (loaded.kind === "payment") {
      const { payment } = loaded;
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
    }

    const { pending, plan } = loaded;
    const payload = pending.payload || {};
    const { keyId } = getRazorpayConfig();
    const breakdown = pendingBreakdown(pending, plan);

    return res.json({
      success: true,
      paid: false,
      onboarding: true,
      keyId,
      order: {
        id: pending.providerOrderId,
        amount: Math.round(Number(pending.amount) * 100),
        currency: pending.currency,
      },
      plan: { key: plan.key, name: plan.name },
      company: { name: payload.companyName || "" },
      prefill: {
        name: payload.adminName || payload.companyName || "",
        email: payload.adminEmail || payload.companyEmail || "",
        contact: payload.companyPhone || "",
      },
      breakdown,
    });
  } catch (error) {
    console.error("Public pay info failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load this payment" });
  }
});

/**
 * POST /api/public/pay/:token/verify
 * Verifies the Razorpay signature and finalises either an existing-client
 * subscription or a pre-onboarding signup. The webhook also finalises
 * independently, so a closed tab still completes the flow.
 */
router.post("/:token/verify", async (req, res) => {
  try {
    const loaded = await loadFromToken(req.params.token);
    if (loaded.error) return res.status(404).json({ success: false, message: loaded.error });

    const orderId = String(req.body?.razorpay_order_id || "").trim();
    const paymentId = String(req.body?.razorpay_payment_id || "").trim();
    const signature = String(req.body?.razorpay_signature || "").trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, message: "Incomplete payment details" });
    }

    const expectedOrderId =
      loaded.kind === "payment"
        ? loaded.payment.providerOrderId
        : loaded.pending.providerOrderId;

    if (orderId !== expectedOrderId) {
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

    const expectedAmount =
      loaded.kind === "payment"
        ? Math.round(Number(loaded.payment.amount) * 100)
        : Math.round(Number(loaded.pending.amount) * 100);
    const expectedCurrency =
      loaded.kind === "payment" ? loaded.payment.currency : loaded.pending.currency;

    if (
      providerPayment.order_id !== orderId ||
      Number(providerPayment.amount) !== expectedAmount ||
      providerPayment.currency !== expectedCurrency
    ) {
      return res.status(400).json({ success: false, message: "Payment details do not match the order" });
    }

    if (providerPayment.status === "captured") {
      if (loaded.kind === "pending") {
        const { payment } = await finalizeSelfServeSignup(loaded.pending, paymentId);
        const receipt = payment ? await buildSelfServeReceipt(payment.id) : null;
        return res.json({
          success: true,
          captured: true,
          onboarding: true,
          message: "Payment verified. The Bispun workspace is now active.",
          receipt,
        });
      }

      await finalizeCapturedPayment({
        transactionId: loaded.payment.id,
        providerPaymentId: paymentId,
      });
      const paid = await loadPaymentTransaction(loaded.payment.id);
      return res.json({ success: true, captured: true, receipt: buildReceipt(paid) });
    }

    if (loaded.kind === "payment") {
      await prisma.paymentTransaction.update({
        where: { id: loaded.payment.id },
        data: {
          status: providerPayment.status === "authorized" ? "AUTHORIZED" : loaded.payment.status,
          providerPaymentId: paymentId,
        },
      });
    } else {
      await prisma.pendingSignup.update({
        where: { id: loaded.pending.id },
        data: { providerPaymentId: paymentId },
      });
    }

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