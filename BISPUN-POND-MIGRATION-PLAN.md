# Bispun CRM — Production (`pond`) Migration Plan: `User.leadStoreColumnOrder`

**Status: PROPOSAL ONLY — NOT EXECUTED. Awaiting explicit Production approval.**
**Date:** 2026-11-07 · **GitHub main:** `118a333` · Dev (`blue-mouse`) already fixed & verified.

> I did **not** connect to `pond`. Production DB access has been off-limits throughout; I have no active authorized read session to it. Items that require live `pond` access are marked **BLOCKED — operator must run** and the exact read-only commands are provided.

---

## 1. Production identity & hosting (no credentials exposed)
| Component | Value | Source |
|---|---|---|
| Frontend | **Vercel** — `https://bispun.com` (CRM at `/login`, `/app`) | `Server: Vercel`; rebuilt today `Last-Modified 2026-11-07 10:52 UTC` |
| Backend API | `https://api.bispun.com` — behind **Cloudflare** → origin **Render** (dashboard-managed; no `render.yaml` in repo) | `Server: cloudflare`; health 200 |
| Prod DB | Neon **`pond`** — host `ep-weathered-pond-axt9umrv-pooler.c-4.us-east-2.aws.neon.tech` (db `neondb`) | `.env.pond.bak` (host only; **password not read/printed**) |

**Deploy pipeline does NOT auto-apply schema.** `build`=`vite build`, `server:prod`=`node server/index.js`. `prisma db push` exists only as a **manual** npm script. ⇒ Schema changes never reach the DB automatically.

## 2–5. Prod schema check / diff / column existence / all pending changes — **BLOCKED (operator must run, read-only)**
I cannot confirm `pond`'s schema without access. **Strong inference:** `pond` is **missing** `leadStoreColumnOrder` (the pipeline doesn't push schema, and dev `blue-mouse` was missing it under the same pipeline), so prod **Client Admins/Managers likely hit the same HTTP 500** on `GET /api/client/lead-store/column-preferences`. Confirm with these **read-only** commands (run by an authorized operator with the pond `DATABASE_URL`):

```bash
# (A) Does the column exist? (read-only)
psql "$POND_DATABASE_URL" -c "SELECT column_name,data_type,column_default,is_nullable \
FROM information_schema.columns WHERE table_name='User' AND column_name='leadStoreColumnOrder';"
# Expect: 0 rows (missing) — confirms the defect.

# (B) FULL schema diff — lists ALL pending changes, not just the expected column (read-only, no apply)
DATABASE_URL="$POND_DATABASE_URL" npx prisma migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma --script
# Expect EXACTLY one statement (the ADD COLUMN below). If ANYTHING else appears → STOP and report.
```

## 6. Exact minimal additive migration
Confirmed from the identical dev diff. The **only** required change:
```sql
ALTER TABLE "User" ADD COLUMN "leadStoreColumnOrder" TEXT[] DEFAULT ARRAY[]::text[];
```
Project-workflow equivalent (preferred, only after the diff in (B) shows ONLY this change):
```bash
DATABASE_URL="$POND_DATABASE_URL" npx prisma db push
# NO --force-reset, NO --accept-data-loss. Additive only.
```

## 7. Compatibility with existing Admin/Manager users & records
- **Additive, defaulted** (`DEFAULT ARRAY[]::text[]`): every existing `User` row (admins, managers, employees) gets `[]` automatically — no row rewrite, no data change.
- Postgres ≥11 (Neon is PG15+) adds a column with a **constant default without rewriting the table** → **near-instant, no meaningful lock/downtime**.
- No impact on auth, roles, permissions, tenant isolation, or any other column/table.
- Effect: the endpoint returns `200` with default order (was `500`); admins/managers can then save custom orders. Employees already unaffected.

## 8. Backup / rollback / verification
**Backup (before change):** create a **Neon branch/restore point** of `pond` from the Neon console (zero-copy, instant) — e.g. branch `pond-pre-leadcol-20261107`. Neon also has automatic PITR. No `pg_dump` needed for an additive change, but the branch gives an instant restore path.

**Rollback (if needed):** the column is new and empty, so dropping it restores the exact prior state (no data loss):
```sql
ALTER TABLE "User" DROP COLUMN "leadStoreColumnOrder";
```

**Post-migration verification (operator):**
1. `information_schema` check (A) → **1 row**, type `ARRAY`, default `ARRAY[]::text[]`.
2. `prisma migrate diff` (B) → **empty** (DB in sync).
3. Authenticated **Client Admin** on prod: `GET /api/client/lead-store/column-preferences` → **HTTP 200** (was 500).
4. (Optional, reversible) PATCH a column order → GET reload shows it → revert to `[]`.
5. Smoke: login/session OK, Lead Store loads, tenant isolation intact, no other 500s.

## 9. Deployed-commit confirmation for `118a333` — **BLOCKED (dashboard needed)**
| Target | Signal | Status |
|---|---|---|
| Vercel frontend | `bispun.com/login` rebuilt today (`Last-Modified 10:52 UTC`, post-PR#9) | **Likely 118a333 — confirm "Ready" + commit in Vercel dashboard** |
| Backend (Render) | `api.bispun.com/api/health` 200 | **Deployed commit NOT verifiable externally — confirm 118a333 in Render dashboard** |
> Note: even once the backend is on `118a333`, the endpoint **stays 500 until `pond` has the column.** Code deploy ≠ schema. The migration is required regardless.

## 10. Risk assessment & approval checklist
**Risk: LOW** — additive, defaulted, reversible, no data rewrite, negligible lock. Only material risk: unexpected schema drift in `pond` (mitigated by the mandatory diff in step B — STOP if it shows anything beyond the one column).

**Approval checklist (in order; operator with authorized pond access):**
- [ ] Confirm session is on **pond** (`current_database()`), read-only first.
- [ ] (A) Column absent → defect confirmed.
- [ ] (B) `prisma migrate diff` shows **only** the `leadStoreColumnOrder` ADD COLUMN. *If more → STOP & report.*
- [ ] Create Neon restore point / branch of `pond`.
- [ ] Apply `prisma db push` (or the exact `ALTER TABLE`) — additive only.
- [ ] Post-verify steps 1–5 above.
- [ ] Confirm Vercel (`118a333` Ready) and Render (`118a333`) deployments.

**No application code change, no push, no redeploy, no data deletion, no existing-user modification. Execution is gated on your explicit approval.**
