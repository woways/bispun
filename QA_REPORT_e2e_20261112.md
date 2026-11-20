# Bispun CRM — Isolated End-to-End API/CRM QA Report

**Date:** 2026-11-12
**Branch:** `qa-fix/e2e-20261112`
**Worktree:** `S:\Bispun-qa` (cut from approved production baseline `59a9908`)
**DB under test:** throwaway **local** Postgres `bispun_qa` @ `localhost:5432` (PG 18) — **no Neon host touched**
**Author:** Track A isolated QA session

---

## 1. Executive summary

| Metric | Result |
|---|---|
| Existing unit suite (`npm test`) | **106 / 106 PASS** |
| New API integration suite (`npm run test:integration`) | **35 / 35 PASS** (repeatable) |
| Areas with a verdict | 11 / 11 |
| **P1 — Lead Store column-preferences 500** | **RESOLVED / confirmed end-to-end** |
| Application bugs found needing a source fix | **0** |
| Environment/deploy risks flagged | **1** (lead-number trigger not in `db push`) |

All six initially-red integration tests were **test-harness calibration** (REST `201` vs `200`, a param name, a reserved folder name, dedup-by-phone, a permission gate) — **not** application defects. Each is documented in §6.

No merge, push, or deploy was performed. No external send occurred (workers disabled, all external creds dummy).

---

## 2. Isolation & safety (how the environment was built)

1. Started local Postgres (`pg_ctl`, data dir `scoop\persist\postgresql\data`), created `CREATE DATABASE bispun_qa` (owner `postgres`, trust auth on localhost).
2. Wrote **`S:\Bispun-qa\.env` (this worktree only)** — `DATABASE_URL`/`DIRECT_URL` → `postgresql://postgres@localhost:5432/bispun_qa`, `NODE_ENV=test`, `DISABLE_BACKGROUND_WORKERS=true`, `QA_EXPECTED_DB_HOST=localhost`, freshly-generated test-only `JWT_SECRET`/`OTP_SIGNING_SECRET`/`FILE_SIGNING_SECRET`, and **dummy** SMTP/Razorpay/Cloudinary/Google/AWS values. `.env` is gitignored (verified). `S:\Bispun-integ\.env` (production) and all other worktrees were left untouched.
3. **Host guard verified BEFORE any write**: resolved host asserted `localhost`; the provisioning script's guard was proven to **abort** on a Neon host (`ep-weathered-*.neon.tech/pond`) and on any non-localhost host.
4. `npm run prisma:generate` + `npm run prisma:push` → schema synced to local `bispun_qa` (61 tables). This materialized `User.leadStoreColumnOrder` (the P1 field, `String[]`).
5. Applied `prisma/pending-migrations/0005P_prod_stable_lead_number_nullable.sql` to the local DB — this creates the **`assign_company_lead_number` function + `Lead_assign_lead_number` BEFORE-INSERT trigger**, which `prisma db push` does **not** create (see §7 risk).
6. `node prisma/seed.js` → modules, plans, SUPER_ADMIN, and tenant **student-mentor** + its CLIENT_ADMIN (baseline global data, localhost only).
7. `node scripts/provisionQaTestCompany.js --execute` → isolated tenant **qa-test-co** + CLIENT_ADMIN, inside one transaction, no OTP/Razorpay/payment.

> **Note:** `scripts/provisionQaTestCompany.js` was **absent** from the approved baseline `59a9908` despite the task brief listing it as present. It was (re)created on this QA-fix branch, with the required dry-run default, `--execute` write mode, and the `QA_EXPECTED_DB_HOST` host-guard. Dry-run and execute both verified; the guard was confirmed to abort on forbidden hosts.

Result: **two tenants** (qa-test-co, student-mentor) + SUPER_ADMIN, giving genuine cross-tenant isolation coverage.

---

## 3. Test assets created (this branch only)

| File | Purpose |
|---|---|
| `server/__tests__/api.integration.test.js` | 35-case API integration suite (real HTTP + DB-row assertions) |
| `scripts/provisionQaTestCompany.js` | Isolated test-company provisioner (dry-run default, host-guard) |
| `package.json` | Added `test:integration` script |
| `.env` | Isolated local config (gitignored, not committed) |

