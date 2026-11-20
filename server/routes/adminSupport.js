import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireSuperAdmin } from "../middleware/adminAuth.js";
import {
  createSupportTicketUpdatedNotification,
} from "../lib/notifications.js";
import {
  writeSuperAdminAudit,
} from "../lib/adminAuditLog.js";

const router = Router();

router.use(requireSuperAdmin);

const TYPE_LABELS = {
  TECHNICAL_ISSUE: "Technical Issue",
  BILLING: "Billing Support",
  CUSTOMIZATION: "Customization Request",
  FEATURE_REQUEST: "Customization Request",
  INTEGRATION: "Customization Request",
  CALL_TO_RM: "Call to RM",
};

const PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

const STATUS_LABELS = {
  NEW: "New",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  DEVELOPMENT: "Development",
  RM_ASSIGNED: "RM Assigned",
  CALL_SCHEDULED: "Call Scheduled",
  DISCUSSION_COMPLETED: "Discussion Completed",
  FOLLOW_UP_REQUIRED: "Follow-up Required",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CLOSED: "Closed",
};

const DISCUSSION_CATEGORIES = {
  GENERAL: "General Discussion",
  PRODUCT_CHANGE: "Product / Workflow Change",
  CUSTOMIZATION: "Customization",
  INTEGRATION: "Integration",
  BILLING_PLAN: "Billing / Plan",
  TRAINING_GUIDANCE: "Training / Guidance",
  OTHER: "Other",
};

const VALID_STATUSES = Object.keys(STATUS_LABELS);

const RM_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "RM_ASSIGNED",
  "CALL_SCHEDULED",
  "DISCUSSION_COMPLETED",
  "FOLLOW_UP_REQUIRED",
  "COMPLETED",
  "REJECTED",
  "CLOSED",
];

const STANDARD_STATUSES = [
  "NEW",
  "UNDER_REVIEW",
  "APPROVED",
  "IN_PROGRESS",
  "DEVELOPMENT",
  "COMPLETED",
  "REJECTED",
  "CLOSED",
];

const SUPPORT_TYPES = [
  "TECHNICAL_ISSUE",
  "BILLING",
];

const CUSTOMIZATION_TYPES = [
  "CUSTOMIZATION",
  "FEATURE_REQUEST",
  "INTEGRATION",
];

const RM_TYPES = ["CALL_TO_RM"];

function getActiveSubscription(subscriptions = []) {
  return (
    subscriptions.find(
      (subscription) =>
        subscription.status === "ACTIVE" ||
        subscription.status === "TRIAL"
    ) ||
    subscriptions[0] ||
    null
  );
}

function formatTicket(ticket) {
  const activeSubscription = getActiveSubscription(
    ticket.company?.subscriptions || []
  );

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title,
    description: ticket.description,
    type: ticket.type,
    typeLabel: TYPE_LABELS[ticket.type] || ticket.type,
    priority: ticket.priority,
    priorityLabel:
      PRIORITY_LABELS[ticket.priority] || ticket.priority,
    status: ticket.status,
    statusLabel: STATUS_LABELS[ticket.status] || ticket.status,
    submittedByName: ticket.submittedByName,
    submittedByEmail: ticket.submittedByEmail,
    department: ticket.department,
    discussionCategory: ticket.discussionCategory,
    discussionCategoryLabel:
      DISCUSSION_CATEGORIES[ticket.discussionCategory] ||
      ticket.discussionCategory ||
      null,
    preferredCallDate: ticket.preferredCallDate,
    preferredTimeSlot: ticket.preferredTimeSlot,
    contactName: ticket.contactName,
    contactPhone: ticket.contactPhone,
    contactEmail: ticket.contactEmail,
    assignedRmUserId: ticket.assignedRmUserId,
    assignedRm: ticket.assignedRmUser
      ? {
          id: ticket.assignedRmUser.id,
          name: ticket.assignedRmUser.name,
          email: ticket.assignedRmUser.email,
          phone: ticket.assignedRmUser.phone,
          jobTitle: ticket.assignedRmUser.jobTitle,
        }
      : null,
    scheduledCallAt: ticket.scheduledCallAt,
    adminRemarks: ticket.adminRemarks,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    company: ticket.company
      ? {
          id: ticket.company.id,
          name: ticket.company.name,
          slug: ticket.company.slug,
          brandName: ticket.company.brandName,
          status: ticket.company.status,
          plan: activeSubscription?.plan?.key || null,
          planName: activeSubscription?.plan?.name || null,
          subscriptionStatus:
            activeSubscription?.status || null,
        }
      : null,
  };
}

