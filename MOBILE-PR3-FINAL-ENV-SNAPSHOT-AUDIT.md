# Bispun CRM — Final env + snapshot + PR #3 merge safety audit

Date: 2026-11-02 · **READ-ONLY. No env/DB/Render/Git change; no migration, db push, snapshot
restore, merge or deploy. No credentials printed.**

## Phase 1 — Env files (endpoints masked to first label)
| File | DATABASE_URL | DIRECT_URL | DISABLE_BG_WORKERS |
|---|---|---|---|
| `S:\Bispun\.env` (main) | **pond** (pooled) | **pond** (direct) | (unset → prod-style) |
| `S:\Bispun\.env.development` | blue-mouse (pooled) | blue-mouse (direct) | **true** |
| `S:\Bispun-integ\.env` (worktree) | ⚠️ **credit** (stale) | pond | (unset) |
| `S:\Bispun-integ\.env.development` | blue-mouse (pooled) | blue-mouse (direct) | **true** |
| `*.env.development.local` | — (only `VITE_API_URL`) | — | — |

- ✅ Your **main** checkout `.env` now points production at **pond** (pooled + direct).
- ✅ Mobile dev isolated on **blue-mouse**; `DISABLE_BACKGROUND_WORKERS=true` in both dev envs.
- ⚠️ **Stale override:** the **integration worktree** `.env` still has `DATABASE_URL = credit` (while its
  `DIRECT_URL = pond`). **Local-only; no production impact** (Render uses its own env), but it is an
  inconsistent, stale pointer — recommend aligning it to pond for any local work from that worktree.
- ⚠️ Minor: both `.env` files have **duplicate** `CLIENT_URL` and `IPINFO_TOKEN` lines (dotenv uses the
  last; local-only, not production). No other conflicts.
- Precedence: Node `--env-file` / `dotenv` load `DATABASE_URL`; `prisma.config.ts` reads
  `process.env["DATABASE_URL"]` only (no `directUrl`). Pooled (`-pooler`) for app queries, direct for
  migrations/introspection — appropriate.

## Phase 2 — Read-only connection tests (SELECT 1 + identity, all succeeded)
| Connection | Endpoint | DB / role / schema | pg system id | DeviceToken | alternatePhone | Cos / Leads |
|---|---|---|---|---|---|---|
| **Prod DATABASE_URL** (pooled) | pond | neondb / neondb_owner / public | `7674171764323737190` | ❌ | ❌ | 3 / **26** |
| **Prod DIRECT_URL** (direct) | pond | neondb / neondb_owner / public | `7674171764323737190` | ❌ | ❌ | 3 / **26** |
| Dev DATABASE_URL | blue-mouse | neondb / neondb_owner / public | `7701221044349418008` | ✅ | ✅ | 1 / 1 |
| (stale) integ `.env` DATABASE_URL | credit | neondb / neondb_owner / public | `7674171764323737190` | ❌ | ✅ | 3 / 25 |

- ✅ **Both production URLs reach the SAME pond branch** (identical system id, schema state, 26 leads) —
  `PROD_URLS_SAME_BRANCH = true`. SSL required on all; role can `CREATE` in `public`.
- ✅ **Dev is a different Neon project** (distinct system id `7701…`) — fully isolated from production.
- Note: `credit` shares the project system id with pond but has diverged data (alternatePhone present,
  25 leads) — it is a **separate branch**, confirming it is **not** production.
- No connection/SSL/pooling/permission problems. **No production URL points to an unexpected branch →
  no STOP condition.**

## Phase 3 — Prisma & production schema
- Datasource resolves from `DATABASE_URL` (no `directUrl` in config). `prisma validate` → **valid**.
- **migrate diff (read-only) vs pond production** — the exact pending changes:
  ```sql
  ALTER TABLE "Lead" ADD COLUMN "alternatePhone" TEXT;   -- additive, nullable
  CREATE TABLE "DeviceToken" (...);                      -- + 4 indexes + 2 FKs
  ```
  Counts: **CreateTable 1 · AddColumn 1 · Index 4 · FK 2 · Destructive 0.** Matches the expected set
  exactly; **zero `DROP`/destructive `ALTER`/`RENAME`.**
- Render build command (your confirmed value): `npm install && npx prisma generate && npx prisma db push`
  — **no destructive flags** (`--accept-data-loss`/`--force-reset` absent; plain `db push` aborts rather
  than drop). Client generation reads the integration schema (`prisma/schema.prisma`). Nothing executed here.

## Phase 4 — Snapshot verification (your dashboard evidence)
From your Neon screenshot: project `consulbuzz-production`, branch `production`, endpoint
`ep-weathered-pond-axt9umrv`, snapshot **"production" @ 2026-11-02 10:39:50 UTC (manual)**, status
created/listed in Backup & Restore, **expiration: never**.
- ✅ The snapshot's branch/endpoint (`ep-weathered-pond`) **matches the production DB I verified** (pond,
  26 leads). It is an appropriate pre-release recovery point taken **before** any schema change.
