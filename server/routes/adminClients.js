import { Router } from "express";
import bcrypt from "bcryptjs";
import { resolveMx } from "node:dns/promises";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { writeSuperAdminAudit } from "../lib/adminAuditLog.js";

const router = Router();

router.use(requireSuperAdmin);

async function getAdminActor(req) {
  return prisma.user.findUnique({ where: { id: req.admin.userId }, select: { id: true, name: true, email: true } });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(
    String(value || "").trim()
  );
}

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

const LEGACY_SUBDOMAIN_SUFFIX = ".consulbuzz.com";
const BISPUN_SUBDOMAIN_SUFFIX = ".bispun.com";

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
    if (
      ["ENOTFOUND", "ENODATA", "EFORMERR", "EBADNAME"].includes(
        error?.code
      )
    ) {
      return false;
    }

    throw error;
  }
}


// GST charged on every subscription (percent). Kept in sync with
// clientBilling.js GST_RATE so onboarding, renewal and receipts agree.
const GST_RATE = 18;

// Compute list price, clamped discount (rupees, never negative, never more than
// the list price), the discounted subtotal, 18% GST on that subtotal, and the
// final amount the client actually pays (= subtotal + GST, incl. tax).
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

function formatClient(company) {
  const activeSubscription =
    company.subscriptions?.find(
      (subscription) =>
        subscription.status === "ACTIVE" ||
        subscription.status === "TRIAL"
    ) ||
    company.subscriptions?.[0] ||
    null;

  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    shortName: company.shortName,
    brandName:
      company.settings?.portalName ||
      company.brandName,
    business: company.business,
    ownerName: company.ownerName,
    city: company.city,
    email: company.email,
    phone: company.phone,
    logoUrl:
      company.settings?.logoUrl ||
      company.logoUrl,

    primaryColor:
      company.settings?.primaryColor ||
      company.primaryColor,
    subdomain: normalizeBispunSubdomain(company.subdomain),

    status: company.status.toLowerCase(),

    users: company._count?.users || 0,

    leads: 0,
    admissions: 0,

    plan: activeSubscription?.plan?.key || null,
    planName: activeSubscription?.plan?.name || null,

    renewalDate: activeSubscription?.renewalDate || null,

    billingCycle: activeSubscription ? "YEARLY" : null,

    subscriptionStatus: activeSubscription?.status || null,

    yearlyPrice: activeSubscription?.plan?.yearlyPrice
      ? Number(activeSubscription.plan.yearlyPrice)
      : 0,

    subscriptionAmount: activeSubscription?.amount
      ? Number(activeSubscription.amount)
      : 0,

    // Discount breakdown: listPrice (before discount), discountAmount,
    // and finalAmount (= subscriptionAmount, what the client pays).
    listPrice: activeSubscription?.listPrice
      ? Number(activeSubscription.listPrice)
      : activeSubscription?.plan?.yearlyPrice
      ? Number(activeSubscription.plan.yearlyPrice)
      : 0,
    discountAmount: activeSubscription?.discountAmount
      ? Number(activeSubscription.discountAmount)
      : 0,
    // finalAmount = amount stored on the subscription = subtotal + 18% GST
    // (the grand total the client is billed). subtotal / gstAmount are derived
    // for display so admin billing can show the tax breakdown.
    subtotal: (() => {
      const lp = activeSubscription?.listPrice
        ? Number(activeSubscription.listPrice)
        : activeSubscription?.plan?.yearlyPrice
        ? Number(activeSubscription.plan.yearlyPrice)
        : 0;
      const disc = activeSubscription?.discountAmount
        ? Number(activeSubscription.discountAmount)
        : 0;
      return Math.max(0, Math.round((lp - disc) * 100) / 100);
    })(),
    gstRate: GST_RATE,
    gstAmount: (() => {
      const amt = activeSubscription?.amount
        ? Number(activeSubscription.amount)
        : 0;
      const lp = activeSubscription?.listPrice
        ? Number(activeSubscription.listPrice)
        : activeSubscription?.plan?.yearlyPrice
        ? Number(activeSubscription.plan.yearlyPrice)
        : 0;
      const disc = activeSubscription?.discountAmount
        ? Number(activeSubscription.discountAmount)
        : 0;
      const sub = Math.max(0, Math.round((lp - disc) * 100) / 100);
      return Math.max(0, Math.round((amt - sub) * 100) / 100);
    })(),
    finalAmount: activeSubscription?.amount
      ? Number(activeSubscription.amount)
      : 0,

    subscriptionStartDate: activeSubscription?.startDate || null,
    subscriptionEndDate: activeSubscription?.endDate || null,

    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function shortNameFromCompany(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function addMonths(date, months) {
  const result = new Date(date);

  const originalDay = result.getDate();

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(
    Math.min(originalDay, lastDayOfTargetMonth)
  );

  return result;
}

/* =========================================================
   GET ALL CLIENTS
========================================================= */

router.get("/", async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      include: {
        settings: true,

        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },

        _count: {
          select: {
            users: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      clients: companies.map(formatClient),
    });
  } catch (error) {
    console.error("Failed to fetch clients:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch clients",
    });
  }
});

