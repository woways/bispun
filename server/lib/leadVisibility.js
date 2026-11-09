/* =========================================================
   LEAD VISIBILITY SCOPE (shared, security-critical)

   Single source of truth for "which leads/records may this
   client user see or act on". Mirrors the Dashboard rule that
   already lives in clientAnalytics.js (getDashboardAccessScope):

     - CLIENT_ADMIN : every record in the company
     - MANAGER      : self + same-department MANAGER/EMPLOYEE
                      (or all MANAGER/EMPLOYEE when the manager
                      has no department set)
     - EMPLOYEE     : only records assigned to themselves

   Used by Lead Store, Leads, Telephony and Communications so the
   "employees only see their assigned leads" rule is enforced in
   backend queries, not just in the UI. Company isolation is always
   applied on top of this by the caller (every query keeps its own
   `companyId` filter).

   NOTE: clientAnalytics.js still has its own copy of this rule for
   the Dashboard. Both must stay in sync; consolidating them is a
   safe follow-up cleanup.
========================================================= */

export function normalizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Given the acting user and the full list of company users, return
 * the subset of users whose assigned records the acting user may see.
 */
export function computeVisibleUsers(currentUser, companyUsers) {
  if (!currentUser) return [];

  const users = Array.isArray(companyUsers) ? companyUsers : [];

  if (currentUser.role === "CLIENT_ADMIN") {
    return users;
  }

  if (currentUser.role === "MANAGER") {
    const department = String(currentUser.department || "")
      .trim()
      .toLowerCase();

    if (department) {
      return users.filter(
        (user) =>
          user.id === currentUser.id ||
          (["MANAGER", "EMPLOYEE"].includes(user.role) &&
            String(user.department || "").trim().toLowerCase() === department)
      );
    }

    return users.filter(
      (user) =>
        user.role === "MANAGER" ||
        user.role === "EMPLOYEE" ||
        user.id === currentUser.id
    );
  }

  // EMPLOYEE (and any other non-admin role): only their own records.
  return users.filter((user) => user.id === currentUser.id);
}

/**
 * Build a plain scope object from already-loaded users (pure, testable).
 */
export function buildScope(currentUser, companyUsers) {
  const role = currentUser?.role || "EMPLOYEE";

  if (role === "CLIENT_ADMIN") {
    return {
      role,
      isAdmin: true,
      visibleUsers: Array.isArray(companyUsers) ? companyUsers : [],
      visibleUserIds: null, // null => no restriction
      visibleUserNames: null,
    };
  }

  const visibleUsers = computeVisibleUsers(currentUser, companyUsers);

  return {
    role,
    isAdmin: false,
    visibleUsers,
    visibleUserIds: new Set(visibleUsers.map((user) => user.id)),
    visibleUserNames: new Set(
      visibleUsers.map((user) => normalizeName(user.name)).filter(Boolean)
    ),
  };
}

/**
 * Load the acting user + company users from the database and build a scope.
 * `clientUser` is req.clientUser (has userId, companyId, role).
 */
export async function getLeadVisibilityScope(prisma, companyId, clientUser) {
  if (!clientUser) {
    return buildScope({ role: "EMPLOYEE" }, []);
  }

  if (clientUser.role === "CLIENT_ADMIN") {
    // Admins are unrestricted; no need to load the user list.
    return {
      role: "CLIENT_ADMIN",
      isAdmin: true,
      visibleUsers: [],
      visibleUserIds: null,
      visibleUserNames: null,
    };
  }

  const [currentUser, companyUsers] = await Promise.all([
    prisma.user.findFirst({
      where: { id: clientUser.userId, companyId, active: true },
      select: { id: true, name: true, role: true, department: true },
    }),
    prisma.user.findMany({
      where: { companyId, active: true },
      select: { id: true, name: true, role: true, department: true },
    }),
  ]);

  // Fall back to the token's identity if the row can't be read, so a missing
  // user row never silently widens access.
  const actor =
    currentUser || {
      id: clientUser.userId,
      name: clientUser.name || "",
      role: clientUser.role || "EMPLOYEE",
      department: null,
    };

  return buildScope(actor, companyUsers);
}

/**
 * Prisma `where` fragment that restricts a lead query to the scope.
 * Returns `null` for admins (caller adds no restriction).
 *
 * A lead counts as visible when EITHER its `assignedToUserId` is in scope
 * OR its `assignedToName` matches a visible user. Lead Store assigns by name
 * (bulk-assign sets only `assignedToName`), while other flows set the id, so
 * both are checked — this matches the Dashboard rule. Anything matching
 * neither stays hidden, which is the safe failure mode.
 */
export function leadVisibilityWhere(scope) {
  if (!scope || scope.isAdmin) return null;

  const ids = [...(scope.visibleUserIds || [])];
  const names = (scope.visibleUsers || [])
    .map((user) => user.name)
    .filter((name) => typeof name === "string" && name.trim().length > 0);

  const or = [];

  if (ids.length) {
    or.push({ assignedToUserId: { in: ids } });
  }

  // Case-insensitive per-name match (Prisma `in` has no case-insensitive mode),
  // so the list query stays consistent with canViewLead(), which normalizes case.
  for (const name of names) {
    or.push({ assignedToName: { equals: name, mode: "insensitive" } });
  }

  if (!or.length) {
    // No visible users at all => match nothing.
    return { id: "__no_visible_leads__" };
  }

  return { OR: or };
}

/**
 * Single-record check used after fetching a lead by id (defends direct
 * API / deep-link access).
 */
export function canViewLead(scope, lead) {
  if (!scope || scope.isAdmin) return true;
  if (!lead) return false;

  if (lead.assignedToUserId && scope.visibleUserIds?.has(lead.assignedToUserId)) {
    return true;
  }

  const name = normalizeName(lead.assignedToName);
  if (name && scope.visibleUserNames?.has(name)) {
    return true;
  }

  return false;
}

/**
 * Prisma `where` for CallRecord history, enforcing the same visibility rule.
 *
 * CallRecord has no assignee of its own, so a non-admin may see a call only
 * when EITHER they placed it themselves (`userId`) OR it belongs to a lead
 * they can view (`leadId` in the caller-supplied `visibleLeadIds`, computed
 * from `leadVisibilityWhere`). The optional `leadId`/`phone` filters are ANDed
 * on top. Admins are restricted by `companyId` only.
 */
export function callHistoryWhere({
  companyId,
  scope,
  actingUserId,
  leadId,
  phone,
  visibleLeadIds,
}) {
  const where = { companyId };
  if (leadId) {
    where.leadId = leadId;
  } else if (phone) {
    where.phone = phone;
  }

  if (scope?.isAdmin) return where;

  const ids = Array.isArray(visibleLeadIds)
    ? visibleLeadIds
    : [...(visibleLeadIds || [])];

  where.OR = [
    { userId: actingUserId },
    ...(ids.length ? [{ leadId: { in: ids } }] : []),
  ];

  return where;
}

/**
 * Same scope applied to lead datasets (datasets carry a single
 * assignedToUserId). Admins unrestricted.
 */
export function datasetVisibilityWhere(scope) {
  if (!scope || scope.isAdmin) return null;
  const ids = [...(scope.visibleUserIds || [])];
  if (!ids.length) return { id: "__no_visible_datasets__" };
  return { assignedToUserId: { in: ids } };
}
