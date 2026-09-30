import { Router } from "express";
import { randomInt } from "crypto";

import prisma from "../lib/prisma.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";
import {
  createSupportTicketCreatedNotification,
} from "../lib/notifications.js";

const router = Router();

router.use(requireClientUser);
router.use(
  requireClientPermission(
    "canManageSupport",
    "You do not have permission to manage support"
  )
);

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

const VALID_NEW_TYPES = [
  "TECHNICAL_ISSUE",
  "BILLING",
  "CUSTOMIZATION",
  "CALL_TO_RM",
];

function countLetters(value) {
  return (String(value || "").match(/\p{L}/gu) || []).length;
}

function isMeaningfulSupportText(value, minLength, minLetters) {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  return text.length >= minLength && countLetters(text) >= minLetters;
}

const VALID_PRIORITIES = Object.keys(PRIORITY_LABELS);
const VALID_DISCUSSION_CATEGORIES = Object.keys(
  DISCUSSION_CATEGORIES
);

function formatTicket(ticket) {
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
  };
}

function generateTicketNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const time = [
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join("");
  const suffix = String(randomInt(1000, 10000));

  return `T-${year}${month}${day}-${time}-${suffix}`;
}

async function createTicketWithUniqueNumber(data) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.supportTicket.create({
        data: {
          ...data,
          ticketNumber: generateTicketNumber(),
        },
        include: {
          assignedRmUser: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              jobTitle: true,
            },
          },
        },
      });
    } catch (error) {
      const isUniqueConflict = error?.code === "P2002";

      if (!isUniqueConflict || attempt === 4) {
        throw error;
      }
    }
  }

  throw new Error("Unable to generate a unique ticket number");
}

async function getCurrentPlan(companyId) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      companyId,
      status: {
        in: ["ACTIVE", "TRIAL"],
      },
    },
    include: {
      plan: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return subscription?.plan?.key || null;
}

function parsePreferredCallDate(value) {
  const clean = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return null;
  }

  const parsed = new Date(`${clean}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

router.get("/", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;

    const tickets = await prisma.supportTicket.findMany({
      where: {
        companyId,
      },
      include: {
        assignedRmUser: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            jobTitle: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      tickets: tickets.map(formatTicket),
    });
  } catch (error) {
    console.error("Failed to fetch support tickets:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch support tickets",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const userId = req.clientUser.userId;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        name: true,
        email: true,
        phone: true,
        department: true,
        active: true,
        companyId: true,
      },
    });

    if (
      !user ||
      !user.active ||
      user.companyId !== companyId
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      title,
      description,
      type,
      priority,
      department,
      discussionCategory,
      preferredCallDate,
      preferredTimeSlot,
      contactName,
      contactPhone,
      contactEmail,
    } = req.body || {};

    const cleanTitle = String(title || "").trim();
    const cleanDescription = String(description || "").trim();
    const typeKey = String(type || "")
      .trim()
      .toUpperCase();
    const priorityKey = String(priority || "MEDIUM")
      .trim()
      .toUpperCase();
    const cleanDepartment = String(department || "").trim();

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message:
          typeKey === "CALL_TO_RM"
            ? "Discussion topic is required"
            : "Ticket title is required",
      });
    }

    if (!cleanDescription) {
      return res.status(400).json({
        success: false,
        message: "Description is required",
      });
    }

    if (!isMeaningfulSupportText(cleanTitle, 4, 2)) {
      return res.status(400).json({
        success: false,
        message:
          typeKey === "CALL_TO_RM"
            ? "Discussion topic must contain meaningful text, including letters"
            : "Ticket title must contain meaningful text, including letters",
      });
    }

    if (!isMeaningfulSupportText(cleanDescription, 10, 3)) {
      return res.status(400).json({
        success: false,
        message: "Description must contain meaningful text, including letters",
      });
    }

    if (!VALID_NEW_TYPES.includes(typeKey)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket type",
      });
    }

    if (!VALID_PRIORITIES.includes(priorityKey)) {
      return res.status(400).json({
        success: false,
        message: "Invalid priority",
      });
    }

    if (typeKey !== "CALL_TO_RM" && !cleanDepartment) {
      return res.status(400).json({
        success: false,
        message: "Department is required",
      });
    }

    if (typeKey === "CUSTOMIZATION") {
      const plan = await getCurrentPlan(companyId);

      if (plan !== "advanced") {
        return res.status(403).json({
          success: false,
          message:
            "Customization Requests are available only on the Advanced plan",
        });
      }
    }

    let rmData = {};

    if (typeKey === "CALL_TO_RM") {
      const categoryKey = String(
        discussionCategory || "GENERAL"
      )
        .trim()
        .toUpperCase();
      const callDate = parsePreferredCallDate(
        preferredCallDate
      );
      const cleanTimeSlot = String(
        preferredTimeSlot || ""
      ).trim();
      const cleanContactName = String(
        contactName || user.name || ""
      ).trim();
      const cleanContactPhone = String(
        contactPhone || user.phone || ""
      ).trim();
      const cleanContactEmail = String(
        contactEmail || user.email || ""
      )
        .trim()
        .toLowerCase();

      if (
        !VALID_DISCUSSION_CATEGORIES.includes(categoryKey)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid discussion category",
        });
      }

      if (!callDate) {
        return res.status(400).json({
          success: false,
          message: "Preferred call date is required",
        });
      }

      const today = new Date();
      const todayUtc = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate()
        )
      );

      if (callDate.getTime() < todayUtc.getTime()) {
        return res.status(400).json({
          success: false,
          message:
            "Preferred call date cannot be in the past",
        });
      }

      if (!cleanTimeSlot) {
        return res.status(400).json({
          success: false,
          message: "Preferred time slot is required",
        });
      }

      if (!cleanContactName) {
        return res.status(400).json({
          success: false,
          message: "Contact person name is required",
        });
      }

      if (!cleanContactPhone) {
        return res.status(400).json({
          success: false,
          message: "Contact phone number is required",
        });
      }

      if (
        !cleanContactEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanContactEmail)
      ) {
        return res.status(400).json({
          success: false,
          message: "A valid contact email is required",
        });
      }

      rmData = {
        discussionCategory: categoryKey,
        preferredCallDate: callDate,
        preferredTimeSlot: cleanTimeSlot,
        contactName: cleanContactName,
        contactPhone: cleanContactPhone,
        contactEmail: cleanContactEmail,
      };
    }

    const ticket = await createTicketWithUniqueNumber({
      companyId,
      title: cleanTitle,
      description: cleanDescription,
      type: typeKey,
      priority: priorityKey,
      status: "NEW",
      submittedByName: user.name,
      submittedByEmail: user.email,
      department:
        typeKey === "CALL_TO_RM"
          ? user.department || null
          : cleanDepartment,
      ...rmData,
    });

    await createSupportTicketCreatedNotification({
      companyId,
      userId,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
    });

    return res.status(201).json({
      success: true,
      message:
        typeKey === "CALL_TO_RM"
          ? "Call to RM request submitted successfully"
          : "Support ticket created successfully",
      ticket: formatTicket(ticket),
    });
  } catch (error) {
    console.error("Failed to create support ticket:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create support ticket",
    });
  }
});

export default router;