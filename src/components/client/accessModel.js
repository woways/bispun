// Shared Access model: the page/component map, action vocabulary and the
// helpers that turn a level's component-action grants into the legacy
// canManage* flags. Imported by AccessTab.jsx (UI) and mirrored by
// server/lib/levelAccess.js (enforcement). Keep the two in sync.

export const ACTIONS = [
  "View",
  "Create",
  "Edit",
  "Delete",
  "Assign",
  "Review",
  "Approve",
  "Comment",
  "Import",
  "Message",
  "Export",
];

export const SCOPES = [
  ["self", "Only themselves", "their own leads, admissions & tasks"],
  ["team", "Their team", "everyone reporting under them"],
  ["dept", "Their department", "everyone in their department"],
  ["everyone", "Everyone", "all data in the company"],
];

// Pages mirror NAV_GROUPS / PAGE_META in ClientPortal.jsx. `flag` is the legacy
// canManage* boolean this page rolls up to (null = always available / personal).
export const ACCESS_GROUPS = [
  {
    g: "Work",
    pages: [
      {
        id: "dashboard",
        name: "Dashboard",
        flag: null,
        comps: [
          { id: "dash.kpi", name: "KPI Cards", acts: ["View", "Export"] },
          { id: "dash.action", name: "Action Center", acts: ["View", "Edit", "Assign", "Export"] },
          { id: "dash.cal", name: "Calendar & Reminders", acts: ["View", "Create", "Edit", "Delete"] },
        ],
      },
      {
        id: "chats",
        name: "Chats",
        flag: null,
        comps: [
          { id: "chat.convo", name: "Conversations", acts: ["View", "Create", "Comment"] },
          { id: "chat.delete", name: "Delete chats", acts: ["Delete"] },
          { id: "chat.meet", name: "Join Meet", acts: ["View", "Create"] },
        ],
      },
      {
        id: "goals-and-targets",
        name: "Goals and Targets",
        flag: "canViewTeamTargets",
        comps: [{ id: "goals.targets", name: "Targets", acts: ["View", "Create", "Edit", "Assign"] }],
      },
    ],
  },
  {
    g: "Leads",
    flag: "canManageLeads",
    pages: [
      {
        id: "lead-store",
        name: "Lead Store",
        flag: "canManageLeads",
        comps: [
          { id: "ls.list", name: "Lead list", acts: ["View", "Export"] },
          { id: "ls.detail", name: "Lead details", acts: ["View", "Edit", "Delete", "Comment"] },
          { id: "ls.add", name: "Add Lead", acts: ["Create"] },
          { id: "ls.import", name: "Import Leads", acts: ["Import"] },
          { id: "ls.message", name: "Send Message", acts: ["Message"] },
          { id: "ls.activity", name: "Activity history", acts: ["View", "Comment"] },
          { id: "ls.nurture", name: "Smart Nurture", acts: ["View", "Create", "Edit"] },
          { id: "ls.kpi", name: "KPI Cards", acts: ["View", "Export"] },
        ],
      },
      {
        id: "utm-leads",
        name: "UTM Leads",
        flag: "canManageLeads",
        comps: [
          { id: "utm.links", name: "UTM Links", acts: ["View", "Create", "Edit", "Delete"] },
          { id: "utm.analytics", name: "UTM Analytics", acts: ["View", "Export"] },
        ],
      },
    ],
  },
  {
    g: "Admissions",
    flag: "canManageAdmissions",
    admissionsScope: true, // this group also shows the stream/college tree
    pages: [
      {
        id: "admissions",
        name: "Admissions (Overall)",
        flag: "canManageAdmissions",
        comps: [
          { id: "adm.list", name: "Admissions list", acts: ["View", "Export"] },
          { id: "adm.kpi", name: "KPI Cards", acts: ["View"] },
        ],
      },
      {
        id: "walkins",
        name: "Walk-ins",
        flag: "canManageAdmissions",
        comps: [
          { id: "wk.records", name: "Walk-in records", acts: ["View", "Create", "Edit", "Export"] },
          { id: "wk.kpi", name: "KPI Cards", acts: ["View"] },
        ],
      },
      {
        id: "counselling",
        name: "Counselling",
        flag: "canManageAdmissions",
        comps: [
          { id: "cn.sessions", name: "Sessions", acts: ["View", "Create", "Edit", "Delete"] },
          { id: "cn.kpi", name: "KPI Cards", acts: ["View"] },
        ],
      },
      {
        id: "admissions-done",
        name: "Admissions Done",
        flag: "canManageAdmissions",
        comps: [
          { id: "admd.add", name: "Add / Edit Admission", acts: ["Create", "Edit"] },
          { id: "admd.attach", name: "Attachments", acts: ["View", "Create", "Delete"] },
        ],
      },
    ],
  },
  {
    g: "Finance",
    flag: "canManageRevenue",
    pages: [
      {
        id: "revenue",
        name: "Finance → Revenue",
        flag: "canManageRevenue",
        comps: [
          { id: "fin.revenue", name: "Revenue", acts: ["View", "Edit", "Export"] },
          { id: "fin.expenses", name: "Expenses", acts: ["View", "Create", "Approve"] },
          { id: "fin.profit", name: "Profit", acts: ["View", "Export"] },
          { id: "fin.atrisk", name: "At-Risk", acts: ["View", "Export"] },
        ],
      },
    ],
  },
  {
    g: "Insights",
    flag: "canViewAnalytics",
    pages: [
      {
        id: "analytics",
        name: "Insights → Analytics",
        flag: "canViewAnalytics",
        comps: [
          { id: "an.metrics", name: "Metrics & KPIs", acts: ["View", "Export"] },
          { id: "an.year", name: "Year Comparison", acts: ["View", "Export"] },
        ],
      },
    ],
  },
  {
    g: "Referrals",
    pages: [
      {
        id: "my-store",
        name: "My Store",
        flag: null,
        comps: [{ id: "store.items", name: "Store items", acts: ["View"] }],
      },
      {
        id: "my-referrals",
        name: "My Referrals",
        flag: null,
        comps: [
          { id: "ref.list", name: "Referrals", acts: ["View", "Create", "Export"] },
          { id: "ref.credit", name: "Credit status", acts: ["View"] },
        ],
      },
    ],
  },
  {
    g: "Support",
    flag: "canManageSupport",
    pages: [
      {
        id: "help",
        name: "Help & Support",
        flag: "canManageSupport",
        comps: [
          { id: "help.tickets", name: "Tickets", acts: ["View", "Create", "Comment"] },
          { id: "help.kpi", name: "KPI Cards", acts: ["View"] },
        ],
      },
    ],
  },
  {
    g: "Personal · everyone, their own",
    pages: [
      {
        id: "profile",
        name: "My Profile",
        flag: null,
        comps: [{ id: "profile.self", name: "My Profile", acts: ["View", "Edit"] }],
      },
    ],
  },
  {
    g: "Admin · Admins only",
    locked: true,
    pages: [
      {
        id: "settings",
        name: "Settings (incl. Access & Org)",
        comps: [{ id: "settings.all", name: "All settings", acts: ["View", "Edit"] }],
      },
    ],
  },
];