/* =========================================================
   GET AVAILABLE PLANS
========================================================= */

router.get("/plans/available", async (req, res) => {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        active: true,
      },

      orderBy: {
        yearlyPrice: "asc",
      },

      include: {
        planModules: {
          include: {
            module: true,
          },
        },
      },
    });

    return res.json({
      success: true,

      plans: plans.map((plan) => ({
        id: plan.id,
        key: plan.key,
        name: plan.name,
        tagline: plan.tagline,
        description: plan.description,

        yearlyPrice: plan.yearlyPrice
          ? Number(plan.yearlyPrice)
          : null,

        modules: plan.planModules
          .slice()
          .sort(
            (a, b) =>
              a.module.sortOrder -
              b.module.sortOrder
          )
          .map((planModule) => ({
            id: planModule.module.id,
            key: planModule.module.key,
            name: planModule.module.name,
          })),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch plans:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch plans",
    });
  }
});

/* =========================================================
   ONBOARD CLIENT
========================================================= */

router.post("/", async (req, res) => {
  try {
    const systemSettings =
      await prisma.systemSettings.upsert({
        where: {
          key: "global",
        },
        update: {},
        create: {
          key: "global",
        },
      });

    if (
      !systemSettings.allowNewClientOnboarding
    ) {
      return res.status(403).json({
        success: false,
        message:
          "New client onboarding is currently disabled in System Settings",
      });
    }
    const {
      name,
      brandName,
      business,
      ownerName,
      city,
      email,
      phone,
      subdomain,
      primaryColor,
      planKey,
      discountAmount: rawDiscountAmount,
      adminName,
      adminEmail,
      adminPassword,
    } = req.body || {};

    const companyName = String(name || "").trim();
    const companyBusiness = String(business || "").trim();
    const companyOwnerName = String(ownerName || "").trim();
    const companyCity = String(city || "").trim();
    const companyEmail = String(email || "")
      .trim()
      .toLowerCase();
    const companyPhone = String(phone || "").trim();

    const clientAdminName = String(
      adminName || ""
    ).trim();

    const clientAdminEmail = String(
      adminEmail || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      adminPassword || ""
    );

    const selectedPlanKey = String(
      planKey || ""
    )
      .trim()
      .toLowerCase();

    const selectedBillingCycle = "YEARLY";

    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: "Company name is required",
      });
    }

    if (!companyBusiness) {
      return res.status(400).json({
        success: false,
        message: "Business type is required",
      });
    }

    if (!companyOwnerName) {
      return res.status(400).json({
        success: false,
        message: "Owner name is required",
      });
    }

    if (!companyEmail) {
      return res.status(400).json({
        success: false,
        message: "Company email is required",
      });
    }

    if (!isValidEmail(companyEmail)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid company email",
      });
    }

    if (!companyPhone) {
      return res.status(400).json({
        success: false,
        message: "Company phone is required",
      });
    }

    if (!isValidPhone(companyPhone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid company phone number",
      });
    }

    if (!companyCity) {
      return res.status(400).json({
        success: false,
        message: "City is required",
      });
    }

    if (!selectedPlanKey) {
      return res.status(400).json({
        success: false,
        message: "Plan is required",
      });
    }

    if (!clientAdminName) {
      return res.status(400).json({
        success: false,
        message: "Client admin name is required",
      });
    }

    if (!clientAdminEmail) {
      return res.status(400).json({
        success: false,
        message: "Client admin email is required",
      });
    }

    if (!isValidEmail(clientAdminEmail)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid client admin email",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Client admin password must be at least 8 characters",
      });
    }

    let companyEmailDomainValid;
    let adminEmailDomainValid;

    try {
      [companyEmailDomainValid, adminEmailDomainValid] =
        await Promise.all([
          emailDomainCanReceiveMail(companyEmail),
          emailDomainCanReceiveMail(clientAdminEmail),
        ]);
    } catch (error) {
      console.error("Email domain verification failed:", error);

      return res.status(503).json({
        success: false,
        message:
          "Unable to verify email domains right now. Please try again.",
      });
    }

    if (!companyEmailDomainValid) {
      return res.status(400).json({
        success: false,
        message:
          "Company email domain could not be verified. Use an email domain that can receive mail.",
      });
    }

    if (!adminEmailDomainValid) {
      return res.status(400).json({
        success: false,
        message:
          "Client admin email domain could not be verified. Use an email domain that can receive mail.",
      });
    }

    const slug = slugify(companyName);

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Invalid company name",
      });
    }

    const existingCompany =
      await prisma.company.findUnique({
        where: {
          slug,
        },
      });

    if (existingCompany) {
      return res.status(409).json({
        success: false,
        message:
          "A company with this name already exists",
      });
    }

    const existingAdmin =
      await prisma.user.findUnique({
        where: {
          email: clientAdminEmail,
        },
      });

    if (existingAdmin) {
      return res.status(409).json({
        success: false,
        message:
          "A user with this admin email already exists",
      });
    }

    const plan = await prisma.plan.findUnique({
      where: {
        key: selectedPlanKey,
      },

      include: {
        planModules: true,
      },
    });

    if (!plan || !plan.active) {
      return res.status(400).json({
        success: false,
        message: "Selected plan is invalid",
      });
    }

    const cleanSubdomain = subdomain
      ? normalizeBispunSubdomain(subdomain)
      : `${slug}.bispun.com`;

    const existingSubdomain =
      await prisma.company.findUnique({
        where: {
          subdomain: cleanSubdomain,
        },
      });

    if (existingSubdomain) {
      return res.status(409).json({
        success: false,
        message:
          "This subdomain is already being used",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    if (
      plan.yearlyPrice === null ||
      plan.yearlyPrice === undefined ||
      Number(plan.yearlyPrice) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Annual pricing is unavailable for this plan",
      });
    }

    const startDate = new Date();
    const renewalDate = addMonths(startDate, 12);

    // Apply the Super Admin's manual discount (rupees). "No discount" = 0.
    const {
      listPrice: subscriptionListPrice,
      discount: subscriptionDiscount,
      finalAmount: subscriptionAmount,
    } = computePricing(plan.yearlyPrice, rawDiscountAmount);

    const company = await prisma.$transaction(
      async (tx) => {
        const createdCompany =
          await tx.company.create({
            data: {
              name: companyName,

              slug,

              brandName: String(
                brandName || companyName
              ).trim(),

              shortName:
                shortNameFromCompany(companyName),

              business: companyBusiness,

              ownerName: companyOwnerName,

              city: companyCity,

              email: companyEmail,

              phone: companyPhone,

              subdomain: cleanSubdomain,

              primaryColor:
                primaryColor ||
                systemSettings.defaultPrimaryColor ||
                "indigo",

              status: "ACTIVE",
            },
          });

        await tx.companySettings.create({
          data: {
            companyId: createdCompany.id,

            portalName: String(
              brandName ||
                `${companyName} CRM`
            ).trim(),

            primaryColor:
              primaryColor ||
              systemSettings.defaultPrimaryColor ||
              "indigo",

            timezone:
              systemSettings.defaultTimezone ||
              "Asia/Kolkata",

            currency:
              systemSettings.defaultCurrency ||
              "INR",

            dateFormat:
              systemSettings.defaultDateFormat ||
              "DD/MM/YYYY",

            emailNotifications:
              systemSettings.defaultEmailNotifications,

            smsNotifications:
              systemSettings.defaultSmsNotifications,
          },
        });

        await tx.subscription.create({
          data: {
            companyId: createdCompany.id,

            planId: plan.id,

            status: "ACTIVE",

            billingCycle:
              selectedBillingCycle,

            startDate,

            renewalDate,

            listPrice: subscriptionListPrice,
            discountAmount: subscriptionDiscount,
            amount: subscriptionAmount,
          },
        });

        if (plan.planModules.length > 0) {
          await tx.companyModule.createMany({
            data: plan.planModules.map(
              (planModule) => ({
                companyId: createdCompany.id,
                moduleId: planModule.moduleId,
                enabled: true,
              })
            ),
          });
        }

        await tx.user.create({
          data: {
            name: clientAdminName,
            email: clientAdminEmail,
            passwordHash,
            role: "CLIENT_ADMIN",
            active: true,
            companyId: createdCompany.id,
          },
        });

        return createdCompany;
      }
    );

    const createdClient =
      await prisma.company.findUnique({
        where: {
          id: company.id,
        },

        include: {
          subscriptions: {
            include: {
              plan: true,
            },

            orderBy: {
              createdAt: "desc",
            },
          },

          _count: {
            select: {
              users: true,
            },
          },
        },
      });

    const actor = await getAdminActor(req);
    await writeSuperAdminAudit({ req, actor, action: "CLIENT_CREATED", entityType: "COMPANY", entityId: createdClient.id, companyId: createdClient.id, companyName: createdClient.name, summary: `${actor?.name || "Super Admin"} onboarded ${createdClient.name}.`, metadata: { plan: createdClient.subscriptions?.[0]?.plan?.key || null, billingCycle: createdClient.subscriptions?.[0]?.billingCycle || null, clientAdminEmail } });

    return res.status(201).json({
      success: true,
      message:
        "Client onboarded successfully",

      client: formatClient(createdClient),
    });
  } catch (error) {
    console.error(
      "Failed to onboard client:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to onboard client",
    });
  }
});

