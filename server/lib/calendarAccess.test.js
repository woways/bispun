import { test } from "node:test";
import assert from "node:assert/strict";

import { canModifyCalendarEvent } from "./calendarAccess.js";

const admin = { userId: "admin1", role: "CLIENT_ADMIN" };
const emp1 = { userId: "emp1", role: "EMPLOYEE" };
const emp2 = { userId: "emp2", role: "EMPLOYEE" };

test("CLIENT_ADMIN can modify any event", () => {
  assert.equal(
    canModifyCalendarEvent(admin, { createdByUserId: "emp1", assignedToUserId: "emp2" }),
    true
  );
});

test("creator can modify their own event", () => {
  assert.equal(
    canModifyCalendarEvent(emp1, { createdByUserId: "emp1", assignedToUserId: null }),
    true
  );
});

test("assignee can modify an event assigned to them", () => {
  assert.equal(
    canModifyCalendarEvent(emp2, { createdByUserId: "emp1", assignedToUserId: "emp2" }),
    true
  );
});

test("a different employee cannot modify someone else's event", () => {
  assert.equal(
    canModifyCalendarEvent(emp2, { createdByUserId: "emp1", assignedToUserId: null }),
    false
  );
});

test("missing user or event is denied", () => {
  assert.equal(canModifyCalendarEvent(null, { createdByUserId: "emp1" }), false);
  assert.equal(canModifyCalendarEvent(emp1, null), false);
});

test("legacy event with no creator/assignee is not editable by a non-admin", () => {
  assert.equal(
    canModifyCalendarEvent(emp1, { createdByUserId: null, assignedToUserId: null }),
    false
  );
  assert.equal(
    canModifyCalendarEvent(admin, { createdByUserId: null, assignedToUserId: null }),
    true
  );
});
