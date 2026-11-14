import prisma from "./prisma.js";
import { sendWelcomeEmail, getAppLoginUrl } from "./mailer.js";
import { shouldAttributeReferral } from "./referralRewards.js";

// GST percent — kept in sync with adminClients.js / clientBilling.js.
export const GST_RATE = 18;
const LEGACY_SUBDOMAIN_SUFFIX = ".consulbuzz.com";
const BISPUN_SUBDOMAIN_SUFFIX = ".bispun.com";

export function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeBispunSubdomain(value) {
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

export function shortNameFromCompany(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function addMonths(date, months) {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

// Is a plan's promotional offer currently live? Offer must be a positive price
// below the list price, and either have no end date or an end date in the future.
export function isPlanOfferActive(offerPrice, offerEndsAt, listPrice) {
  const op = Number(offerPrice);
  const lp = Number(listPrice) || 0;
  if (!Number.isFinite(op) || op <= 0) return false;
  if (op >= lp) return false;
  if (offerEndsAt && new Date(offerEndsAt).getTime() < Date.now()) return false;
  return true;
}

// Self-serve pricing: list price (or active offer price) + 18% GST.
// Accepts a plan object { yearlyPrice, offerPrice, offerEndsAt } or, for
// back-compatibility, a raw yearly price number.
export function computeSelfServePricing(plan) {
  const isObj = plan && typeof plan === "object";
  const listPrice = Number(isObj ? plan.yearlyPrice : plan) || 0;
  const offerPrice = isObj ? plan.offerPrice : null;
  const offerEndsAt = isObj ? plan.offerEndsAt : null;

  const offerActive = isPlanOfferActive(offerPrice, offerEndsAt, listPrice);
  const subtotal = offerActive
    ? Math.round(Number(offerPrice) * 100) / 100
    : listPrice;
  const discount = Math.round((listPrice - subtotal) * 100) / 100;
  const gstAmount = Math.round(subtotal * (GST_RATE / 100) * 100) / 100;
  const finalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
  return {
    listPrice,
    discount,
    subtotal,
    gstRate: GST_RATE,
    gstAmount,
    finalAmount,
    offerActive,
    offerEndsAt: offerActive ? offerEndsAt : null,
  };
}

async function uniqueSubdomain(base) {
  let candidate = normalizeBispunSubdomain(base);
  for (let i = 0; i < 20; i++) {
    const probe = i === 0 ? candidate : candidate.replace(/\.bispun\.com$/, `-${i + 1}.bispun.com`);
    const exists = await prisma.company.findUnique({ where: { subdomain: probe } });
    if (!exists) return probe;
  }
  return candidate.replace(/\.bispun\.com$/, `-${Date.now().toString().slice(-5)}.bispun.com`);
}

/**
 * Create the real Company + admin + subscription from a captured self-serve
 * signup. Idempotent: safe to call from both the verify endpoint and the webhook.
 * Returns { company, payment } or throws.
 */
// PDF §11 lifecycle, stage REFERRED: called from /start once a signup is
// verified and a payment order is created. Records a referral row (no company
// yet) linked to the PendingSignup. Backend-validated and non-fatal: an invalid/
// unknown code, a self-referral, or any error never blocks signup and never
// creates a reward. Idempotent via the unique pendingSignupId.
export async function recordReferredIntent({
  pendingSignupId,
  referralCode,
  referredEmail,
  referredName,
}) {
  try {
    const refCode = String(referralCode || "").trim().toUpperCase();
    if (!refCode || !pendingSignupId) return null;

    const referrer = await prisma.user.findUnique({
      where: { referralCode: refCode },
      select: { id: true, referralCode: true, email: true, active: true },
    });

    // Invalid/unknown code, inactive referrer, or self-referral -> no referral
    // row (signup still proceeds). Decision is a pure, unit-tested function.
    const decision = shouldAttributeReferral({
      referralCode: refCode,
      referrerFound: Boolean(referrer),
      referrerActive: referrer?.active,
      referrerEmail: referrer?.email,
      referredEmail,
    });
    if (!decision.ok) return null;

    // Idempotent: one REFERRED row per pending signup/order.
    const existing = await prisma.crmReferral.findUnique({ where: { pendingSignupId } });
    if (existing) return existing;

    return await prisma.crmReferral.create({
      data: {
        referrerId: referrer.id,
        referredCompanyId: null,
        pendingSignupId,
        referralCode: referrer.referralCode,
        referredEmail: String(referredEmail || "").trim().toLowerCase() || null,
        referredName: referredName || null,
        status: "REFERRED",
        qualifiedAt: null,
      },
    });
  } catch (error) {
    // Never break signup because of referral attribution.
    console.error("recordReferredIntent failed (non-fatal):", error);
    return null;
  }
}

export async function finalizeSelfServeSignup(pending, providerPaymentId) {
  // Already done? Return the existing company + its payment.
  if (pending.status === "CONSUMED" && pending.createdCompanyId) {
    const payment = await prisma.paymentTransaction.findUnique({
      where: { providerOrderId: pending.providerOrderId },
    });
    const company = await prisma.company.findUnique({ where: { id: pending.createdCompanyId } });
    return { company, payment, alreadyDone: true };
  }

  const existingTxn = await prisma.paymentTransaction.findUnique({
    where: { providerOrderId: pending.providerOrderId },
  });
  if (existingTxn) {
    return { company: null, payment: existingTxn, alreadyDone: true };
  }

  const data = pending.payload || {};
  const plan = await prisma.plan.findUnique({
    where: { id: data.planId },
    include: { planModules: true },
  });
  if (!plan || !plan.active) throw new Error("Plan is unavailable for this signup");

  const isAdminPreOnboard = data.source === "admin_pre_onboard";

  // Public signup uses list price + GST. Super Admin pre-onboarding links may
  // include a manual discount, so preserve the exact quoted amount stored in
  // PendingSignup instead of recomputing it as a public self-serve purchase.
  const pricing = (() => {
    if (!isAdminPreOnboard) {
      // Prefer the exact breakdown captured when the order was created, so the
      // receipt matches the charged amount even if the offer has since expired.
      const stored = data.pricing;
      if (stored && Number.isFinite(Number(stored.finalAmount))) {
        return {
          listPrice: Number(stored.listPrice) || 0,
          discount: Number(stored.discount) || 0,
          subtotal: Number(stored.subtotal) || 0,
          gstRate: Number(stored.gstRate ?? GST_RATE),
          gstAmount: Number(stored.gstAmount) || 0,
          finalAmount: Number(stored.finalAmount) || 0,
        };
      }
      return computeSelfServePricing(plan);
    }

    const listPrice = Number(pending.listPrice || plan.yearlyPrice || 0);
    let discount = Number(data.discountAmount || 0);
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
  })();

  const slug = slugify(data.companyName);
  const subdomain = await uniqueSubdomain(data.subdomain || `${slug}.bispun.com`);

  // Resolve referral code -> referrer user (option B: credit the referrer).
  let referrer = null;
  const refCode = String(data.referralCode || "").trim().toUpperCase();
  if (refCode) {
    referrer = await prisma.user.findUnique({
      where: { referralCode: refCode },
      select: { id: true, referralCode: true, email: true, active: true },
    });

    // Parity with recordReferredIntent: reject unknown code, INACTIVE referrer,
    // or self-referral using the same pure, unit-tested decision function, so the
    // fallback-create path can never credit an inactive referrer.
    const decision = shouldAttributeReferral({
      referralCode: refCode,
      referrerFound: Boolean(referrer),
      referrerActive: referrer?.active,
      referrerEmail: referrer?.email,
      referredEmail: data.adminEmail,
    });
    if (!decision.ok) {
      referrer = null;
    }
  }

  const settings = await prisma.systemSettings.upsert({
    where: { key: "global" },
    update: {},
    create: { key: "global" },
  });

  const startDate = new Date();
  const renewalDate = addMonths(startDate, 12);
  const receipt = `cb_${Date.now()}_${pending.id.slice(-6)}`.slice(0, 40);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: data.companyName,
        slug,
        brandName: String(data.brandName || data.companyName).trim(),
        shortName: shortNameFromCompany(data.companyName),
        business: data.business || "",
        ownerName: data.ownerName || "",
        city: data.city || null,
        email: data.companyEmail,
        phone: data.companyPhone,
        subdomain,
        primaryColor: data.primaryColor || settings.defaultPrimaryColor || "indigo",
        status: "ACTIVE",
      },
    });

    await tx.companySettings.create({
      data: {
        companyId: company.id,
        portalName: String(data.brandName || `${data.companyName} CRM`).trim(),
        primaryColor: data.primaryColor || settings.defaultPrimaryColor || "indigo",
        timezone: settings.defaultTimezone || "Asia/Kolkata",
        currency: settings.defaultCurrency || "INR",
        dateFormat: settings.defaultDateFormat || "DD/MM/YYYY",
        emailNotifications: settings.defaultEmailNotifications ?? true,
        smsNotifications: settings.defaultSmsNotifications ?? false,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        status: "ACTIVE",
        billingCycle: "YEARLY",
        startDate,
        renewalDate,
        listPrice: pricing.listPrice,
        discountAmount: pricing.discount,
        amount: pricing.finalAmount,
      },
    });

    if (plan.planModules.length > 0) {
      await tx.companyModule.createMany({
        data: plan.planModules.map((pm) => ({
          companyId: company.id,
          moduleId: pm.moduleId,
          enabled: true,
        })),
      });
    }

    await tx.user.create({
      data: {
        name: data.adminName,
        email: data.adminEmail,
        passwordHash: data.passwordHash,
        role: "CLIENT_ADMIN",
        active: true,
        companyId: company.id,
      },
    });

    // Referred -> Earned. A REFERRED row created at verified signup is
    // transitioned to EARNED now that payment is captured + the company exists.
    // If none was recorded (legacy/direct), create the EARNED row as a fallback
    // so any paid referral is still attributed. This whole finalize runs once
    // per order (guarded above), so the transition is idempotent.
    const existingReferred = await tx.crmReferral.findUnique({
      where: { pendingSignupId: pending.id },
    });
    if (existingReferred) {
      if (existingReferred.status !== "EARNED") {
        await tx.crmReferral.update({
          where: { id: existingReferred.id },
          data: {
            status: "EARNED",
            referredCompanyId: company.id,
            qualifiedAt: new Date(),
          },
        });
      }
    } else if (referrer) {
      await tx.crmReferral.create({
        data: {
          referrerId: referrer.id,
          referredCompanyId: company.id,
          pendingSignupId: pending.id,
          referralCode: referrer.referralCode,
          referredEmail: data.adminEmail || null,
          referredName: data.adminName || null,
          status: "EARNED",
          qualifiedAt: new Date(),
        },
      });
    }

    const payment = await tx.paymentTransaction.create({
      data: {
        companyId: company.id,
        planId: plan.id,
        subscriptionId: subscription.id,
        provider: "RAZORPAY",
        status: "CAPTURED",
        billingCycle: "YEARLY",
        listPrice: pricing.listPrice,
        discountAmount: pricing.discount,
        amount: pricing.finalAmount,
        currency: pending.currency || "INR",
        providerOrderId: pending.providerOrderId,
        providerPaymentId: providerPaymentId || null,
        receipt,
        paidAt: new Date(),
      },
    });

    await tx.pendingSignup.update({
      where: { id: pending.id },
      data: { status: "CONSUMED", createdCompanyId: company.id, providerPaymentId: providerPaymentId || null },
    });

    return { company, payment };
  });

  // Welcome email with the login link — best-effort, never blocks signup.
  // Only reached on first creation (the alreadyDone branches return earlier),
  // so the buyer gets exactly one email even if verify + webhook both run.
  try {
    await sendWelcomeEmail({
      toEmail: data.adminEmail,
      adminName: data.adminName,
      companyName: result.company?.name,
      planName: plan.name,
      receiptNumber: result.payment?.receipt,
      amount: result.payment?.amount,
      loginUrl: getAppLoginUrl(),
    });
  } catch (error) {
    console.error("Self-serve welcome email failed:", error.message);
  }

  return result;
}

// Build the receipt shape (same as publicPay) for the success screen / PDF.
export async function buildSelfServeReceipt(paymentId) {
  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: paymentId },
    include: {
      plan: true,
      company: { select: { id: true, name: true, brandName: true, email: true, phone: true, city: true } },
      subscription: { select: { id: true, status: true, billingCycle: true, startDate: true, renewalDate: true, endDate: true } },
    },
  });
  if (!payment) return null;
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