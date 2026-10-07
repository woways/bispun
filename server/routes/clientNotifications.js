import { Router } from "express";

import prisma from "../lib/prisma.js";
import { getSubscriptionGraceEndsAt } from "../lib/subscriptions.js";
import {
  requireClientUser,
} from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);


async function ensureCalendarReminders(
  companyId,
  userId
) {
  const now =
    new Date();

  const soon =
    new Date(
      now.getTime() +
        60 * 60 * 1000
    );

  const events =
    await prisma.calendarEvent.findMany({
      where: {
        companyId,
        assignedToUserId:
          userId,
        status:
          "SCHEDULED",
        startAt: {
          gte: now,
          lte: soon,
        },
      },
      select: {
        id: true,
        title: true,
        startAt: true,
        type: true,
      },
    });

  for (const event of events) {
    const marker =
      `CALENDAR_REMINDER:${event.id}`;

    const exists =
      await prisma.notification.findFirst({
        where: {
          companyId,
          userId,
          message: {
            contains:
              marker,
          },
        },
        select: {
          id: true,
        },
      });

    if (!exists) {
      await prisma.notification.create({
        data: {
          companyId,
          userId,
          title:
            "Upcoming calendar event",
          message:
            `${event.title} starts at ${event.startAt.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}. ${marker}`,
          type:
            "REMINDER",
          actionModule:
            "dashboard",
          actionLabel:
            "Open calendar",
        },
      });
    }
  }
}

async function ensureBillingRenewalReminder(
  companyId,
  userId
) {
  const user =
    await prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        active: true,
      },
      select: {
        role: true,
        canManageBilling: true,
      },
    });

  if (
    !user ||
    (
      user.role !== "CLIENT_ADMIN" &&
      user.canManageBilling !== true
    )
  ) {
    return;
  }

  const subscription =
    await prisma.subscription.findFirst({
      where: {
        companyId,
        renewalDate: { not: null },
        status: {
          in: [
            "TRIAL",
            "ACTIVE",
            "PAST_DUE",
            "EXPIRED",
          ],
        },
      },
      include: {
        plan: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

  if (!subscription?.renewalDate) {
    return;
  }

  const now = new Date();
  const renewalDate = new Date(subscription.renewalDate);
  const graceEndsAt = getSubscriptionGraceEndsAt(renewalDate);
  const dateKey = renewalDate.toISOString().slice(0, 10);
  const formatDate = (date) =>
    date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  // On/after the due date, replace approaching reminders with one clear
  // overdue/expired message that explains the 7-day grace period.
  if (renewalDate <= now) {
    await prisma.notification.deleteMany({
      where: {
        companyId,
        userId,
        title: {
          in: [
            "Subscription renewal approaching",
            "Subscription renewal due soon",
          ],
        },
        message: {
          contains: `BILLING_RENEWAL_`,
        },
      },
    });

    const expired =
      subscription.status === "EXPIRED" ||
      (graceEndsAt && now >= graceEndsAt);
    const marker =
      `BILLING_OVERDUE:${subscription.id}:${dateKey}`;

    const exists =
      await prisma.notification.findFirst({
        where: {
          companyId,
          userId,
          message: { contains: marker },
        },
        select: { id: true },
      });

    if (!exists) {
      await prisma.notification.create({
        data: {
          companyId,
          userId,
          title: expired
            ? "Subscription expired"
            : "Subscription renewal overdue",
          message: expired
            ? `${subscription.plan.name} expired after the 7-day grace period. Renew the annual plan to restore CRM access. ${marker}`
            : `${subscription.plan.name} renewal was due on ${formatDate(renewalDate)}. Manual renewal is required by ${formatDate(graceEndsAt)} to avoid CRM access restriction. ${marker}`,
          type: "BILLING",
          actionModule: "settings",
          actionLabel: "Renew now",
        },
      });
    }

    return;
  }

  const daysUntilRenewal =
    (renewalDate.getTime() - now.getTime()) /
    (24 * 60 * 60 * 1000);

  const reminderDays =
    daysUntilRenewal <= 7
      ? 7
      : daysUntilRenewal <= 30
      ? 30
      : null;

  if (!reminderDays) {
    return;
  }

  // When the 7-day reminder is reached, remove the older 30-day reminder so
  // the notification list only shows the most useful current action.
  if (reminderDays === 7) {
    await prisma.notification.deleteMany({
      where: {
        companyId,
        userId,
        message: {
          contains: `BILLING_RENEWAL_30:${subscription.id}:`,
        },
      },
    });
  }

  const marker =
    `BILLING_RENEWAL_${reminderDays}:${subscription.id}:${dateKey}`;

  const exists =
    await prisma.notification.findFirst({
      where: {
        companyId,
        userId,
        message: { contains: marker },
      },
      select: { id: true },
    });

  if (!exists) {
    await prisma.notification.create({
      data: {
        companyId,
        userId,
        title:
          reminderDays === 7
            ? "Subscription renewal due soon"
            : "Subscription renewal approaching",
        message:
          `${subscription.plan.name} annual plan renews on ${formatDate(renewalDate)}. ` +
          `This is a manual renewal, so you can confirm the plan before payment. ${marker}`,
        type: "BILLING",
        actionModule: "settings",
        actionLabel: "View billing",
      },
    });
  }
}

async function ensureDynamicNotifications(
  req
) {
  await Promise.all([
    ensureCalendarReminders(
      req.clientUser.companyId,
      req.clientUser.userId
    ),
    ensureBillingRenewalReminder(
      req.clientUser.companyId,
      req.clientUser.userId
    ),
  ]);
}

function notificationWhere(req) {
  return {
    companyId: req.clientUser.companyId,
    OR: [
      { userId: null },
      { userId: req.clientUser.userId },
    ],
  };
}

async function getWorkspaceDefaults(companyId) {
  const settings =
    await prisma.companySettings.findUnique({
      where: {
        companyId,
      },
      select: {
        emailNotifications: true,
        smsNotifications: true,
      },
    });

  return {
    emailEnabled:
      settings?.emailNotifications ?? true,
    smsEnabled:
      settings?.smsNotifications ?? false,
  };
}

async function getUserPreference(
  companyId,
  userId
) {
  const [
    preference,
    workspaceDefaults,
  ] = await Promise.all([
    prisma.userNotificationPreference.findUnique({
      where: {
        userId,
      },
    }),
    getWorkspaceDefaults(companyId),
  ]);

  return {
    workspaceDefaults,

    preference: {
      inAppEnabled:
        preference?.inAppEnabled ?? true,

      emailEnabled:
        preference?.emailEnabled ??
        workspaceDefaults.emailEnabled,

      smsEnabled:
        preference?.smsEnabled ??
        workspaceDefaults.smsEnabled,

      leadUpdates:
        preference?.leadUpdates ?? true,

      admissionUpdates:
        preference?.admissionUpdates ?? true,

      billingUpdates:
        preference?.billingUpdates ?? true,

      supportUpdates:
        preference?.supportUpdates ?? true,

      systemUpdates:
        preference?.systemUpdates ?? true,
    },
  };
}

router.get(
  "/preferences",
  async (req, res) => {
    try {
      const data =
        await getUserPreference(
          req.clientUser.companyId,
          req.clientUser.userId
        );

      return res.json({
        success: true,
        ...data,
      });
    } catch (error) {
      console.error(
        "Load notification preferences failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load notification preferences",
      });
    }
  }
);

router.patch(
  "/preferences",
  async (req, res) => {
    try {
      const companyId =
        req.clientUser.companyId;

      const userId =
        req.clientUser.userId;

      const allowedFields = [
        "inAppEnabled",
        "emailEnabled",
        "smsEnabled",
        "leadUpdates",
        "admissionUpdates",
        "billingUpdates",
        "supportUpdates",
        "systemUpdates",
      ];

      const data = {};

      for (const field of allowedFields) {
        if (
          typeof req.body?.[field] ===
          "boolean"
        ) {
          data[field] =
            req.body[field];
        }
      }

      await prisma.userNotificationPreference.upsert({
        where: {
          userId,
        },
        update: {
          ...data,
          companyId,
        },
        create: {
          companyId,
          userId,
          ...data,
        },
      });

      const result =
        await getUserPreference(
          companyId,
          userId
        );

      return res.json({
        success: true,
        message:
          "Notification preferences saved",
        ...result,
      });
    } catch (error) {
      console.error(
        "Save notification preferences failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to save notification preferences",
      });
    }
  }
);

