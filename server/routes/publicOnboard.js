import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";

import prisma from "../lib/prisma.js";
import { getRazorpayClient, getRazorpayConfig } from "../lib/razorpay.js";
import {
  computeSelfServePricing,
  finalizeSelfServeSignup,
  buildSelfServeReceipt,
} from "../lib/selfServeOnboard.js";

const router = Router();

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(v || "").trim());
}
function isPhone(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15;
}
function safeEqualHex(a, b) {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

// GET /api/public/onboard/plans — public plan list for the signup page.
router.get("/plans", async (_req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { yearlyPrice: "asc" },
    });
    return res.json({
      success: true,
      plans: plans.map((p) => {
        const pricing = computeSelfServePricing(p.yearlyPrice);
        return {
          key: p.key,
          name: p.name,
          tagline: p.tagline || "",
          yearlyPrice: p.yearlyPrice !== null ? Number(p.yearlyPrice) : null,
          breakdown: pricing,
        };
      }),
    });
  } catch (error) {
    console.error("Public plans failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load plans" });
  }
});

/**
 * POST /api/public/onboard/start
 * Validates the signup form, creates a Razorpay order, stashes the form in
 * PendingSignup (password pre-hashed). Returns Checkout params. NO account yet.
 */
router.post("/start", async (req, res) => {
  try {
    const b = req.body || {};
    const planKey = String(b.planKey || "").trim().toLowerCase();

    const companyName = String(b.name || "").trim();
    const brandName = String(b.brandName || "").trim();
    const business = String(b.business || "").trim();
    const ownerName = String(b.ownerName || "").trim();
    const city = String(b.city || "").trim();
    const companyEmail = String(b.email || "").trim().toLowerCase();
    const companyPhone = String(b.phone || "").trim();
    const adminName = String(b.adminName || "").trim();
    const adminEmail = String(b.adminEmail || "").trim().toLowerCase();
    const adminPassword = String(b.adminPassword || "");
    const referralCode = String(b.referralCode || "").trim().toUpperCase();

    if (!companyName) return res.status(400).json({ success: false, message: "Company name is required" });
    if (!business) return res.status(400).json({ success: false, message: "Business type is required" });
    if (!ownerName) return res.status(400).json({ success: false, message: "Owner name is required" });
    if (!isEmail(companyEmail)) return res.status(400).json({ success: false, message: "Enter a valid company email" });
    if (!isPhone(companyPhone)) return res.status(400).json({ success: false, message: "Enter a valid company phone" });
    if (!adminName) return res.status(400).json({ success: false, message: "Admin name is required" });
    if (!isEmail(adminEmail)) return res.status(400).json({ success: false, message: "Enter a valid admin email" });
    if (adminPassword.length < 8) return res.status(400).json({ success: false, message: "Admin password must be at least 8 characters" });

    const plan = await prisma.plan.findUnique({ where: { key: planKey } });
    if (!plan || !plan.active) return res.status(404).json({ success: false, message: "Selected plan is unavailable" });
    if (plan.yearlyPrice === null || Number(plan.yearlyPrice) <= 0) {
      return res.status(400).json({ success: false, message: "Annual pricing is unavailable for this plan" });
    }

    // Early duplicate checks for a friendly message (uniqueness re-enforced at finalize).
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } }).catch(() => null);
    if (existingAdmin) return res.status(409).json({ success: false, message: "An account with this admin email already exists. Please log in instead." });

    const pricing = computeSelfServePricing(plan.yearlyPrice);
    const amountPaise = Math.round(pricing.finalAmount * 100);
    if (amountPaise < 100) return res.status(400).json({ success: false, message: "Payable amount is invalid" });

    const receipt = `cbss_${Date.now()}`.slice(0, 40);
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: { planKey: plan.key, source: "self_serve", company: companyName },
    });

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await prisma.pendingSignup.create({
      data: {
        providerOrderId: order.id,
        planId: plan.id,
        listPrice: pricing.listPrice,
        amount: pricing.finalAmount,
        currency: "INR",
        status: "PENDING",
        payload: {
          planId: plan.id,
          planKey: plan.key,
          companyName,
          brandName,
          business,
          ownerName,
          city,
          companyEmail,
          companyPhone,
          adminName,
          adminEmail,
          passwordHash,
          referralCode,
        },
      },
    });

    const { keyId } = getRazorpayConfig();
    return res.status(201).json({
      success: true,
      keyId,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      plan: { key: plan.key, name: plan.name },
      prefill: { name: adminName, email: adminEmail, contact: companyPhone },
      breakdown: pricing,
    });
  } catch (error) {
    console.error("Self-serve start failed:", error);
    return res.status(500).json({ success: false, message: "Unable to start signup" });
  }
});

/**
 * POST /api/public/onboard/verify
 * Verifies the signature and creates the account. The webhook also finalises
 * independently, so a closed tab still gets the account after payment.
 */
router.post("/verify", async (req, res) => {
  try {
    const orderId = String(req.body?.razorpay_order_id || "").trim();
    const paymentId = String(req.body?.razorpay_payment_id || "").trim();
    const signature = String(req.body?.razorpay_signature || "").trim();
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, message: "Incomplete payment details" });
    }

    const pending = await prisma.pendingSignup.findUnique({ where: { providerOrderId: orderId } });
    if (!pending) return res.status(404).json({ success: false, message: "Signup not found for this payment" });

    const { keySecret } = getRazorpayConfig();
    const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    if (!safeEqualHex(expected, signature)) {
      return res.status(400).json({ success: false, message: "Payment signature verification failed" });
    }

    const razorpay = getRazorpayClient();
    const providerPayment = await razorpay.payments.fetch(paymentId);
    if (
      providerPayment.order_id !== orderId ||
      Number(providerPayment.amount) !== Math.round(Number(pending.amount) * 100) ||
      providerPayment.currency !== pending.currency
    ) {
      return res.status(400).json({ success: false, message: "Payment details do not match the order" });
    }

    if (providerPayment.status !== "captured") {
      return res.status(202).json({
        success: true,
        captured: false,
        message: "Payment received and awaiting capture. Your workspace will be created automatically.",
      });
    }

    const { payment } = await finalizeSelfServeSignup(pending, paymentId);
    const receipt = payment ? await buildSelfServeReceipt(payment.id) : null;
    return res.json({
      success: true,
      captured: true,
      message: "Payment verified. Your workspace is ready.",
      loginUrl: "/login",
      receipt,
    });
  } catch (error) {
    console.error("Self-serve verify failed:", error);
    const msg = /already exists|unique/i.test(error.message)
      ? "An account with these details already exists. Please log in."
      : "Unable to complete signup";
    return res.status(500).json({ success: false, message: msg });
  }
});

export default router;
