import { Router } from "express";

import prisma from "../lib/prisma.js";
import { backfillAdmissionsLeads } from "../lib/admissionsLeadSync.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";
import {
  insightsSectionAllowed,
  dashboardSectionAllowed,
  allowedDashboardSections,
} from "../lib/pageAccess.js";

const router = Router();

router.use(requireClientUser);

const SOURCE_LABELS = {
  GOOGLE_FORM: "Google Form",
  WEBSITE_FORM: "Website Form",
  IM_LEADS: "IM Leads",
  DM_LEADS: "DM Leads",
  OTHER: "Other",
  REFERRAL: "Referral",
  OFFLINE: "Offline",
  LEAD_STORE: "Lead Store",
};

const STAGE_LABELS = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  COUNSELLING: "Counselling",
  ADMITTED: "Admitted",
  LOST: "Lost",
};

function monthKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}`;
}

function monthLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
  });
}

function getLastMonths(count = 8) {
  const now = new Date();
  const months = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    months.push(
      new Date(
        now.getFullYear(),
        now.getMonth() - offset,
        1
      )
    );
  }

  return months;
}

function parseYear(value) {
  if (!value || value === "all") return null;

  const year = Number(value);

  return Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100
    ? year
    : null;
}

function yearRange(year) {
  if (!year) return null;

  return {
    gte: new Date(year, 0, 1),
    lt: new Date(year + 1, 0, 1),
  };
}

function getYearMonths(year) {
  return Array.from(
    { length: 12 },
    (_, month) => new Date(year, month, 1)
  );
}

function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeContactPhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeContactEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function contactKeys({ phone, email } = {}) {
  const keys = [];
  const normalizedPhone = normalizeContactPhone(phone);
  const normalizedEmail = normalizeContactEmail(email);

  if (normalizedPhone) keys.push(`phone:${normalizedPhone}`);
  if (normalizedEmail) keys.push(`email:${normalizedEmail}`);

  return keys;
}

function mapUserByName(users = []) {
  const map = new Map();

  for (const user of users) {
    const key = normalizeName(user.name);
    if (key && !map.has(key)) {
      map.set(key, user);
    }
  }

  return map;
}

function recordUserId(record, userByName, fieldName) {
  return (
    record?.leadDataset?.assignedToUserId ||
    record?.lead?.leadDataset?.assignedToUserId ||
    userByName.get(normalizeName(record?.[fieldName]))?.id ||
    null
  );
}

function visibleToDashboardUser({
  record,
  fieldName,
  currentUser,
  visibleUserIds,
  visibleUserNames,
  includeUnassigned,
}) {
  if (currentUser.role === "CLIENT_ADMIN") {
    return true;
  }

  const directUserId =
    record?.leadDataset?.assignedToUserId ||
    record?.lead?.leadDataset?.assignedToUserId ||
    null;

  if (directUserId && visibleUserIds.has(directUserId)) {
    return true;
  }

  const normalized = normalizeName(record?.[fieldName]);

  if (normalized && visibleUserNames.has(normalized)) {
    return true;
  }

  return includeUnassigned && !normalized && !directUserId;
}

async function getDashboardAccessScope(companyId, userId) {
  const currentUser = await prisma.user.findFirst({
    where: {
      id: userId,
      companyId,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
    },
  });

  if (!currentUser) {
    return null;
  }

  const companyUsers = await prisma.user.findMany({
    where: {
      companyId,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
    },
  });

  let visibleUsers = companyUsers;

  if (currentUser.role === "EMPLOYEE") {
    visibleUsers = companyUsers.filter(
      (user) => user.id === currentUser.id
    );
  } else if (currentUser.role === "MANAGER") {
    const department = String(
      currentUser.department || ""
    ).trim();

    if (department) {
      visibleUsers = companyUsers.filter(
        (user) =>
          user.id === currentUser.id ||
          (["MANAGER", "EMPLOYEE"].includes(user.role) &&
            String(user.department || "")
              .trim()
              .toLowerCase() === department.toLowerCase())
      );
    } else {
      visibleUsers = companyUsers.filter(
        (user) =>
          user.role === "MANAGER" ||
          user.role === "EMPLOYEE" ||
          user.id === currentUser.id
      );
    }
  }

  return {
    currentUser,
    companyUsers,
    visibleUsers,
    userByName: mapUserByName(companyUsers),
    visibleUserIds: new Set(
      visibleUsers.map((user) => user.id)
    ),
    visibleUserNames: new Set(
      visibleUsers
        .map((user) => normalizeName(user.name))
        .filter(Boolean)
    ),
  };
}

async function getLeadNumberMap(companyId) {
  const rows = await prisma.lead.findMany({
    where: { companyId },
    select: { id: true, leadNumber: true },
  });

  return new Map(rows.map((lead) => [lead.id, lead.leadNumber]));
}

function leadDisplayId(leadNumber) {
  const value = Number(leadNumber);
  return Number.isInteger(value) && value > 0
    ? `LD${String(value).padStart(3, "0")}`
    : null;
}

/* =========================================================
   DASHBOARD
   Accessible to every authenticated client user. Data is scoped
   by role so employees do not require canViewAnalytics.
========================================================= */

router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const userId = req.clientUser.userId;

    // Repair legacy admissions that pre-date the admission -> Lead Store link
    // rule so Dashboard/Action Center can show the same Lead ID consistently.
    await backfillAdmissionsLeads(prisma, companyId);
    const selectedYear = parseYear(req.query.year);
    const currentYear = new Date().getFullYear();

    const access = await getDashboardAccessScope(
      companyId,
      userId
    );

    if (!access) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      currentUser,
      companyUsers,
      userByName,
      visibleUserIds,
      visibleUserNames,
    } = access;

    const leadWhere = { companyId };
    // The Admissions KPI counts every admission record (including CANCELLED) so
    // it matches the Admissions page total. Revenue/performance below filter out
    // CANCELLED separately via `activeAdmissions`.
    const admissionWhere = {
      companyId,
    };

    if (selectedYear) {
      leadWhere.createdAt = yearRange(selectedYear);
      admissionWhere.admissionDate = yearRange(selectedYear);
    }

    const [allLeads, allAdmissions, expenses, incentives] =
      await Promise.all([
        prisma.lead.findMany({
          where: leadWhere,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            source: true,
            stage: true,
            campaign: true,
            assignedToName: true,
            createdAt: true,
            leadDataset: {
              select: {
                assignedToUserId: true,
              },
            },
          },
        }),
        prisma.admission.findMany({
          where: admissionWhere,
          select: {
            id: true,
            leadId: true,
            studentName: true,
            studentPhone: true,
            studentEmail: true,
            college: true,
            course: true,
            counsellorName: true,
            totalFee: true,
            paidAmount: true,
            status: true,
            admissionDate: true,
            createdAt: true,
            lead: {
              select: {
                assignedToName: true,
                leadDataset: {
                  select: {
                    assignedToUserId: true,
                  },
                },
              },
            },
          },
        }),
        prisma.expense.findMany({
          where: {
            companyId,
            status: "APPROVED",
          },
          select: {
            amount: true,
            createdAt: true,
          },
        }),
        prisma.incentive.findMany({
          where: {
            companyId,
            status: {
              in: ["APPROVED", "PAID"],
            },
          },
          select: {
            amount: true,
            createdAt: true,
            userId: true,
            employeeName: true,
          },
        }),
      ]);

    const includeUnassigned =
      currentUser.role === "MANAGER";

    const leads = allLeads.filter((lead) =>
      visibleToDashboardUser({
        record: lead,
        fieldName: "assignedToName",
        currentUser,
        visibleUserIds,
        visibleUserNames,
        includeUnassigned,
      })
    );

    const admissions = allAdmissions.filter((admission) =>
      visibleToDashboardUser({
        record: admission,
        fieldName: "counsellorName",
        currentUser,
        visibleUserIds,
        visibleUserNames,
        includeUnassigned,
      })
    );

    // `admissions` now includes CANCELLED rows so the headline count matches the
    // Admissions page. Money and counsellor credit must ignore cancelled deals.
    const activeAdmissions = admissions.filter(
      (admission) => admission.status !== "CANCELLED"
    );

    const dateSourceLeads =
      currentUser.role === "CLIENT_ADMIN"
        ? allLeads
        : leads;
    const dateSourceAdmissions =
      currentUser.role === "CLIENT_ADMIN"
        ? allAdmissions
        : admissions;

    const availableYears = Array.from(
      new Set([
        currentYear,
        ...dateSourceLeads.map((item) =>
          new Date(item.createdAt).getFullYear()
        ),
        ...dateSourceAdmissions.map((item) =>
          new Date(item.admissionDate).getFullYear()
        ),
      ])
    )
      .filter(Number.isFinite)
      .sort((a, b) => b - a);

    const filteredExpenses = selectedYear
      ? expenses.filter(
          (item) =>
            new Date(item.createdAt).getFullYear() ===
            selectedYear
        )
      : expenses;

    const filteredIncentives = selectedYear
      ? incentives.filter(
          (item) =>
            new Date(item.createdAt).getFullYear() ===
            selectedYear
        )
      : incentives;

    // Dashboard lead KPIs use a unified customer count. An admission can be
    // created directly without a Lead Store record, so those students must not
    // disappear from Total Leads / Qualified Leads. At the same time, avoid
    // double-counting admissions that are already linked to (or clearly match)
    // an existing lead by phone/email.
    const leadIdByContactKey = new Map();

    for (const lead of leads) {
      for (const key of contactKeys({
        phone: lead.phone,
        email: lead.email,
      })) {
        if (!leadIdByContactKey.has(key)) {
          leadIdByContactKey.set(key, lead.id);
        }
      }
    }

    const admittedLeadIds = new Set();
    const directAdmissionContactKeys = new Set();
    let directAdmissionLeadCount = 0;

    for (const admission of activeAdmissions) {
      if (admission.leadId) {
        admittedLeadIds.add(admission.leadId);
        continue;
      }

      const keys = contactKeys({
        phone: admission.studentPhone,
        email: admission.studentEmail,
      });

      const matchedLeadId = keys
        .map((key) => leadIdByContactKey.get(key))
        .find(Boolean);

      if (matchedLeadId) {
        admittedLeadIds.add(matchedLeadId);
        continue;
      }

      // Multiple admission rows for the same direct-entry student should still
      // represent one lead in the dashboard KPI. When no contact information is
      // available, the admission itself is the safest unique fallback.
      const alreadyCounted =
        keys.length > 0 &&
        keys.some((key) => directAdmissionContactKeys.has(key));

      if (alreadyCounted) continue;

      if (keys.length > 0) {
        keys.forEach((key) => directAdmissionContactKeys.add(key));
      }

      directAdmissionLeadCount += 1;
    }

    // Lead KPIs represent actual Lead Store records. Direct-entry admissions
    // stay in Admissions instead of inflating Lead Store counts.
    const totalLeads = leads.length;
    const newLeads = leads.filter(
      (lead) => lead.stage === "NEW"
    ).length;
    const qualifiedLeads = leads.filter(
      (lead) => lead.stage === "QUALIFIED" || lead.stage === "ADMITTED"
    ).length;
    const totalAdmissions = admissions.length;

    const potentialRevenue = activeAdmissions.reduce(
      (sum, admission) =>
        sum + Number(admission.totalFee || 0),
      0
    );
    const receivedAmount = activeAdmissions.reduce(
      (sum, admission) =>
        sum + Number(admission.paidAmount || 0),
      0
    );
    const pendingAmount = Math.max(
      potentialRevenue - receivedAmount,
      0
    );

    const approvedExpenses =
      currentUser.role === "CLIENT_ADMIN"
        ? filteredExpenses.reduce(
            (sum, expense) =>
              sum + Number(expense.amount || 0),
            0
          )
        : 0;

    const totalIncentives =
      currentUser.role === "CLIENT_ADMIN"
        ? filteredIncentives.reduce(
            (sum, incentive) =>
              sum + Number(incentive.amount || 0),
            0
          )
        : 0;

    const currentProfit =
      currentUser.role === "CLIENT_ADMIN"
        ? receivedAmount -
          approvedExpenses -
          totalIncentives
        : 0;

    const months = selectedYear
      ? getYearMonths(selectedYear)
      : getLastMonths(8);

    const admissionsByMonth = months.map((month) => {
      const key = monthKey(month);
      const monthAdmissions = admissions.filter(
        (admission) =>
          monthKey(new Date(admission.admissionDate)) === key
      );

      return {
        key,
        m: monthLabel(month),
        admissions: monthAdmissions.length,
      };
    });

    const revenueTrend = months.map((month) => {
      const key = monthKey(month);
      const monthAdmissions = activeAdmissions.filter(
        (admission) =>
          monthKey(new Date(admission.admissionDate)) === key
      );

      return {
        key,
        m: monthLabel(month),
        potential: monthAdmissions.reduce(
          (sum, admission) => sum + Number(admission.totalFee || 0),
          0
        ),
        received: monthAdmissions.reduce(
          (sum, admission) => sum + Number(admission.paidAmount || 0),
          0
        ),
      };
    });

    const sourceCounts = {};

    for (const lead of leads) {
      const rawSource =
        SOURCE_LABELS[lead.source] || lead.source;
      // Leads with no recorded source go to a named bucket instead of an empty
      // legend row, so every lead is represented.
      const source =
        rawSource && String(rawSource).trim()
          ? String(rawSource).trim()
          : "Unspecified";
      sourceCounts[source] =
        (sourceCounts[source] || 0) + 1;
    }

    // Direct admissions are included in `totalLeads` but have no lead row, so
    // they were missing from the source breakdown — which made the donut's
    // center total (e.g. 13) exceed the legend sum (e.g. 11). Surface them as
    // their own bucket so the breakdown reconciles with the total.
    if (directAdmissionLeadCount > 0) {
      sourceCounts["Direct Admission"] =
        (sourceCounts["Direct Admission"] || 0) + directAdmissionLeadCount;
    }

    const leadsBySource = Object.entries(sourceCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const teamMap = new Map();

    function ensurePerformance({
      userId: performanceUserId,
      fallbackName,
    }) {
      const matchedUser = performanceUserId
        ? companyUsers.find(
            (user) => user.id === performanceUserId
          )
        : userByName.get(normalizeName(fallbackName));

      const key =
        matchedUser?.id ||
        normalizeName(fallbackName) ||
        "unassigned";

      if (!teamMap.has(key)) {
        teamMap.set(key, {
          userId: matchedUser?.id || null,
          name:
            matchedUser?.name ||
            fallbackName ||
            "Unassigned",
          leads: 0,
          admissions: 0,
          revenue: 0,
        });
      }

      return teamMap.get(key);
    }

    for (const lead of leads) {
      const performance = ensurePerformance({
        userId: recordUserId(
          lead,
          userByName,
          "assignedToName"
        ),
        fallbackName:
          lead.assignedToName || "Unassigned",
      });
      performance.leads += 1;
    }

    for (const admission of activeAdmissions) {
      const performance = ensurePerformance({
        userId:
          recordUserId(
            admission,
            userByName,
            "counsellorName"
          ) ||
          recordUserId(
            admission.lead || {},
            userByName,
            "assignedToName"
          ),
        fallbackName:
          admission.counsellorName ||
          admission.lead?.assignedToName ||
          "Unassigned",
      });
      performance.admissions += 1;
      performance.revenue += Number(
        admission.paidAmount || 0
      );
    }

    const teamPerformance = Array.from(
      teamMap.values()
    ).sort(
      (a, b) =>
        b.admissions - a.admissions ||
        b.leads - a.leads
    );

    const myPerformance =
      teamPerformance.find(
        (item) => item.userId === currentUser.id
      ) ||
      teamPerformance.find(
        (item) =>
          normalizeName(item.name) ===
          normalizeName(currentUser.name)
      ) || {
        userId: currentUser.id,
        name: currentUser.name,
        leads: 0,
        admissions: 0,
        revenue: 0,
      };

    const recentAdmissions = [...admissions]
      .sort(
        (a, b) =>
          new Date(b.admissionDate).getTime() -
          new Date(a.admissionDate).getTime()
      )
      .slice(0, 8)
      .map((admission) => ({
        id: admission.id,
        studentName: admission.studentName,
        college: admission.college,
        course: admission.course,
        counsellorName: admission.counsellorName,
        admissionDate: admission.admissionDate,
        amount: Number(admission.paidAmount || 0),
        status: admission.status,
      }));

    const recentActivity = [
      ...leads.map((lead) => ({
        id: `lead-${lead.id}`,
        title: `${lead.name} · ${
          STAGE_LABELS[lead.stage] || lead.stage
        } lead`,
        userName:
          lead.assignedToName || "Unassigned",
        createdAt: lead.createdAt,
      })),
      ...admissions.map((admission) => ({
        id: `admission-${admission.id}`,
        title: `${admission.studentName} · Admission recorded`,
        userName:
          admission.counsellorName || "Unassigned",
        createdAt:
          admission.admissionDate || admission.createdAt,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0, 10);

    // Daily Action Center intentionally ignores the selected reporting year.
    // It is a "what needs attention now" view, while the rest of the dashboard
    // continues to respect the global year selector.
    const actionNow = new Date();
    const [actionLeadRows, actionAdmissionRows, actionFollowUpRows] =
      await Promise.all([
        prisma.lead.findMany({
          where: {
            companyId,
            stage: { notIn: ["ADMITTED", "LOST"] },
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            stage: true,
            temperature: true,
            leadStatus: true,
            assignedToName: true,
            createdAt: true,
            leadDataset: { select: { assignedToUserId: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 3000,
        }),
        prisma.admission.findMany({
          where: {
            companyId,
            status: { not: "CANCELLED" },
          },
          select: {
            id: true,
            studentName: true,
            counsellorName: true,
            totalFee: true,
            paidAmount: true,
            amountStatus: true,
            revenueStatus: true,
            admissionDate: true,
            lead: {
              select: {
                assignedToName: true,
                leadDataset: { select: { assignedToUserId: true } },
              },
            },
          },
          orderBy: { admissionDate: "desc" },
          take: 3000,
        }),
        prisma.counsellingSession.findMany({
          where: {
            companyId,
            followUpAt: { lt: actionNow },
            status: { in: ["SCHEDULED", "FOLLOW_UP"] },
          },
          select: {
            id: true,
            leadId: true,
            studentName: true,
            counsellorName: true,
            followUpAt: true,
            status: true,
          },
          orderBy: { followUpAt: "asc" },
          take: 1000,
        }),
      ]);

    const visibleActionLeads = actionLeadRows.filter((lead) =>
      visibleToDashboardUser({
        record: lead,
        fieldName: "assignedToName",
        currentUser,
        visibleUserIds,
        visibleUserNames,
        includeUnassigned,
      })
    );

    const visibleActionAdmissions = actionAdmissionRows.filter((admission) =>
      visibleToDashboardUser({
        record: admission,
        fieldName: "counsellorName",
        currentUser,
        visibleUserIds,
        visibleUserNames,
        includeUnassigned,
      })
    );

    const visibleActionFollowUps = actionFollowUpRows.filter((session) => {
      if (currentUser.role === "CLIENT_ADMIN") return true;
      const normalized = normalizeName(session.counsellorName);
      if (normalized && visibleUserNames.has(normalized)) return true;
      return includeUnassigned && !normalized;
    });

    const actionLeadIds = visibleActionLeads.map((lead) => lead.id);
    const actionCommunications = actionLeadIds.length
      ? await prisma.leadCommunication.findMany({
          where: {
            companyId,
            leadId: { in: actionLeadIds },
          },
          select: {
            leadId: true,
            channel: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        })
      : [];

    const contactedLeadIds = new Set(
      actionCommunications.map((item) => item.leadId).filter(Boolean)
    );

    const hotLeadsNotContacted = visibleActionLeads.filter((lead) => {
      const freshStatus = normalizeName(lead.leadStatus) === "fresh";
      return (
        lead.temperature === "HOT" &&
        (lead.stage === "NEW" || freshStatus) &&
        !contactedLeadIds.has(lead.id)
      );
    });

    const pendingAdmissions = visibleActionAdmissions
      .map((admission) => ({
        ...admission,
        pendingAmount: Math.max(
          Number(admission.totalFee || 0) - Number(admission.paidAmount || 0),
          0
        ),
        ageDays: Math.max(
          0,
          Math.floor(
            (actionNow.getTime() - new Date(admission.admissionDate).getTime()) /
              86400000
          )
        ),
      }))
      .filter(
        (admission) =>
          admission.pendingAmount > 0 && admission.amountStatus !== "RECEIVED"
      );

    const revenueAtRiskAdmissions = pendingAdmissions.filter(
      (admission) =>
        admission.ageDays >= 30 ||
        (admission.revenueStatus === "BUFFER_ZONE" && admission.ageDays >= 60)
    );

    const revenueAtRiskAmount = revenueAtRiskAdmissions.reduce(
      (sum, admission) => sum + admission.pendingAmount,
      0
    );

    const whatsAppRepliesWaiting = actionCommunications.filter(
      (item) =>
        item.channel === "WHATSAPP_INBOUND" && item.status === "WAITING_REPLY"
    );

    const actionCenter = {
      generatedAt: actionNow,
      totalPrioritySignals:
        hotLeadsNotContacted.length +
        visibleActionFollowUps.length +
        pendingAdmissions.length +
        whatsAppRepliesWaiting.length +
        revenueAtRiskAdmissions.length,
      items: [
        {
          key: "hot-leads",
          label: "Hot leads not contacted",
          count: hotLeadsNotContacted.length,
          detail: "Hot leads still waiting for first tracked contact",
          tone: "rose",
        },
        {
          key: "overdue-followups",
          label: "Follow-ups overdue",
          count: visibleActionFollowUps.length,
          detail: "Counselling follow-ups past their scheduled time",
          tone: "amber",
        },
        {
          key: "pending-payments",
          label: "Payments pending",
          count: pendingAdmissions.length,
          amount: pendingAdmissions.reduce(
            (sum, admission) => sum + admission.pendingAmount,
            0
          ),
          detail: "Outstanding admission fee collections",
          tone: "amber",
        },
        {
          key: "whatsapp-replies",
          label: "WhatsApp replies waiting",
          count: whatsAppRepliesWaiting.length,
          detail: "Inbound WhatsApp messages waiting for a response",
          tone: "indigo",
        },
        {
          key: "revenue-risk",
          label: "Revenue at risk",
          count: revenueAtRiskAdmissions.length,
          amount: revenueAtRiskAmount,
          detail: "Pending revenue aged 30+ days or stuck in Buffer Zone",
          tone: "rose",
        },
      ],
    };

    const dashboardAccess = allowedDashboardSections(
      req.clientUser.pageAccess,
      req.clientUser.role
    );
    const canDashboard = (section) => dashboardAccess.includes(section);

    return res.json({
      success: true,
      selectedYear: selectedYear || "all",
      availableYears,
      dashboardScope: {
        role: currentUser.role,
        department: currentUser.department || null,
      },
      dashboardAccess,
      actionCenter: canDashboard("action-center")
        ? actionCenter
        : { items: [], totalPrioritySignals: 0 },
      summary: canDashboard("business-pulse")
        ? {
        totalLeads,
        newLeads,
        qualifiedLeads,
        totalAdmissions,
        potentialRevenue,
        receivedAmount,
        pendingAmount,
        currentProfit,
      }
        : {},
      revenueTrend: canDashboard("revenue-trend") ? revenueTrend : [],
      leadsBySource: canDashboard("leads-by-source") ? leadsBySource : [],
      teamPerformance: canDashboard("team-performance") ? teamPerformance : [],
      myPerformance: canDashboard("team-performance") ? myPerformance : null,
      recentAdmissions: canDashboard("recent-admissions") ? recentAdmissions : [],
      admissionsByMonth: canDashboard("admissions-by-month") ? admissionsByMonth : [],
      recentActivity: canDashboard("action-center") ? recentActivity : [],
    });
  } catch (error) {
    console.error("Failed to fetch dashboard:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load dashboard",
    });
  }
});

/* =========================================================
   DASHBOARD KPI DETAILS
   Lazy drill-down data for Business Pulse cards. The query mirrors the
   dashboard's role/year scope so every opened record set reconciles with the
   number shown on the card without making the main dashboard payload heavy.
========================================================= */

router.get("/dashboard/kpi/:key", async (req, res) => {
  try {
    if (!dashboardSectionAllowed(req.clientUser.pageAccess, req.clientUser.role, "business-pulse")) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to Dashboard Business Pulse",
      });
    }

    const companyId = req.clientUser.companyId;
    const userId = req.clientUser.userId;
    const selectedYear = parseYear(req.query.year);
    const key = String(req.params.key || "").trim();
    const allowedKeys = new Set([
      "total-leads",
      "qualified-leads",
      "new-leads",
      "admissions",
      "potential-revenue",
      "received-revenue",
      "pending-revenue",
      "current-profit",
    ]);

    if (!allowedKeys.has(key)) {
      return res.status(400).json({ success: false, message: "Unknown dashboard KPI" });
    }

    const access = await getDashboardAccessScope(companyId, userId);
    if (!access) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      currentUser,
      visibleUserIds,
      visibleUserNames,
    } = access;
    const includeUnassigned = currentUser.role === "MANAGER";

    const leadWhere = { companyId };
    const admissionWhere = { companyId };
    if (selectedYear) {
      leadWhere.createdAt = yearRange(selectedYear);
      admissionWhere.admissionDate = yearRange(selectedYear);
    }

    const [allLeads, allAdmissions, expenses, incentives, leadNumberMap] =
      await Promise.all([
        prisma.lead.findMany({
          where: leadWhere,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            source: true,
            stage: true,
            assignedToName: true,
            createdAt: true,
            leadDataset: { select: { assignedToUserId: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.admission.findMany({
          where: admissionWhere,
          select: {
            id: true,
            leadId: true,
            studentName: true,
            studentPhone: true,
            studentEmail: true,
            counsellorName: true,
            college: true,
            course: true,
            totalFee: true,
            paidAmount: true,
            status: true,
            admissionDate: true,
            lead: {
              select: {
                id: true,
                assignedToName: true,
                leadDataset: { select: { assignedToUserId: true } },
              },
            },
          },
          orderBy: { admissionDate: "desc" },
        }),
        prisma.expense.findMany({
          where: { companyId, status: "APPROVED" },
          select: { amount: true, createdAt: true },
        }),
        prisma.incentive.findMany({
          where: { companyId, status: { in: ["APPROVED", "PAID"] } },
          select: { amount: true, createdAt: true },
        }),
        getLeadNumberMap(companyId),
      ]);

    const visibleLead = (lead) =>
      visibleToDashboardUser({
        record: lead,
        fieldName: "assignedToName",
        currentUser,
        visibleUserIds,
        visibleUserNames,
        includeUnassigned,
      });

    const visibleAdmission = (admission) =>
      visibleToDashboardUser({
        record: admission,
        fieldName: "counsellorName",
        currentUser,
        visibleUserIds,
        visibleUserNames,
        includeUnassigned,
      });

    const leads = allLeads.filter(visibleLead);
    const admissions = allAdmissions.filter(visibleAdmission);
    const activeAdmissions = admissions.filter((admission) => admission.status !== "CANCELLED");

    const filteredExpenses = selectedYear
      ? expenses.filter((item) => new Date(item.createdAt).getFullYear() === selectedYear)
      : expenses;
    const filteredIncentives = selectedYear
      ? incentives.filter((item) => new Date(item.createdAt).getFullYear() === selectedYear)
      : incentives;

    const leadByContactKey = new Map();
    for (const lead of leads) {
      for (const contactKey of contactKeys({ phone: lead.phone, email: lead.email })) {
        if (!leadByContactKey.has(contactKey)) leadByContactKey.set(contactKey, lead);
      }
    }

    const admittedLeadIds = new Set();
    const directAdmissionKeys = new Set();
    const directAdmissionRows = [];

    for (const admission of activeAdmissions) {
      if (admission.leadId) {
        admittedLeadIds.add(admission.leadId);
        continue;
      }

      const keys = contactKeys({ phone: admission.studentPhone, email: admission.studentEmail });
      const matchedLead = keys.map((contactKey) => leadByContactKey.get(contactKey)).find(Boolean);
      if (matchedLead) {
        admittedLeadIds.add(matchedLead.id);
        continue;
      }

      const alreadyCounted = keys.length > 0 && keys.some((contactKey) => directAdmissionKeys.has(contactKey));
      if (alreadyCounted) continue;
      keys.forEach((contactKey) => directAdmissionKeys.add(contactKey));
      directAdmissionRows.push(admission);
    }

    const mapLead = (lead) => ({
      id: lead.id,
      leadId: lead.id,
      leadDisplayId: leadDisplayId(leadNumberMap.get(lead.id)),
      kind: "lead",
      primary: lead.name || "Unnamed lead",
      phone: lead.phone || null,
      email: lead.email || null,
      owner: lead.assignedToName || "Unassigned",
      status: lead.stage || "NEW",
      occurredAt: lead.createdAt,
      note: SOURCE_LABELS[lead.source] || lead.source || "Lead",
    });

    const mapAdmission = (admission, amount = null, note = null) => {
      const effectiveLeadId = admission.leadId || admission.lead?.id || null;
      return {
        id: admission.id,
        leadId: effectiveLeadId,
        leadDisplayId: effectiveLeadId
          ? leadDisplayId(leadNumberMap.get(effectiveLeadId))
          : null,
        kind: "admission",
        primary: admission.studentName || "Admission",
        phone: admission.studentPhone || null,
        email: admission.studentEmail || null,
        owner: admission.counsellorName || admission.lead?.assignedToName || "Unassigned",
        status: admission.status || "ONGOING",
        occurredAt: admission.admissionDate,
        ...(amount !== null ? { amount } : {}),
        note: note || [admission.college, admission.course].filter(Boolean).join(" · ") || "Admission",
      };
    };

    if (key === "total-leads" || key === "qualified-leads" || key === "new-leads") {
      let selectedLeads = leads;
      let label = "Total Leads";

      if (key === "qualified-leads") {
        label = "Qualified Leads";
        selectedLeads = leads.filter(
          (lead) => lead.stage === "QUALIFIED" || lead.stage === "ADMITTED"
        );
      } else if (key === "new-leads") {
        label = "New Leads";
        selectedLeads = leads.filter((lead) => lead.stage === "NEW");
      }

      const items = selectedLeads.map(mapLead);
      return res.json({ success: true, key, label, count: items.length, items });
    }

    if (key === "admissions") {
      const items = admissions.map((admission) => mapAdmission(admission));
      return res.json({ success: true, key, label: "Admissions", count: items.length, items });
    }

    const revenueItems = activeAdmissions.map((admission) => {
      const potential = Number(admission.totalFee || 0);
      const received = Number(admission.paidAmount || 0);
      const pending = Math.max(potential - received, 0);
      const amount =
        key === "potential-revenue" ? potential :
        key === "received-revenue" ? received : pending;
      return mapAdmission(admission, amount);
    });

    if (key === "potential-revenue" || key === "received-revenue" || key === "pending-revenue") {
      const filteredItems = key === "pending-revenue"
        ? revenueItems.filter((item) => Number(item.amount || 0) > 0)
        : revenueItems;
      const total = filteredItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const label =
        key === "potential-revenue" ? "Potential Revenue" :
        key === "received-revenue" ? "Received Revenue" : "Pending Revenue";

      return res.json({
        success: true,
        key,
        label,
        count: filteredItems.length,
        valueLabel: "Total",
        displayValue: `₹${total.toLocaleString("en-IN")}`,
        items: filteredItems,
      });
    }

    const receivedAmount = activeAdmissions.reduce(
      (sum, admission) => sum + Number(admission.paidAmount || 0),
      0
    );
    const approvedExpenses = currentUser.role === "CLIENT_ADMIN"
      ? filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
      : 0;
    const totalIncentives = currentUser.role === "CLIENT_ADMIN"
      ? filteredIncentives.reduce((sum, incentive) => sum + Number(incentive.amount || 0), 0)
      : 0;
    const currentProfit = currentUser.role === "CLIENT_ADMIN"
      ? receivedAmount - approvedExpenses - totalIncentives
      : 0;

    return res.json({
      success: true,
      key,
      label: "Current Profit",
      count: activeAdmissions.length,
      valueLabel: "Profit",
      displayValue: `₹${currentProfit.toLocaleString("en-IN")}`,
      breakdown: [
        { label: "Received Revenue", displayValue: `₹${receivedAmount.toLocaleString("en-IN")}` },
        { label: "Approved Expenses", displayValue: `₹${approvedExpenses.toLocaleString("en-IN")}` },
        { label: "Incentives", displayValue: `₹${totalIncentives.toLocaleString("en-IN")}` },
      ],
      items: activeAdmissions.map((admission) => mapAdmission(admission, Number(admission.paidAmount || 0))),
    });
  } catch (error) {
    console.error("Failed to fetch dashboard KPI details:", error);
    return res.status(500).json({ success: false, message: "Unable to load dashboard KPI details" });
  }
});


/* =========================================================
   ACTION CENTER DETAILS
   Loaded only when a dashboard priority card is opened so the
   main dashboard payload stays compact.
========================================================= */

router.get("/action-center/:key", async (req, res) => {
  try {
    if (!dashboardSectionAllowed(req.clientUser.pageAccess, req.clientUser.role, "action-center")) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to Dashboard Action Center",
      });
    }

    const companyId = req.clientUser.companyId;
    const userId = req.clientUser.userId;
    const key = String(req.params.key || "").trim();
    const allowedKeys = new Set([
      "hot-leads",
      "overdue-followups",
      "pending-payments",
      "whatsapp-replies",
      "revenue-risk",
    ]);

    if (!allowedKeys.has(key)) {
      return res.status(400).json({
        success: false,
        message: "Unknown Action Center item",
      });
    }

    const access = await getDashboardAccessScope(companyId, userId);

    if (!access) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const {
      currentUser,
      visibleUserIds,
      visibleUserNames,
    } = access;

    const includeUnassigned = currentUser.role === "MANAGER";
    const now = new Date();
    const leadNumberMap = await getLeadNumberMap(companyId);

    const visibleLead = (lead) =>
      visibleToDashboardUser({
        record: lead,
        fieldName: "assignedToName",
        currentUser,
        visibleUserIds,
        visibleUserNames,
        includeUnassigned,
      });

    const visibleAdmission = (admission) =>
      visibleToDashboardUser({
        record: admission,
        fieldName: "counsellorName",
        currentUser,
        visibleUserIds,
        visibleUserNames,
        includeUnassigned,
      });

    if (key === "hot-leads") {
      const leads = await prisma.lead.findMany({
        where: {
          companyId,
          stage: { notIn: ["ADMITTED", "LOST"] },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          stage: true,
          temperature: true,
          leadStatus: true,
          assignedToName: true,
          createdAt: true,
          leadDataset: { select: { assignedToUserId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 3000,
      });

      const visibleLeads = leads.filter(visibleLead);
      const leadIds = visibleLeads.map((lead) => lead.id);
      const communications = leadIds.length
        ? await prisma.leadCommunication.findMany({
            where: { companyId, leadId: { in: leadIds } },
            select: { leadId: true },
          })
        : [];
      const contactedLeadIds = new Set(
        communications.map((item) => item.leadId).filter(Boolean)
      );

      const items = visibleLeads
        .filter((lead) => {
          const freshStatus = normalizeName(lead.leadStatus) === "fresh";
          return (
            lead.temperature === "HOT" &&
            (lead.stage === "NEW" || freshStatus) &&
            !contactedLeadIds.has(lead.id)
          );
        })
        .map((lead) => ({
          id: lead.id,
          leadId: lead.id,
          leadDisplayId: leadDisplayId(leadNumberMap.get(lead.id)),
          kind: "lead",
          primary: lead.name || "Unnamed lead",
          phone: lead.phone || null,
          email: lead.email || null,
          owner: lead.assignedToName || "Unassigned",
          status: lead.stage || "NEW",
          occurredAt: lead.createdAt,
          note: "No tracked communication yet",
        }));

      return res.json({
        success: true,
        key,
        label: "Hot leads not contacted",
        count: items.length,
        items,
      });
    }

    if (key === "overdue-followups") {
      const sessions = await prisma.counsellingSession.findMany({
        where: {
          companyId,
          followUpAt: { lt: now },
          status: { in: ["SCHEDULED", "FOLLOW_UP"] },
        },
        select: {
          id: true,
          leadId: true,
          studentName: true,
          counsellorName: true,
          followUpAt: true,
          status: true,
        },
        orderBy: { followUpAt: "asc" },
        take: 1000,
      });

      const items = sessions
        .filter((session) => {
          if (currentUser.role === "CLIENT_ADMIN") return true;
          const normalized = normalizeName(session.counsellorName);
          if (normalized && visibleUserNames.has(normalized)) return true;
          return includeUnassigned && !normalized;
        })
        .map((session) => ({
          id: session.id,
          leadId: session.leadId || null,
          leadDisplayId: session.leadId
            ? leadDisplayId(leadNumberMap.get(session.leadId))
            : null,
          kind: "followup",
          primary: session.studentName || "Lead follow-up",
          owner: session.counsellorName || "Unassigned",
          status: session.status,
          occurredAt: session.followUpAt,
          note: "Follow-up time has passed",
        }));

      return res.json({
        success: true,
        key,
        label: "Follow-ups overdue",
        count: items.length,
        items,
      });
    }

    if (key === "pending-payments" || key === "revenue-risk") {
      const admissions = await prisma.admission.findMany({
        where: {
          companyId,
          status: { not: "CANCELLED" },
        },
        select: {
          id: true,
          leadId: true,
          studentName: true,
          studentPhone: true,
          studentEmail: true,
          counsellorName: true,
          totalFee: true,
          paidAmount: true,
          amountStatus: true,
          revenueStatus: true,
          admissionDate: true,
          lead: {
            select: {
              id: true,
              assignedToName: true,
              leadDataset: { select: { assignedToUserId: true } },
            },
          },
        },
        orderBy: { admissionDate: "asc" },
        take: 3000,
      });

      const pendingAdmissions = admissions
        .filter(visibleAdmission)
        .map((admission) => ({
          ...admission,
          pendingAmount: Math.max(
            Number(admission.totalFee || 0) - Number(admission.paidAmount || 0),
            0
          ),
          ageDays: Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(admission.admissionDate).getTime()) /
                86400000
            )
          ),
        }))
        .filter(
          (admission) =>
            admission.pendingAmount > 0 && admission.amountStatus !== "RECEIVED"
        );

      const selected =
        key === "revenue-risk"
          ? pendingAdmissions.filter(
              (admission) =>
                admission.ageDays >= 30 ||
                (admission.revenueStatus === "BUFFER_ZONE" &&
                  admission.ageDays >= 60)
            )
          : pendingAdmissions;

      const items = selected.map((admission) => ({
        id: admission.id,
        leadId: admission.leadId || admission.lead?.id || null,
        leadDisplayId: leadDisplayId(
          leadNumberMap.get(admission.leadId || admission.lead?.id)
        ),
        kind: key === "revenue-risk" ? "revenue" : "payment",
        primary: admission.studentName || "Admission",
        phone: admission.studentPhone || null,
        email: admission.studentEmail || null,
        owner:
          admission.counsellorName ||
          admission.lead?.assignedToName ||
          "Unassigned",
        status:
          key === "revenue-risk"
            ? admission.revenueStatus || "AT_RISK"
            : admission.amountStatus || "PENDING",
        occurredAt: admission.admissionDate,
        amount: admission.pendingAmount,
        totalFee: Number(admission.totalFee || 0),
        paidAmount: Number(admission.paidAmount || 0),
        ageDays: admission.ageDays,
        note:
          key === "revenue-risk"
            ? `${admission.ageDays} days with pending revenue`
            : "Admission fee still outstanding",
      }));

      return res.json({
        success: true,
        key,
        label:
          key === "revenue-risk" ? "Revenue at risk" : "Payments pending",
        count: items.length,
        amount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        items,
      });
    }

    const leads = await prisma.lead.findMany({
      where: {
        companyId,
        stage: { notIn: ["ADMITTED", "LOST"] },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        assignedToName: true,
        leadDataset: { select: { assignedToUserId: true } },
      },
      take: 3000,
    });

    const visibleLeads = leads.filter(visibleLead);
    const leadMap = new Map(visibleLeads.map((lead) => [lead.id, lead]));
    const leadIds = visibleLeads.map((lead) => lead.id);
    const communications = leadIds.length
      ? await prisma.leadCommunication.findMany({
          where: {
            companyId,
            leadId: { in: leadIds },
            channel: "WHATSAPP_INBOUND",
            status: "WAITING_REPLY",
          },
          select: {
            id: true,
            leadId: true,
            message: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
          take: 1000,
        })
      : [];

    const items = communications.map((communication) => {
      const lead = leadMap.get(communication.leadId);
      return {
        id: communication.id,
        leadId: communication.leadId || null,
        leadDisplayId: communication.leadId
          ? leadDisplayId(leadNumberMap.get(communication.leadId))
          : null,
        kind: "whatsapp",
        primary: lead?.name || "WhatsApp lead",
        phone: lead?.phone || null,
        email: lead?.email || null,
        owner: lead?.assignedToName || "Unassigned",
        status: "WAITING_REPLY",
        occurredAt: communication.createdAt,
        note:
          String(communication.message || "").trim().slice(0, 180) ||
          "Inbound WhatsApp message waiting for a response",
      };
    });

    return res.json({
      success: true,
      key,
      label: "WhatsApp replies waiting",
      count: items.length,
      items,
    });
  } catch (error) {
    console.error("Failed to fetch Action Center details:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load Action Center details",
    });
  }
});

/* =========================================================
   ANALYTICS
   The dedicated Analytics module still requires analytics access.
========================================================= */

router.get(
  "/",
  requireClientPermission(
    "canViewAnalytics",
    "You do not have permission to view analytics"
  ),
  async (req, res) => {
    try {
      const companyId = req.clientUser.companyId;
      const requestedYear = parseYear(req.query.year);
      const currentYear = new Date().getFullYear();

      const primaryYear = requestedYear || currentYear;
      const compareYear =
        parseYear(req.query.compareYear) || primaryYear - 1;

      async function buildYearAnalytics(year) {
        const leadWhere = {
          companyId,
          createdAt: yearRange(year),
        };

        const admissionWhere = {
          companyId,
          admissionDate: yearRange(year),
          status: { not: "CANCELLED" },
        };

        const [leads, admissions] = await Promise.all([
          prisma.lead.findMany({
            where: leadWhere,
            select: {
              id: true,
              source: true,
              stage: true,
              campaign: true,
              assignedToName: true,
              createdAt: true,
            },
          }),
          prisma.admission.findMany({
            where: admissionWhere,
            select: {
              id: true,
              leadId: true,
              counsellorName: true,
              totalFee: true,
              paidAmount: true,
              admissionDate: true,
            },
          }),
        ]);

        const totalLeads = leads.length;
        const totalAdmissions = admissions.length;

        const linkedAdmissions = admissions.filter((admission) =>
          Boolean(admission.leadId)
        ).length;

        const conversionRate =
          totalLeads > 0
            ? Number(
                (
                  (linkedAdmissions / totalLeads) *
                  100
                ).toFixed(1)
              )
            : 0;

        const potentialRevenue = admissions.reduce(
          (sum, admission) =>
            sum + Number(admission.totalFee || 0),
          0
        );

        const receivedAmount = admissions.reduce(
          (sum, admission) =>
            sum + Number(admission.paidAmount || 0),
          0
        );

        const pendingAmount = Math.max(
          potentialRevenue - receivedAmount,
          0
        );

        const sourceMap = {};

        for (const lead of leads) {
          const source =
            SOURCE_LABELS[lead.source] || lead.source;

          if (!sourceMap[source]) {
            sourceMap[source] = {
              name: source,
              leads: 0,
              admissions: 0,
            };
          }

          sourceMap[source].leads += 1;
        }

        const admissionLeadIds = new Set(
          admissions
            .map((admission) => admission.leadId)
            .filter(Boolean)
        );

        for (const lead of leads) {
          if (admissionLeadIds.has(lead.id)) {
            const source =
              SOURCE_LABELS[lead.source] || lead.source;

            if (!sourceMap[source]) {
              sourceMap[source] = {
                name: source,
                leads: 0,
                admissions: 0,
              };
            }

            sourceMap[source].admissions += 1;
          }
        }

        const sourceConversion = Object.values(
          sourceMap
        ).map((item) => ({
          ...item,
          conversion:
            item.leads > 0
              ? Number(
                  (
                    (item.admissions / item.leads) *
                    100
                  ).toFixed(1)
                )
              : 0,
        }));

        const stageMap = {};

        for (const lead of leads) {
          const stage =
            STAGE_LABELS[lead.stage] || lead.stage;
          stageMap[stage] =
            (stageMap[stage] || 0) + 1;
        }

        const leadsByStage = Object.entries(stageMap).map(
          ([name, value]) => ({ name, value })
        );

        const monthlyActivity = getYearMonths(year).map(
          (month) => {
            const key = monthKey(month);
            const monthAdmissions = admissions.filter(
              (admission) =>
                monthKey(
                  new Date(admission.admissionDate)
                ) === key
            );

            return {
              key,
              m: monthLabel(month),
              leads: leads.filter(
                (lead) =>
                  monthKey(new Date(lead.createdAt)) === key
              ).length,
              admissions: monthAdmissions.length,
              potential: monthAdmissions.reduce(
                (sum, admission) =>
                  sum + Number(admission.totalFee || 0),
                0
              ),
              received: monthAdmissions.reduce(
                (sum, admission) =>
                  sum + Number(admission.paidAmount || 0),
                0
              ),
            };
          }
        );

        const employeeMap = {};

        for (const lead of leads) {
          const name =
            lead.assignedToName || "Unassigned";

          if (!employeeMap[name]) {
            employeeMap[name] = {
              name,
              leads: 0,
              admissions: 0,
              revenue: 0,
            };
          }

          employeeMap[name].leads += 1;
        }

        for (const admission of admissions) {
          const name =
            admission.counsellorName || "Unassigned";

          if (!employeeMap[name]) {
            employeeMap[name] = {
              name,
              leads: 0,
              admissions: 0,
              revenue: 0,
            };
          }

          employeeMap[name].admissions += 1;
          employeeMap[name].revenue += Number(
            admission.paidAmount || 0
          );
        }

        const employeePerformance = Object.values(
          employeeMap
        ).sort(
          (a, b) => b.admissions - a.admissions
        );

        const campaignMap = {};

        for (const lead of leads) {
          const campaign =
            lead.campaign || "No Campaign";

          if (!campaignMap[campaign]) {
            campaignMap[campaign] = {
              campaign,
              leads: 0,
              admissions: 0,
            };
          }

          campaignMap[campaign].leads += 1;

          if (admissionLeadIds.has(lead.id)) {
            campaignMap[campaign].admissions += 1;
          }
        }

        const topCampaigns = Object.values(campaignMap)
          .map((item) => ({
            ...item,
            conversion:
              item.leads > 0
                ? Number(
                    (
                      (item.admissions / item.leads) *
                      100
                    ).toFixed(1)
                  )
                : 0,
          }))
          .sort(
            (a, b) => b.admissions - a.admissions
          )
          .slice(0, 10);

        return {
          year,
          summary: {
            totalLeads,
            totalAdmissions,
            conversionRate,
            potentialRevenue,
            receivedAmount,
            pendingAmount,
          },
          sourceConversion,
          leadsByStage,
          monthlyActivity,
          employeePerformance,
          topCampaigns,
        };
      }

      const [primary, comparison] = await Promise.all([
        buildYearAnalytics(primaryYear),
        buildYearAnalytics(compareYear),
      ]);

      const monthlyComparison = primary.monthlyActivity.map(
        (item, index) => ({
          m: item.m,
          primaryLeads: item.leads,
          compareLeads:
            comparison.monthlyActivity[index]?.leads || 0,
          primaryAdmissions: item.admissions,
          compareAdmissions:
            comparison.monthlyActivity[index]?.admissions || 0,
          primaryRevenue: item.received,
          compareRevenue:
            comparison.monthlyActivity[index]?.received || 0,
        })
      );

      const canComparison = insightsSectionAllowed(
        req.clientUser.pageAccess,
        req.clientUser.role,
        "comparison"
      );
      const canOverview = insightsSectionAllowed(
        req.clientUser.pageAccess,
        req.clientUser.role,
        "overview"
      );

      return res.json({
        success: true,
        selectedYear: requestedYear || "all",
        primaryYear,
        compareYear,
        // The comparison grant must not implicitly reveal Overview datasets.
        // Each payload is withheld independently, even for direct API calls.
        summary: canOverview ? primary.summary : {},
        sourceConversion: canOverview ? primary.sourceConversion : [],
        leadsByStage: canOverview ? primary.leadsByStage : [],
        monthlyActivity: canOverview ? primary.monthlyActivity : [],
        employeePerformance: canOverview ? primary.employeePerformance : [],
        topCampaigns: canOverview ? primary.topCampaigns : [],
        // Withhold the Comparison payload unless that section is granted.
        comparison: canComparison
          ? {
              primaryYear,
              compareYear,
              primary: primary.summary,
              compare: comparison.summary,
              monthly: monthlyComparison,
            }
          : null,
        allowedSections: {
          overview: canOverview,
          comparison: canComparison,
        },
      });
    } catch (error) {
      console.error("Failed to fetch analytics:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to load analytics",
      });
    }
  }
);

export default router;