import crypto from "crypto";
import { Router } from "express";
import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import { getRazorpayClient } from "../lib/razorpay.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";

const router = Router();

router.use(requireSuperAdmin);

// GST percent. Kept in sync with adminClients.js / clientBilling.js so the
// amount on a generated link matches onboarding, renewal and receipts.
const GST_RATE = 18;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

// Public base URL the client opens the pay page on (the website, NOT the API).
// Falls back to the first https origin in CLIENT_URL, then bispun.com.
function webBaseUrl() {
  const explicit = String(process.env.PUBLIC_WEB_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const origins = String(process.env.CLIENT_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const https = origins.find((o) => o.startsWith("https://") && !o.includes("www."));
  return (https || origins[0] || "https://bispun.com").replace(/\/+$/, "");
}

// Same math as adminClients.computePricing: clamp discount, add 18% GST.
function computePricing(yearlyPrice, rawDiscount) {
  const listPrice = Number(yearlyPrice) || 0;
  let discount = Number(rawDiscount);
  if (!Number.isFinite(discount) || discount < 0) discount = 0;
  if (discount > listPrice) discount = listPrice;
  discount = Math.round(discount * 100) / 100;
  const subtotal = Math.round((listPrice - discount) * 100) / 100;
  const gstAmount = Math.round(subtotal * (GST_RATE / 100) * 100) / 100;
  const finalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
  return { listPrice, discount, subtotal, gstRate: GST_RATE, gstAmount, finalAmount };
}

/**
 * POST /api/admin/payment-links
 * Body: { companyId, planKey?, discount?, amountOverride? }
 *
 * Creates a Razorpay order + a CREATED PaymentTransaction and returns a signed
 * public pay URL (/pay/:token) the Super Admin can send to the client.
 * The existing webhook (payment.captured) and the public verify endpoint both
 * finalise the same transaction, so nothing else needs to change.
 */
router.post("/", async (req, res) => {
  try {
    const companyId = String(req.body?.companyId || "").trim();
    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId is required" });
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscriptions: { orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } },
      },
    });

    if (!company) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const currentSub = company.subscriptions?.[0] || null;

    // Pick the plan: explicit planKey, else the company's current subscription plan.
    const planKey = String(req.body?.planKey || "").trim().toLowerCase();
    const plan = planKey
      ? await prisma.plan.findUnique({ where: { key: planKey } })
      : currentSub?.plan || null;

    if (!plan || !plan.active) {
      return res
        .status(400)
        .json({ success: false, message: "Select a valid plan for this client" });
    }

    // Discount: explicit, else carry the current subscription's discount for the same plan.
    let discount = req.body?.discount;
    if (discount === undefined || discount === null || discount === "") {
      discount =
        currentSub && currentSub.planId === plan.id && currentSub.discountAmount
          ? Number(currentSub.discountAmount)
          : 0;
    }

    const pricing = computePricing(plan.yearlyPrice, discount);

    // amountOverride lets the admin type an exact figure; otherwise use list+GST.
    const override = req.body?.amountOverride;
    const amount =
      override !== undefined && override !== null && override !== ""
        ? Math.round(Number(override) * 100) / 100
        : pricing.finalAmount;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Payable amount is invalid" });
    }

    const amountPaise = Math.round(amount * 100);
    if (amountPaise < 100) {
      return res.status(400).json({ success: false, message: "Amount must be at least ₹1" });
    }

    const receipt = `cb_${Date.now()}_${companyId.slice(-6)}`.slice(0, 40);

    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        companyId,
        planKey: plan.key,
        billingCycle: "YEARLY",
        source: "admin_payment_link",
      },
    });

    const transaction = await prisma.paymentTransaction.create({
      data: {
        companyId,
        planId: plan.id,
        initiatedByUserId: null,
        provider: "RAZORPAY",
        status: "CREATED",
        billingCycle: "YEARLY",
        listPrice: pricing.listPrice,
        discountAmount: override ? 0 : pricing.discount,
        amount,
        currency: "INR",
        providerOrderId: order.id,
        receipt,
      },
    });

    const token = jwt.sign(
      { typ: "pay", t: transaction.id, c: companyId },
      getJwtSecret(),
      { expiresIn: "7d", algorithm: "HS256" }
    );

    const payUrl = `${webBaseUrl()}/pay/${token}`;

    return res.status(201).json({
      success: true,
      payUrl,
      transactionId: transaction.id,
      amount,
      plan: { key: plan.key, name: plan.name },
      breakdown: pricing,
      expiresInDays: 7,
      company: { id: company.id, name: company.name },
    });
  } catch (error) {
    console.error("Create admin payment link failed:", error);
    return res.status(500).json({ success: false, message: "Unable to create payment link" });
  }
});

export default router;
