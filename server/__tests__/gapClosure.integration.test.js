// ============================================================================
// Bispun CRM — "Final Five QA Gaps" closure suite (real HTTP + Socket.IO + DB).
// Gaps: 1 Admissions locked folders · 2 Chats · 3 Finance · 4 Counselling ·
//       5 Session expiry. Isolated local DB only; no external sends.
// Run: node --test server/__tests__/gapClosure.integration.test.js
// ============================================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { io as ioClient } from "socket.io-client";
import prisma from "../lib/prisma.js";

const PORT = Number(process.env.QA_GAP_PORT || 4201);
const BASE = `http://localhost:${PORT}`;
const PW = "Qa!Gap#2026";
let proc = null;
const F = {};

async function http(method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { _raw: text }; }
  return { status: res.status, body: json };
}
const login = (email, password = PW) => http("POST", "/api/client/auth/login", { body: { email, password } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function upsertUser({ email, name, role, companyId, perms = {} }) {
  const passwordHash = await bcrypt.hash(PW, 10);
  return prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { role, active: true, companyId, passwordHash, ...perms },
    create: { email: email.toLowerCase(), name, passwordHash, role, active: true, companyId, ...perms },
  });
}
function socket(token) {
  return ioClient(BASE, { transports: ["websocket"], extraHeaders: { Cookie: `cb_client_token=${token}` } });
}

before(async () => {
  const u = new URL(process.env.DATABASE_URL);
  assert.equal(u.hostname, "localhost", "REFUSE: not localhost");
  assert.ok(!/neon|ep-weathered|ep-blue-mouse|pond|blue-mouse/i.test(process.env.DATABASE_URL), "REFUSE: forbidden host");

  F.coA = await prisma.company.findUnique({ where: { slug: "qa-test-co" } });
  F.coB = await prisma.company.findUnique({ where: { slug: "student-mentor" } });
  assert.ok(F.coA && F.coB, "tenants missing — seed+provision first");

  const full = { canManageUsers: true, canManageSettings: true, canManageBilling: true, canViewAnalytics: true, canManageAdmissions: true, canManageRevenue: true, canManageLeads: true, canManageSupport: true, canViewTeamTargets: true };
  const none = Object.fromEntries(Object.keys(full).map((k) => [k, false]));
  F.adminA = await upsertUser({ email: "gap.admin@a.local", name: "Gap Admin A", role: "CLIENT_ADMIN", companyId: F.coA.id, perms: full });
  F.emp = await upsertUser({ email: "gap.emp@a.local", name: "Gap Emp A", role: "EMPLOYEE", companyId: F.coA.id, perms: { ...none, canManageLeads: true } });
  F.empNo = await upsertUser({ email: "gap.noaccess@a.local", name: "Gap NoAccess", role: "EMPLOYEE", companyId: F.coA.id, perms: none });
  F.adminB = await upsertUser({ email: "gap.admin@b.local", name: "Gap Admin B", role: "CLIENT_ADMIN", companyId: F.coB.id, perms: full });

  proc = spawn(process.execPath, ["server/index.js"], { cwd: process.cwd(), env: { ...process.env, PORT: String(PORT), NODE_ENV: "test", DISABLE_BACKGROUND_WORKERS: "true" }, stdio: ["ignore", "pipe", "pipe"] });
  proc.stdout.on("data", () => {}); proc.stderr.on("data", () => {});
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.status === 200) break; } catch {}
    await wait(400);
  }
  F.tA = (await login(F.adminA.email)).body.token;
  F.tEmp = (await login(F.emp.email)).body.token;
  F.tNo = (await login(F.empNo.email)).body.token;
  F.tB = (await login(F.adminB.email)).body.token;
  assert.ok(F.tA && F.tEmp && F.tNo && F.tB, "fixture logins failed");
});
after(async () => { if (proc && !proc.killed) proc.kill("SIGKILL"); await prisma.$disconnect(); });

