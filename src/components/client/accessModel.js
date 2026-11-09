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
          { id: "ls.detail", name: "Lead details", acts: ["View", "Edit", "Comment"] },
          { id: "ls.add", name: "Add Lead", acts: ["Create"] },
          { id: "ls.import", name: "Import Leads", acts: ["Create"] },
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
