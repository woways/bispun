import { Router } from "express";
import bcrypt from "bcryptjs";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";
import { writeAuditLog } from "../lib/auditLog.js";
import {
  normalizePageAccess,
  fullPageAccess,
  clampPageAccessToActor,
} from "../lib/pageAccess.js";

const router = Router();

router.use(requireClientUser);

/* ------------------------------------------------------------------ *
 * Manager reporting-hierarchy scoping.
 * Admin manages everyone; a manager manages only the EMPLOYEEs beneath them
 * in the managerId chain. Only an admin can edit another manager.
 * ------------------------------------------------------------------ */
async function reportsSubtreeIds(companyId, rootId) {
  const rows = await prisma.user.findMany({
    where: { companyId },
    select: { id: true, managerId: true },
  });
  const childrenByManager = new Map();
  for (const row of rows) {
    if (!row.managerId) continue;
    if (!childrenByManager.has(row.managerId)) childrenByManager.set(row.managerId, []);
    childrenByManager.get(row.managerId).push(row.id);
  }
  const out = new Set();
  const queue = [...(childrenByManager.get(rootId) || [])];
  while (queue.length) {
    const id = queue.shift();
    if (out.has(id)) continue;
    out.add(id);
    for (const child of childrenByManager.get(id) || []) queue.push(child);
  }
  return out;
}

function actorAccessSpec(actor) {
  return actor.role === "CLIENT_ADMIN"
    ? fullPageAccess()
    : normalizePageAccess(actor.pageAccess);
}

/** Can `actor` view/manage `target`? (target already guaranteed non-super.) */
function canManageTarget(actor, target, subtreeIds) {
  if (actor.id === target.id) return actor.role === "CLIENT_ADMIN";
  if (actor.role === "CLIENT_ADMIN") return true;
  // Managers: only EMPLOYEEs within their own reporting subtree.
  return target.role === "EMPLOYEE" && subtreeIds.has(target.id);
}

const ALLOWED_ROLES = [
  "CLIENT_ADMIN",
  "MANAGER",
  "EMPLOYEE",
];

const PERMISSION_KEYS = [
  "canManageUsers",
  "canManageSettings",
  "canManageBilling",
  "canViewAnalytics",
  "canManageAdmissions",
  "canManageRevenue",
  "canManageLeads",
  "canManageSupport",
  "canViewTeamTargets",
];


const DEFAULT_DEPARTMENTS = [
  {
    id: "admin",
    name: "Admin",
    code: "ADM",
    system: true,
    permissions: {
      canManageUsers: true,
      canManageSettings: true,
      canManageBilling: true,
      canViewAnalytics: true,
      canManageAdmissions: true,
      canManageRevenue: true,
      canManageLeads: true,
      canManageSupport: true,
      canViewTeamTargets: true,
    },
  },
  {
    id: "sales",
    name: "Sales",
    code: "SAL",
    system: true,
    permissions: {
      canManageUsers: false,
      canManageSettings: false,
      canManageBilling: false,
      canViewAnalytics: true,
      canManageAdmissions: true,
      canManageRevenue: false,
      canManageLeads: true,
      canManageSupport: true,
      canViewTeamTargets: true,
    },
  },
];

function cleanCode(value, fallback = "GEN") {
  const code = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  return code || fallback;
}

function normalizePermissions(source = {}) {
  return Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, source?.[key] === true])
  );
}

function normalizeOrganizationConfig(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const customDepartments = Array.isArray(source.departments) ? source.departments : [];
  const departments = [...DEFAULT_DEPARTMENTS];
  for (const item of customDepartments) {
    if (!item?.id || DEFAULT_DEPARTMENTS.some((base) => base.id === item.id)) continue;
    departments.push({
      id: String(item.id),
      name: String(item.name || "Department"),
      code: cleanCode(item.code, "DEP"),
      system: false,
      permissions: normalizePermissions(item.permissions),
    });
  }
  const roles = (Array.isArray(source.roles) ? source.roles : []).map((item) => ({
    id: String(item.id),
    name: String(item.name || "Custom Role"),
    code: cleanCode(item.code, "ROL"),
    baseRole: ALLOWED_ROLES.includes(String(item.baseRole || "EMPLOYEE").toUpperCase())
      ? String(item.baseRole).toUpperCase()
      : "EMPLOYEE",
    permissions: normalizePermissions(item.permissions),
  }));
  return { departments, roles };
}

