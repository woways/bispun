import crypto from "crypto";
import bcrypt from "bcryptjs";
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
const LEGACY_SUBDOMAIN_SUFFIX = ".consulbuzz.com";
const BISPUN_SUBDOMAIN_SUFFIX = ".bispun.com";

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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || "").trim());
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBispunSubdomain(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  if (normalized.endsWith(LEGACY_SUBDOMAIN_SUFFIX)) {
    return `${normalized.slice(0, -LEGACY_SUBDOMAIN_SUFFIX.length)}${BISPUN_SUBDOMAIN_SUFFIX}`;
  }

  return normalized;
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
 * POST /api/admin/payment-links/pre-onboard
 *
 * Creates a PRE-ONBOARDING payment link directly from the Super Admin
 * onboarding form. No Company/User/Subscription is created yet. The completed
 * form is stored in PendingSignup with the admin password already hashed.
 * After Razorpay capture, the existing webhook/public verify flow creates the
 * real client workspace and payment invoice atomically.
 */
router.post("/pre-onboard", async (req, res) => {
  try {
    const b = req.body || {};

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
    const planKey = String(b.planKey || "").trim().toLowerCase();
    const referralCode = String(b.referralCode || "").trim().toUpperCase();
    const primaryColor = String(b.primaryColor || "indigo").trim() || "indigo";

    if (!companyName) return res.status(400).json({ success: false, message: "Company name is required" });
    if (!business) return res.status(400).json({ success: false, message: "Business type is required" });
    if (!ownerName) return res.status(400).json({ success: false, message: "Owner name is required" });
    if (!city) return res.status(400).json({ success: false, message: "City is required" });
    if (!isValidEmail(companyEmail)) return res.status(400).json({ success: false, message: "Enter a valid company email" });
    if (!isValidPhone(companyPhone)) return res.status(400).json({ success: false, message: "Enter a valid company phone" });
    if (!adminName) return res.status(400).json({ success: false, message: "Client admin name is required" });
    if (!isValidEmail(adminEmail)) return res.status(400).json({ success: false, message: "Enter a valid client admin email" });
    if (adminPassword.length < 8) return res.status(400).json({ success: false, message: "Client admin password must be at least 8 characters" });
    if (!planKey) return res.status(400).json({ success: false, message: "Plan is required" });

    const slug = slugify(companyName);
    if (!slug) return res.status(400).json({ success: false, message: "Invalid company name" });

    const cleanSubdomain = b.subdomain
      ? normalizeBispunSubdomain(b.subdomain)
      : `${slug}.bispun.com`;

    const [existingCompany, existingAdmin, existingSubdomain, plan] = await Promise.all([
      prisma.company.findUnique({ where: { slug } }),
      prisma.user.findUnique({ where: { email: adminEmail } }),
      prisma.company.findUnique({ where: { subdomain: cleanSubdomain } }),
      prisma.plan.findUnique({ where: { key: planKey } }),
    ]);

    if (existingCompany) {
      return res.status(409).json({ success: false, message: "A company with this name already exists" });
    }
    if (existingAdmin) {
      return res.status(409).json({ success: false, message: "A user with this admin email already exists" });
    }
    if (existingSubdomain) {
      return res.status(409).json({ success: false, message: "This subdomain is already being used" });
    }
    if (!plan || !plan.active || plan.yearlyPrice === null || Number(plan.yearlyPrice) <= 0) {
      return res.status(400).json({ success: false, message: "Selected plan is unavailable" });
    }

    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });
      if (!referrer) {
        return res.status(400).json({ success: false, message: "Referral code is invalid" });
      }
    }

    const pricing = computePricing(plan.yearlyPrice, b.discountAmount);
    const amountPaise = Math.round(pricing.finalAmount * 100);
    if (amountPaise < 100) {
      return res.status(400).json({ success: false, message: "Payable amount must be at least ₹1" });
    }

    const receipt = `cbpo_${Date.now()}`.slice(0, 40);
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt,
      notes: {
        source: "admin_pre_onboard",
        planKey: plan.key,
        company: companyName,
      },
    });

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const pending = await prisma.pendingSignup.create({
      data: {
        providerOrderId: order.id,
        planId: plan.id,
        listPrice: pricing.listPrice,
        amount: pricing.finalAmount,
        currency: "INR",
        status: "PENDING",
        payload: {
          source: "admin_pre_onboard",
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
          subdomain: cleanSubdomain,
          primaryColor,
          discountAmount: pricing.discount,
          subtotal: pricing.subtotal,
          gstRate: pricing.gstRate,
          gstAmount: pricing.gstAmount,
        },
      },
    });

    const token = jwt.sign(
      { typ: "onboard_pay", p: pending.id, o: order.id },
      getJwtSecret(),
      { expiresIn: "7d", algorithm: "HS256" }
    );

    const payUrl = `${webBaseUrl()}/pay/${token}`;

    return res.status(201).json({
      success: true,
      payUrl,
      pendingId: pending.id,
      amount: pricing.finalAmount,
      plan: { key: plan.key, name: plan.name },
      breakdown: pricing,
      expiresInDays: 7,
      company: { name: companyName, email: companyEmail, phone: companyPhone },
      message: "Pre-onboarding payment link created. The client workspace will be created only after payment is captured.",
    });
  } catch (error) {
    console.error("Create pre-onboarding payment link failed:", error);
    return res.status(500).json({ success: false, message: "Unable to create pre-onboarding payment link" });
  }
});

/**
 * DELETE /api/admin/payment-links/pre-onboard/:pendingId
 * Invalidates an unsent/incorrect pre-onboarding link so the admin can edit the
 * form and safely generate a fresh one. Razorpay orders cannot be deleted, but
 * the Bispun public URL becomes unusable immediately.
 */
router.delete("/pre-onboard/:pendingId", async (req, res) => {
  try {
    const pending = await prisma.pendingSignup.findUnique({
      where: { id: req.params.pendingId },
    });

    if (!pending) {
      return res.status(404).json({ success: false, message: "Payment link not found" });
    }

    if (pending.status === "CONSUMED") {
      return res.status(409).json({ success: false, message: "This payment is already completed" });
    }

    if (pending.status !== "CANCELLED") {
      await prisma.pendingSignup.update({
        where: { id: pending.id },
        data: { status: "CANCELLED" },
      });
    }

    return res.json({ success: true, message: "Payment link cancelled" });
  } catch (error) {
    console.error("Cancel pre-onboarding payment link failed:", error);
    return res.status(500).json({ success: false, message: "Unable to cancel payment link" });
  }
});

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