/* =========================================================
   CHANGE CLIENT PLAN / BILLING CYCLE
========================================================= */

router.patch("/:id/subscription", async (req, res) => {
  try {
    const companyId = req.params.id;

    const planKey = String(
      req.body?.planKey || ""
    )
      .trim()
      .toLowerCase();

    const billingCycle = "YEARLY";

    if (!planKey) {
      return res.status(400).json({
        success: false,
        message: "Plan is required",
      });
    }

    const [company, plan] = await Promise.all([
      prisma.company.findUnique({
        where: {
          id: companyId,
        },
      }),

      prisma.plan.findUnique({
        where: {
          key: planKey,
        },

        include: {
          planModules: true,
        },
      }),
    ]);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    if (!plan || !plan.active) {
      return res.status(400).json({
        success: false,
        message: "Selected plan is invalid",
      });
    }

    const currentSubscription =
      await prisma.subscription.findFirst({
        where: {
          companyId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    if (!currentSubscription) {
      return res.status(404).json({
        success: false,
        message: "Client subscription not found",
      });
    }

    const renewalBase = new Date();

    if (
      plan.yearlyPrice === null ||
      plan.yearlyPrice === undefined ||
      Number(plan.yearlyPrice) <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Annual pricing is unavailable for this plan",
      });
    }

    const renewalDate = addMonths(renewalBase, 12);

    // Apply the Super Admin's manual discount (rupees) on renewal too.
    const {
      listPrice: subscriptionListPrice,
      discount: subscriptionDiscount,
      finalAmount: subscriptionAmount,
    } = computePricing(plan.yearlyPrice, req.body?.discountAmount);

    const updatedSubscription =
      await prisma.$transaction(async (tx) => {
        const updated =
          await tx.subscription.update({
            where: {
              id: currentSubscription.id,
            },

            data: {
              planId: plan.id,
              status: "ACTIVE",
              billingCycle,
              renewalDate,
              endDate: null,
              listPrice: subscriptionListPrice,
              discountAmount: subscriptionDiscount,
              amount: subscriptionAmount,
            },

            include: {
              plan: true,
            },
          });

        const allModules =
          await tx.module.findMany({
            where: {
              active: true,
            },

            select: {
              id: true,
            },
          });

        const allowedModuleIds =
          new Set(
            plan.planModules.map(
              (item) => item.moduleId
            )
          );

        for (const crmModule of allModules) {
          await tx.companyModule.upsert({
            where: {
              companyId_moduleId: {
                companyId,
                moduleId: crmModule.id,
              },
            },

            update: {
              enabled:
                allowedModuleIds.has(
                  crmModule.id
                ),
            },

            create: {
              companyId,
              moduleId: crmModule.id,
              enabled:
                allowedModuleIds.has(
                  crmModule.id
                ),
            },
          });
        }

        return updated;
      });

    const actor = await getAdminActor(req);
    await writeSuperAdminAudit({ req, actor, action: "CLIENT_SUBSCRIPTION_UPDATED", entityType: "SUBSCRIPTION", entityId: updatedSubscription.id, companyId, companyName: company.name, summary: `${actor?.name || "Super Admin"} changed ${company.name} to ${plan.name} (${billingCycle}).`, metadata: { planKey: plan.key, billingCycle, amount: Number(updatedSubscription.amount || 0) } });

    return res.json({
      success: true,
      message: `Client moved to ${plan.name} successfully`,

      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        billingCycle:
          "YEARLY",
        startDate:
          updatedSubscription.startDate,
        renewalDate:
          updatedSubscription.renewalDate,
        endDate:
          updatedSubscription.endDate,
        amount: updatedSubscription.amount
          ? Number(updatedSubscription.amount)
          : 0,

        listPrice: updatedSubscription.listPrice
          ? Number(updatedSubscription.listPrice)
          : Number(plan.yearlyPrice || 0),
        discountAmount: updatedSubscription.discountAmount
          ? Number(updatedSubscription.discountAmount)
          : 0,
        finalAmount: updatedSubscription.amount
          ? Number(updatedSubscription.amount)
          : 0,

        plan: {
          id: updatedSubscription.plan.id,
          key: updatedSubscription.plan.key,
          name: updatedSubscription.plan.name,
          yearlyPrice:
            updatedSubscription.plan.yearlyPrice
              ? Number(
                  updatedSubscription.plan.yearlyPrice
                )
              : null,
        },
      },
    });
  } catch (error) {
    console.error(
      "Failed to change client plan:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to change client plan",
    });
  }
});