- ⚠️ I **cannot independently re-confirm** the snapshot inside Neon (no console/API access) — it is
  **VERIFIED by your dashboard evidence**, not by my own query.
- **Recovery steps (do NOT restore now):** if the deploy fails, Neon console → `consulbuzz-production`
  → **Backup & Restore** → the `2026-11-02 10:39:50 UTC` snapshot. **To avoid overwriting newer records:**
  first create a **new branch from the _current_ production** (preserves post-deploy state for inspection),
  then restore production from the snapshot — or **branch from the snapshot** to a side branch and compare
  before promoting. A straight in-place restore reverts to the 10:39:50 UTC state, discarding anything
  written after it — so branch first if any real writes occurred post-deploy.

## Phase 5 — Git & deployment
- PR **#3**: **OPEN**, not merged (`mergedAt` null), `MERGEABLE`/`CLEAN`, **CI 2/2 green**, auto-merge off.
- `origin/main` = `496fa88` (unchanged, 0 commits ahead of HEAD); `origin/integration/mui-yc` = local =
  `70b8209`; all developer branches contained (verified previously, unchanged).
- Health: Render API `https://api.bispun.com/api/health` → `database: connected`; Vercel
  `consulbuzz.vercel.app` + `bispun.com` → 200. Production target = **pond** (confirmed).
- **Post-deploy checks (prepared):** Render build log shows `prisma generate` + `db push` applied +
  "Bispun API running"; `GET /api/health` → connected; `SELECT to_regclass('public."DeviceToken"')` →
  non-null; `Lead.alternatePhone` column exists; **existing client login** works; **Lead Store
  create/edit** → 200 (exercises new column + client); Firebase push safe when config present (dispatch
  try/catch-isolated); Web CRM core modules (Dashboard/Chat/Calendar/Revenue/Analytics) load.
- **Rollback (non-destructive):** revert the merge commit on `main` → Render + Vercel auto-redeploy the
  previous build. **Git revert does NOT undo the DB** — `alternatePhone` + `DeviceToken` are additive and
  backward-compatible (old code ignores them); keep them, or recover data via the 10:39:50 UTC snapshot
  using the branch-first procedure above.

## FINAL REPORT
| | Item | Result |
|---|---|---|
| **A** | Local production `.env` configuration | ✅ **PASS** (main `.env` = pond pooled+direct; ⚠️ stale `credit` in the integ worktree `.env` — local only) |
| **B** | Development database isolation | ✅ **PASS** (blue-mouse, separate project, workers disabled) |
| **C** | `DATABASE_URL` & `DIRECT_URL` consistency | ✅ **PASS** for production (both pond, same branch); ⚠️ worktree `.env` internally inconsistent (credit vs pond) |
| **D** | Prisma production schema diff | ✅ **PASS** (additive only: `alternatePhone` + `DeviceToken`; zero destructive) |
| **E** | Production Neon snapshot | ✅ **VERIFIED** (by your dashboard evidence; branch/endpoint matches pond; not independently queryable by me) |
| **F** | Render & Vercel readiness | ✅ **PASS** (API healthy+db connected, web 200, build has `prisma generate`, no destructive flags) |
| **G** | PR #3 readiness | 🟢 **GO** |

### H. Remaining blockers
- **CRITICAL:** none. The production migration is additive-only, snapshot is in place, build regenerates
  the client, services healthy, CI green, no conflicts.
- **NON-BLOCKING (local/scheduling):** stale `credit` in the integ worktree `.env` (fix locally);
  duplicate `CLIENT_URL`/`IPINFO_TOKEN` in local `.env` (last-wins, local only); Android release is a
  separate track; functional flows still NOT TESTED (Chat 2-user, OTP, billing/payment, FCM delivery,
  real Nurture/Dial sends); confirm you intend live nurture sends now the UI is restored.

### I. Final merge & monitoring sequence
1. (Done) Pond snapshot @ 2026-11-02 10:39:50 UTC — recovery point in place.
2. On your approval, **merge PR #3 → `main`** (single merge/squash). This auto-deploys Render API + Vercel web.
3. Render build: `install → prisma generate → db push` (applies `alternatePhone` + `DeviceToken`) `→ start`.
4. Smoke: `/api/health` connected; `DeviceToken` + `Lead.alternatePhone` present; client login; Lead
   Store create/edit; Dashboard/Chat/Calendar load; Vercel site live against `api.bispun.com`.
5. If anything fails: revert the merge commit (auto-redeploys previous); recover data via the snapshot
   using the branch-first procedure. Android APK handled separately.

**STOP — all read-only checks complete. 🟢 GO for PR #3 (Path A). No CRITICAL blockers. Awaiting your
explicit final merge approval; I will not merge, migrate, db push, restore, or deploy until you authorize it.**