async function findTicketUserId(companyId, email) {
  if (!email) return null;

  const user = await prisma.user.findFirst({
    where: {
      companyId,
      email: String(email).trim().toLowerCase(),
    },
    select: {
      id: true,
    },
  });

  return user?.id || null;
}

async function getActor(req) {
  return prisma.user.findUnique({
    where: {
      id: req.admin.userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

const ticketInclude = {
  company: {
    include: {
      subscriptions: {
        include: {
          plan: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  },
  assignedRmUser: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      jobTitle: true,
    },
  },
};

router.get("/", async (req, res) => {
  try {
    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();
    const type = String(req.query.type || "")
      .trim()
      .toUpperCase();
    const companyId = String(
      req.query.companyId || ""
    ).trim();
    const scope = String(req.query.scope || "")
      .trim()
      .toLowerCase();

    const where = {};

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (type) {
      where.type = type;
    } else if (scope === "support") {
      where.type = {
        in: SUPPORT_TYPES,
      };
    } else if (scope === "customization") {
      where.type = {
        in: CUSTOMIZATION_TYPES,
      };
    } else if (scope === "rm") {
      where.type = {
        in: RM_TYPES,
      };
    }

    const [tickets, rmUsers] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: ticketInclude,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.findMany({
        where: {
          role: "SUPER_ADMIN",
          active: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          jobTitle: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

    const formatted = tickets.map(formatTicket);

    const summary = {
      total: formatted.length,
      new: formatted.filter(
        (ticket) => ticket.status === "NEW"
      ).length,
      underReview: formatted.filter(
        (ticket) => ticket.status === "UNDER_REVIEW"
      ).length,
      active: formatted.filter((ticket) =>
        [
          "APPROVED",
          "IN_PROGRESS",
          "DEVELOPMENT",
          "RM_ASSIGNED",
          "CALL_SCHEDULED",
          "FOLLOW_UP_REQUIRED",
        ].includes(ticket.status)
      ).length,
      completed: formatted.filter((ticket) =>
        [
          "DISCUSSION_COMPLETED",
          "COMPLETED",
          "CLOSED",
        ].includes(ticket.status)
      ).length,
      customization: formatted.filter((ticket) =>
        CUSTOMIZATION_TYPES.includes(ticket.type)
      ).length,
      callToRm: formatted.filter(
        (ticket) => ticket.type === "CALL_TO_RM"
      ).length,
    };

    return res.json({
      success: true,
      summary,
      rmUsers,
      tickets: formatted,
    });
  } catch (error) {
    console.error(
      "Failed to fetch admin support tickets:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch support tickets",
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: {
        id: req.params.id,
      },
      include: ticketInclude,
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    return res.json({
      success: true,
      ticket: formatTicket(ticket),
    });
  } catch (error) {
    console.error("Failed to fetch support ticket:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch support ticket",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.supportTicket.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found",
      });
    }

    const data = {};

    if (req.body.status !== undefined) {
      const status = String(req.body.status || "")
        .trim()
        .toUpperCase();

      const allowedStatuses =
        existing.type === "CALL_TO_RM"
          ? RM_STATUSES
          : STANDARD_STATUSES;

      if (
        !VALID_STATUSES.includes(status) ||
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid support ticket status",
        });
      }

      data.status = status;

      if (
        [
          "DISCUSSION_COMPLETED",
          "COMPLETED",
          "CLOSED",
        ].includes(status)
      ) {
        data.resolvedAt = new Date();
      } else {
        data.resolvedAt = null;
      }
    }

    if (req.body.adminRemarks !== undefined) {
      data.adminRemarks = req.body.adminRemarks
        ? String(req.body.adminRemarks).trim()
        : null;
    }

    if (
      existing.type === "CALL_TO_RM" &&
      req.body.assignedRmUserId !== undefined
    ) {
      const assignedRmUserId = String(
        req.body.assignedRmUserId || ""
      ).trim();

      if (!assignedRmUserId) {
        data.assignedRmUserId = null;
      } else {
        const rmUser = await prisma.user.findFirst({
          where: {
            id: assignedRmUserId,
            role: "SUPER_ADMIN",
            active: true,
          },
          select: {
            id: true,
          },
        });

        if (!rmUser) {
          return res.status(400).json({
            success: false,
            message: "Invalid Relationship Manager",
          });
        }

        data.assignedRmUserId = rmUser.id;

        if (
          req.body.status === undefined &&
          ["NEW", "UNDER_REVIEW"].includes(existing.status)
        ) {
          data.status = "RM_ASSIGNED";
          data.resolvedAt = null;
        }
      }
    }

    if (
      existing.type === "CALL_TO_RM" &&
      req.body.scheduledCallAt !== undefined
    ) {
      const cleanScheduledCallAt = String(
        req.body.scheduledCallAt || ""
      ).trim();

      if (!cleanScheduledCallAt) {
        data.scheduledCallAt = null;
      } else {
        const parsed = new Date(cleanScheduledCallAt);

        if (Number.isNaN(parsed.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid scheduled call date/time",
          });
        }

        data.scheduledCallAt = parsed;

        if (req.body.status === undefined) {
          data.status = "CALL_SCHEDULED";
          data.resolvedAt = null;
        }
      }
    }

    const updated = await prisma.supportTicket.update({
      where: {
        id: existing.id,
      },
      data,
      include: ticketInclude,
    });

    const statusChanged =
      data.status !== undefined &&
      data.status !== existing.status;
    const remarksChanged =
      data.adminRemarks !== undefined &&
      data.adminRemarks !== existing.adminRemarks;
    const rmChanged =
      data.assignedRmUserId !== undefined &&
      data.assignedRmUserId !== existing.assignedRmUserId;
    const scheduleChanged =
      data.scheduledCallAt !== undefined &&
      String(data.scheduledCallAt || "") !==
        String(existing.scheduledCallAt || "");

    if (
      statusChanged ||
      remarksChanged ||
      rmChanged ||
      scheduleChanged
    ) {
      const targetUserId = await findTicketUserId(
        existing.companyId,
        existing.submittedByEmail
      );

      await createSupportTicketUpdatedNotification({
        companyId: existing.companyId,
        userId: targetUserId,
        ticketId: updated.id,
        ticketNumber: updated.ticketNumber,
        ticketTitle: updated.title,
        statusLabel:
          STATUS_LABELS[updated.status] || updated.status,
        adminRemarks: updated.adminRemarks,
      });

      const actor = await getActor(req);

      await writeSuperAdminAudit({
        req,
        actor,
        action: "SUPPORT_TICKET_UPDATED",
        entityType: "SUPPORT_TICKET",
        entityId: updated.id,
        companyId: existing.companyId,
        companyName: existing.company?.name || null,
        summary: `${
          actor?.name || "Super Admin"
        } updated ticket ${updated.ticketNumber} for ${
          existing.company?.name || "a client"
        }.`,
        metadata: {
          type: updated.type,
          statusBefore: existing.status,
          statusAfter: updated.status,
          remarksChanged,
          rmChanged,
          scheduleChanged,
          assignedRmUserId:
            updated.assignedRmUserId || null,
          scheduledCallAt:
            updated.scheduledCallAt || null,
        },
      });
    }

    return res.json({
      success: true,
      message:
        existing.type === "CALL_TO_RM"
          ? "Call to RM request updated successfully"
          : "Support ticket updated successfully",
      ticket: formatTicket(updated),
    });
  } catch (error) {
    console.error("Failed to update support ticket:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update support ticket",
    });
  }
});

export default router;