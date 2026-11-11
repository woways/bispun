# Bispun CRM — Final Merge / Release Report (2026-11-11)

Execution of the "FINAL MAIN MERGE, PRODUCTION VERIFICATION, BRANCH CLEANUP & NEXT
DEVELOPMENT HANDOFF" authorization. The conditional authorization requires **all** release
gates to pass before merge/deploy; where a gate is unverified, the unsafe operation is stopped.

## Outcome in one line
Consolidated candidate is **ready and green** (tests/build/feature-preservation). **Main merge
+ Production deploy are STOPPED** at the mandatory gates: Production schema compatibility and
Vercel/Render deploy triggers are **unverified** (no authorized read-only prod evidence). No
merge, deploy, migration, or branch deletion performed. Production `pond` untouched.

## A. Git inventory (live)
- `origin/main` = **`f6b7dd5`** — **freeze/cutoff SHA** for this release.
- New since last report: PR#17 (`890ba58`, Analytics drill-down) and **PR#18 (`f6b7dd5`,
  Admissions confidential/locked folder)** — both folded into the RC.
- RC `rc/consolidated-release-20261110` refreshed to **`4f568dd`** (0 behind / 43 ahead of main;
  clean superset; conflict-free `ort` merges). Pushed.
- Open PRs: **#13** only (MERGEABLE/CLEAN; its content is already in the RC).
- Branch protection on `main`: required status check **"Vercel"** (strict=false); required
  approving reviews **0**; required conversation resolution ON; enforce_admins OFF; force-push &
  deletion disabled. → a merge needs the Vercel check green (confirms Vercel builds on PRs/main).
- Unique unmerged work preserved: `feat/client-admin-password-reset` (`0084f2d`) — on origin +
  backup tag; **excluded** from this release (backend-only, dev-scoped, frontend/security review
  pending). Recovery tags intact (`backup/pre-consolidation/*`, `backup/pre-release/main-20261110b`).

## B. Consolidation (no new RC branch created)
Reused the existing RC. Conflict-free merges of main PR#17 then PR#18. Semantic-overlap files
verified as union (both sides retained): `schema.prisma`, `ClientPortal.jsx`, `Analytics.jsx`,
`LeadStore.jsx`, `Admissions.jsx`, `clientAnalytics.js`, `clientLeadStore.js`, Finance/Admissions
modules. No feature removed. Conflicts: **none**. Bugs introduced: **none found**.

## C. Feature-preservation audit — ✅ no loss detected
All key web modules and backend routes present; markers confirmed: PR#17 analytics drill-down,
PR#18 confidential folder (`AdmissionAttachmentFolder.locked`), account-deletion model + routes,
fail-closed Android signing. Desktop CRM behavior unchanged (union merge, no redesign).

## D. Quality gate (on RC `4f568dd`)
- `npx prisma validate` → **valid**
- `npm test` → **86 pass, 0 fail**
- `npm run build` → **✓ built (exit 0)**
- Interactive/authenticated workflows are **not** proven by these (recorded, not claimed as PASS).

## E. Production database gate — 🔴 UNVERIFIED (blocks merge)
Model: Prisma schema + hand-applied SQL; no reliable migration history. Required objects now
**include a new PR#18 dependency**:

| Object | Source | Dev | Prod verified | Risk | Action |
|---|---|---|---|---|---|
| `UtmLink.influencerName` | 0003 (main) | yes | **UNKNOWN** | low | operator SQL |
| `Lead.preferredColleges` + `LeadDatasetType` +5 | 0004 (main) | yes | **UNKNOWN** | low | operator SQL |
| `Lead.leadNumber` NOT NULL + idx + trigger | 0005 (main) | yes | **UNKNOWN** | **HIGH** | operator SQL |
| `LeadDataset.duplicateDetails` | 0006 (main) | yes | **UNKNOWN** | low | operator SQL |
| **`AdmissionAttachmentFolder.locked` BOOLEAN** | **PR#18 (main)** | yes | **UNKNOWN** | low (additive, default) | operator SQL; SQL in `0009_*.sql` |
| `AccountDeletionRequest` table | 0008 | yes | **ABSENT** | med (code fail-safe) | apply for Play |
| calendar visibility | 0007 DRAFT | no | n/a | — | **HOLD** |

`0003–0006` + `locked` ship with `main`; if Production already runs `main` they must exist — but
this must be **operator-confirmed**, not inferred. Prepared additive SQL:
`prisma/pending-migrations/0009_add_admission_folder_locked.sql` (not run). **No migration
executed.** Read-only verification SQL + pass criteria: `BISPUN-OPERATOR-PROD-EVIDENCE-CHECKLIST.md`.

