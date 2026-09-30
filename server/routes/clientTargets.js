import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const LAUNCH_YEAR = 2026;
const LAUNCH_MONTH = 9; // September

const DEFAULT_DEPARTMENT_NAMES = ["Admin", "Sales"];

async function loadConfiguredDepartmentMap(companyId) {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { organizationConfig: true },
  });

  const configured = Array.isArray(settings?.organizationConfig?.departments)
    ? settings.organizationConfig.departments
    : [];

  const names = [
    ...DEFAULT_DEPARTMENT_NAMES,
    ...configured
      .map((item) => String(item?.name || "").trim())
      .filter(Boolean),
  ];

  return new Map(names.map((name) => [name.toLowerCase(), name]));
}

function canonicalDepartmentName(departmentMap, value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return departmentMap.get(raw.toLowerCase()) || null;
}

function startMonthFor(year) {
  return 1;
}

// Business weeks: ceil(daysInMonth / 7) → always 4 or 5.
function weeksInMonth(year, month /* 1-12 */) {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.ceil(daysInMonth / 7);
}

function pctOf(a, t) {
  if (!t || t <= 0) return 0;
  return Math.round((a / t) * 100);
}

function normalize(arr, len) {
  const out = [];
  for (let i = 0; i < len; i += 1) out.push(Math.max(0, Number(arr?.[i] || 0)));
  return out;
}

// Build the full computed row.
function computeRow(row, year, month) {
  const totalWeeks = weeksInMonth(year, month);
  const wt = normalize(row?.weekTarget || [], totalWeeks);
  const wa = normalize(row?.weekAchieved || [], totalWeeks);

  const weeks = [];
  for (let i = 0; i < totalWeeks; i += 1) {
    weeks.push({
      week: i + 1,
      target: wt[i],
      achieved: wa[i],
      percent: pctOf(wa[i], wt[i]), // week % = achieved / that week's target
    });
  }

  const monthlyTarget = Number(row?.monthlyTarget || 0); // admin-set directly
  const totalAchieved = wa.reduce((s, x) => s + x, 0);
  // Overall % = total achieved / typed monthly target (paper rule → 110%, 75%).
  const overallPercent = pctOf(totalAchieved, monthlyTarget);

  return { totalWeeks, weeks, monthlyTarget, totalAchieved, overallPercent };
}

function formatRow(row, year, month) {
  const c = computeRow(row, year, month);
  return {
    id: row?.id || null,
    year,
    month,
    monthlyTarget: c.monthlyTarget,
    totalAchieved: c.totalAchieved,
    weeks: c.weeks,
    overallPercent: c.overallPercent,
  };
}

// Team access + scope.
//   CLIENT_ADMIN                -> allowed, sees everyone (managerScope = null)
//   MANAGER                     -> allowed, sees only their own reports (managerScope = their id)
//   canViewTeamTargets granted  -> allowed, sees everyone (managerScope = null)
//   otherwise                   -> not allowed
async function getTeamAccess(req) {
  const actor = await prisma.user.findUnique({
    where: { id: req.clientUser.userId },
    select: { id: true, role: true, active: true, companyId: true, canViewTeamTargets: true },
  });
  if (!actor || !actor.active || actor.companyId !== req.clientUser.companyId) {
    return { allowed: false, managerScope: null };
  }
  if (actor.role === "CLIENT_ADMIN") return { allowed: true, managerScope: null };
  if (actor.role === "MANAGER") return { allowed: true, managerScope: actor.id };
  if (actor.canViewTeamTargets) return { allowed: true, managerScope: null };
  return { allowed: false, managerScope: null };
}

/* ------------------------------------------------------------------ */
/* GET /me?year=YYYY                                                    */
/* ------------------------------------------------------------------ */

