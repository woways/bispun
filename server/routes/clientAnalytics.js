import { Router } from "express";

import prisma from "../lib/prisma.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";

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

/* =========================================================
   DASHBOARD
   Accessible to every authenticated client user. Data is scoped
   by role so employees do not require canViewAnalytics.
========================================================= */

router.get("/dashboard", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const userId = req.clientUser.userId;
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
    const admissionWhere = {
      companyId,
      status: { not: "CANCELLED" },
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

    for (const admission of admissions) {
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

    const totalLeads = leads.length + directAdmissionLeadCount;
    const newLeads = leads.filter(
      (lead) => lead.stage === "NEW"
    ).length;
    const qualifiedLeads =
      leads.filter(
        (lead) =>
          lead.stage === "QUALIFIED" ||
          lead.stage === "ADMITTED" ||
          admittedLeadIds.has(lead.id)
      ).length + directAdmissionLeadCount;
    const totalAdmissions = admissions.length;

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

    const revenueTrend =
      currentUser.role === "CLIENT_ADMIN"
        ? months.map((month) => {
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
          })
        : [];

    const sourceCounts = {};

    for (const lead of leads) {
      const source =
        SOURCE_LABELS[lead.source] || lead.source;
      sourceCounts[source] =
        (sourceCounts[source] || 0) + 1;
    }

    const leadsBySource = Object.entries(sourceCounts).map(
      ([name, value]) => ({ name, value })
    );

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

    for (const admission of admissions) {
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

    return res.json({
      success: true,
      selectedYear: selectedYear || "all",
      availableYears,
      dashboardScope: {
        role: currentUser.role,
        department: currentUser.department || null,
      },
      summary: {
        totalLeads,
        newLeads,
        qualifiedLeads,
        totalAdmissions,
        potentialRevenue,
        receivedAmount,
        pendingAmount,
        currentProfit,
      },
      revenueTrend,
      leadsBySource,
      teamPerformance,
      myPerformance,
      recentAdmissions,
      admissionsByMonth,
      recentActivity,
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

      return res.json({
        success: true,
        selectedYear: requestedYear || "all",
        primaryYear,
        compareYear,
        summary: primary.summary,
        sourceConversion: primary.sourceConversion,
        leadsByStage: primary.leadsByStage,
        monthlyActivity: primary.monthlyActivity,
        employeePerformance: primary.employeePerformance,
        topCampaigns: primary.topCampaigns,
        comparison: {
          primaryYear,
          compareYear,
          primary: primary.summary,
          compare: comparison.summary,
          monthly: monthlyComparison,
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