import crypto from "crypto";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { resolveMx } from "node:dns/promises";

import prisma from "../lib/prisma.js";
import { getRazorpayClient, getRazorpayConfig } from "../lib/razorpay.js";
import {
  computeSelfServePricing,
  finalizeSelfServeSignup,
  buildSelfServeReceipt,
} from "../lib/selfServeOnboard.js";
import {
  assertContactVerified,
  ContactVerificationError,
  sendContactVerificationOtp,
  verifyContactVerificationOtp,
} from "../lib/contactVerification.js";

const router = Router();

function isEmail(value) {
  const email = String(value || "").trim().toLowerCase();

  if (!email || email.length > 254 || email.includes(" ")) {
    return false;
  }

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) {
    return false;
  }

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  ) {
    return false;
  }

  return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

function isPhone(value) {
  return /^\d{10}$/.test(String(value || "").trim());
}

function getEmailDomain(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .split("@")
    .pop();
}

async function emailDomainCanReceiveMail(email) {
  const domain = getEmailDomain(email);

  try {
    const records = await resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (error) {
    if (["ENOTFOUND", "ENODATA", "EFORMERR", "EBADNAME"].includes(error?.code)) {
      return false;
    }

    throw error;
  }
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

/** Contact verification used before a public signup can start payment. */
router.post("/verification/send", async (req, res) => {
  try {
    const channel = String(req.body?.channel || "").trim().toLowerCase();
    const purpose = String(req.body?.purpose || "").trim().toLowerCase();
    const target = String(req.body?.target || "").trim();

    if (channel === "email") {
      if (!isEmail(target)) {
        return res.status(400).json({ success: false, message: "Enter a valid email address" });
      }
      let domainValid;
      try {
        domainValid = await emailDomainCanReceiveMail(target);
      } catch (error) {
        console.error("Public OTP email-domain check failed:", error);
        return res.status(503).json({ success: false, message: "Unable to verify this email domain right now. Please try again." });
      }
      if (!domainValid) {
        return res.status(400).json({ success: false, message: "Use an email address with a valid mail domain" });
      }
    } else if (channel === "phone") {
      if (!isPhone(target)) {
        return res.status(400).json({ success: false, message: "Enter a valid 10-digit phone number" });
      }
    } else {
      return res.status(400).json({ success: false, message: "Invalid verification channel" });
    }

    const result = await sendContactVerificationOtp({ channel, purpose, target });
    return res.json({ success: true, message: "OTP sent successfully", ...result });
  } catch (error) {
    if (error instanceof ContactVerificationError) {
      return res.status(error.status || 400).json({ success: false, message: error.message, code: error.code });
    }
    console.error("Public contact OTP send failed:", error);
    return res.status(500).json({ success: false, message: "Unable to send OTP" });
  }
});

router.post("/verification/verify", async (req, res) => {
  try {
    const result = await verifyContactVerificationOtp({
      channel: req.body?.channel,
      purpose: req.body?.purpose,
      target: req.body?.target,
      otp: req.body?.otp,
      challengeToken: req.body?.challengeToken,
    });
    return res.json({ success: true, message: "Verified successfully", ...result });
  } catch (error) {
    if (error instanceof ContactVerificationError) {
      return res.status(error.status || 400).json({ success: false, message: error.message, code: error.code });
    }
    console.error("Public contact OTP verify failed:", error);
    return res.status(500).json({ success: false, message: "Unable to verify OTP" });
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
    const companyEmailVerificationToken = String(b.companyEmailVerificationToken || "");
    const adminEmailVerificationToken = String(b.adminEmailVerificationToken || "");
    const phoneVerificationToken = String(b.phoneVerificationToken || "");

    if (!companyName) return res.status(400).json({ success: false, message: "Company name is required" });
    if (!business) return res.status(400).json({ success: false, message: "Business type is required" });
    if (!ownerName) return res.status(400).json({ success: false, message: "Owner name is required" });
    if (!isEmail(companyEmail)) return res.status(400).json({ success: false, message: "Enter a valid company email" });
    if (!isPhone(companyPhone)) return res.status(400).json({ success: false, message: "Enter a valid 10-digit company phone number" });
    if (!adminName) return res.status(400).json({ success: false, message: "Admin name is required" });
    if (!isEmail(adminEmail)) return res.status(400).json({ success: false, message: "Enter a valid admin email" });
    if (adminPassword.length < 8) return res.status(400).json({ success: false, message: "Admin password must be at least 8 characters" });

    let companyEmailDomainValid;
    let adminEmailDomainValid;

    try {
      [companyEmailDomainValid, adminEmailDomainValid] = await Promise.all([
        emailDomainCanReceiveMail(companyEmail),
        emailDomainCanReceiveMail(adminEmail),
      ]);
    } catch (error) {
      console.error("Public signup email domain verification failed:", error);
      return res.status(503).json({
        success: false,
        message: "Unable to verify email domains right now. Please try again.",
      });
    }

    if (!companyEmailDomainValid) {
      return res.status(400).json({
        success: false,
        message: "Company email domain could not be verified. Use a valid email address.",
      });
    }

    if (!adminEmailDomainValid) {
      return res.status(400).json({
        success: false,
        message: "Admin email domain could not be verified. Use a valid email address.",
      });
    }

    try {
      assertContactVerified(companyEmailVerificationToken, {
        channel: "email",
        purpose: "company_email",
        target: companyEmail,
      });
      assertContactVerified(adminEmailVerificationToken, {
        channel: "email",
        purpose: "admin_email",
        target: adminEmail,
      });
      assertContactVerified(phoneVerificationToken, {
        channel: "phone",
        purpose: "company_phone",
        target: companyPhone,
      });
    } catch (error) {
      if (error instanceof ContactVerificationError) {
        return res.status(error.status || 400).json({
          success: false,
          message: error.message,
          code: error.code,
        });
      }
      throw error;
    }

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