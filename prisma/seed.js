import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});


function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

const SUPER_ADMIN_EMAIL =
  process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
  "admin@consulbuzz.com";

const SUPER_ADMIN_PASSWORD =
  requiredEnv("SEED_SUPER_ADMIN_PASSWORD");

const STUDENT_MENTOR_ADMIN_EMAIL =
  process.env.SEED_STUDENT_MENTOR_ADMIN_EMAIL?.trim().toLowerCase() ||
  "admin@studentmentor.co.in";

const STUDENT_MENTOR_ADMIN_PASSWORD =
  requiredEnv("SEED_STUDENT_MENTOR_ADMIN_PASSWORD");

const REMOVED_MODULE_KEYS = [
  "quotation",
  "negotiation",
];

const modules = [
  {
    key: "dashboard",
    name: "Overall Dashboard",
    description: "Business overview and key CRM performance metrics",
    icon: "LayoutDashboard",
    route: "/",
    sortOrder: 1,
  },
  {
    key: "utm-leads",
    name: "UTM Leads",
    description:
      "Manage Google Form, Website Form, IM Leads and DM Leads",
    icon: "Link2",
    route: "/utm-leads",
    sortOrder: 2,
  },
  {
    key: "admissions",
    name: "Admissions",
    description: "Manage converted leads and admissions",
    icon: "UserCheck",
    route: "/admissions",
    sortOrder: 3,
  },
  {
    key: "revenue",
    name: "Revenue",
    description:
      "Track revenue, received amounts, pending amounts and profit",
    icon: "DollarSign",
    route: "/revenue",
    sortOrder: 4,
  },
  {
    key: "lead-store",
    name: "Lead Store",
    description:
      "Manage external data and offline lead generation",
    icon: "Database",
    route: "/lead-store",
    sortOrder: 5,
  },
  {
    key: "walkins",
    name: "Walk-ins",
    description:
      "Manage physical walk-in leads",
    icon: "UserPlus",
    route: "/walkins",
    sortOrder: 6,
  },
  {
    key: "counselling",
    name: "Counselling",
    description:
      "Manage counselling sessions and outcomes",
    icon: "Video",
    route: "/counselling",
    sortOrder: 7,
  },
  {
    key: "analytics",
    name: "Analytics",
    description:
      "Business, lead, admission and revenue analytics",
    icon: "BarChart3",
    route: "/analytics",
    sortOrder: 8,
  },
  {
    key: "help",
    name: "Help & Support",
    description:
      "Support tickets and customization requests",
    icon: "HelpCircle",
    route: "/help",
    sortOrder: 9,
  },
  {
    key: "settings",
    name: "Settings",
    description:
      "Company, users, branding and portal settings",
    icon: "Settings",
    route: "/settings",
    sortOrder: 10,
  },
];

const planDefinitions = {
  basic: {
    name: "Basic",
    description:
      "Core Bispun CRM package",
    tagline:
      "Core CRM for small consultancies",
    monthlyPrice: 0,
    yearlyPrice: 27000,

    modules: [
      "dashboard",
      "utm-leads",
      "admissions",
      "revenue",
      "lead-store",
      "analytics",
      "help",
      "settings",
    ],
  },

  pro: {
    name: "Pro",
    description:
      "Advanced CRM package for growing consultancies",
    tagline:
      "Adds walk-ins & career counselling",
    monthlyPrice: 0,
    yearlyPrice: 54000,

    modules: [
      "dashboard",
      "utm-leads",
      "admissions",
      "revenue",
      "lead-store",
      "walkins",
      "counselling",
      "analytics",
      "help",
      "settings",
    ],
  },

  advanced: {
    name: "Advanced",
    description:
      "Complete Bispun CRM package",
    tagline:
      "Advanced customization, white-label and priority capabilities",
    monthlyPrice: 0,
    yearlyPrice: 81000,

    modules: [
      "dashboard",
      "utm-leads",
      "admissions",
      "revenue",
      "lead-store",
      "walkins",
      "counselling",
      "analytics",
      "help",
      "settings",
    ],
  },
};