async function loadOrganizationConfig(companyId) {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { organizationConfig: true },
  });
  return normalizeOrganizationConfig(settings?.organizationConfig);
}

function canonicalDepartmentName(organization, value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = organization.departments.find(
    (item) => item.name.toLowerCase() === raw.toLowerCase()
  );

  return match?.name || null;
}

async function saveOrganizationConfig(companyId, config) {
  const customDepartments = config.departments
    .filter((item) => !item.system)
    .map(({ system, ...item }) => item);
  const organizationConfig = {
    departments: customDepartments,
    roles: config.roles,
  };
  await prisma.companySettings.upsert({
    where: { companyId },
    create: { companyId, organizationConfig },
    update: { organizationConfig },
  });
  return normalizeOrganizationConfig(organizationConfig);
}

function slugId(prefix, name) {
  const slug = String(name || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30) || "item";
  return `${prefix}-${slug}-${Date.now().toString(36)}`;
}

async function generateEmployeeId(companyId, departmentCode, roleCode) {
  const year = String(new Date().getFullYear()).slice(-2);
  const prefix = `${year}${cleanCode(departmentCode, "GEN")}${cleanCode(roleCode, "EMP")}`;
  const existing = await prisma.user.findMany({
    where: { companyId, employeeId: { startsWith: year } },
    select: { employeeId: true },
  });
  let maxSerial = 0;
  for (const item of existing) {
    const match = String(item.employeeId || "").match(/(\d{3,})$/);
    if (match) maxSerial = Math.max(maxSerial, Number(match[1]) || 0);
  }
  return `${prefix}${String(maxSerial + 1).padStart(3, "0")}`;
}

function defaultPermissions(role) {
  if (role === "CLIENT_ADMIN") {
    return {
      canManageUsers: true,
      canManageSettings: true,
      canManageBilling: true,
      canViewAnalytics: true,
      canManageAdmissions: true,
      canManageRevenue: true,
      canManageLeads: true,
      canManageSupport: true,
      canViewTeamTargets: true,
    };
  }

  if (role === "MANAGER") {
    return {
      canManageUsers: false,
      canManageSettings: false,
      canManageBilling: false,
      canViewAnalytics: true,
      canManageAdmissions: true,
      canManageRevenue: true,
      canManageLeads: true,
      canManageSupport: true,
      canViewTeamTargets: true,
    };
  }

  return {
    canManageUsers: false,
    canManageSettings: false,
    canManageBilling: false,
    canViewAnalytics: false,
    canManageAdmissions: false,
    canManageRevenue: false,
    canManageLeads: true,
    canManageSupport: true,
    canViewTeamTargets: false,
  };
}

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    phone: user.phone,
    jobTitle: user.jobTitle,
    department: user.department,
    employeeId: user.employeeId,
    customRoleId: user.customRoleId,
    customRoleName: user.customRoleName,
    managerId: user.managerId ?? null,
    managerName: user.manager?.name ?? null,
    permissions: {
      canManageUsers:
        user.role === "CLIENT_ADMIN" ||
        user.canManageUsers,
      canManageSettings:
        user.role === "CLIENT_ADMIN" ||
        user.canManageSettings,
      canManageBilling:
        user.role === "CLIENT_ADMIN" ||
        user.canManageBilling,
      canViewAnalytics:
        user.role === "CLIENT_ADMIN" ||
        user.canViewAnalytics,
      canManageAdmissions:
        user.role === "CLIENT_ADMIN" ||
        user.canManageAdmissions,
      canManageRevenue:
        user.role === "CLIENT_ADMIN" ||
        user.canManageRevenue,
      canManageLeads:
        user.role === "CLIENT_ADMIN" ||
        user.canManageLeads,
      canManageSupport:
        user.role === "CLIENT_ADMIN" ||
        user.canManageSupport,
      canViewTeamTargets:
        user.role === "CLIENT_ADMIN" ||
        user.canViewTeamTargets,
    },
    pageAccess:
      user.role === "CLIENT_ADMIN"
        ? fullPageAccess()
        : normalizePageAccess(user.pageAccess),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

async function getActor(req) {
  return prisma.user.findUnique({
    where: {
      id: req.clientUser.userId,
    },
  });
}

