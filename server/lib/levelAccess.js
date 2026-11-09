/**
 * Level-keyed access resolution (server).
 *
 * Permissions are configured per LEVEL in organizationConfig.levels[].permissions.
 * A user inherits their level's permissions unless they carry a per-user override
 * (User.pageAccess, edited on the People tab via PermissionTree). This module
 *   - normalizes the stored level-permission blob,
 *   - derives the legacy canManage* booleans from the component-action matrix,
 *   - answers "can this user do ACTION on COMPONENT?" and "is DATA in scope?".
 *
 * Mirror of src/components/client/accessModel.js — keep the component map and the
 * flag roll-up in sync between the two.
 */

export const ACTIONS = ["View", "Create", "Edit", "Delete", "Assign", "Review", "Approve", "Comment", "Export"];
export const SCOPE_VALUES = ["self", "team", "dept", "everyone"];

export const ALL_FLAGS = [
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

// componentId -> legacy flag it rolls up to. Keep aligned with accessModel.js.
export const COMPONENT_TO_FLAG = {
  "dash.kpi": null, "dash.action": null, "dash.cal": null,
  "chat.convo": null, "chat.delete": null, "chat.meet": null,
  "goals.targets": "canViewTeamTargets",
  "ls.list": "canManageLeads", "ls.detail": "canManageLeads", "ls.add": "canManageLeads",
  "ls.import": "canManageLeads", "ls.activity": "canManageLeads", "ls.nurture": "canManageLeads", "ls.kpi": "canManageLeads",
  "utm.links": "canManageLeads", "utm.analytics": "canManageLeads",
  "adm.list": "canManageAdmissions", "adm.kpi": "canManageAdmissions",
  "wk.records": "canManageAdmissions", "wk.kpi": "canManageAdmissions",
  "cn.sessions": "canManageAdmissions", "cn.kpi": "canManageAdmissions",
  "admd.add": "canManageAdmissions", "admd.attach": "canManageAdmissions",
  "fin.revenue": "canManageRevenue", "fin.expenses": "canManageRevenue", "fin.profit": "canManageRevenue", "fin.atrisk": "canManageRevenue",
  "an.metrics": "canViewAnalytics", "an.year": "canViewAnalytics",
  "store.items": null, "ref.list": null, "ref.credit": null,
  "help.tickets": "canManageSupport", "help.kpi": "canManageSupport",
  "profile.self": null,
};

export function normalizeLevelPermissions(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const components = {};
  if (s.components && typeof s.components === "object") {
    for (const [cid, acts] of Object.entries(s.components)) {
      if (!acts || typeof acts !== "object") continue;
      const kept = {};
      for (const a of ACTIONS) if (acts[a] === true) kept[a] = true;
      if (Object.keys(kept).length) components[cid] = kept;
    }
  }
  const adm = s.admissions && typeof s.admissions === "object" ? s.admissions : {};
  const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
  const scope = SCOPE_VALUES.includes(s.scope) ? s.scope : "self";
  return {
    scope,
    components,
    admissions: { all: adm.all === true, streamIds: arr(adm.streamIds), collegeIds: arr(adm.collegeIds) },
  };
}

export function flagsFromComponents(components = {}) {
  const flags = Object.fromEntries(ALL_FLAGS.map((f) => [f, false]));
  for (const [cid, acts] of Object.entries(components)) {
    const flag = COMPONENT_TO_FLAG[cid];
    if (flag && Object.values(acts || {}).some(Boolean)) flags[flag] = true;
  }
  return flags;
}

/** Full access blob for Administrators (every component, every action, everyone). */
export function fullLevelPermissions() {
  const components = {};
  for (const cid of Object.keys(COMPONENT_TO_FLAG)) {
    components[cid] = Object.fromEntries(ACTIONS.map((a) => [a, true]));
  }
  return { scope: "everyone", components, admissions: { all: true, streamIds: [], collegeIds: [] } };
}

/**
 * Effective permissions for a user:
 *   CLIENT_ADMIN            -> full
 *   user has own override   -> override (already clamped to actor when saved)
 *   otherwise               -> the level's permissions
 */
export function resolveUserAccess({ user, level }) {
  if (user?.role === "CLIENT_ADMIN") return fullLevelPermissions();
  if (user?.pageAccess && user.pageAccess.__override === true) {
    return normalizeLevelPermissions(user.pageAccess);
  }
  return normalizeLevelPermissions(level?.permissions);
}

export function componentAllowed(perms, componentId, action) {
  const c = perms?.components?.[componentId];
  if (!c) return false;
  if (action === "View") return Object.values(c).some(Boolean);
  return c[action] === true;
}

/**
 * Is a record in the user's data scope? Relationship flags come from the caller
 * (it knows the record's owner vs the user's team/department).
 *   scope: self | team | dept | everyone
 */
export function scopeAllows(perms, { isOwn, isInTeam, isInDept }) {
  switch (perms?.scope) {
    case "everyone": return true;
    case "dept": return !!(isOwn || isInTeam || isInDept);
    case "team": return !!(isOwn || isInTeam);
    case "self":
    default: return !!isOwn;
  }
}

/** Admissions stream/college gate. */
export function admissionCollegeAllowed(perms, { streamId, collegeId }) {
  const a = perms?.admissions;
  if (!a) return false;
  if (a.all) return true;
  if (collegeId && a.collegeIds.includes(String(collegeId))) return true;
  if (streamId && a.streamIds.includes(String(streamId))) return true;
  return false;
}

/**
 * No-escalation clamp: a granter (manager) can only grant what they themselves
 * hold. Returns a copy of `desired` with anything outside `actor` removed.
 */
export function clampLevelToActor(desired, actor) {
  if (!actor) return normalizeLevelPermissions(desired); // admin granter = no clamp
  const d = normalizeLevelPermissions(desired);
  const a = normalizeLevelPermissions(actor);
  const components = {};
  for (const [cid, acts] of Object.entries(d.components)) {
    const kept = {};
    for (const act of Object.keys(acts)) if (a.components[cid]?.[act]) kept[act] = true;
    if (Object.keys(kept).length) components[cid] = kept;
  }
  const admissions = a.admissions.all
    ? d.admissions
    : {
        all: false,
        streamIds: d.admissions.streamIds.filter((s) => a.admissions.streamIds.includes(s)),
        collegeIds: d.admissions.collegeIds.filter((c) => a.admissions.collegeIds.includes(c) || a.admissions.all),
      };
  // a level can't grant a wider data scope than the granter holds
  const order = { self: 0, team: 1, dept: 2, everyone: 3 };
  const scope = order[d.scope] <= order[a.scope] ? d.scope : a.scope;
  return { scope, components, admissions };
}
