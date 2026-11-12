import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeName,
  computeVisibleUsers,
  buildScope,
  leadVisibilityWhere,
  canViewLead,
  datasetVisibilityWhere,
  callHistoryWhere,
} from "./leadVisibility.js";

const COMPANY_USERS = [
  { id: "admin1", name: "Client Admin", role: "CLIENT_ADMIN", department: "Admin" },
  { id: "mgr1", name: "Sales Manager", role: "MANAGER", department: "Sales" },
  { id: "emp1", name: "Employee One", role: "EMPLOYEE", department: "Sales" },
  { id: "emp2", name: "Employee Two", role: "EMPLOYEE", department: "Sales" },
  { id: "emp3", name: "Employee Three", role: "EMPLOYEE", department: "Support" },
];

test("normalizeName trims, lowercases and collapses spaces", () => {
  assert.equal(normalizeName("  Santoshi   K  "), "santoshi k");
  assert.equal(normalizeName(null), "");
});

test("EMPLOYEE only sees themselves", () => {
  const emp = COMPANY_USERS[2];
  const visible = computeVisibleUsers(emp, COMPANY_USERS);
  assert.deepEqual(visible.map((u) => u.id), ["emp1"]);
});

test("MANAGER with a department sees self + same-department team", () => {
  const mgr = COMPANY_USERS[1];
  const visible = computeVisibleUsers(mgr, COMPANY_USERS).map((u) => u.id).sort();
  // Sales dept: mgr1, emp1, emp2 (not emp3 in Support, not admin)
  assert.deepEqual(visible, ["emp1", "emp2", "mgr1"]);
});

test("CLIENT_ADMIN sees everyone", () => {
  const admin = COMPANY_USERS[0];
  const visible = computeVisibleUsers(admin, COMPANY_USERS);
  assert.equal(visible.length, COMPANY_USERS.length);
});

test("admin scope has no restriction (null ids, where null)", () => {
  const scope = buildScope(COMPANY_USERS[0], COMPANY_USERS);
  assert.equal(scope.isAdmin, true);
  assert.equal(scope.visibleUserIds, null);
  assert.equal(leadVisibilityWhere(scope), null);
  assert.equal(datasetVisibilityWhere(scope), null);
});

test("employee lead where matches own assigned id + case-insensitive name", () => {
  const scope = buildScope(COMPANY_USERS[2], COMPANY_USERS); // emp1
  const where = leadVisibilityWhere(scope);
  assert.ok(where.OR, "expected an OR clause");
  const idClause = where.OR.find((c) => c.assignedToUserId?.in);
  assert.deepEqual(idClause.assignedToUserId.in, ["emp1"]);
  // Name matching must be case-insensitive to stay consistent with canViewLead
  // (which normalizes case). Each visible name is an insensitive equals clause.
  const nameClause = where.OR.find((c) => c.assignedToName?.equals);
  assert.equal(nameClause.assignedToName.equals, "Employee One");
  assert.equal(nameClause.assignedToName.mode, "insensitive");
  // No case-sensitive `in` clause should remain.
  assert.equal(where.OR.find((c) => c.assignedToName?.in), undefined);
});

test("manager name matching is case-insensitive for each team member", () => {
  const scope = buildScope(COMPANY_USERS[1], COMPANY_USERS); // Sales manager: mgr1, emp1, emp2
  const where = leadVisibilityWhere(scope);
  const nameClauses = where.OR.filter((c) => c.assignedToName?.equals);
  assert.equal(nameClauses.length, 3);
  assert.ok(nameClauses.every((c) => c.assignedToName.mode === "insensitive"));
});

test("canViewLead: employee can see own lead by id, not others", () => {
  const scope = buildScope(COMPANY_USERS[2], COMPANY_USERS); // emp1
  assert.equal(canViewLead(scope, { assignedToUserId: "emp1" }), true);
  assert.equal(canViewLead(scope, { assignedToUserId: "emp2" }), false);
});

test("canViewLead: unassigned lead hidden from employee", () => {
  const scope = buildScope(COMPANY_USERS[2], COMPANY_USERS); // emp1
  assert.equal(
    canViewLead(scope, { assignedToUserId: null, assignedToName: null }),
    false
  );
});

test("canViewLead: name-assigned lead visible to the matching employee", () => {
  const scope = buildScope(COMPANY_USERS[2], COMPANY_USERS); // emp1 = "Employee One"
  // Lead Store bulk-assign sets only assignedToName (null id).
  assert.equal(
    canViewLead(scope, { assignedToUserId: null, assignedToName: "employee one" }),
    true
  );
  assert.equal(
    canViewLead(scope, { assignedToUserId: null, assignedToName: "Employee Two" }),
    false
  );
});

test("canViewLead: admin sees everything", () => {
  const scope = buildScope(COMPANY_USERS[0], COMPANY_USERS);
  assert.equal(canViewLead(scope, { assignedToUserId: "emp2" }), true);
  assert.equal(canViewLead(scope, { assignedToUserId: null }), true);
});

test("manager canViewLead covers team members, not outsiders", () => {
  const scope = buildScope(COMPANY_USERS[1], COMPANY_USERS); // Sales manager
  assert.equal(canViewLead(scope, { assignedToUserId: "emp1" }), true); // Sales
  assert.equal(canViewLead(scope, { assignedToUserId: "emp3" }), false); // Support
});

test("datasetVisibilityWhere scopes by assignedToUserId for employee", () => {
  const scope = buildScope(COMPANY_USERS[2], COMPANY_USERS); // emp1
  assert.deepEqual(datasetVisibilityWhere(scope), {
    assignedToUserId: { in: ["emp1"] },
  });
});

test("callHistoryWhere: admin is companyId-only, no OR restriction", () => {
  const scope = buildScope(COMPANY_USERS[0], COMPANY_USERS);
  const where = callHistoryWhere({
    companyId: "c1",
    scope,
    actingUserId: "admin1",
    leadId: "lead-9",
  });
  assert.deepEqual(where, { companyId: "c1", leadId: "lead-9" });
});

test("callHistoryWhere: employee restricted to own calls OR calls on visible leads", () => {
  const scope = buildScope(COMPANY_USERS[2], COMPANY_USERS); // emp1
  const where = callHistoryWhere({
    companyId: "c1",
    scope,
    actingUserId: "emp1",
    leadId: "lead-9",
    visibleLeadIds: ["lead-9", "lead-10"],
  });
  assert.equal(where.companyId, "c1");
  assert.equal(where.leadId, "lead-9");
  assert.ok(Array.isArray(where.OR), "expected OR restriction for non-admin");
  const ownClause = where.OR.find((c) => c.userId === "emp1");
  assert.ok(ownClause, "own-calls clause missing");
  const leadClause = where.OR.find((c) => c.leadId?.in);
  assert.deepEqual(leadClause.leadId.in, ["lead-9", "lead-10"]);
});

test("callHistoryWhere: employee with no visible leads still sees only own calls", () => {
  const scope = buildScope(COMPANY_USERS[2], COMPANY_USERS); // emp1
  const where = callHistoryWhere({
    companyId: "c1",
    scope,
    actingUserId: "emp1",
    phone: "9998887777",
    visibleLeadIds: [],
  });
  assert.equal(where.companyId, "c1");
  assert.equal(where.phone, "9998887777");
  assert.deepEqual(where.OR, [{ userId: "emp1" }]);
});