/* =========================================================
   UPDATE CLIENT STATUS
========================================================= */

router.patch("/:id/status", async (req, res) => {
  try {
    const status=String(req.body?.status||"").trim().toUpperCase();
    const allowed=["TRIAL","ACTIVE","SUSPENDED","INACTIVE"];
    if(!allowed.includes(status)) return res.status(400).json({success:false,message:"Invalid client status"});
    const existing=await prisma.company.findUnique({where:{id:req.params.id}});
    if(!existing) return res.status(404).json({success:false,message:"Client not found"});
    const updated=await prisma.company.update({where:{id:existing.id},data:{status}});
    const actor=await getAdminActor(req);
    await writeSuperAdminAudit({req,actor,action:"CLIENT_STATUS_UPDATED",entityType:"COMPANY",entityId:updated.id,companyId:updated.id,companyName:updated.name,summary:`${actor?.name || "Super Admin"} changed ${updated.name} status from ${existing.status} to ${updated.status}.`,metadata:{before:existing.status,after:updated.status}});
    return res.json({success:true,message:"Client status updated successfully",status:updated.status.toLowerCase()});
  } catch(error) { console.error("Failed to update client status:",error); return res.status(500).json({success:false,message:"Unable to update client status"}); }
});

/* =========================================================
   GET ONE CLIENT / CLIENT 360
========================================================= */