// Every grantable component id -> its page's legacy flag (for roll-up).
export const COMPONENT_TO_FLAG = (() => {
  const map = {};
  for (const grp of ACCESS_GROUPS) {
    if (grp.locked) continue;
    for (const page of grp.pages) {
      for (const comp of page.comps) map[comp.id] = page.flag || null;
    }
  }
  return map;
})();

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

export function emptyLevelPermissions() {
  return { scope: "self", components: {}, admissions: { all: false, streamIds: [], collegeIds: [] } };
}

export function normalizeLevelPermissions(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const components = {};
  if (s.components && typeof s.components === "object") {
    for (const [cid, acts] of Object.entries(s.components)) {
      if (!acts || typeof acts !== "object") continue;
      components[cid] = {};
      for (const a of ACTIONS) if (acts[a] === true) components[cid][a] = true;
    }
  }
  const adm = s.admissions && typeof s.admissions === "object" ? s.admissions : {};
  const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
  const scope = ["self", "team", "dept", "everyone"].includes(s.scope) ? s.scope : "self";
  return {
    scope,
    components,
    admissions: { all: adm.all === true, streamIds: arr(adm.streamIds), collegeIds: arr(adm.collegeIds) },
  };
}

// Derive the legacy canManage* booleans from a component-action matrix: a flag
// is ON when any non-personal component under that flag has any action granted.
export function flagsFromComponents(components = {}) {
  const flags = Object.fromEntries(ALL_FLAGS.map((f) => [f, false]));
  for (const [cid, acts] of Object.entries(components)) {
    const flag = COMPONENT_TO_FLAG[cid];
    if (!flag) continue;
    if (Object.values(acts || {}).some(Boolean)) flags[flag] = true;
  }
  return flags;
}