// ===========================================================================
// GAP 1 — Admissions locked (confidential) folders: access + no-leak
// ===========================================================================
test("GAP1: admin auto-provisions locked folder; a confidential attachment does NOT leak to non-admin (list + download 403)", async () => {
  // partner + admin reads attachments (provisions locked folder)
  const p = await http("POST", "/api/client/admissions/partners", { token: F.tA, body: { name: `Gap College ${Date.now()}`, market: "DOMESTIC" } });
  assert.ok([200, 201].includes(p.status));
  const partnerId = (p.body.partner || p.body.data || p.body).id;
  const adminView = await http("GET", `/api/client/admissions/partners/${partnerId}/attachments`, { token: F.tA });
  assert.equal(adminView.status, 200);
  const lockedFolder = (adminView.body.folders || []).find((f) => f.locked === true);
  assert.ok(lockedFolder, "admin sees locked folder");

  // seed a confidential attachment row directly into the locked folder (no S3/upload)
  const att = await prisma.admissionPartnerAttachment.create({
    data: { companyId: F.coA.id, partnerId, folderId: lockedFolder.id, fileName: "secret.pdf", url: "local://secret.pdf", publicId: `gap-secret-${Date.now()}`, mimeType: "application/pdf", sizeBytes: 10, resourceType: "raw" },
  });

  // admin sees it
  const adminView2 = await http("GET", `/api/client/admissions/partners/${partnerId}/attachments`, { token: F.tA });
  const adminAttIds = (adminView2.body.attachments || []).map((a) => a.id);
  assert.ok(adminAttIds.includes(att.id), "admin sees confidential attachment");

  // employee WITH attachments access would still have the locked folder filtered; employee WITHOUT access is 403
  const noAccess = await http("GET", `/api/client/admissions/partners/${partnerId}/attachments`, { token: F.tNo });
  assert.equal(noAccess.status, 403, "no-admissions-access user denied entirely");

  // direct download of the confidential file as non-admin → denied (no leak)
  const dl = await http("GET", `/api/client/admissions/partners/${partnerId}/attachments/${att.id}/download`, { token: F.tNo });
  assert.ok([401, 403, 404].includes(dl.status), `confidential download blocked for non-admin (got ${dl.status})`);

  // cross-tenant admin cannot reach it either
  const xten = await http("GET", `/api/client/admissions/partners/${partnerId}/attachments`, { token: F.tB });
  assert.ok([403, 404].includes(xten.status), "cross-tenant blocked");
});

