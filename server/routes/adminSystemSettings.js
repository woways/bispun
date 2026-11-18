import { Router } from "express";
import jwt from "jsonwebtoken";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import { writeSuperAdminAudit } from "../lib/adminAuditLog.js";
import {
  isGoogleConfigured,
  getAuthUrl,
  hasGmailSendScope,
} from "../lib/google.js";

const router = Router();

router.use(requireSuperAdmin);

// ---------------------------------------------------------------------------
// System email sender (Google) — connect ONE Google account at the platform
// level so OTP / welcome / system emails send via the Gmail API (HTTPS), which
// works where outbound SMTP is blocked (e.g. Render free tier). Tokens are
// stored on the SUPER_ADMIN user record by the shared OAuth callback
// (server/routes/clientGoogle.js), attributed via the signed `state`.
// ---------------------------------------------------------------------------

// Is the platform email sender connected (for the current super admin)?
router.get("/google/status", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.admin.userId },
      select: {
        googleRefreshToken: true,
        googleEmail: true,
        googleConnectedAt: true,
        googleScopes: true,
      },
    });
    return res.json({
      success: true,
      configured: isGoogleConfigured(),
      connected: Boolean(user?.googleRefreshToken),
      email: user?.googleEmail || null,
      connectedAt: user?.googleConnectedAt || null,
      gmailEnabled: hasGmailSendScope(user?.googleScopes || []),
    });
  } catch (error) {
    console.error("Admin Google status failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load Google status" });
  }
});

// Start the connect flow: returns the Google consent URL. Identity + an `admin`
// flag ride in a short-lived signed `state`, so the public callback can both
// attribute the tokens and redirect back to the admin page.
router.get("/google/connect", async (req, res) => {
  if (!isGoogleConfigured()) {
    return res
      .status(400)
      .json({ success: false, message: "Google is not configured on the server" });
  }
  const state = jwt.sign(
    { sub: req.admin.userId, admin: true },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  return res.json({ success: true, url: getAuthUrl(state) });
});

// Disconnect the platform email sender.
router.post("/google/disconnect", async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.admin.userId },
      data: {
        googleRefreshToken: null,
        googleEmail: null,
        googleConnectedAt: null,
        googleScopes: [],
      },
    });
    return res.json({ success: true, message: "Disconnected" });
  } catch (error) {
    console.error("Admin Google disconnect failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to disconnect" });
  }
});

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
        "smsEnabled",
        "smsWelcomeEnabled",
        "smsEnquiryEnabled",
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

    // MSG91 SMS text fields (template IDs / sender) — trimmed, empty clears.
    for (const field of [
      "smsSenderId",
      "smsOtpTemplateId",
      "smsWelcomeTemplateId",
      "smsEnquiryTemplateId",
    ]) {
      if (req.body[field] !== undefined) {
        const value = String(req.body[field] || "").trim();
        data[field] = value || null;
      }
    }

    if (req.body.smsEnquiryHours !== undefined) {
      const hours = Number(req.body.smsEnquiryHours);
      data.smsEnquiryHours =
        Number.isFinite(hours) && hours > 0 && hours <= 720
          ? Math.round(hours)
          : 24;
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