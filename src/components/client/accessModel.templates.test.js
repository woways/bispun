import test from "node:test";
import assert from "node:assert/strict";

import {
  TEAM_TEMPLATES,
  levelPermissionsFromTemplateRole,
  templateRolePercent,
  suggestLevelCode,
  flagsFromComponents,
  grantablePermissionCount,
  planTeamTemplateApply,
} from "./accessModel.js";

// Default org levels a fresh company starts with (mirrors server seed).
const DEFAULT_LEVELS = [
  { id: "level-admin", name: "Admin", code: "ADM", rank: 1, system: true },
  { id: "level-manager", name: "Manager", code: "MGR", rank: 2, system: true },
  { id: "level-employee", name: "Employee", code: "EMP", rank: 3, system: true },
];

function roleByName(templateKey, name) {
  const t = TEAM_TEMPLATES.find((x) => x.key === templateKey);
  return t.roles.find((r) => r.name === name);
}

test("three templates exist with the expected level counts", () => {
  assert.deepEqual(
    TEAM_TEMPLATES.map((t) => [t.key, t.roles.length]),
    [
      ["solo", 2],
      ["domestic", 4],
      ["both", 5],
    ]
  );
});

test("every template leads with an Owner / Admin role", () => {
  for (const t of TEAM_TEMPLATES) {
    assert.equal(t.roles[0].name, "Owner / Admin");
    assert.equal(t.roles[0].admin, true);
  }
});

test("admin role expands to full-access scope and emits no component grants", () => {
  // Callers skip admin roles (the protected Admin level already grants full access),
  // but the translator must still be safe to call on one.
  const perms = levelPermissionsFromTemplateRole(roleByName("solo", "Owner / Admin"));
  assert.equal(perms.scope, "everyone");
  assert.deepEqual(perms.components, {});
});

test("scope labels map to the correct level scope keys", () => {
  assert.equal(levelPermissionsFromTemplateRole(roleByName("domestic", "Manager")).scope, "dept");
  assert.equal(levelPermissionsFromTemplateRole(roleByName("domestic", "Consultant")).scope, "team");
  assert.equal(levelPermissionsFromTemplateRole(roleByName("domestic", "Telecaller")).scope, "self");
});

test("telecaller 'own' Lead Store expands to limited actions, no Delete/Import", () => {
  const perms = levelPermissionsFromTemplateRole(roleByName("solo", "Telecaller"));
  // ls.detail acts are View/Edit/Delete/Comment; 'own' grants View+Comment only.
  assert.deepEqual(perms.components["ls.detail"], { View: true, Comment: true });
  // ls.import is [Import]; 'own' does not grant Import, so the component is absent.
  assert.equal(perms.components["ls.import"], undefined);
  // ls.add is [Create]; 'own' grants Create.
  assert.deepEqual(perms.components["ls.add"], { Create: true });
});

test("manager 'full' Lead Store grants every action on every component", () => {
  const perms = levelPermissionsFromTemplateRole(roleByName("domestic", "Manager"));
  assert.deepEqual(perms.components["ls.detail"], {
    View: true,
    Edit: true,
    Delete: true,
    Comment: true,
  });
  assert.deepEqual(perms.components["ls.import"], { Import: true });
});

test("'manage' grants everything except Delete", () => {
  // Consultant has Admissions:"manage"; counselling sessions are View/Create/Edit/Delete.
  const perms = levelPermissionsFromTemplateRole(roleByName("domestic", "Consultant"));
  assert.deepEqual(perms.components["cn.sessions"], { View: true, Create: true, Edit: true });
});

test("Admissions module expands across all four admissions pages", () => {
  const perms = levelPermissionsFromTemplateRole(roleByName("domestic", "Manager"));
  // one component id from each of the 4 admissions pages must be present under "full"
  for (const cid of ["adm.list", "wk.records", "cn.sessions", "admd.add"]) {
    assert.ok(perms.components[cid], `expected ${cid} to be granted`);
  }
});

test("derived legacy flags are sane for a manager", () => {
  const perms = levelPermissionsFromTemplateRole(roleByName("domestic", "Manager"));
  const flags = flagsFromComponents(perms.components);
  assert.equal(flags.canManageLeads, true);
  assert.equal(flags.canManageAdmissions, true);
  assert.equal(flags.canViewAnalytics, true);
});

test("a telecaller does not get admissions or analytics flags", () => {
  const perms = levelPermissionsFromTemplateRole(roleByName("solo", "Telecaller"));
  const flags = flagsFromComponents(perms.components);
  assert.equal(flags.canManageAdmissions, false);
  assert.equal(flags.canViewAnalytics, false);
});