async function removeDeprecatedModules() {
  console.log(
    "Removing deprecated modules..."
  );

  const removed =
    await prisma.module.deleteMany({
      where: {
        key: {
          in: REMOVED_MODULE_KEYS,
        },
      },
    });

  console.log(
    `Deprecated modules removed: ${removed.count}`
  );
}

async function seedModules() {
  console.log("Seeding modules...");

  for (const moduleData of modules) {
    await prisma.module.upsert({
      where: {
        key: moduleData.key,
      },

      update: {
        name: moduleData.name,
        description:
          moduleData.description,
        icon: moduleData.icon,
        route: moduleData.route,
        sortOrder:
          moduleData.sortOrder,
        active: true,
      },

      create: moduleData,
    });
  }

  console.log("Modules seeded.");
}

async function seedPlans() {
  console.log("Seeding plans...");

  for (
    const [key, planData] of
    Object.entries(planDefinitions)
  ) {
    const plan =
      await prisma.plan.upsert({
        where: {
          key,
        },

        update: {
          name: planData.name,
          description:
            planData.description,
          tagline:
            planData.tagline,
          monthlyPrice:
            planData.monthlyPrice,
          yearlyPrice:
            planData.yearlyPrice,
          active: true,
        },

        create: {
          key,
          name: planData.name,
          description:
            planData.description,
          tagline:
            planData.tagline,
          monthlyPrice:
            planData.monthlyPrice,
          yearlyPrice:
            planData.yearlyPrice,
        },
      });

    const allowedModules =
      await prisma.module.findMany({
        where: {
          key: {
            in: planData.modules,
          },
        },

        select: {
          id: true,
          key: true,
        },
      });

    const foundKeys =
      new Set(
        allowedModules.map(
          (crmModule) =>
            crmModule.key
        )
      );

    for (
      const moduleKey of
      planData.modules
    ) {
      if (
        !foundKeys.has(moduleKey)
      ) {
        throw new Error(
          `Module ${moduleKey} was not found`
        );
      }
    }

    const allowedModuleIds =
      allowedModules.map(
        (crmModule) =>
          crmModule.id
      );

    await prisma.planModule.deleteMany({
      where: {
        planId: plan.id,

        moduleId: {
          notIn:
            allowedModuleIds,
        },
      },
    });

    for (
      const crmModule of
      allowedModules
    ) {
      await prisma.planModule.upsert({
        where: {
          planId_moduleId: {
            planId: plan.id,
            moduleId:
              crmModule.id,
          },
        },

        update: {},

        create: {
          planId: plan.id,
          moduleId:
            crmModule.id,
        },
      });
    }
  }

  console.log("Plans seeded.");
}

async function seedSuperAdmin() {
  console.log(
    "Seeding Bispun Super Admin..."
  );

  const passwordHash =
    await bcrypt.hash(
      SUPER_ADMIN_PASSWORD,
      12
    );

  await prisma.user.upsert({
    where: {
      email:
        SUPER_ADMIN_EMAIL,
    },

    // Do NOT reset an existing admin's password on re-seed (RISK-001).
    // passwordHash is set only when the user is first created.
    update: {
      name:
        "Bispun Super Admin",
      role: "SUPER_ADMIN",
      active: true,
      companyId: null,
    },

    create: {
      name:
        "Bispun Super Admin",
      email:
        SUPER_ADMIN_EMAIL,
      passwordHash,
      role: "SUPER_ADMIN",
      active: true,
    },
  });

  console.log(
    "Super Admin seeded."
  );
}