export function componentAllowed(perms, componentId, action) {
  const c = perms?.components?.[componentId];
  if (action === "View") {
    // View is implied if any action on the component is granted.
    return !!c && Object.values(c).some(Boolean);
  }
  return !!(c && c[action]);
}

// ---------------------------------------------------------------------------
// Team templates — ready-made bundles of levels + scope + permissions.
//
// Ported from the Users & Roles design prototype. Each template role carries a
// coarse per-module grant ("full" | "manage" | "edit" | "view" | "own"); the
// tables below expand that into the real component-action matrix so Apply can
// create/update levels through the normal level-access API.
// ---------------------------------------------------------------------------

// A template role's human scope label -> the SCOPES key used on a level.
export const SCOPE_LABEL_TO_KEY = {
  Everyone: "everyone",
  "Only themselves": "self",
  "Their department": "dept",
  "Their team": "team",
};

// Coarse access level -> the action set it grants (then intersected per component).
export const ACCESS_LEVEL_ACTIONS = {
  full: ACTIONS.slice(),
  manage: ACTIONS.filter((a) => a !== "Delete"),
  edit: ["View", "Create", "Edit", "Comment"],
  view: ["View", "Export"],
  own: ["View", "Create", "Comment", "Message"],
};

// Template module name -> real ACCESS_GROUPS page id(s).
export const TEMPLATE_MODULE_TO_PAGE_IDS = {
  Dashboard: ["dashboard"],
  "Lead Store": ["lead-store"],
  "UTM Leads": ["utm-leads"],
  Admissions: ["admissions", "walkins", "counselling", "admissions-done"],
  Finance: ["revenue"],
  Insights: ["analytics"],
  Chats: ["chats"],
  "Goals & Targets": ["goals-and-targets"],
  Support: ["help"],
  Referrals: ["my-store", "my-referrals"],
};

const PAGE_BY_ID = (() => {
  const map = {};
  for (const grp of ACCESS_GROUPS) {
    for (const page of grp.pages) map[page.id] = page;
  }
  return map;
})();

// Expand one template role into a normalized level-permissions object.
// Admin roles are NOT expanded here — the org's protected Admin level already
// grants full access, so callers skip admin roles when applying a template.
export function levelPermissionsFromTemplateRole(role) {
  const scope = role?.admin ? "everyone" : SCOPE_LABEL_TO_KEY[role?.scope] || "self";
  const components = {};
  const access = (role && role.access) || {};
  for (const [moduleName, accessLevel] of Object.entries(access)) {
    const allowed = ACCESS_LEVEL_ACTIONS[accessLevel];
    if (!allowed) continue;
    const pageIds = TEMPLATE_MODULE_TO_PAGE_IDS[moduleName] || [];
    for (const pageId of pageIds) {
      const page = PAGE_BY_ID[pageId];
      if (!page) continue;
      for (const comp of page.comps) {
        const granted = comp.acts.filter((a) => allowed.includes(a));
        if (granted.length) components[comp.id] = Object.fromEntries(granted.map((a) => [a, true]));
      }
    }
  }
  return normalizeLevelPermissions({
    scope,
    components,
    admissions: { all: false, streamIds: [], collegeIds: [] },
  });
}

// Total grantable component-actions across non-admin-locked pages (for % display).
export function grantablePermissionCount() {
  let tot = 0;
  for (const grp of ACCESS_GROUPS) {
    if (grp.locked) continue;
    for (const page of grp.pages) for (const comp of page.comps) tot += comp.acts.length;
  }
  return tot;
}

// Fraction (0..1) of all grantable permissions a template role would hold.
export function templateRolePercent(role) {
  if (role?.admin) return 1;
  const perms = levelPermissionsFromTemplateRole(role);
  let on = 0;
  for (const acts of Object.values(perms.components)) on += Object.values(acts).filter(Boolean).length;
  const tot = grantablePermissionCount();
  return tot ? on / tot : 0;
}

// Fraction (0..1) of all grantable permissions a stored level holds (for meters).
export function levelPermissionPercent(permissions) {
  const perms = normalizeLevelPermissions(permissions);
  let on = 0;
  for (const acts of Object.values(perms.components)) on += Object.values(acts).filter(Boolean).length;
  const tot = grantablePermissionCount();
  return tot ? on / tot : 0;
}