The integration suite spawns `server/index.js` on a dedicated port (`4199`) against the local DB, logs in synthetic accounts of every role (CLIENT_ADMIN / MANAGER / EMPLOYEE in tenant A, CLIENT_ADMIN in tenant B, SUPER_ADMIN), and exercises real endpoints over HTTP, asserting both the HTTP response **and** the resulting database rows. It is idempotent (unique data per run) and re-runs green.

---

## 4. Area-by-area verdicts (HTTP + DB evidence)

| # | Area | Verdict | Evidence |
|---|---|---|---|
| 1 | **Authentication & sessions** | **PASS** | valid login → `200` + JWT + a `ClientSession` row persisted (count +1); wrong password → `401`; missing fields → `400`; no token → `401`; garbage bearer → `401`; SUPER_ADMIN blocked from client portal → `401` |
| 2 | **Lead Store column-preferences (P1)** | **PASS — P1 RESOLVED** | admin `GET` → `200 {canReorder:true}`; admin `PATCH` reorder → `200` and `User.leadStoreColumnOrder` updated in DB; non-array body → `400` |
| 3 | **Stable Lead IDs** | **PASS** | lead create → `leadNumber` auto-assigned, `leadDisplayId` = `LDxxx`, sequential within company; DB: **41/41 leads have a leadNumber, 0 NULLs** |
| 4 | **Role permissions** | **PASS** | EMPLOYEE w/o `canManageLeads` → lead-store `403` (module gate); EMPLOYEE w/ access but not admin/manager → `canReorder:false` and reorder `PATCH` `403`; MANAGER reorder → `200`; EMPLOYEE create-user → `403`; admin list org users → `200` |
| 5 | **Tenant isolation** | **PASS** | tenant B `PATCH` of a tenant A lead → `404` (DB confirms name unchanged); tenant B lead list excludes tenant A leads; chat user directory company-scoped (0 foreign users) |
| 6 | **Admissions + locked folders** | **PASS** | admissions list → `200`; admin read of a partner's attachments **auto-provisions exactly one `locked:true` folder** (DB-confirmed, migration 0009 column); locked folder rename → `403` (permanent) |
| 7 | **Counselling & walk-ins** | **PASS** | counselling options+list → `200`; walk-in create → `201` + `WalkIn` row (company-scoped) + linked admissions lead; walk-in list → `200` |
| 8 | **Analytics / dashboard** | **PASS** | `GET /analytics/dashboard` → `200` with payload |
| 9 | **Chats & notifications** | **PASS** | notifications list → `200`; chat conversation create (`memberIds`) → persisted `Conversation` row (company-scoped) |
| 10 | **Referrals lifecycle** | **PASS** | `GET /referrals/me` → `200` with referral code + reward program; tag a lead → `200`, double-tag same lead → `409` (**no double-referral**, exactly 1 `Referral` row); SUPER_ADMIN credit beyond earned ceiling → rejected (`400/409/422`) — **no double-credit** (complements existing `referralRewards` + `adminReferralsAuth` unit suites) |
| 11 | **Account deletion requests** | **PASS** | `POST /account/deletion-request` → `200`; durable `AuditLog` (`ACCOUNT_DELETION_REQUESTED`) row +1 **and** `AccountDeletionRequest` row persisted (migration 0008); no external email (SMTP dummy, fire-and-forget to localhost) |
| 12 | **Finance APIs (incl. writes)** | **PASS** | revenue read → `200`; **finance write**: admission create with `totalFee`/`paidAmount` → persisted `Admission` row with correct financials (DB-confirmed); revenue read company-scoped for tenant B |

**No area is FAIL or BLOCKED.**

### DB evidence snapshot (post-run, cumulative across runs)
```
companies=11  users=8  leads=41  leads_with_number=41  leads_null_number=0
client_sessions=55  walkins=9  admissions=3  locked_folders=2
referrals=9  deletion_requests=9  conversations=1  audit_deletion=9
```

---

## 5. The P1 confirmation (Lead Store column-preferences 500)

- Baseline `59a9908` **has** `User.leadStoreColumnOrder String[] @default([])` in `prisma/schema.prisma` and the route handlers in `server/routes/clientLeadStore.js` (`GET`/`PATCH /column-preferences`).
- The production 500 occurs only when the **DB column is missing** (schema not applied to that environment).
- After `prisma db push` to the isolated DB, both endpoints return **`200`** and the reorder **persists** (verified via HTTP and a direct `psql` read of `leadStoreColumnOrder`).
- **Conclusion:** the P1 is a schema/deploy issue, already fixed at the code+schema level on the baseline. **No source change required.** It is resolved for any environment where the schema is actually applied. Covered by integration tests #7–#11.

