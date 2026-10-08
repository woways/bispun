import prisma from "./prisma.js";
import { sendWelcomeEmail, getAppLoginUrl } from "./mailer.js";

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

// Self-serve pricing: list price + 18% GST, no discount (discount is admin-only).
export function computeSelfServePricing(yearlyPrice) {
  const listPrice = Number(yearlyPrice) || 0;
  const subtotal = listPrice; // no discount on self-serve
  const gstAmount = Math.round(subtotal * (GST_RATE / 100) * 100) / 100;
  const finalAmount = Math.round((subtotal + gstAmount) * 100) / 100;
  return { listPrice, discount: 0, subtotal, gstRate: GST_RATE, gstAmount, finalAmount };
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
    if (!isAdminPreOnboard) return computeSelfServePricing(plan.yearlyPrice);

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
      select: { id: true, referralCode: true },
    });
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

    if (referrer) {
      await tx.crmReferral.create({
        data: {
          referrerId: referrer.id,
          referredCompanyId: company.id,
          referralCode: referrer.referralCode,
          status: "SUCCESSFUL",
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