// Suggest a short, unique level code from a name (deduped against `taken`).
export function suggestLevelCode(name, taken = []) {
  const clean = String(name || "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  let base = words.length >= 2 ? words.map((w) => w[0]).join("").slice(0, 4) : (words[0] || "LVL").slice(0, 3);
  if (!base) base = "LVL";
  const takenSet = new Set(taken.map((c) => String(c || "").toUpperCase()));
  if (!takenSet.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base.slice(0, 3)}${i}`;
    if (!takenSet.has(candidate)) return candidate;
  }
  return `${base.slice(0, 2)}${Date.now().toString().slice(-3)}`;
}

// Plan a safe-merge apply of a template against the org's existing levels:
// non-admin roles become either an update (matched by name) or a create, each
// carrying the real, translated permissions. Mirrors Settings.applyTeamTemplate.
export function planTeamTemplateApply(existingLevels, template) {
  const byName = new Map((existingLevels || []).map((l) => [String(l.name).toLowerCase(), l]));
  const creates = [];
  const updates = [];
  for (const role of template?.roles || []) {
    if (role.admin) continue;
    const permissions = levelPermissionsFromTemplateRole(role);
    const existing = byName.get(role.name.toLowerCase());
    if (existing) updates.push({ id: existing.id, name: role.name, permissions });
    else creates.push({ name: role.name, permissions });
  }
  return { creates, updates };
}

export const TEAM_TEMPLATES = [
  {
    key: "solo",
    name: "Boss + Telecallers",
    tagline: "Smallest team",
    description:
      "The owner runs everything; telecallers only work their own leads. Two levels, nothing to configure.",
    roles: [
      { name: "Owner / Admin", role: "Full portal", scope: "Everyone", admin: true },
      {
        name: "Telecaller",
        role: "Calls & works own leads",
        scope: "Only themselves",
        access: { Dashboard: "view", "Lead Store": "own", Chats: "full", Support: "view" },
      },
    ],
  },
  {
    key: "domestic",
    name: "Domestic Team",
    tagline: "One market",
    description:
      "A domestic admissions desk — a manager over the team, consultants on walk-ins & counselling, telecallers feeding the pipeline.",
    roles: [
      { name: "Owner / Admin", role: "Full portal", scope: "Everyone", admin: true },
      {
        name: "Manager",
        role: "Runs the desk",
        scope: "Their department",
        market: "Domestic",
        access: {
          Dashboard: "view",
          "Lead Store": "full",
          "UTM Leads": "full",
          Admissions: "full",
          Finance: "view",
          Insights: "view",
          Chats: "full",
          "Goals & Targets": "manage",
          Support: "full",
        },
      },
      {
        name: "Consultant",
        role: "Walk-ins & counselling",
        scope: "Their team",
        market: "Domestic",
        access: {
          Dashboard: "view",
          "Lead Store": "full",
          "UTM Leads": "view",
          Admissions: "manage",
          Chats: "full",
          "Goals & Targets": "edit",
          Support: "view",
        },
      },
      {
        name: "Telecaller",
        role: "Qualifies leads",
        scope: "Only themselves",
        market: "Domestic",
        access: { Dashboard: "view", "Lead Store": "own", Chats: "full", Support: "view" },
      },
    ],
  },
  {
    key: "both",
    name: "Domestic + International",
    tagline: "Two markets",
    description:
      "A full consultancy across both markets, with consultants split by region so each sees only their market's admissions.",
    roles: [
      { name: "Owner / Admin", role: "Full portal", scope: "Everyone", admin: true },
      {
        name: "Manager",
        role: "Oversees both markets",
        scope: "Their department",
        market: "Both",
        access: {
          Dashboard: "view",
          "Lead Store": "full",
          "UTM Leads": "full",
          Admissions: "full",
          Finance: "view",
          Insights: "view",
          Chats: "full",
          "Goals & Targets": "manage",
          Support: "full",
        },
      },
      {
        name: "Domestic Consultant",
        role: "Domestic admissions",
        scope: "Their team",
        market: "Domestic",
        access: {
          Dashboard: "view",
          "Lead Store": "full",
          "UTM Leads": "view",
          Admissions: "manage",
          Chats: "full",
          "Goals & Targets": "edit",
          Support: "view",
        },
      },
      {
        name: "International Consultant",
        role: "International admissions",
        scope: "Their team",
        market: "International",
        access: {
          Dashboard: "view",
          "Lead Store": "full",
          "UTM Leads": "view",
          Admissions: "manage",
          Chats: "full",
          "Goals & Targets": "edit",
          Support: "view",
        },
      },
      {
        name: "Telecaller",
        role: "Feeds both pipelines",
        scope: "Only themselves",
        market: "Both",
        access: { Dashboard: "view", "Lead Store": "own", Chats: "full", Support: "view" },
      },
    ],
  },
];
