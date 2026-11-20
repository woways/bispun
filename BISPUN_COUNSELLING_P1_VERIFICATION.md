# Bispun CRM — Counselling P1 Fix Verification

**Date:** 2026-11-13 · **Branch:** `integration/bispun-final-pdf-review` (isolated worktree `S:\Bispun-final-review`)
**Fix commit on branch:** `0f1ebc7` (cherry-pick of QA-branch `011faf4`). **Reused existing fix — not recreated.**

## 1. The defect (confirmed)
`server/routes/clientCounselling.js` references `studentAltPhone` in four code paths, but the `CounsellingSession` Prisma model has **no such column** — on this branch's base **and on `origin/main`**:
| Path | Location (origin/main) |
|---|---|
| read (list mapping) | `clientCounselling.js:96` `alternatePhone: session.studentAltPhone` |
| search (where OR) | `clientCounselling.js:173` `{ studentAltPhone: { contains: search } }` |
| create | `clientCounselling.js:410` `studentAltPhone: cleanOptional(...)` |
| update | `clientCounselling.js:473-475` `data.studentAltPhone = ...` |
Effect: **every counselling create/update and any phone search returned HTTP 500** (`PrismaClientValidationError: Unknown argument studentAltPhone`). Reproduced live (pre-fix: HTTP 500 "Unable to schedule counselling session").

## 2. The fix (inspected — clean, additive, no unrelated changes)
`git show 0f1ebc7 --stat` → exactly **2 files, +13/-3**:
- `prisma/schema.prisma` — adds `studentAltPhone String?` to the `CounsellingSession` model (branch line 1023).
- `prisma/pending-migrations/0010_add_counselling_student_alt_phone.sql` — `ALTER TABLE "CounsellingSession" ADD COLUMN IF NOT EXISTS "studentAltPhone" TEXT;` (additive, nullable, idempotent; rollback = DROP COLUMN).
No code, no other models, no dependency changes. ✅ no unrelated changes.

## 3. Compared with `origin/main`
- `origin/main` CounsellingSession model: **no `studentAltPhone`** (verified via `git show origin/main:prisma/schema.prisma`).
- `origin/main` has no `0010` migration.
- Branch = main + this additive column + migration. The field type (`String?`, nullable) matches how the code writes it (`cleanOptional(...)` → string|null).

## 4. Runtime behavior verified (isolated local DB `bispun_final`)
| Operation | Result | Evidence |
|---|---|---|
| **create** (with `alternatePhone`) | **201** + row persisted (`studentAltPhone` saved) + linked Lead Store lead | GAP4 + direct prisma probe (`alt=8880002222`) |
| **read** (list) | returns `alternatePhone` mapped from `studentAltPhone` | GAP4 read-back assertion |
| **search** (`?search=<altPhone>`) | finds the session (the `studentAltPhone` where-clause no longer 500s) | GAP4 search assertion |
| **update** (PATCH status + followUp) | **200** | GAP4 edit assertion |
| validation (missing name / bad status) | **400** | GAP4 |
Pre-fix these were **500**; post-fix **201/200/200**. 

## 5. Regression coverage
- Covered by `server/__tests__/gapClosure.integration.test.js` → **GAP4** (create+lead-link, edit, validation, role gating, **plus added**: `studentAltPhone` persist, read-back, alt-phone search).
- Added the read-back + search assertions in this task (commit `544d8d4`) so all four defective code paths (read/search/create/update) are now exercised.
- Full gap suite: **5/5 PASS**.

## 6. Why it is not yet on `main`
`main`'s counselling code was merged **referencing `studentAltPhone`** without the corresponding schema column/migration — a code/schema merge gap. The fix exists only on the unmerged QA branch (`qa-fix/counselling-studentaltphone` `011faf4`), now cherry-picked onto this review branch (`0f1ebc7`). It has **not** been merged to `main` or deployed. **This is production-affecting: counselling scheduling is broken on current `main`/production until this column ships** (and because production deploys via `prisma db push`, the model field must be present for the column to be created — same materialization caveat as the lead-number trigger).

## 7. Status & next action
- **Fix status:** verified, clean, covered, preserved on `integration/bispun-final-pdf-review`. **Not merged/deployed.**
- **Next action (needs your approval):** merge this additive change to `main` and ensure migration `0010` (or the model field via `db push`) is applied to production, then re-verify counselling create/edit live.