async function requireUserManager(req, res) {
  const actor = await getActor(req);

  if (
    !actor ||
    !actor.active ||
    actor.companyId !==
      req.clientUser.companyId
  ) {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return null;
  }

  if (
    actor.role !== "CLIENT_ADMIN" &&
    !actor.canManageUsers
  ) {
    res.status(403).json({
      success: false,
      message:
        "You do not have permission to manage users",
    });
    return null;
  }

  return actor;
}

function buildPermissionData(
  role,
  source = {}
) {
  if (role === "CLIENT_ADMIN") {
    return defaultPermissions(role);
  }

  const defaults =
    defaultPermissions(role);

  const result = {};

  for (const key of PERMISSION_KEYS) {
    result[key] =
      typeof source[key] ===
      "boolean"
        ? source[key]
        : defaults[key];
  }

  return result;
}


router.get("/organization", async (req, res) => {
  try {
    const organization = await loadOrganizationConfig(req.clientUser.companyId);
    return res.json({ success: true, ...organization });
  } catch (error) {
    console.error("Load organization config failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load departments and roles" });
  }
});

/**
 * Live permission tree for the Users & Roles editor:
 *   Market -> Stream -> College(Partner) -> Branch, plus finance/insights sections.
 * Colleges/branches are read live, so newly-added ones appear automatically.
 * Returns the actor's own pageAccess so the UI can prevent a manager granting
 * beyond their own scope (also clamped server-side on save).
 */