router.get("/me", async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const rows = await prisma.monthlyTarget.findMany({
      where: {
        companyId: req.clientUser.companyId,
        ownerId: req.clientUser.userId,
        year,
      },
    });
    const byMonth = new Map(rows.map((r) => [r.month, r]));
    const months = [];
    for (let m = startMonthFor(year); m <= 12; m += 1) {
      months.push(formatRow(byMonth.get(m) || null, year, m));
    }
    return res.json({ success: true, year, months });
  } catch (error) {
    console.error("Failed to load my targets:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load targets" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /me/achieved — employee updates one week's achieved            */
/* Body: { year, month, week, value }                                  */
/* ------------------------------------------------------------------ */

router.patch("/me/achieved", async (req, res) => {
  try {
    const year = Number(req.body?.year);
    const month = Number(req.body?.month);
    const week = Number(req.body?.week);
    const value = Math.max(0, Number(req.body?.value) || 0);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(week) ||
      week < 1
    ) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    const totalWeeks = weeksInMonth(year, month);
    if (week > totalWeeks) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid week for this month" });
    }

    // CA-021: reject achieved values for a week that hasn't started yet.
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    const weekStartDay = (week - 1) * 7 + 1;
    const isFuture =
      year > cy ||
      (year === cy && month > cm) ||
      (year === cy && month === cm && weekStartDay > now.getDate());
    if (isFuture) {
      return res.status(400).json({
        success: false,
        message: "You can't record achievements for a week that hasn't started.",
      });
    }

    const key = {
      companyId_ownerId_year_month: {
        companyId: req.clientUser.companyId,
        ownerId: req.clientUser.userId,
        year,
        month,
      },
    };

    const existing = await prisma.monthlyTarget.findUnique({ where: key });
    const wa = normalize(existing?.weekAchieved || [], totalWeeks);
    wa[week - 1] = value;

    const row = await prisma.monthlyTarget.upsert({
      where: key,
      update: { weekAchieved: wa },
      create: {
        companyId: req.clientUser.companyId,
        ownerId: req.clientUser.userId,
        year,
        month,
        monthlyTarget: Number(existing?.monthlyTarget || 0),
        weekTarget: normalize(existing?.weekTarget || [], totalWeeks),
        weekAchieved: wa,
      },
    });

    return res.json({ success: true, target: formatRow(row, year, month) });
  } catch (error) {
    console.error("Failed to update achieved:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update achieved" });
  }
});

/* ------------------------------------------------------------------ */
/* PATCH /target — admin sets one week's target                        */
/* Body: { ownerId, year, month, week, value }                         */
/* ------------------------------------------------------------------ */

router.patch("/target", async (req, res) => {
  try {
    const access = await getTeamAccess(req);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to set targets",
      });
    }

    const ownerId = String(req.body?.ownerId || "");
    const year = Number(req.body?.year);
    const month = Number(req.body?.month);
    const value = Math.max(0, Number(req.body?.value) || 0);
    // Either a week target (scope="week", needs week) or the monthly target
    // (scope="monthly").
    const scope = req.body?.scope === "monthly" ? "monthly" : "week";
    const week = Number(req.body?.week);

    if (
      !ownerId ||
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({ success: false, message: "Invalid input" });
    }

    const totalWeeks = weeksInMonth(year, month);

    if (scope === "week") {
      if (!Number.isInteger(week) || week < 1 || week > totalWeeks) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid week for this month" });
      }
    }

    if (access.managerScope && ownerId !== access.managerScope) {
      return res.status(403).json({
        success: false,
        message: "Managers can only update their own target until reporting-manager mapping is configured",
      });
    }

    const owner = await prisma.user.findFirst({
      where: {
        id: ownerId,
        companyId: req.clientUser.companyId,
        active: true,
      },
      select: { id: true },
    });
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const key = {
      companyId_ownerId_year_month: {
        companyId: req.clientUser.companyId,
        ownerId,
        year,
        month,
      },
    };

    const existing = await prisma.monthlyTarget.findUnique({ where: key });
    const wt = normalize(existing?.weekTarget || [], totalWeeks);
    const wa = normalize(existing?.weekAchieved || [], totalWeeks);
    let monthlyTarget = Number(existing?.monthlyTarget || 0);

    if (scope === "week") {
      wt[week - 1] = value;
    } else {
      monthlyTarget = value;
    }

    const row = await prisma.monthlyTarget.upsert({
      where: key,
      update: {
        weekTarget: wt,
        monthlyTarget,
        setByUserId: req.clientUser.userId,
      },
      create: {
        companyId: req.clientUser.companyId,
        ownerId,
        year,
        month,
        monthlyTarget,
        weekTarget: wt,
        weekAchieved: wa,
        setByUserId: req.clientUser.userId,
      },
    });

    return res.json({ success: true, target: formatRow(row, year, month) });
  } catch (error) {
    console.error("Failed to set target:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to set target" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /team?year=YYYY                                                  */
/* ------------------------------------------------------------------ */

router.get("/team", async (req, res) => {
  try {
    const access = await getTeamAccess(req);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view team targets",
      });
    }

    const year = Number(req.query.year) || new Date().getFullYear();

    const users = await prisma.user.findMany({
      where: {
        companyId: req.clientUser.companyId,
        active: true,
        // Current User schema does not contain managerId/reporting relations.
        // Admin/permitted users see the company. Managers are safely scoped
        // to their own row until reporting-manager mapping is added to Prisma.
        ...(access.managerScope ? { id: access.managerScope } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        department: true,
        role: true,
        customRoleName: true,
      },
      orderBy: { name: "asc" },
    });

    const [rows, departmentMap] = await Promise.all([
      prisma.monthlyTarget.findMany({
        where: { companyId: req.clientUser.companyId, year },
      }),
      loadConfiguredDepartmentMap(req.clientUser.companyId),
    ]);

    const byOwner = new Map();
    rows.forEach((r) => {
      if (!byOwner.has(r.ownerId)) byOwner.set(r.ownerId, []);
      byOwner.get(r.ownerId).push(r);
    });

    const roster = users.map((u) => {
      const owned = byOwner.get(u.id) || [];
      const monthOveralls = owned
        .map((r) => computeRow(r, year, r.month))
        .filter((c) => c.monthlyTarget > 0)
        .map((c) => c.overallPercent);
      const avg =
        monthOveralls.length > 0
          ? Math.round(
              monthOveralls.reduce((a, b) => a + b, 0) / monthOveralls.length
            )
          : 0;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        jobTitle: u.jobTitle,
        department: canonicalDepartmentName(departmentMap, u.department),
        role: u.role,
        roleLabel:
          String(u.customRoleName || "").trim() ||
          (u.role === "CLIENT_ADMIN"
            ? "Client Admin"
            : u.role === "MANAGER"
              ? "Manager"
              : "Employee"),
        managerId: null,
        managerName: null,
        yearAveragePercent: avg,
        monthsWithData: monthOveralls.length,
      };
    });

    const teamAverage =
      roster.length > 0
        ? Math.round(
            roster.reduce((a, r) => a + r.yearAveragePercent, 0) /
              roster.length
          )
        : 0;

    return res.json({ success: true, year, teamAverage, roster });
  } catch (error) {
    console.error("Failed to load team targets:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load team targets" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /user/:userId?year=YYYY                                          */
/* ------------------------------------------------------------------ */

router.get("/user/:userId", async (req, res) => {
  try {
    const access = await getTeamAccess(req);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this",
      });
    }

    if (access.managerScope && req.params.userId !== access.managerScope) {
      return res.status(403).json({
        success: false,
        message: "Managers can only view their own target until reporting-manager mapping is configured",
      });
    }

    const owner = await prisma.user.findFirst({
      where: {
        id: req.params.userId,
        companyId: req.clientUser.companyId,
      },
      select: { id: true, name: true, email: true, jobTitle: true },
    });
    if (!owner) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const year = Number(req.query.year) || new Date().getFullYear();
    const rows = await prisma.monthlyTarget.findMany({
      where: {
        companyId: req.clientUser.companyId,
        ownerId: owner.id,
        year,
      },
    });

    const byMonth = new Map(rows.map((r) => [r.month, r]));
    const months = [];
    for (let m = startMonthFor(year); m <= 12; m += 1) {
      months.push(formatRow(byMonth.get(m) || null, year, m));
    }

    return res.json({ success: true, owner, year, months });
  } catch (error) {
    console.error("Failed to load user targets:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load user targets" });
  }
});