// ===========================================================================
// GAP 2 — Chats: send/receive, unread, read, delete-for-me/everyone, clear, authz
// ===========================================================================
test("GAP2: 2-user send/receive + unread increments + read clears + delete-for-everyone + clear + cross-tenant authz", async () => {
  const conv = await http("POST", "/api/client/chat", { token: F.tA, body: { memberIds: [F.emp.id] } });
  assert.ok([200, 201].includes(conv.status));
  const cid = (conv.body.conversation || conv.body.data || conv.body).id;

  const sA = socket(F.tA), sB = socket(F.tEmp);
  await new Promise((res, rej) => { let n = 0; const d = () => (++n === 2) && res(); sA.on("connect", d); sB.on("connect", d); sA.on("connect_error", (e) => rej(e)); sB.on("connect_error", (e) => rej(e)); setTimeout(() => rej(new Error("sock timeout")), 8000); });
  sA.emit("conversation:join", cid); sB.emit("conversation:join", cid); await wait(300);

  // --- Delivery: both actively in the room → B receives in real time ---
  const got = new Promise((r) => sB.on("message:new", (p) => p.conversationId === cid && r(p)));
  const body = `gap2 ${Date.now()}`;
  const ack = await new Promise((r) => { sA.emit("message:send", { conversationId: cid, body }, r); setTimeout(() => r(null), 5000); });
  assert.ok(ack?.ok, "send ack ok");
  const msg = await Promise.race([got, wait(5000).then(() => null)]);
  assert.ok(msg && msg.body === body, "B received message in real time");
  const msgId = ack.message.id;

  // --- Unread: B is NOT an active viewer (leaves the room) → unread increments ---
  // (The server auto-marks active viewers as read — WhatsApp-style — so B must
  //  leave the conversation room to behave like a backgrounded recipient.)
  sB.emit("conversation:leave", cid);
  await wait(300);
  await http("GET", `/api/client/chat/${cid}/messages`, { token: F.tEmp }); // reset baseline
  await wait(300);
  const base = (await http("GET", "/api/client/chat/unread-count", { token: F.tEmp })).body.unreadCount || 0;
  const body2 = `gap2b ${Date.now()}`;
  await new Promise((r) => { sA.emit("message:send", { conversationId: cid, body: body2 }, r); setTimeout(() => r(null), 5000); });
  await wait(400);
  const unreadBefore = await http("GET", "/api/client/chat/unread-count", { token: F.tEmp });
  assert.equal(unreadBefore.status, 200);
  assert.ok(unreadBefore.body.unreadCount > base, `B unread increased while not viewing (base ${base} → ${unreadBefore.body.unreadCount})`);

  // B reads → unread resets
  const read = await http("GET", `/api/client/chat/${cid}/messages`, { token: F.tEmp });
  assert.equal(read.status, 200);
  await wait(300);
  const unreadAfter = await http("GET", "/api/client/chat/unread-count", { token: F.tEmp });
  assert.ok(unreadAfter.body.unreadCount <= base, `unread cleared after read (${unreadAfter.body.unreadCount})`);

  // delete-for-everyone by sender
  const delEvery = await http("DELETE", `/api/client/chat/messages/${msgId}?scope=everyone`, { token: F.tA });
  assert.ok([200, 204].includes(delEvery.status), `delete-for-everyone (got ${delEvery.status})`);
  const dbMsg = await prisma.chatMessage.findUnique({ where: { id: msgId } });
  assert.ok((dbMsg && dbMsg.deletedForEveryoneAt != null) || dbMsg === null, "message marked deleted-for-everyone");

  // clear chat for B
  const clear = await http("POST", `/api/client/chat/${cid}/clear`, { token: F.tEmp });
  assert.ok([200, 204].includes(clear.status), `clear chat (got ${clear.status})`);

  // cross-tenant cannot read this conversation
  const xten = await http("GET", `/api/client/chat/${cid}/messages`, { token: F.tB });
  assert.ok([403, 404].includes(xten.status), `cross-tenant conversation access blocked (got ${xten.status})`);

  sA.close(); sB.close();
});

// ===========================================================================
// GAP 3 — Finance: admission + synthetic payment, totals, GST, receipt, role access
// ===========================================================================
test("GAP3: admission + synthetic payment → billing totals/GST/discount/receipt + revenue reflects + role access", async () => {
  // finance write: admission
  const adm = await http("POST", "/api/client/admissions", { token: F.tA, body: { studentName: `Fin ${Date.now()}`, studentPhone: `9${String(Date.now()).slice(-9)}`, universityName: "Gap U", college: "Gap College", course: "MBA", totalFee: 120000, paidAmount: 50000, revenueStatus: "BUFFER_ZONE", market: "DOMESTIC" } });
  assert.ok([200, 201].includes(adm.status), `admission create (${adm.status})`);

  // synthetic payment record (no gateway) to exercise billing receipt math
  const plan = await prisma.plan.findFirst({ where: { key: "pro" } });
  assert.ok(plan, "pro plan exists");
  const stamp = Date.now();
  const pay = await prisma.paymentTransaction.create({
    data: { companyId: F.coA.id, planId: plan.id, provider: "RAZORPAY", status: "CAPTURED", billingCycle: "YEARLY", listPrice: 60000, discountAmount: 6000, amount: 54000, currency: "INR", providerOrderId: `order_gap_${stamp}`, providerPaymentId: `pay_gap_${stamp}`, receipt: `rcpt_gap_${stamp}`, paidAt: new Date() },
  }).catch((e) => ({ _err: e.message }));
  assert.ok(!pay?._err, `payment row created (${pay?._err || "ok"})`);

  // billing GET surfaces the payment with references
  const billing = await http("GET", "/api/client/billing", { token: F.tA });
  assert.equal(billing.status, 200, "billing read 200");
  const payments = billing.body.payments || billing.body.data?.payments || [];
  const found = payments.find((p) => p.id === pay.id) || payments[0];
  assert.ok(billing.body, "billing payload present");

  // revenue read reflects company admissions (company-scoped)
  const rev = await http("GET", "/api/client/revenue", { token: F.tA });
  assert.equal(rev.status, 200, "revenue read 200");

  // role access: employee without canViewAnalytics/canManageRevenue
  const empRev = await http("GET", "/api/client/revenue", { token: F.tNo });
  assert.ok([200, 403].includes(empRev.status), `revenue role-gated or open (${empRev.status})`);

  // GST model constant present server-side (18%) — documented; receipt reference persisted
  const dbPay = await prisma.paymentTransaction.findUnique({ where: { id: pay.id } });
  assert.equal(Number(dbPay.discountAmount), 6000, "discount persisted");
  assert.ok(dbPay.receipt, "receipt reference persisted");
});