router.get("/permission-tree", async (req, res) => {
  try {
    const actor = await requireUserManager(req, res);
    if (!actor) return;

    const companyId = req.clientUser.companyId;

    const streams = await prisma.admissionStream.findMany({
      where: { companyId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        partners: {
          where: { active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            branches: {
              where: { active: true },
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const MARKET_LABELS = { DOMESTIC: "Domestic", INTERNATIONAL: "International" };
    const markets = ["DOMESTIC", "INTERNATIONAL"].map((key) => ({
      key,
      label: MARKET_LABELS[key],
      streams: streams
        .filter((s) => s.market === key)
        .map((s) => ({
          id: s.id,
          name: s.name,
          colleges: s.partners.map((p) => ({
            id: p.id,
            name: p.name,
            branches: p.branches.map((b) => ({ id: b.id, name: b.name })),
          })),
        })),
    }));

    return res.json({
      success: true,
      tree: {
        markets,
        finance: { sections: ["overview", "expenses", "incentives"] },
        insights: { sections: ["overview", "comparison"] },
      },
      actorPageAccess: actorAccessSpec(actor),
      actorRole: actor.role,
    });
  } catch (error) {
    console.error("Load permission tree failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load permission tree" });
  }
});

router.post("/departments", async (req, res) => {
  try {
    const actor = await requireUserManager(req, res);
    if (!actor) return;
    if (actor.role !== "CLIENT_ADMIN") {
      return res.status(403).json({ success: false, message: "Only Client Admin can create departments" });
    }
    const name = String(req.body?.name || "").trim();
    const code = cleanCode(req.body?.code, "DEP");
    if (!name) return res.status(400).json({ success: false, message: "Department name is required" });
    const config = await loadOrganizationConfig(req.clientUser.companyId);
    if (config.departments.some((item) => item.name.toLowerCase() === name.toLowerCase() || item.code === code)) {
      return res.status(409).json({ success: false, message: "Department name or code already exists" });
    }
    config.departments.push({
      id: slugId("dept", name), name, code, system: false,
      permissions: normalizePermissions(req.body?.permissions),
    });
    const organization = await saveOrganizationConfig(req.clientUser.companyId, config);
    return res.status(201).json({ success: true, ...organization });
  } catch (error) {
    console.error("Create department failed:", error);
    return res.status(500).json({ success: false, message: "Unable to create department" });
  }
});

router.delete("/departments/:departmentId", async (req, res) => {
  try {
    const actor = await requireUserManager(req, res);
    if (!actor) return;
    if (actor.role !== "CLIENT_ADMIN") return res.status(403).json({ success: false, message: "Only Client Admin can remove departments" });
    const config = await loadOrganizationConfig(req.clientUser.companyId);
    const target = config.departments.find((item) => item.id === req.params.departmentId);
    if (!target || target.system) return res.status(400).json({ success: false, message: "Default departments cannot be removed" });
    const inUse = await prisma.user.count({ where: { companyId: req.clientUser.companyId, department: target.name } });
    if (inUse) return res.status(409).json({ success: false, message: "Move employees out of this department before deleting it" });
    config.departments = config.departments.filter((item) => item.id !== target.id);
    const organization = await saveOrganizationConfig(req.clientUser.companyId, config);
    return res.json({ success: true, ...organization });
  } catch (error) {
    console.error("Delete department failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete department" });
  }
});

router.post("/roles", async (req, res) => {
  try {
    const actor = await requireUserManager(req, res);
    if (!actor) return;
    if (actor.role !== "CLIENT_ADMIN") return res.status(403).json({ success: false, message: "Only Client Admin can create roles" });
    const name = String(req.body?.name || "").trim();
    const code = cleanCode(req.body?.code, "ROL");
    const baseRole = String(req.body?.baseRole || "EMPLOYEE").toUpperCase();
    if (!name) return res.status(400).json({ success: false, message: "Role name is required" });
    if (!ALLOWED_ROLES.includes(baseRole) || baseRole === "CLIENT_ADMIN") return res.status(400).json({ success: false, message: "Custom roles can use Employee or Manager as the base access level" });
    const config = await loadOrganizationConfig(req.clientUser.companyId);
    if (config.roles.some((item) => item.name.toLowerCase() === name.toLowerCase() || item.code === code)) {
      return res.status(409).json({ success: false, message: "Role name or code already exists" });
    }
    config.roles.push({ id: slugId("role", name), name, code, baseRole, permissions: normalizePermissions(req.body?.permissions) });
    const organization = await saveOrganizationConfig(req.clientUser.companyId, config);
    return res.status(201).json({ success: true, ...organization });
  } catch (error) {
    console.error("Create custom role failed:", error);
    return res.status(500).json({ success: false, message: "Unable to create role" });
  }
});

router.delete("/roles/:roleId", async (req, res) => {
  try {
    const actor = await requireUserManager(req, res);
    if (!actor) return;
    if (actor.role !== "CLIENT_ADMIN") return res.status(403).json({ success: false, message: "Only Client Admin can remove roles" });
    const config = await loadOrganizationConfig(req.clientUser.companyId);
    const target = config.roles.find((item) => item.id === req.params.roleId);
    if (!target) return res.status(404).json({ success: false, message: "Role not found" });
    const inUse = await prisma.user.count({ where: { companyId: req.clientUser.companyId, customRoleId: target.id } });
    if (inUse) return res.status(409).json({ success: false, message: "Reassign employees using this role before deleting it" });
    config.roles = config.roles.filter((item) => item.id !== target.id);
    const organization = await saveOrganizationConfig(req.clientUser.companyId, config);
    return res.json({ success: true, ...organization });
  } catch (error) {
    console.error("Delete custom role failed:", error);
    return res.status(500).json({ success: false, message: "Unable to delete role" });
  }
});

router.get("/", async (req, res) => {
  try {
    const actor =
      await requireUserManager(
        req,
        res
      );

    if (!actor) return;

    const organization = await loadOrganizationConfig(
      req.clientUser.companyId
    );

    // Admin sees the whole company; a manager sees only their reporting subtree.
    let idScope = null;
    if (actor.role !== "CLIENT_ADMIN") {
      const subtree = await reportsSubtreeIds(
        req.clientUser.companyId,
        actor.id
      );
      idScope = [...subtree];
    }

    const users =
      await prisma.user.findMany({
        where: {
          companyId:
            req.clientUser.companyId,
          role: {
            not: "SUPER_ADMIN",
          },
          ...(idScope ? { id: { in: idScope } } : {}),
        },
        include: {
          manager: { select: { name: true } },
        },
        orderBy: [
          { active: "desc" },
          { createdAt: "asc" },
        ],
      });

    return res.json({
      success: true,
      users: users.map((user) =>
        formatUser({
          ...user,
          department: canonicalDepartmentName(organization, user.department),
        })
      ),
    });
  } catch (error) {
    console.error(
      "Load client users failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load users",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const actor =
      await requireUserManager(
        req,
        res
      );

    if (!actor) return;

    const name = String(
      req.body?.name || ""
    ).trim();

    const email = String(
      req.body?.email || ""
    )
      .trim()
      .toLowerCase();

    const password = String(
      req.body?.password || ""
    );

    const organization = await loadOrganizationConfig(req.clientUser.companyId);
    const requestedCustomRoleId = String(req.body?.customRoleId || "").trim();
    const customRole = requestedCustomRoleId
      ? organization.roles.find((item) => item.id === requestedCustomRoleId)
      : null;

    const role = customRole
      ? customRole.baseRole
      : String(req.body?.role || "EMPLOYEE").trim().toUpperCase();

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email and password are required",
      });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid user role",
      });
    }

    if (requestedCustomRoleId && !customRole) {
      return res.status(400).json({ success: false, message: "Selected custom role no longer exists" });
    }

    const departmentName = String(req.body?.department || "").trim();
    const department = organization.departments.find(
      (item) => item.name.toLowerCase() === departmentName.toLowerCase()
    );
    if (!department) {
      return res.status(400).json({ success: false, message: "Department is required and must be selected from the configured departments" });
    }

    // A non-admin (manager) may only create EMPLOYEEs inside their own team.
    if (actor.role !== "CLIENT_ADMIN" && role !== "EMPLOYEE") {
      return res.status(403).json({
        success: false,
        message: "Only Client Admin can create managers or admins",
      });
    }

    // Employees report to a manager. Validate the assignment against the
    // company's active managers. (Managers/admins are not assigned upward.)
    let managerId = null;
    if (actor.role !== "CLIENT_ADMIN") {
      // Manager-created employees always report to that manager.
      managerId = actor.id;
    } else if (role === "EMPLOYEE") {
      const requestedManagerId = String(req.body?.managerId || "").trim();
      if (requestedManagerId) {
        const manager = await prisma.user.findFirst({
          where: {
            id: requestedManagerId,
            companyId: req.clientUser.companyId,
            role: "MANAGER",
            active: true,
          },
          select: { id: true },
        });
        if (!manager) {
          return res.status(400).json({ success: false, message: "Selected manager is invalid or no longer a manager" });
        }
        managerId = manager.id;
      }
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and include uppercase, lowercase and a number",
      });
    }

    const duplicate =
      await prisma.user.findUnique({
        where: { email },
      });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "A user with this email already exists",
      });
    }

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    const permissionDefaults = customRole
      ? customRole.permissions
      : defaultPermissions(role);

    // Department membership must not silently elevate access. Role/custom-role
    // defaults are the baseline; individual permissions are only changed when
    // the Client Admin explicitly sends a boolean choice for that permission.
    const permissions = role === "CLIENT_ADMIN"
      ? defaultPermissions(role)
      : Object.fromEntries(
          PERMISSION_KEYS.map((key) => [
            key,
            typeof req.body?.permissions?.[key] === "boolean"
              ? req.body.permissions[key]
              : permissionDefaults[key] === true,
          ])
        );

    // A non-admin granter can never hand out a page they do not themselves hold.
    if (actor.role !== "CLIENT_ADMIN") {
      for (const key of PERMISSION_KEYS) {
        if (permissions[key] && actor[key] !== true) permissions[key] = false;
      }
    }

    // Granular in-page scope, clamped to the granter's own access.
    const pageAccess =
      role === "CLIENT_ADMIN"
        ? fullPageAccess()
        : clampPageAccessToActor(
            req.body?.pageAccess,
            actorAccessSpec(actor),
            actor.role
          );

    const roleCode = customRole?.code || ({ CLIENT_ADMIN: "ADM", MANAGER: "MGR", EMPLOYEE: "EMP" }[role] || "EMP");
    const employeeId = await generateEmployeeId(
      req.clientUser.companyId,
      department.code,
      roleCode
    );

    const user =
      await prisma.user.create({
        data: {
          companyId:
            req.clientUser.companyId,
          name,
          email,
          passwordHash,
          role,
          active: true,
          phone:
            req.body?.phone
              ? String(req.body.phone).trim()
              : null,
          jobTitle:
            req.body?.jobTitle
              ? String(req.body.jobTitle).trim()
              : null,
          department: department.name,
          employeeId,
          customRoleId: customRole?.id || null,
          customRoleName: customRole?.name || null,
          managerId,
          pageAccess,
          ...permissions,
        },
      });

    await prisma.notification.create({
      data: {
        companyId:
          req.clientUser.companyId,
        userId: actor.id,
        title: "User added",
        message:
          `${user.name} was added as ${user.customRoleName || user.role.replaceAll("_", " ")} (${user.employeeId}).`,
        type: "USER",
        actionModule: "settings",
        actionLabel:
          "Open Users & Roles",
      },
    });

    await writeAuditLog({
      req,
      companyId:
        req.clientUser.companyId,
      actor,
      action:
        "USER_CREATED",
      entityType:
        "USER",
      entityId:
        user.id,
      summary:
        `${actor.name} added ${user.name} as ${user.customRoleName || user.role.replaceAll("_", " ")} (${user.employeeId}).`,
      metadata: {
        targetEmail:
          user.email,
        role:
          user.role,
        department:
          user.department,
        employeeId:
          user.employeeId,
        customRole:
          user.customRoleName,
      },
    });

    return res.status(201).json({
      success: true,
      message:
        "User created successfully",
      user:
        formatUser(user),
    });
  } catch (error) {
    console.error(
      "Create client user failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create user",
    });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const actor =
      await requireUserManager(
        req,
        res
      );

    if (!actor) return;

    const target =
      await prisma.user.findFirst({
        where: {
          id: req.params.id,
          companyId:
            req.clientUser.companyId,
          role: {
            not: "SUPER_ADMIN",
          },
        },
      });

    if (!target) {
      return res.status(404).json({
        success: false,
        message:
          "User not found",
      });
    }

    // Manager scoping: a non-admin may only edit EMPLOYEEs in their own subtree.
    if (actor.role !== "CLIENT_ADMIN") {
      const subtree = await reportsSubtreeIds(
        req.clientUser.companyId,
        actor.id
      );
      if (!canManageTarget(actor, target, subtree)) {
        return res.status(403).json({
          success: false,
          message:
            "You can only manage employees in your own team. Ask a Client Admin to change access for managers.",
        });
      }
      // Managers cannot change a user's role (promote/demote) or reassign them.
      if (req.body.role !== undefined && String(req.body.role).toUpperCase() !== target.role) {
        return res.status(403).json({
          success: false,
          message: "Only Client Admin can change a user's role",
        });
      }
    }

    const data = {};
    const organization = await loadOrganizationConfig(req.clientUser.companyId);

    if (req.body.name !== undefined) {
      const name = String(
        req.body.name || ""
      ).trim();

      if (!name) {
        return res.status(400).json({
          success: false,
          message:
            "User name is required",
        });
      }
      data.name = name;
    }

    if (req.body.email !== undefined) {
      const email = String(
        req.body.email || ""
      )
        .trim()
        .toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,
          message:
            "Email is required",
        });
      }

      const duplicate =
        await prisma.user.findFirst({
          where: {
            email,
            id: {
              not: target.id,
            },
          },
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "A user with this email already exists",
        });
      }

      data.email = email;
    }

    let customRole = target.customRoleId
      ? organization.roles.find((item) => item.id === target.customRoleId) || null
      : null;

    if (req.body.customRoleId !== undefined) {
      const customRoleId = String(req.body.customRoleId || "").trim();
      customRole = customRoleId
        ? organization.roles.find((item) => item.id === customRoleId) || null
        : null;
      if (customRoleId && !customRole) {
        return res.status(400).json({ success: false, message: "Selected custom role no longer exists" });
      }
      data.customRoleId = customRole?.id || null;
      data.customRoleName = customRole?.name || null;
      if (customRole) data.role = customRole.baseRole;
    }

    let role =
      target.role;

    if (req.body.role !== undefined) {
      role = String(
        req.body.role || ""
      )
        .trim()
        .toUpperCase();

      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user role",
        });
      }

      if (
        target.id === actor.id &&
        target.role === "CLIENT_ADMIN" &&
        role !== "CLIENT_ADMIN"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot remove your own Client Admin role",
        });
      }

      data.role = role;
      if (req.body.customRoleId === undefined) {
        data.customRoleId = null;
        data.customRoleName = null;
        customRole = null;
      }
    }

    if (req.body.active !== undefined) {
      const active =
        req.body.active === true;

      if (
        target.id === actor.id &&
        !active
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot deactivate your own account",
        });
      }

      data.active = active;
    }

    for (const field of [
      "phone",
      "jobTitle",
    ]) {
      if (req.body[field] !== undefined) {
        data[field] =
          req.body[field]
            ? String(req.body[field]).trim()
            : null;
      }
    }

    if (req.body.department !== undefined) {
      const departmentName = String(req.body.department || "").trim();
      const department = organization.departments.find(
        (item) => item.name.toLowerCase() === departmentName.toLowerCase()
      );
      if (!department) {
        return res.status(400).json({ success: false, message: "Select a valid department" });
      }
      data.department = department.name;
    }

    if (
      req.body.permissions !== undefined ||
      req.body.role !== undefined ||
      req.body.customRoleId !== undefined
    ) {
      const nextPerms =
        role === "CLIENT_ADMIN"
          ? defaultPermissions(role)
          : Object.fromEntries(
              PERMISSION_KEYS.map((key) => [
                key,
                typeof req.body?.permissions?.[key] === "boolean"
                  ? req.body.permissions[key]
                  : customRole?.permissions?.[key] === true,
              ])
            );

      // A non-admin granter cannot exceed their own page-level access.
      if (actor.role !== "CLIENT_ADMIN") {
        for (const key of PERMISSION_KEYS) {
          if (nextPerms[key] && actor[key] !== true) nextPerms[key] = false;
        }
      }

      Object.assign(data, nextPerms);
    }

    // Granular in-page scope. Recompute when the client sends it, or when the
    // role flips to/from admin (admin => full, non-admin => clamped spec).
    if (
      req.body.pageAccess !== undefined ||
      req.body.role !== undefined ||
      req.body.customRoleId !== undefined
    ) {
      if (role === "CLIENT_ADMIN") {
        data.pageAccess = fullPageAccess();
      } else {
        const requested =
          req.body.pageAccess !== undefined
            ? req.body.pageAccess
            : target.pageAccess;
        data.pageAccess = clampPageAccessToActor(
          requested,
          actorAccessSpec(actor),
          actor.role
        );
      }
    }

    const updated =
      await prisma.user.update({
        where: {
          id: target.id,
        },
        data,
      });

    const changedFields =
      Object.keys(data);

    await writeAuditLog({
      req,
      companyId:
        req.clientUser.companyId,
      actor,
      action:
        data.active !== undefined &&
        changedFields.length === 1
          ? data.active
            ? "USER_ACTIVATED"
            : "USER_DEACTIVATED"
          : "USER_UPDATED",
      entityType:
        "USER",
      entityId:
        updated.id,
      summary:
        `${actor.name} updated ${updated.name}.`,
      metadata: {
        changedFields,
        targetEmail:
          updated.email,
        role:
          updated.role,
        active:
          updated.active,
      },
    });

    return res.json({
      success: true,
      message:
        "User updated successfully",
      user:
        formatUser(updated),
    });
  } catch (error) {
    console.error(
      "Update client user failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update user",
    });
  }
});