router.get("/:id", async (req, res) => {
  try {
    const company =
      await prisma.company.findUnique({
        where: {
          id: req.params.id,
        },

        include: {
          settings: true,

          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              active: true,
              createdAt: true,
              updatedAt: true,
            },

            orderBy: {
              createdAt: "asc",
            },
          },

          subscriptions: {
            include: {
              plan: true,
            },

            orderBy: {
              createdAt: "desc",
            },
          },

          companyModules: {
            include: {
              module: true,
            },
          },

          _count: {
            select: {
              users: true,
            },
          },
        },
      });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const sortedModules =
      company.companyModules
        .slice()
        .sort(
          (a, b) =>
            a.module.sortOrder -
            b.module.sortOrder
        );

    return res.json({
      success: true,

      client: {
        ...formatClient(company),

        settings: company.settings,

        usersList: company.users,

        modules: sortedModules.map(
          (companyModule) => ({
            id: companyModule.module.id,

            key: companyModule.module.key,

            name: companyModule.module.name,

            description:
              companyModule.module.description,

            icon: companyModule.module.icon,

            route: companyModule.module.route,

            sortOrder:
              companyModule.module.sortOrder,

            enabled: companyModule.enabled,
          })
        ),
      },
    });
  } catch (error) {
    console.error(
      "Failed to fetch client:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch client",
    });
  }
});

/* =========================================================
   ENABLE / DISABLE CLIENT MODULE
========================================================= */