async function seedStudentMentor() {
  console.log(
    "Seeding Student Mentor..."
  );

  const company =
    await prisma.company.upsert({
      where: {
        slug: "student-mentor",
      },

      update: {
        name: "Student Mentor",
        brandName:
          "Student Mentor CRM",
        shortName: "SM",
        business:
          "Education Consultancy",
        ownerName: "Rakesh N.",
        city: "Hyderabad",
        subdomain:
          "studentmentor.consulbuzz.com",
        primaryColor: "indigo",
        status: "ACTIVE",
      },

      create: {
        name: "Student Mentor",
        slug: "student-mentor",
        brandName:
          "Student Mentor CRM",
        shortName: "SM",
        business:
          "Education Consultancy",
        ownerName: "Rakesh N.",
        city: "Hyderabad",
        subdomain:
          "studentmentor.consulbuzz.com",
        primaryColor: "indigo",
        status: "ACTIVE",
      },
    });

  await prisma.companySettings.upsert({
    where: {
      companyId: company.id,
    },

    update: {
      portalName:
        "Student Mentor CRM",
      primaryColor: "indigo",
      timezone:
        "Asia/Kolkata",
      currency: "INR",
      dateFormat:
        "DD/MM/YYYY",
      emailNotifications: true,
      smsNotifications: false,
    },

    create: {
      companyId: company.id,
      portalName:
        "Student Mentor CRM",
      primaryColor: "indigo",
      timezone:
        "Asia/Kolkata",
      currency: "INR",
      dateFormat:
        "DD/MM/YYYY",
      emailNotifications: true,
      smsNotifications: false,
    },
  });

  const proPlan =
    await prisma.plan.findUnique({
      where: {
        key: "pro",
      },

      include: {
        planModules: true,
      },
    });

  if (!proPlan) {
    throw new Error(
      "Pro plan was not found"
    );
  }

  const existingSubscription =
    await prisma.subscription.findFirst({
      where: {
        companyId: company.id,
        status: "ACTIVE",
      },

      orderBy: {
        createdAt: "desc",
      },
    });

  const annualRenewalDate = new Date();
  annualRenewalDate.setFullYear(
    annualRenewalDate.getFullYear() + 1
  );

  if (!existingSubscription) {
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: proPlan.id,
        status: "ACTIVE",
        billingCycle: "YEARLY",
        startDate: new Date(),
        renewalDate: annualRenewalDate,
        amount: 54000,
      },
    });
  } else if (
    existingSubscription.planId !==
      proPlan.id ||
    existingSubscription.billingCycle !==
      "YEARLY" ||
    Number(existingSubscription.amount || 0) !==
      54000
  ) {
    await prisma.subscription.update({
      where: {
        id:
          existingSubscription.id,
      },

      data: {
        planId: proPlan.id,
        billingCycle: "YEARLY",
        renewalDate: annualRenewalDate,
        amount: 54000,
      },
    });
  }

  const proModuleIds =
    proPlan.planModules.map(
      (planModule) =>
        planModule.moduleId
    );

  await prisma.companyModule.deleteMany({
    where: {
      companyId: company.id,

      moduleId: {
        notIn: proModuleIds,
      },
    },
  });

  for (
    const planModule of
    proPlan.planModules
  ) {
    await prisma.companyModule.upsert({
      where: {
        companyId_moduleId: {
          companyId:
            company.id,
          moduleId:
            planModule.moduleId,
        },
      },

      update: {
        enabled: true,
      },

      create: {
        companyId:
          company.id,
        moduleId:
          planModule.moduleId,
        enabled: true,
      },
    });
  }

  const clientAdminPasswordHash =
    await bcrypt.hash(
      STUDENT_MENTOR_ADMIN_PASSWORD,
      12
    );

  await prisma.user.upsert({
    where: {
      email:
        STUDENT_MENTOR_ADMIN_EMAIL,
    },

    // Do NOT reset an existing user's password on re-seed (RISK-001).
    update: {
      name:
        "Student Mentor Admin",
      role: "CLIENT_ADMIN",
      active: true,
      companyId: company.id,
    },

    create: {
      name:
        "Student Mentor Admin",
      email:
        STUDENT_MENTOR_ADMIN_EMAIL,
      passwordHash:
        clientAdminPasswordHash,
      role: "CLIENT_ADMIN",
      active: true,
      companyId: company.id,
    },
  });

  console.log(
    "Student Mentor seeded."
  );
}

async function main() {
  console.log("");
  console.log(
    "Starting Bispun database seed..."
  );
  console.log("");

  await removeDeprecatedModules();
  await seedModules();
  await seedPlans();
  await seedSuperAdmin();
  await seedStudentMentor();

  console.log("");
  console.log(
    "Bispun seed completed successfully."
  );
  console.log("");
}

main()
  .catch((error) => {
    console.error("");
    console.error("Seed failed:");
    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });