# Bispun CRM — Render `db push` safety review + PR #3 merge decision

Date: 2026-11-02 · **Read-only analysis. Nothing changed in Render/DB/Git; no migrate/push/merge/deploy.**

## Render build command (as you confirmed)
`npm install && npx prisma generate && npx prisma db push` · branch `main` · root dir = repo root.
`prisma generate` ✅ present (earlier blocker resolved). The open question was `prisma db push`.

## 1. What `db push` would actually do to PRODUCTION — verified
I computed the exact diff **production DB → integration Prisma schema** read-only
(`prisma migrate diff --from-config-datasource --to-schema`, introspection only). The **complete** result:
```sql
CREATE TABLE "DeviceToken" (... id PK, companyId, userId, token, platform DEFAULT 'android',
  active DEFAULT true, lastSeenAt/createdAt/updatedAt ...);
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_companyId_idx" ON "DeviceToken"("companyId");
CREATE INDEX "DeviceToken_userId_active_idx" ON "DeviceToken"("userId","active");
CREATE INDEX "DeviceToken_companyId_userId_idx" ON "DeviceToken"("companyId","userId");
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_companyId_fkey" FOREIGN KEY ("companyId")
  REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
**That is the entire delta — one new table, additive only.** No `DROP`, no `ALTER` of existing
tables/columns, no type/default/not-null changes, no data loss. Production already matches the schema
everywhere else (`Lead.alternatePhone`, `LeadRemark`, `assignedToUserId`, `followUpAt`,
`WalkIn.alternatePhone` are all present). So **for this specific release, `db push` would do exactly
the reviewed additive migration and nothing more.**

## 2. DeviceToken SQL & schema diff
The generated SQL **matches** the prepared migration and the Prisma `DeviceToken` model exactly (same
columns, unique `token`, 3 non-unique indexes, 2 cascade FKs). No discrepancy.

## 3 & 6. Safest sequence + duplicate/conflict check
- `db push` is **declarative/idempotent**: it syncs the DB to the schema. Whether `DeviceToken` is
  created by a manual migration first **or** by `db push`, the end state is one identical table — so
  **no duplicate and no conflict can occur** (if it already exists and matches, `db push` is a no-op).
- With `db push` in the build, the deploy is **self-ordering**: `install → generate` (client learns
  DeviceToken + alternatePhone) `→ db push` (creates the table) `→ server starts`. The table exists
  before the new code serves traffic, so there is **no window** where new code runs without the table.
- `db push` is also **self-protecting**: in non-interactive CI it **aborts** on any data-loss diff
  (it won't drop data without `--accept-data-loss`, which is not in the command). Here the diff is
  additive, so it succeeds cleanly.

## 4. Should `db push` be removed from the production build?
**For THIS release: not required** — the verified diff is additive-only, so `db push` is safe and will
create exactly `DeviceToken`.
**As ongoing policy: yes, recommended** — auto `db push` on every deploy has real latent risk: it is
unreviewed, keeps **no migration history**, and will **abort a future deploy** if a later schema ever
has a destructive diff (or silently drop data if someone adds `--accept-data-loss`). Recommended
replacement build command going forward:
> `npm install && npx prisma generate`
…and apply schema changes through **reviewed migrations** (explicit SQL like the DeviceToken file, or
adopt `prisma migrate deploy` with a committed `prisma/migrations/` history). This is a process
improvement to schedule — **not a blocker for this merge.**

**Two safe paths for this release (your choice):**
- **Path A — simplest, verified-safe (recommended):** merge as-is; the build's `db push` creates
  `DeviceToken` automatically. No Render change, no separate manual migration.
- **Path B — maximum control:** first change the Render build to `npm install && npx prisma generate`
  (removes `db push`), apply the `DeviceToken` SQL manually (reviewed), then merge. More steps; choose
  this only if you want `db push` gone before this deploy.

## 5. Prisma client generation & data compatibility
`prisma generate` runs from `prisma.config.ts → prisma/schema.prisma` (the integration schema), so the
production client will know `DeviceToken` and `Lead.alternatePhone`. All changes are additive →
**fully compatible with existing production CRM data**; no column removed or retyped.

## 7. Pre / post-deployment verification
**Pre (before merge):** `SELECT to_regclass('public."DeviceToken"');` → `NULL`; confirm the Render env
`DATABASE_URL` host is `ep-weathered-credit`; note Neon **PITR** timestamp.
**Post (after deploy):** Render build log shows `prisma generate` + `db push` applied + "Bispun API
running"; `GET /api/health` → `database: connected`; `SELECT to_regclass('public."DeviceToken"')` →
non-null and 4 indexes + 2 FKs exist; **create/edit a Lead** (exercises `alternatePhone` + regenerated
client) → 200; open Smart Nurture + Dial & Track; Vercel build green and site loads against the prod API.

## 8. Rollback
Revert the merge commit on `main` → Render + Vercel auto-redeploy the previous web + API. **Git revert
does NOT undo the DB.** `DeviceToken` is backward-compatible with the old code (ignored), so leave it;
or `DROP TABLE "DeviceToken";` to fully revert. Neon **PITR** to the pre-deploy timestamp is the DB
recovery path. Android: redistribute the previous APK.

## 9. Smart Nurture & background workers
**Unchanged vs `main`** — `nurtureEngine.js` is not in the diff; production worker behavior is identical
to today. Gated by `DISABLE_BACKGROUND_WORKERS` (unset in prod → runs as it already does),
tenant-isolated (`companyId`), idempotent (SENT/COMPLETED/REPLIED/FAILED), dispatch `try/catch`-isolated.
No new default external sending. (Confirm you intend live nurture sequences now the UI is restored.)

## 10. Is PR #3 safe to merge? / remaining approval
**Schema & deploy safety: YES — PR #3 is safe to merge.** `prisma generate` is present; the only schema
change `db push` will make is the additive `DeviceToken` table (verified, non-destructive); client
generation is correct; workers unchanged; Web CRM backward-compatible; CI green; no conflicts.

**The only thing still required is YOUR explicit decision/approval:**
1. **Approve the merge of PR #3 into `main`** (this auto-deploys Render API + Vercel web), **and**
2. **Pick Path A or Path B** (A: let the build's `db push` create `DeviceToken`; B: remove `db push`
   first + apply the migration manually). I recommend **Path A** for this release.
3. (Optional policy follow-up) schedule removing `db push` from the build afterward.

**Final: 🟢 GO (merge-safe), pending your explicit merge approval + Path A/B choice. I will not merge,
migrate, or change Render until you say so.**