## F. Vercel/Render deploy gate — 🟡 UNVERIFIED (blocks merge)
Repo: `vercel.json` SPA; no `render.yaml`; no auto-migration in build/start; "Vercel" is a
required status check (Vercel connected). **Dashboard-level confirmation absent**: whether a
merge to `main` promotes to Production (Vercel) and auto-deploys the backend (Render), build/
start/pre-deploy commands, prod env (`VITE_API_URL`, `CLIENT_URL`, `DISABLE_BACKGROUND_WORKERS`),
health check, and rollback. Operator checklist provided.

## G. Main-merge gate — ⛔ STOPPED (not executed)
Conditional-authorization requirements status: (1) schema compat **UNVERIFIED**, (2) no unapproved
migration needed **UNVERIFIED** (depends on E; `locked`/0008 may be required), (3) tests **PASS**,
(4) deploy triggers **UNVERIFIED**, (5) FE/BE compat **UNVERIFIED** (depends on E), (6) rollback
restorable **PARTIAL** (git refs yes; platform rollback not dashboard-confirmed), (7) protections/
approvals **OK** (0 reviews; Vercel check required), (8) no P0/P1 **FAILS** (open P0s below),
(9) no unapproved destructive op **OK**. → Requirements 1,2,4,5,6,8 not satisfied ⇒ **do not
merge or deploy.** Stopped at this gate per instruction.

## H. Branch cleanup — ⏸ DEFERRED
Merge blocked ⇒ integration/RC branches still hold unmerged work ⇒ **no branches deleted.**
Eligible-after-merge (fully in main, 0 ahead): `feat/admissions-notifications-calendar`,
`feat/mobile-ui-optimization`, `feat/referrals-integration`, `hotfix/prod-login-coldstart`,
`integration/mui-yc`, `finance-changes`. Retained: `main`, RC, integration, PR#13 head,
signing branches, `feat/client-admin-password-reset`, all backup tags.

## I. Android baseline
Last debug APK (`4aef725`, SHA-256 `e04ad388…7103`) launch-tested on Pixel_6 (login + backend
401 + no crash). The RC has since advanced to `4f568dd` (PR#18) — a fresh debug build is advisable
for device QA of the confidential-folder change. **Signed AAB: BLOCKED** on operator keystore
credentials (`S:\Bispun-release\android\app\bispun-release.jks` present, never regenerated);
release config is fail-closed. Release AAB must bake the prod HTTPS API URL (never 10.0.2.2).

## J. Google Play — BLOCKED
Signed AAB not built; listing assets/Data Safety/privacy+deletion URLs pending; `0008` not in
prod (deletion URL can't persist); actual deletion fulfillment unimplemented; `PROCESSED` naming
decision. Public submission requires separate authorization.

## FINAL VERDICT
- **ALL COMPLETED APPROVED WORK IN MAIN — NO** (consolidated in RC `4f568dd`; merge stopped at gate)
- **MAIN MERGE SUCCESSFUL — NO** (stopped; `main` = `f6b7dd5`, untouched)
- **PRODUCTION HEALTHY — NOT DEPLOYED**
- **OBSOLETE BRANCH CLEANUP — BLOCKED** (deferred until merge; all preserved)
- **NO FEATURE LOSS VERIFIED — YES** (union merge; audit clean)
- **SIGNED ANDROID AAB READY — NO** (operator keystore creds)
- **GOOGLE PLAY SUBMISSION READY — NO**
- **REMAINING BLOCKERS (prioritized):**
  - **P0:** Production schema unverified — run `BISPUN-OPERATOR-PROD-EVIDENCE-CHECKLIST.md` SQL
    (esp. `Lead.leadNumber` NOT NULL+trigger, and new `AdmissionAttachmentFolder.locked`).
  - **P0:** Vercel/Render deploy + rollback behavior dashboard-unconfirmed.
  - **P0:** Explicit confirmation that the controlled Production deploy may run on this merge,
    given the above verified (the authorization is conditional on it).
  - **P1:** `0008` → prod for deletion-URL persistence; signed AAB keystore creds; `PROCESSED`
    naming/fulfillment.
  - **P2:** fresh debug APK for PR#18 device QA; `feat/client-admin-password-reset` decision.

## Safety confirmation
MAIN MERGE / PRODUCTION DEPLOY / DB MIGRATIONS / BRANCH DELETIONS / PLAY SUBMISSION —
**NONE EXECUTED.** Production `pond` — **NOT TOUCHED.** No Production credentials used.
No force-push. Freeze SHA = `f6b7dd5`.