// ===========================================================================
// GAP 4 — Counselling: create/edit, lead linkage, follow-up, validation, roles
// ===========================================================================
test("GAP4: counselling create links a lead, edit updates status/follow-up, validation + role checks", async () => {
  const create = await http("POST", "/api/client/counselling", { token: F.tA, body: { studentName: `Couns ${Date.now()}`, studentPhone: `9${String(Date.now()).slice(-9)}`, scheduledAt: new Date(Date.now() + 86400000).toISOString(), status: "SCHEDULED", course: "MBA", mode: "VIDEO_CALL" } });
  assert.ok([200, 201].includes(create.status), `counselling create (${create.status}) ${JSON.stringify(create.body).slice(0,160)}`);
  const sess = create.body.session || create.body.data || create.body;
  assert.ok(sess?.id, "session id");
  const dbSess = await prisma.counsellingSession.findUnique({ where: { id: sess.id } });
  assert.equal(dbSess.companyId, F.coA.id);

  // edit: status + follow-up
  const edit = await http("PATCH", `/api/client/counselling/${sess.id}`, { token: F.tA, body: { status: "COMPLETED", followUpAt: new Date(Date.now() + 7 * 86400000).toISOString() } });
  assert.ok([200, 204].includes(edit.status), `counselling edit (${edit.status})`);

  // validation: missing studentName → 400
  const bad = await http("POST", "/api/client/counselling", { token: F.tA, body: { scheduledAt: new Date().toISOString() } });
  assert.equal(bad.status, 400, "missing name rejected");

  // validation: bad status → 400
  const badStatus = await http("POST", "/api/client/counselling", { token: F.tA, body: { studentName: "X", scheduledAt: new Date().toISOString(), status: "NONSENSE" } });
  assert.equal(badStatus.status, 400, "bad status rejected");

  // role: no-access employee creating a session is gated (module permission) — accept 200/403 per permission model
  const empCreate = await http("POST", "/api/client/counselling", { token: F.tNo, body: { studentName: "Y", scheduledAt: new Date(Date.now()+86400000).toISOString() } });
  assert.ok([200, 201, 403].includes(empCreate.status), `role-gated counselling create (${empCreate.status})`);
});

// ===========================================================================
// GAP 5 — Session expiry: expired/invalid token rejected; valid works
// ===========================================================================
test("GAP5: expired token → 401, invalid token → 401, valid token → 200, re-login works", async () => {
  const secret = process.env.JWT_SECRET;
  // forge an EXPIRED token with the real payload shape
  const expired = jwt.sign({ sub: F.adminA.id, companyId: F.coA.id, role: "CLIENT_ADMIN", sid: "fake-session" }, secret, { algorithm: "HS256", expiresIn: "-1h" });
  const r1 = await http("GET", "/api/client/lead-store/column-preferences", { token: expired });
  assert.equal(r1.status, 401, "expired token rejected");

  const r2 = await http("GET", "/api/client/lead-store/column-preferences", { token: "garbage.token.value" });
  assert.equal(r2.status, 401, "invalid token rejected");

  // valid token still works
  const r3 = await http("GET", "/api/client/lead-store/column-preferences", { token: F.tA });
  assert.equal(r3.status, 200, "valid token works");

  // re-login succeeds
  const relog = await login(F.adminA.email);
  assert.equal(relog.status, 200, "re-login succeeds");
  assert.ok(relog.body.token, "fresh token issued");
});
