# Bispun CRM — PR #3 Path A final safety gate

Date: 2026-11-02 · **All read-only. Nothing merged, migrated, pushed, deployed, or changed in
Render/Vercel/DB.** Path A = keep the existing Render build command for this release.

| # | Check | Result |
|---|---|---|
| 1 | PR #3 state | ✅ **OPEN**, not draft, **not merged**, `MERGEABLE` / `CLEAN`, **CI 2 passing / 0 failing**, auto-merge off |
| 2 | New commits? | ✅ none — `origin/main` = `496fa88` (unchanged, 0 commits ahead of HEAD); `origin/integration/mui-yc` = local = `70b8209` (in sync) |
| 3 | Prod schema diff (what `db push` applies) | ✅ **ONLY `DeviceToken`** — CreateTable 1, CreateIndex 4, AddForeignKey 2, **Drop/Alter 0**, no other table touched |
| 4 | Neon backup / PITR | ⚠️ **Confirm in Neon console** (see below) — I cannot access it authoritatively |
| 5 | Render + Vercel health | ✅ Render API `https://api.bispun.com/api/health` → `database: connected`; Vercel `consulbuzz.vercel.app` + `bispun.com` → 200 |
| 6 | Prod DB permissions | ✅ role `neondb_owner`: `CREATE` in `public` = true, `REFERENCES` on `Company` + `User` = true → additive change permitted |
| 7 | Destructive Prisma flags | ✅ none — plain `db push` (no `--accept-data-loss` / `--force-reset`); it **aborts** rather than drop data |
| 8 | Monitoring + rollback | ✅ prepared (below) |
| 9 | Web CRM compatibility | ✅ additive only; `Lead.alternatePhone` already in prod; `DeviceToken` ignored by current code until deploy — backward-compatible |

## Item 4 — Neon backup/PITR (the one thing to confirm authoritatively)
Neon provides automatic point-in-time restore, but the exact **history-retention window** is a
Neon-project setting I cannot read from SQL or without console access. **Before merging, please do one
of (authoritative recovery point):**
- Neon console → the production project → **Branches** → create a branch from `main`/primary **now**
  (instant, zero-copy snapshot = guaranteed restore point), **or**
- Confirm the project's **History retention** window covers your rollback needs.
Because the change is a single additive empty table, the practical data-loss risk is nil; this snapshot
is belt-and-suspenders for the deploy as a whole.

## Monitoring (after you merge → auto-deploy)
- **Render (API):** deploy build log shows `prisma generate` + `db push` applied (creates `DeviceToken`)
  + "Bispun API running"; then `GET https://api.bispun.com/api/health` → `database: connected`;
  `SELECT to_regclass('public."DeviceToken"')` → non-null (4 indexes + 2 FKs); **create/edit a Lead**
  (exercises `alternatePhone` + regenerated client) → 200.
- **Vercel (web):** build green; `consulbuzz.vercel.app` loads; calls reach `api.bispun.com`; no console/CORS errors.

## Rollback
Revert the merge commit on `main` → Render + Vercel auto-redeploy the previous web + API. **Git revert
does NOT undo the DB** — `DeviceToken` is backward-compatible (leave it), or `DROP TABLE "DeviceToken";`.
Neon PITR / the pre-deploy branch is the DB recovery path. Android: redistribute the previous APK.

## Background workers
Unchanged vs `main` (`nurtureEngine.js` not in the diff); gated by `DISABLE_BACKGROUND_WORKERS`
(unset in prod → runs as today), tenant-isolated, idempotent, dispatch `try/catch`-isolated. No new
default external sending. (Confirm you intend live nurture sequences now the UI is restored.)

## 10. Final release decision
🟢 **GO (Path A) — PR #3 is safe to merge.** Every gate passed: PR open/clean/CI-green, no new commits,
the only schema change is the additive `DeviceToken` table (verified, no destructive flags, within the
prod role's permissions), both production services healthy, Web CRM backward-compatible, workers
unchanged. The single caveat is operational, not a blocker: confirm the Neon PITR window / take a
pre-merge Neon branch snapshot.

**Merging `main` WILL auto-deploy production (Render API + Vercel web).** On merge, the Render build
will `generate` the client and `db push` will create `DeviceToken` in the same build, before the server
starts — self-ordered, no manual migration, no duplicate.

**STOP — all safety checks pass. I'm requesting your final explicit authorization to merge PR #3 into
`main` via Path A.** On your "yes" I will (and only then): take/confirm the Neon snapshot step with you,
merge PR #3, then watch the Render + Vercel deploys and run the post-deploy smoke. I will not merge,
migrate, deploy, or change any production setting until you authorize it.