// Remove internal dedup markers (e.g. "CALENDAR_REMINDER:abc",
// "BILLING_RENEWAL:abc:2026-09-17") from user-facing notification text.
function stripMarkers(text) {
  if (!text) return text;
  return String(text)
    .replace(/\s*[A-Z][A-Z_]{2,}:[A-Za-z0-9:_-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

router.get("/", async (req, res) => {
  try {
    await ensureDynamicNotifications(req);

    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 20,
        1
      ),
      50
    );

    const where =
      notificationWhere(req);

    const [notifications, unreadCount] =
      await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: {
            createdAt: "desc",
          },
          take: limit,
        }),

        prisma.notification.count({
          where: {
            ...where,
            read: false,
          },
        }),
      ]);

    return res.json({
      success: true,
      notifications: notifications.map(
        (n) => ({
          ...n,
          message: stripMarkers(n.message),
        })
      ),
      unreadCount,
    });
  } catch (error) {
    console.error(
      "Load client notifications failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load notifications",
    });
  }
});

router.get(
  "/unread-count",
  async (req, res) => {
    try {
      await ensureDynamicNotifications(req);

      const unreadCount =
        await prisma.notification.count({
          where: {
            ...notificationWhere(req),
            read: false,
          },
        });

      return res.json({
        success: true,
        unreadCount,
      });
    } catch (error) {
      console.error(
        "Load unread notification count failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load notification count",
      });
    }
  }
);

router.patch(
  "/read-all",
  async (req, res) => {
    try {
      const result =
        await prisma.notification.updateMany({
          where: {
            ...notificationWhere(req),
            read: false,
          },
          data: {
            read: true,
            readAt:
              new Date(),
          },
        });

      return res.json({
        success: true,
        updated: result.count,
      });
    } catch (error) {
      console.error(
        "Mark all notifications read failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to mark notifications as read",
      });
    }
  }
);

router.patch(
  "/:id/read",
  async (req, res) => {
    try {
      const notification =
        await prisma.notification.findFirst({
          where: {
            id: req.params.id,
            ...notificationWhere(req),
          },
        });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message:
            "Notification not found",
        });
      }

      const updated =
        notification.read
          ? notification
          : await prisma.notification.update({
              where: {
                id: notification.id,
              },
              data: {
                read: true,
                readAt:
                  new Date(),
              },
            });

      return res.json({
        success: true,
        notification: updated,
      });
    } catch (error) {
      console.error(
        "Mark notification read failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update notification",
      });
    }
  }
);

export default router;