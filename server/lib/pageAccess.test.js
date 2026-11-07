import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAdmissionScope,
  dashboardSectionAllowed,
  financeSectionAllowed,
  insightsSectionAllowed,
} from "./pageAccess.js";

const access = {
  dashboard: { all: false, sections: ["business-pulse"] },
  admissions: {
    all: false,
    markets: ["DOMESTIC"],
    streamIds: [],
    collegeIds: ["college-1"],
    branchIds: [],
  },
  finance: { all: false, sections: ["expenses"] },
  insights: { all: false, sections: ["comparison"] },
};

test("section helpers allow only explicitly granted sections", () => {
  assert.equal(dashboardSectionAllowed(access, "EMPLOYEE", "business-pulse"), true);
  assert.equal(dashboardSectionAllowed(access, "EMPLOYEE", "team-performance"), false);
  assert.equal(financeSectionAllowed(access, "EMPLOYEE", "expenses"), true);
  assert.equal(financeSectionAllowed(access, "EMPLOYEE", "incentives"), false);
  assert.equal(insightsSectionAllowed(access, "EMPLOYEE", "comparison"), true);
  assert.equal(insightsSectionAllowed(access, "EMPLOYEE", "overview"), false);
});

test("Client Admin bypasses every granular section restriction", () => {
  assert.equal(financeSectionAllowed({}, "CLIENT_ADMIN", "incentives"), true);
  assert.equal(insightsSectionAllowed({}, "CLIENT_ADMIN", "overview"), true);
});

test("admission scope is ANDed into company queries", () => {
  const where = applyAdmissionScope(
    { companyId: "company-1", status: "ONGOING" },
    access,
    "MANAGER"
  );
  assert.equal(where.companyId, "company-1");
  assert.deepEqual(where.AND, [
    {
      OR: [
        { market: { in: ["DOMESTIC"] } },
        { partnerId: { in: ["college-1"] } },
      ],
    },
  ]);
});

