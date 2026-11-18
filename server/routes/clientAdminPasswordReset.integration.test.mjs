// Integration test — requires the dev server running on :4000 and blue-mouse DB.
// Run: node server/routes/clientAdminPasswordReset.integration.test.mjs
// Creates + deletes synthetic @example.test fixtures only. Never touches pond.
import prisma from "../lib/prisma.js";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:4000";
const results = [];
const ok = (name, cond, extra = "") => { results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };

async function http(method, path, { token, data } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${BASE}${path}`, { method, headers, body: data ? JSON.stringify(data) : undefined });
      let body = {};
      try { body = await r.json(); } catch { body = {}; }
      return { status: r.status, body };
    } catch (e) {
      if (attempt === 2) return { status: 0, body: { _err: String(e.message || e).split("\n")[0] } };
      await new Promise((res) => setTimeout(res, 800));
    }
  }
}

const ids = {};
try {
  const saPass = "SuperSecret9", oldPass = "OldPass123", newPass = "NewPass456";
  const sa = await prisma.user.create({ data: { name: "QA SA Reset", email: "qa.sa.reset@example.test", passwordHash: await bcrypt.hash(saPass, 12), role: "SUPER_ADMIN", active: true } });
  const coA = await prisma.company.create({ data: { name: "QA Reset Co A", slug: "qa-reset-co-a-" + Date.now(), status: "ACTIVE" } });
  const coB = await prisma.company.create({ data: { name: "QA Reset Co B", slug: "qa-reset-co-b-" + Date.now(), status: "ACTIVE" } });
  const caA = await prisma.user.create({ data: { name: "QA CA A", email: "qa.reset.a@example.test", passwordHash: await bcrypt.hash(oldPass, 12), role: "CLIENT_ADMIN", active: true, companyId: coA.id } });
  const caB = await prisma.user.create({ data: { name: "QA CA B", email: "qa.reset.b@example.test", passwordHash: await bcrypt.hash(oldPass, 12), role: "CLIENT_ADMIN", active: true, companyId: coB.id } });
  Object.assign(ids, { sa: sa.id, coA: coA.id, coB: coB.id, caA: caA.id, caB: caB.id });

  const saLogin = await http("POST", "/api/admin/auth/login", { data: { email: sa.email, password: saPass } });
  const saToken = saLogin.body?.token;
  ok("1. SUPER_ADMIN admin-login succeeds", saLogin.status === 200 && !!saToken, `status ${saLogin.status}`);

  const caLogin = await http("POST", "/api/client/auth/login", { data: { email: caB.email, password: oldPass } });
  const unauth = await http("POST", `/api/admin/clients/${coA.id}/client-admins/${caA.id}/reset-password`, { token: caLogin.body?.token, data: { newPassword: newPass, confirmPassword: newPass } });
  ok("2. Non-super-admin rejected", unauth.status === 401 || unauth.status === 403, `status ${unauth.status}`);

  await http("POST", "/api/client/auth/login", { data: { email: caA.email, password: oldPass } });
  const sessBefore = await prisma.clientSession.count({ where: { userId: caA.id } });
  ok("3. Client admin A has a live session before reset", sessBefore >= 1, `sessions=${sessBefore}`);

  const cross = await http("POST", `/api/admin/clients/${coB.id}/client-admins/${caA.id}/reset-password`, { token: saToken, data: { newPassword: newPass, confirmPassword: newPass } });
  ok("4. Cross-company reset rejected (404)", cross.status === 404, `status ${cross.status}`);

  const weak = await http("POST", `/api/admin/clients/${coA.id}/client-admins/${caA.id}/reset-password`, { token: saToken, data: { newPassword: "weak", confirmPassword: "weak" } });
  ok("5. Weak password rejected (400)", weak.status === 400, `status ${weak.status}`);

  const reset = await http("POST", `/api/admin/clients/${coA.id}/client-admins/${caA.id}/reset-password`, { token: saToken, data: { newPassword: newPass, confirmPassword: newPass } });
  ok("6. Authorized reset succeeds (200)", reset.status === 200, `status ${reset.status}`);
  ok("7. Reset response does NOT echo the password", !JSON.stringify(reset.body).includes(newPass));

  const sessAfter = await prisma.clientSession.count({ where: { userId: caA.id } });
  ok("8. Existing sessions invalidated after reset", sessAfter === 0, `sessions=${sessAfter}`);

  const oldTry = await http("POST", "/api/client/auth/login", { data: { email: caA.email, password: oldPass } });
  ok("9. Old password rejected at /login (401)", oldTry.status === 401, `status ${oldTry.status}`);
  const newTry = await http("POST", "/api/client/auth/login", { data: { email: caA.email, password: newPass } });
  ok("10. New password accepted at /login (200)", newTry.status === 200, `status ${newTry.status}`);

  const audit = await prisma.superAdminAuditLog.count({ where: { action: "CLIENT_ADMIN_PASSWORD_RESET", entityId: caA.id } }).catch(() => -1);
  ok("11. Audit event recorded", audit >= 1, `count=${audit}`);
} catch (e) {
  results.push("FAIL  harness error — " + (e.message || "").split("\n")[0]);
} finally {
  try {
    await prisma.superAdminAuditLog.deleteMany({ where: { entityId: ids.caA } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { contains: "@example.test" } } });
    await prisma.company.deleteMany({ where: { id: { in: [ids.coA, ids.coB].filter(Boolean) } } });
    const leftover = await prisma.user.count({ where: { email: { contains: "@example.test" } } });
    results.push(`CLEANUP  remaining @example.test fixtures: ${leftover} (should be 0)`);
  } catch (e) { results.push("CLEANUP ERROR — " + (e.message || "").split("\n")[0]); }
  console.log(results.join("\n"));
  process.exit(0);
}