/* ------------------------------------------------------------------ */
/* GET /all?years=2026,2027 — admin/permitted: every employee x months  */
/* Returns each employee with their months for each requested year.     */
/* ------------------------------------------------------------------ */

router.get("/all", async (req, res) => {
  try {
    const access = await getTeamAccess(req);
    if (!access.allowed) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this",
      });
    }

    // years query: "2026" or "2026,2027". Default current/launch year.
    const yearsRaw = String(req.query.years || "").trim();
    let years = yearsRaw
      ? yearsRaw.split(",").map((y) => Number(y)).filter((y) => Number.isInteger(y))
      : [Math.max(LAUNCH_YEAR, new Date().getFullYear())];
    years = Array.from(new Set(years)).sort((a, b) => a - b);
    if (years.length === 0) {
      years = [Math.max(LAUNCH_YEAR, new Date().getFullYear())];
    }

    const users = await prisma.user.findMany({
      where: {
        companyId: req.clientUser.companyId,
        active: true,
        ...(access.managerScope ? { id: access.managerScope } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        department: true,
        role: true,
        customRoleName: true,
      },
      orderBy: { name: "asc" },
    });

    const [rows, departmentMap] = await Promise.all([
      prisma.monthlyTarget.findMany({
        where: {
          companyId: req.clientUser.companyId,
          year: { in: years },
        },
      }),
      loadConfiguredDepartmentMap(req.clientUser.companyId),
    ]);

    // Index rows by owner+year+month.
    const key = (o, y, m) => `${o}|${y}|${m}`;
    const byKey = new Map(rows.map((r) => [key(r.ownerId, r.year, r.month), r]));

    const employees = users.map((u) => {
      const months = [];
      years.forEach((y) => {
        for (let m = startMonthFor(y); m <= 12; m += 1) {
          const r = byKey.get(key(u.id, y, m)) || null;
          months.push(formatRow(r, y, m));
        }
      });
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        jobTitle: u.jobTitle,
        department: canonicalDepartmentName(departmentMap, u.department),
        role: u.role,
        roleLabel:
          String(u.customRoleName || "").trim() ||
          (u.role === "CLIENT_ADMIN"
            ? "Client Admin"
            : u.role === "MANAGER"
              ? "Manager"
              : "Employee"),
        months,
      };
    });

    return res.json({ success: true, years, employees });
  } catch (error) {
    console.error("Failed to load all targets:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load all targets" });
  }
});

export default router;