router.patch(
  "/:id/modules/:moduleId",
  async (req, res) => {
    try {
      const companyId = req.params.id;
      const moduleId = req.params.moduleId;

      const enabled =
        req.body?.enabled === true;

      const company =
        await prisma.company.findUnique({
          where: {
            id: companyId,
          },
        });

      if (!company) {
        return res.status(404).json({
          success: false,
          message: "Client not found",
        });
      }

      const crmModule =
        await prisma.module.findUnique({
          where: {
            id: moduleId,
          },
        });

      if (!crmModule) {
        return res.status(404).json({
          success: false,
          message: "Module not found",
        });
      }

      if (
        enabled &&
        !crmModule.active
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This module is globally inactive and cannot be enabled for a client",
        });
      }

      const companyModule =
        await prisma.companyModule.upsert({
          where: {
            companyId_moduleId: {
              companyId,
              moduleId,
            },
          },

          update: {
            enabled,
          },

          create: {
            companyId,
            moduleId,
            enabled,
          },

          include: {
            module: true,
          },
        });

      const actor = await getAdminActor(req);
      await writeSuperAdminAudit({ req, actor, action: enabled ? "CLIENT_MODULE_ENABLED" : "CLIENT_MODULE_DISABLED", entityType: "MODULE", entityId: crmModule.id, companyId: company.id, companyName: company.name, summary: `${actor?.name || "Super Admin"} ${enabled ? "enabled" : "disabled"} ${crmModule.name} for ${company.name}.` });

      return res.json({
        success: true,

        message: enabled
          ? `${companyModule.module.name} enabled`
          : `${companyModule.module.name} disabled`,

        module: {
          id: companyModule.module.id,
          key: companyModule.module.key,
          name: companyModule.module.name,
          description:
            companyModule.module.description,
          icon: companyModule.module.icon,
          route: companyModule.module.route,
          enabled: companyModule.enabled,
        },
      });
    } catch (error) {
      console.error(
        "Failed to update client module:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update module access",
      });
    }
  }
);

/* =========================================================
   UPDATE COMPANY SETTINGS
========================================================= */

router.patch("/:id/settings", async (req, res) => {
  try {
    const companyId = req.params.id;

    const company =
      await prisma.company.findUnique({
        where: {
          id: companyId,
        },
      });

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const {
      portalName,
      primaryColor,
      secondaryColor,
      timezone,
      currency,
      dateFormat,
      emailNotifications,
      smsNotifications,
    } = req.body || {};

    const settings =
      await prisma.companySettings.upsert({
        where: {
          companyId,
        },

        update: {
          portalName:
            portalName !== undefined
              ? String(portalName).trim()
              : undefined,

          primaryColor:
            primaryColor !== undefined
              ? String(primaryColor).trim()
              : undefined,

          secondaryColor:
            secondaryColor !== undefined
              ? String(secondaryColor).trim()
              : undefined,

          timezone:
            timezone !== undefined
              ? String(timezone).trim()
              : undefined,

          currency:
            currency !== undefined
              ? String(currency).trim()
              : undefined,

          dateFormat:
            dateFormat !== undefined
              ? String(dateFormat).trim()
              : undefined,

          emailNotifications:
            typeof emailNotifications ===
            "boolean"
              ? emailNotifications
              : undefined,

          smsNotifications:
            typeof smsNotifications ===
            "boolean"
              ? smsNotifications
              : undefined,
        },

        create: {
          companyId,

          portalName:
            String(
              portalName ||
                company.brandName ||
                `${company.name} CRM`
            ).trim(),

          primaryColor:
            String(
              primaryColor ||
                company.primaryColor ||
                "indigo"
            ).trim(),

          secondaryColor:
            secondaryColor
              ? String(secondaryColor).trim()
              : null,

          timezone:
            String(
              timezone || "Asia/Kolkata"
            ).trim(),

          currency:
            String(currency || "INR").trim(),

          dateFormat:
            String(
              dateFormat || "DD/MM/YYYY"
            ).trim(),

          emailNotifications:
            typeof emailNotifications ===
            "boolean"
              ? emailNotifications
              : true,

          smsNotifications:
            typeof smsNotifications ===
            "boolean"
              ? smsNotifications
              : false,
        },
      });

    const actor = await getAdminActor(req);
    await writeSuperAdminAudit({ req, actor, action: "CLIENT_SETTINGS_UPDATED", entityType: "COMPANY_SETTINGS", entityId: settings.id, companyId: company.id, companyName: company.name, summary: `${actor?.name || "Super Admin"} updated portal settings for ${company.name}.`, metadata: { portalName: settings.portalName, primaryColor: settings.primaryColor, timezone: settings.timezone, currency: settings.currency, dateFormat: settings.dateFormat } });

    return res.json({
      success: true,
      message:
        "Client settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error(
      "Failed to update settings:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update client settings",
    });
  }
});

export default router;