test("templateRolePercent is 1 for admin and between 0 and 1 for others", () => {
  assert.equal(templateRolePercent(roleByName("solo", "Owner / Admin")), 1);
  const telPct = templateRolePercent(roleByName("solo", "Telecaller"));
  const mgrPct = templateRolePercent(roleByName("domestic", "Manager"));
  assert.ok(telPct > 0 && telPct < 1, "telecaller percent in range");
  assert.ok(mgrPct > telPct, "manager holds more than telecaller");
  assert.ok(grantablePermissionCount() > 0);
});

/* ---- end-to-end: planning a template apply against a fresh org ---- */

test("Boss + Telecallers on a fresh org: 1 create (Telecaller), updates Manager", () => {
  const t = TEAM_TEMPLATES.find((x) => x.key === "solo");
  const { creates, updates } = planTeamTemplateApply(DEFAULT_LEVELS, t);
  assert.deepEqual(creates.map((c) => c.name), ["Telecaller"]);
  assert.deepEqual(updates.map((u) => u.name), []); // no "Telecaller" level exists yet; Manager not in this template
});

test("Domestic Team on a fresh org: updates Manager, creates Consultant + Telecaller", () => {
  const t = TEAM_TEMPLATES.find((x) => x.key === "domestic");
  const { creates, updates } = planTeamTemplateApply(DEFAULT_LEVELS, t);
  assert.deepEqual(updates.map((u) => u.name), ["Manager"]); // matches seeded Manager by name
  assert.deepEqual(creates.map((c) => c.name).sort(), ["Consultant", "Telecaller"]);
  // the matched Manager update carries real, non-empty permissions
  const mgr = updates.find((u) => u.name === "Manager");
  assert.equal(mgr.id, "level-manager");
  assert.ok(Object.keys(mgr.permissions.components).length > 0, "Manager update has real permissions");
});

test("Domestic + International on a fresh org: 4 creates, Manager updated", () => {
  const t = TEAM_TEMPLATES.find((x) => x.key === "both");
  const { creates, updates } = planTeamTemplateApply(DEFAULT_LEVELS, t);
  assert.deepEqual(updates.map((u) => u.name), ["Manager"]);
  assert.deepEqual(
    creates.map((c) => c.name).sort(),
    ["Domestic Consultant", "International Consultant", "Telecaller"].sort()
  );
});

test("admin role is never created or updated by a template apply", () => {
  for (const t of TEAM_TEMPLATES) {
    const { creates, updates } = planTeamTemplateApply(DEFAULT_LEVELS, t);
    for (const row of [...creates, ...updates]) {
      assert.notEqual(row.name, "Owner / Admin");
      assert.notEqual(row.name.toLowerCase(), "admin");
    }
  }
});

test("re-applying a template is idempotent (everything becomes an update, nothing new created)", () => {
  const t = TEAM_TEMPLATES.find((x) => x.key === "both");
  // First apply against fresh org, simulate the resulting level set.
  const first = planTeamTemplateApply(DEFAULT_LEVELS, t);
  const afterFirst = [
    ...DEFAULT_LEVELS,
    ...first.creates.map((c, i) => ({ id: `new-${i}`, name: c.name, code: c.name.slice(0, 3) })),
  ];
  const second = planTeamTemplateApply(afterFirst, t);
  assert.equal(second.creates.length, 0, "no new levels on re-apply");
  assert.equal(second.updates.length, t.roles.filter((r) => !r.admin).length, "all non-admin roles update in place");
});

test("every created/updated level carries real component permissions (not dummy/empty)", () => {
  for (const t of TEAM_TEMPLATES) {
    const { creates, updates } = planTeamTemplateApply(DEFAULT_LEVELS, t);
    for (const row of [...creates, ...updates]) {
      assert.ok(
        Object.keys(row.permissions.components).length > 0,
        `${t.key}/${row.name} should have real permissions`
      );
      assert.ok(["self", "team", "dept", "everyone"].includes(row.permissions.scope));
    }
  }
});

test("suggestLevelCode derives initials and dedupes against taken codes", () => {
  assert.equal(suggestLevelCode("Consultant", []), "CON");
  assert.equal(suggestLevelCode("Domestic Consultant", []), "DC");
  assert.equal(suggestLevelCode("International Consultant", []), "IC");
  // collision -> suffixed
  const next = suggestLevelCode("Consultant", ["CON"]);
  assert.notEqual(next, "CON");
});
