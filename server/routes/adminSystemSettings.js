import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { writeSuperAdminAudit } from "../lib/adminAuditLog.js";

const router = Router();

router.use(requireSuperAdmin);

const SETTINGS_KEY =
  "global";

const ALLOWED_COLORS = [
  "indigo",
  "blue",
  "emerald",
  "amber",
  "rose",
  "purple",
  "slate",
  "sky",
];

async function getOrCreateSettings() {
  return prisma.systemSettings.upsert({
    where: {
      key:
        SETTINGS_KEY,
    },
    update: {
      defaultBillingCycle:
        "YEARLY",
    },
    create: {
      key:
        SETTINGS_KEY,
      defaultBillingCycle:
        "YEARLY",
    },
  });
}

async function getActor(req) {
  return prisma.user.findUnique({
    where: {
      id:
        req.admin.userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

router.get("/", async (req, res) => {
  try {
    const settings =
      await getOrCreateSettings();

    return res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error(
      "Failed to fetch system settings:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch system settings",
    });
  }
});

router.patch("/", async (req, res) => {
  try {
    const current =
      await getOrCreateSettings();

    const data = {};

    if (
      req.body.platformName !==
      undefined
    ) {
      const platformName =
        String(
          req.body.platformName ||
            ""
        ).trim();

      if (!platformName) {
        return res.status(400).json({
          success: false,
          message:
            "Platform name is required",
        });
      }

      data.platformName =
        platformName;
    }

    if (
      req.body.supportEmail !==
      undefined
    ) {
      const supportEmail =
        req.body.supportEmail
          ? String(
              req.body.supportEmail
            )
              .trim()
              .toLowerCase()
          : null;

      if (
        supportEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          supportEmail
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Support email is invalid",
        });
      }

      data.supportEmail =
        supportEmail;
    }

    if (
      req.body.supportPhone !==
      undefined
    ) {
      data.supportPhone =
        req.body.supportPhone
          ? String(
              req.body.supportPhone
            ).trim()
          : null;
    }

    if (
      req.body.defaultTimezone !==
      undefined
    ) {
      data.defaultTimezone =
        String(
          req.body.defaultTimezone ||
            "Asia/Kolkata"
        ).trim();
    }

    if (
      req.body.defaultCurrency !==
      undefined
    ) {
      data.defaultCurrency =
        String(
          req.body.defaultCurrency ||
            "INR"
        )
          .trim()
          .toUpperCase();
    }

    if (
      req.body.defaultDateFormat !==
      undefined
    ) {
      data.defaultDateFormat =
        String(
          req.body.defaultDateFormat ||
            "DD/MM/YYYY"
        ).trim();
    }

    if (
      req.body.defaultTrialDays !==
      undefined
    ) {
      const days =
        Number(
          req.body.defaultTrialDays
        );

      if (
        !Number.isInteger(
          days
        ) ||
        days < 0 ||
        days > 365
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Trial days must be between 0 and 365",
        });
      }

      data.defaultTrialDays =
        days;
    }

    if (
      req.body.defaultBillingCycle !==
      undefined
    ) {
      const cycle =
        String(
          req.body
            .defaultBillingCycle
        )
          .trim()
          .toUpperCase();

      if (cycle !== "YEARLY") {
        return res.status(400).json({
          success: false,
          message:
            "Only annual billing is available",
        });
      }

      data.defaultBillingCycle =
        "YEARLY";
    }

    for (
      const field of [
        "defaultEmailNotifications",
        "defaultSmsNotifications",
        "maintenanceMode",
        "allowNewClientOnboarding",
      ]
    ) {
      if (
        typeof req.body[field] ===
        "boolean"
      ) {
        data[field] =
          req.body[field];
      }
    }

    if (
      req.body.defaultPrimaryColor !==
      undefined
    ) {
      const color =
        String(
          req.body.defaultPrimaryColor ||
            "indigo"
        )
          .trim()
          .toLowerCase();

      if (
        !ALLOWED_COLORS.includes(
          color
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid default primary color",
        });
      }

      data.defaultPrimaryColor =
        color;
    }

    const settings =
      await prisma.systemSettings.update({
        where: {
          id:
            current.id,
        },
        data,
      });

    const changedFields =
      Object.keys(data).filter(
        (field) =>
          String(
            current[field] ??
              ""
          ) !==
          String(
            settings[field] ??
              ""
          )
      );

    if (
      changedFields.length
    ) {
      const actor =
        await getActor(req);

      await writeSuperAdminAudit({
        req,
        actor,
        action:
          "SYSTEM_SETTINGS_UPDATED",
        entityType:
          "SYSTEM_SETTINGS",
        entityId:
          settings.id,
        summary:
          `${actor?.name || "Super Admin"} updated Bispun system settings.`,
        metadata: {
          changedFields,
          maintenanceMode:
            settings.maintenanceMode,
          allowNewClientOnboarding:
            settings.allowNewClientOnboarding,
        },
      });
    }

    return res.json({
      success: true,
      message:
        "System settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error(
      "Failed to update system settings:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update system settings",
    });
  }
});

export default router;