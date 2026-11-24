# 🔴 P1 — Counselling is 500-ing in PRODUCTION (found 2026-11-19)

## The bug (live now)
The **deployed** backend `a34923e` writes `studentAltPhone` to **CounsellingSession** in `server/routes/clientCounselling.js` — create (L410), update (L473-475), phone-search (L173), read (L96) — **but the `CounsellingSession` Prisma model never declared that column** (it exists only on the `Admission` model). So in production **every counselling create / update / phone-search throws `PrismaClientValidationError` → HTTP 500 right now.** This is also true on current `main` (`a8708f9`). PR #23 was meant to fix it but is stranded on an ancient base and never actually landed the schema column on main.

## URGENT — fix production immediately (independent of any code deploy)
The deployed code already expects the column, so just add it to Pond. Additive, idempotent, safe, no data change. Neon → project `consulbuzz-production` → branch `production` → db `neondb` → SQL Editor:
```sql
-- read-only check first:
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='CounsellingSession' AND column_name='studentAltPhone';
-- if it returns 0 rows, apply:
ALTER TABLE "CounsellingSession" ADD COLUMN IF NOT EXISTS "studentAltPhone" TEXT;
```
After this, counselling create/update/phone-search work again on the live backend. **Do not `prisma db push`.**

## The code fix (committed locally, verified, NOT yet pushed)
Branch `fix/counselling-session-alt-phone`, commit **`6e2e4ee`** (local, in `S:\Bispun-meetfix`), 4 files:
- `prisma/schema.prisma` — add `studentAltPhone String?` to the `CounsellingSession` model.
- `prisma/pending-migrations/0010_add_counselling_student_alt_phone.sql` — the additive migration above.
- `server/lib/counsellingSchema.test.js` — DB-free regression guard (asserts the model declares every field the route persists).
- `package.json` — register that test in `npm test`.

Verified: **142/142 tests PASS**, `prisma validate` OK, `vite build` PASS. No UI change (so no accessibility impact).

## Why it isn't on main yet
Remote-write operations (`git push` and the gh API) were **blocked by this session's auto-mode permission classifier** this turn. Nothing is lost — the commit is safe locally.

**To land it (you run, or allow me to):**
```
cd S:\Bispun-meetfix
git push -u origin fix/counselling-session-alt-phone
gh pr create --repo woways/bispun --base main --head fix/counselling-session-alt-phone --title "fix(counselling): add missing CounsellingSession.studentAltPhone (P1)"
```
Then merge once CI (Vercel + conflict-and-syntax) is green, and delete the branch. No new schema migration is introduced beyond the one `0010` column above.
