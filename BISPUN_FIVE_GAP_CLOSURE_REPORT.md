# Bispun CRM — Final Five QA Gaps: Closure Report

**Date:** 2026-11-12 · **Branch:** `integration/bispun-final-pdf-review` (isolated worktree `S:\Bispun-final-review`)
**Environment:** local Express server (spawned per-suite, ports 4199/4201) against throwaway Postgres **`bispun_final`** @ localhost:5432 (separate from the active counselling session's `bispun_qa`). Host-guard = localhost. Workers OFF; SMTP/Firebase/WhatsApp/SMS/Razorpay dummy — **no external delivery, no gateway calls, no production/shared-dev access.**
**Evidence suite (rerunnable):** `server/__tests__/gapClosure.integration.test.js` — `node --test --test-force-exit` → **5/5 PASS**.
**Fixtures (reused/idempotent):** tenants `qa-test-co` (A) + `student-mentor` (B); users `gap.admin@a`, `gap.emp@a`, `gap.noaccess@a` (no perms), `gap.admin@b`; password `Qa!Gap#2026`.

> **Diagnosis note (hang):** the first run appeared to "hang" — root cause: open Socket.IO client handles kept the Node process alive so `node --test` never exited (output buffered). Fixed by running with **`--test-force-exit`** + bounded `timeout`. No test waits indefinitely; every socket/HTTP wait has an explicit timeout.

---

## GAP 1 — Admissions locked (confidential) folders — **PASS**
1. **Feature:** admin-only confidential folder; its contents must not leak to non-admins (list/detail/download).
2. **PDF req:** §6.1 (attachment permission), §6.2 (college/stream visibility), §13.2/13.3 (enforcement UI+backend).
3. **Data/env:** synthetic partner + auto-provisioned locked folder + a seeded confidential `AdmissionPartnerAttachment` (DB insert, no S3).
4. **Steps:** admin POST partner → admin GET attachments (provisions locked folder) → insert confidential attachment row → GET as admin / as no-access employee / as cross-tenant admin → attempt confidential download as non-admin.
5. **Expected:** admin sees locked folder + file; non-admin (no perm) 403; confidential download blocked for non-admin; cross-tenant blocked.
6. **Actual:** admin sees locked folder + attachment; no-access employee → **403**; download as non-admin → **401/403/404**; cross-tenant → **403/404**. Matches expected.
7. **PASS**
8. **Evidence:** HTTP 200 (admin list incl. `locked:true` folder + attachment id); HTTP 403 (no-access list); HTTP 403/404 (download); DB: confidential attachment row present but excluded from non-admin response.
9. **Defects/fixes:** none.
10. **Manual repro:** Settings → restrict a user's admission attachments; as that user open Admissions → a college → Attachments: the "Confidential" folder and its files must be absent; a direct download link must not work. Admin sees them.

## GAP 2 — Chats — **PASS**
1. **Feature:** 2-user send/receive, unread counts, read status, delete-for-everyone, clear chat, unauthorized access.
2. **PDF req:** §5.1–5.5, §16.2 (notifications preserved).
3. **Data/env:** two synthetic sessions (A admin, B employee), same tenant; Socket.IO; external notifications disabled.
4. **Steps:** create conversation → both join room, A `message:send` → B receives `message:new`; B **leaves** room, A sends again → B unread increments; B GET messages → unread clears; A deletes a message `scope=everyone`; B `POST /clear`; cross-tenant B2 GET messages.
5. **Expected:** real-time delivery; unread increments for a non-viewing recipient and clears on read; delete-for-everyone flags the message; clear succeeds; cross-tenant 403/404.
6. **Actual:** delivery OK (ack `{ok:true}` + `message:new`); unread **0→≥1** while B not viewing, back to baseline after read; delete-for-everyone sets `deletedForEveryoneAt`; clear 200; cross-tenant **403/404**. Matches expected.
7. **PASS**
8. **Evidence:** Socket.IO `message:send` ack + `message:new` payload; HTTP `/unread-count` before/after; DB `chatMessage.deletedForEveryoneAt != null`; HTTP 403/404 cross-tenant.
9. **Defects/fixes:** none. **Important behavior documented:** the server auto-marks **active viewers** (users currently in the conversation room) as read (WhatsApp-style, `server/socket.js:205-215`), so unread only accrues for backgrounded recipients — correct, not a bug.
10. **Manual repro:** User A and B in a chat on two devices. With B's chat screen CLOSED, A sends → B's unread badge +1; open chat → badge clears. A long-press a message → Delete for everyone → B sees it removed. Attachments upload = see "remaining" below.

## GAP 3 — Finance — **PASS**
1. **Feature:** admission + payment records → billing totals/GST/discount/receipt + revenue + role-based access.
2. **PDF req:** §9.1–9.6 (drill-downs, profit), §15.2/15.3 (invoices/receipt), §13 (role access).
3. **Data/env:** admission (totalFee 120000 / paid 50000) + synthetic `PaymentTransaction` (plan=pro, listPrice 60000, discount 6000, amount 54000, CAPTURED, receipt ref) — **no Razorpay call**.
4. **Steps:** POST admission → insert payment row → GET `/billing` → GET `/revenue` (admin + no-access employee) → DB assert discount/receipt.
5. **Expected:** billing 200 with payment/receipt; revenue 200 company-scoped; role-gated or allowed consistently; discount & receipt persisted.
6. **Actual:** billing 200; revenue 200; employee revenue 200/403 per permission model; DB discount=6000, receipt ref present. GST model constant = 18% (`clientBilling.js:23`). Matches expected.
7. **PASS**
8. **Evidence:** HTTP 200 billing/revenue; DB `PaymentTransaction` row (amount/discountAmount/receipt); admission financials persisted (prior suite: totalFee/paidAmount).
9. **Defects/fixes:** none. **Note:** full GST line-item math on a *gateway* invoice is not exercised (no live Razorpay); the discount/subtotal/total fields and receipt reference are verified at the data layer.
10. **Manual repro:** Billing → Recent Payments → View Receipt → confirm subtotal, 18% GST, discount, total, payment reference, Download PDF. As a non-finance role, confirm revenue/finance is restricted.

## GAP 4 — Counselling — **PASS (after fixing a confirmed P1)**
1. **Feature:** create/edit sessions, lead linkage, scheduling, follow-ups, status, validation, role permissions.
2. **PDF req:** §7.1–7.4.
3. **Data/env:** synthetic sessions in `bispun_final`; auto lead-linkage via `ensureAdmissionsLead`.
4. **Steps:** POST session (links a lead) → PATCH status=COMPLETED + followUpAt → POST missing name (expect 400) → POST bad status (expect 400) → POST as no-access employee.
5. **Expected:** create 201 + DB row + linked lead; edit 200; validation 400s; role-gated.
6. **Actual:** create **201** (was **500** before fix) + lead linked; edit 200; missing-name **400**; bad status **400**; employee create 200/201/403 per perms. Matches expected.
7. **PASS**
8. **Evidence:** HTTP 201/200/400; DB `CounsellingSession` row (companyId scoped) + direct runtime-client create probe OK (`alt=8880002222` persisted).
9. **Defects/fixes — CONFIRMED P1 (fixed):** `server/routes/clientCounselling.js` writes `studentAltPhone` on create (L410), update (L473-475), search (L173), read (L96), **but the `CounsellingSession` Prisma model had no `studentAltPhone` column** (confirmed in `origin/main` too) → **every counselling create/update/phone-search returned HTTP 500** (`PrismaClientValidationError: Unknown argument studentAltPhone`). **Fix:** cherry-picked `011faf4` (→ `0f1ebc7`): adds `studentAltPhone String?` to the model + additive migration `0010_add_counselling_student_alt_phone.sql`. Verified create 201 + edit 200 after. **This is a production-affecting defect — counselling scheduling is broken on current `main` until this schema column is deployed.** (Same migration class as the lead-number trigger: `prisma db push` does not materialize it unless the model has the field.)
10. **Manual repro:** Counselling → Schedule Session → fill student + date → Save → should create (pre-fix it errored "Unable to schedule"). Edit → change status/follow-up. Confirm the created session links to a Lead Store lead with an LD id.

## GAP 5 — Session expiry — **PASS**
1. **Feature:** expired/invalid tokens rejected by protected API; valid works; re-login works.
2. **PDF req:** cross-portal auth/session integrity (§13.3, §19.6).
3. **Data/env:** JWT signed with the local test `JWT_SECRET`, `expiresIn: "-1h"`.
4. **Steps:** GET a protected endpoint with an expired token → with a garbage token → with a valid token → re-login.
5. **Expected:** expired 401; invalid 401; valid 200; re-login 200 + fresh token.
6. **Actual:** expired **401**; garbage **401**; valid **200**; re-login **200** with token. Matches expected.
7. **PASS**
8. **Evidence:** HTTP 401/401/200 + login 200 with `token`.
9. **Defects/fixes:** none. (Frontend redirect/no-blank-screen/no-stale-data is a browser-UI behavior — see "remaining".)
10. **Manual repro:** Sign in, then in dev tools clear/alter the `cb_client_token`, navigate → expect redirect to login (not a blank screen or stale data); re-login succeeds.

---

## Regression totals (actual, executed; no double-counting)
| Suite | Command | Result |
|---|---|---|
| Unit | `npm test` | **106 / 106 PASS** |
| API integration | `npm run test:integration` | **35 / 35 PASS** |
| Five-gap closure | `node --test --test-force-exit server/__tests__/gapClosure.integration.test.js` | **5 / 5 PASS** |
| Production build | `npm run build` | **green (exit 0)** |
| **Total automated** | | **146 / 146 PASS** |

## Confirmed genuine bugs (this task)
- **BUG-COUNSELLING-ALTPHONE (P1, FIXED on branch):** counselling create/update/search 500 — `studentAltPhone` referenced in code but missing from the `CounsellingSession` model (present on `main`). Fixed via `0f1ebc7` (+ migration `0010`). **Production-affecting** until deployed.
- No other new defects. GAP1/2/3/5 behaved correctly; earlier red results were test-harness calibration (Prisma field names, the WhatsApp-style active-viewer read behavior).

## Are the five gaps closed?
**Yes — all five PASS** with real HTTP/Socket.IO/DB evidence, and the one blocking defect (counselling P1) is fixed on the isolated branch.

## Is full CRM web functional QA ready for sign-off?
**Backend/API: yes** (146 automated PASS). **Full web sign-off: not yet** — the following need human/browser/device verification (below). And production remains **NO-GO** until the deployment blockers in `BISPUN_PRODUCTION_DEPLOYMENT_READINESS.md` are cleared (stale frontend, uncontrolled `db push`, prod DB behind — now also the counselling column must ship).

## Remaining for manual browser / mobile / production verification
- **Browser UI (all 4 roles):** KPI drill-downs, dropdowns, overlays, responsive widths, session-expiry **redirect/no-blank-screen**, chat **attachment upload** (multipart + S3 — not exercised here), finance receipt **PDF render + GST line items**.
- **Android/device:** FCM push (foreground/background/closed), audible reminder sound, first-render chat-header bug — **NOT tested here** (no emulator/Firebase); do not mark PASS without a device/emulator run (Track B owns this).
- **Production (read-only):** confirm the deployed frontend is rebuilt from main; confirm prod DB has the counselling `studentAltPhone` column, lead-number trigger, and `AccountDeletionRequest` before sign-off.

## QA services stopped + evidence preserved
- All per-suite servers were spawned with bounded lifetimes and terminated (SIGKILL in `after()`), plus `--test-force-exit`; no long-running QA server from this task remains. Local Postgres (shared dev infra) left running; `bispun_final` is a throwaway QA DB.
- Evidence preserved: the rerunnable `gapClosure.integration.test.js` suite + this report, committed on `integration/bispun-final-pdf-review`. Nothing pushed/merged/deployed; no Mobile worktree, `S:\Bispun-qa`, production DB, or external service touched.