---

## 6. Initial red tests — all confirmed-correct behavior (not bugs)

| Symptom | Reality | Action |
|---|---|---|
| lead create expected `200`, got `201` | Route correctly returns `201 Created` | Test accepts `200/201` |
| employee GET column-prefs expected `200`, got `403` | Whole lead-store router requires `canManageLeads` (intentional module gate) | Split into a module-gate test (`403`) and a capability test (employee *with* access → `canReorder:false`) |
| chat create → `400 "Select at least one member"` | Body param is `memberIds`, not `participantIds` | Test fixed |
| admission create → `400 "Student phone is required"` | Admissions intentionally require a phone to link to Lead Store | Test supplies a unique `studentPhone` |
| folder "Confidential" → `409 reserved name` | `Confidential` is the reserved locked-folder name | Rewrote to the real feature (admin read auto-provisions the locked folder) |
| admission re-run → `409 already linked` | Admissions dedupe by student phone | Test uses a unique phone per run |

---

## 7. Observations / risk flagged (no code change made)

**R1 — Stable-lead-number trigger is not materialized by `prisma db push`.**
`Lead.leadNumber` is populated by a Postgres **trigger + function** (`assign_company_lead_number` / `Lead_assign_lead_number`) that lives only in `prisma/pending-migrations/0005*.sql`, **not** in `prisma/schema.prisma`. Any environment provisioned purely via `prisma db push` (without hand-applying `0005`/`0005P`) will insert leads with `leadNumber = NULL`, breaking the `LDxxx` display ID and the `@@unique([companyId, leadNumber])` guarantee. This is already documented inside `0005P` (which warns prod must apply it manually), but it is an easy footgun for any new/rebuilt environment. **Recommendation (for a future, separately-authorized change):** ensure deploy pipelines apply the pending SQL (or move the trigger into a managed migration), and add a startup/health assertion that the trigger exists. Flagged only — **not** fixed here.

---

## 8. Bugs fixed on this branch

**None required.** No application defect was discovered. The branch contains only **additive QA infrastructure** (integration suite, provisioning script, npm script). The P1 needed no source change (resolved by schema application).

---

## 9. Remaining / not covered (future QA)

- File-upload paths (attachments, chat upload, Excel import/export) — exercised structurally only; multipart upload flows not driven.
- Google Calendar / Meet, WhatsApp, telephony, Razorpay webhooks, Firebase push — intentionally disabled (dummy creds / workers off); require their own sandboxed harness.
- Nurture engine / calendar-reminder background workers — disabled per safety; not exercised.
- Deep referral **reward** state machine (CrmReferral Referred→Earned→Credited slab math across the full payout lifecycle) — the credit *ceiling / no-double-credit* invariant is covered here + by unit tests; the multi-step slab progression deserves a dedicated suite.
- Admin (SUPER_ADMIN) console breadth (clients, billing, plans, global usage) — only the referral-credit path was touched.
- Load/concurrency (e.g., concurrent lead creation racing the advisory-lock in the trigger).

---

## 10. How to reproduce

```bash
# from S:\Bispun-qa (branch qa-fix/e2e-20261112), local Postgres running, .env in place
npm run prisma:generate && npm run prisma:push
psql "postgresql://postgres@localhost:5432/bispun_qa" -f prisma/pending-migrations/0005P_prod_stable_lead_number_nullable.sql
node prisma/seed.js
node scripts/provisionQaTestCompany.js --execute
npm test              # 106/106 unit
npm run test:integration   # 35/35 integration (spawns server on :4199)
```

---

## 11. Guarantees honored

- ✅ Only the local `bispun_qa` DB was written. Host guard verified; proven to abort on Neon/non-localhost.
- ✅ No Neon prod (`pond`/`ep-weathered-*`) or shared dev (`blue-mouse`/`ep-blue-mouse-*`) access.
- ✅ No other worktree's `.env` touched; no Android signing / deploy config touched.
- ✅ No external email/SMS/push (workers disabled, creds dummy).
- ✅ No merge, push, or deploy. All work on `qa-fix/e2e-20261112`.