router.patch(
  "/:id/reset-password",
  async (req, res) => {
    try {
      const actor =
        await requireUserManager(
          req,
          res
        );

      if (!actor) return;

      const target =
        await prisma.user.findFirst({
          where: {
            id: req.params.id,
            companyId:
              req.clientUser.companyId,
            role: {
              not: "SUPER_ADMIN",
            },
          },
        });

      if (!target) {
        return res.status(404).json({
          success: false,
          message:
            "User not found",
        });
      }

      if (actor.role !== "CLIENT_ADMIN") {
        const subtree = await reportsSubtreeIds(
          req.clientUser.companyId,
          actor.id
        );
        if (!canManageTarget(actor, target, subtree)) {
          return res.status(403).json({
            success: false,
            message:
              "You can only manage employees in your own team.",
          });
        }
      }

      const password = String(
        req.body?.password || ""
      );

      if (
        password.length < 8 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[0-9]/.test(password)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters and include uppercase, lowercase and a number",
        });
      }

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      await prisma.user.update({
        where: {
          id: target.id,
        },
        data: {
          passwordHash,
        },
      });

      await writeAuditLog({
        req,
        companyId:
          req.clientUser.companyId,
        actor,
        action:
          "USER_PASSWORD_RESET",
        entityType:
          "USER",
        entityId:
          target.id,
        summary:
          `${actor.name} reset the password for ${target.name}.`,
        metadata: {
          targetEmail:
            target.email,
        },
      });

      return res.json({
        success: true,
        message:
          "Password reset successfully",
      });
    } catch (error) {
      console.error(
        "Reset client user password failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to reset password",
      });
    }
  }
);

export default router;