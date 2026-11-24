# Bispun CRM — CORRECTED production database verification (pond)

Date: 2026-11-02 · **Read-only. Nothing changed/migrated/snapshotted/merged/deployed.**

## ⚠️ Correction to all earlier production reports
My previous production audits queried **`ep-weathered-credit-axobwesm`**, because my local
`.env` has `DATABASE_URL` = credit. **That is NOT the production database.** Render's `bispun-api`
uses **`ep-weathered-pond-axt9umrv`** (Neon project **`consulbuzz-production`**), as you found.
I re-verified directly against **pond**, and the migration scope is **larger than I previously
reported** (one extra additive column). Details below. Earlier "only DeviceToken needed" statements
are **superseded** by this document.

## 1. Which DB does production use?
- `prisma.config.ts` → `datasource.url = process.env["DATABASE_URL"]` (no `directUrl`), so Prisma
  `generate` / `db push` / `migrate diff` all target **`DATABASE_URL`**.
- Render production `DATABASE_URL` host = **`ep-weathered-pond-axt9umrv`** (you confirmed from the
  Render Environment). The live API **`https://api.bispun.com/api/health`** → `database: connected`
  (this API is the pond-backed production backend).
- My local `.env`: `DATABASE_URL` = **credit** (line 12, wrong branch) and `DIRECT_URL` = **pond**
  (line 13). I used the `DIRECT_URL` value to reach pond read-only for this verification.

## 2. Identity (no credentials exposed)
| | CREDIT (my local DATABASE_URL) | **POND (production)** |
|---|---|---|
| Endpoint | `ep-weathered-credit-axobwesm` | **`ep-weathered-pond-axt9umrv`** |
| Database | `neondb` | `neondb` |
| pg system identifier | `7674171764323737190` | `7674171764323737190` (same) |
| `Lead.alternatePhone` | **present** | **MISSING** |
| `DeviceToken` | missing | **MISSING** |
| `LeadRemark` / `WalkIn.alternatePhone` | present | present |
| Companies / Leads | 3 / 25 | **3 / 26** |

**Same system identifier but divergent schema + data ⇒ credit and pond are two different Neon
_branches_ of the same project, not the same live DB.** **Pond is production** (real data: 3
companies, 26 leads). Credit is a separate non-production branch that happened to already have
`alternatePhone` — which is why my earlier audit understated the migration.

## 3–5. What Render's `db push` would apply to PRODUCTION (pond) — verified read-only
`prisma migrate diff` (pond → integration schema @ `70b8209`), exact output:
```sql
-- AlterTable  (ADDITIVE — nullable column, no default, no table rewrite)
ALTER TABLE "Lead" ADD COLUMN "alternatePhone" TEXT;

-- CreateTable
CREATE TABLE "DeviceToken" ( id PK, companyId, userId, token, platform DEFAULT 'android',
  active DEFAULT true, lastSeenAt/createdAt/updatedAt );
CREATE UNIQUE INDEX "DeviceToken_token_key"        ON "DeviceToken"("token");
CREATE INDEX        "DeviceToken_companyId_idx"     ON "DeviceToken"("companyId");
CREATE INDEX        "DeviceToken_userId_active_idx" ON "DeviceToken"("userId","active");
CREATE INDEX        "DeviceToken_companyId_userId_idx" ON "DeviceToken"("companyId","userId");
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
**Counts:** 1 `ADD COLUMN` + 1 `CREATE TABLE` + 4 `CREATE INDEX` + 2 FK. **Zero `DROP`, zero
destructive `ALTER`/`RENAME`/type change.** This is the **entire** delta — pond is otherwise in
sync with the integration schema (LeadRemark, WalkIn.alternatePhone, assignedToUserId, followUpAt
all already present).

## 4. DeviceToken + other differences
- `DeviceToken`: **MISSING** on production → will be created.
- **Additional difference I previously missed:** `Lead.alternatePhone` is **MISSING** on production
  → will be added (nullable). The 26 existing leads get `NULL` (no data change).
- No other differences; nothing destructive.

## 6. Compatibility with the actual production database
✅ **Compatible.** Both changes are additive and non-destructive; the 3 companies / 26 leads are
preserved; `alternatePhone` is nullable with no default (instant metadata-only add, no row rewrite).
Plain `db push` (no `--accept-data-loss`) would apply both and **abort rather than destroy** if
anything were ever destructive. Path A (let the Render build's `db push` apply both) remains safe —
it simply applies two additive changes instead of one. No manual migration needed for Path A.

## 7. Backup / restore for `consulbuzz-production` (pond)
Neon provides automatic PITR and instant zero-copy **branches**. Recommended authoritative recovery
point before release: create a Neon **branch** from the production branch (the one whose endpoint is
`ep-weathered-pond`). This is instant and non-disruptive.

## 8. Exact pre-release snapshot instructions (correct project)
Neon console → project **`consulbuzz-production`** → **Branches** → **Create branch** → parent =
the **production** branch (endpoint `ep-weathered-pond-axt9umrv`) → name e.g.
`pre-pr3-backup-2026-11-02`. (Zero-copy, instant.) To roll back data later, restore/reset the
production branch from this snapshot in the Neon console. Also note the project's **History
retention** window (Settings) as the PITR fallback.

## 9. Is the credit endpoint used in production config?
- **Repo:** neither `ep-weathered-credit` nor `ep-weathered-pond` is hardcoded in any tracked file —
  production DB config lives only in Render env (pond). ✅
- **Render production:** `DATABASE_URL` = pond (not credit). ✅ Credit is **not** in production config.
- **Where credit DOES appear:** only in my **local** `.env` as `DATABASE_URL` (a local dev-side
  pointer at the wrong branch) — this caused the earlier audit misdirection. Recommend correcting the
  local `.env` to point at the intended branch for any future local checks (not a production issue).

## 10. Final GO / NO-GO
🟢 **GO (Path A) — with the corrected, verified migration scope.** Against the **real** production DB
(pond), the only changes Render's `db push` would make are **two additive operations** —
`Lead.alternatePhone` (nullable column) and the `DeviceToken` table (+ indexes + FKs) — with **no
destructive change**, within the `neondb_owner` role's permissions, preserving all 26 leads / 3
companies. The Render build already runs `prisma generate` and `db push` (self-ordered: generate →
push → start). Production API + Vercel web are healthy.

**One required correction to the plan:** the pre-release Neon snapshot must be taken on the
**`consulbuzz-production` / pond** project (Step 8), not the credit branch. If you ever choose Path B
(manual migration), the SQL must include **both** the `ALTER TABLE "Lead" ADD COLUMN "alternatePhone"`
**and** the `CREATE TABLE "DeviceToken"` statements (not DeviceToken alone).

**STOP — corrected production verification complete. No snapshot/migration/merge/deploy performed.
Awaiting your approval. I recommend: (1) take the pond snapshot (Step 8), then (2) authorize the
Path A merge of PR #3.**
