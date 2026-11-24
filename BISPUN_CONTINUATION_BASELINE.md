# BISPUN CRM — Continuation Baseline (Independently Verified)

**Date:** 2026-11-12
**Session:** Continuation / QA takeover
**Working directory:** `S:\Bispun`
**Current branch:** `feat/referral-signup-lifecycle` @ `0a7d7ed`
**Repo:** https://github.com/woways/bispun.git (`origin`)

> This report contains **only findings I verified myself** in this session via read-only
> git and filesystem inspection and a local test run. Where the handover prompt made a
> claim I could not verify, or that proved inaccurate, it is marked explicitly.
> **No** production writes, migrations, pushes, merges, or deployments were performed.

---

## 1. Verdict summary

| Area | Prior-session claim | Independently verified result |
|---|---|---|
| Claimed QA commits exist | 6 SHAs listed | ✅ **All 6 exist locally** (`0f1ebc7 ad57772 9a00c09 011faf4 c714a7d fa0518f`) |
| Integration branch | `integration/bispun-final-pdf-review` | ✅ Exists **locally only** — tip `9a00c09`, 73 ahead / 0 behind `main`, **NOT on origin** |
| Unit tests | 106/106 (integration branch) | ✅ **119/119 pass** on current branch (`npm test`) — see §4 |
| API-integration + 5-gap suites | 35/35 + 5/5 | ⚠️ **Not present on current branch** — live only on integration/qa-fix branches. Not run. |
| Counselling P1 (`studentAltPhone`) | Fixed in `0f1ebc7` | ⛔ **Fix is on the unpushed integration branch ONLY.** Still a live bug on `main` — see §3 |
| QA database | local Postgres `bispun_final:5432` | ❌ **Inaccurate for this machine** — `.env` points to **Neon cloud** `neondb`. See §5 |
| Local worktree `S:\Bispun-final-review` | present | ✅ Exists (integration branch). Plus 7 other sibling worktrees — see §2 |

**Bottom line:** The current repo is real and healthy; unit tests genuinely pass. But the
headline Counselling P1 fix and the full QA suite live on a **local-only, never-pushed**
branch, so `main` (and therefore any deploy from `main`) is **still exposed** to the P1
500 bug. The environment also differs materially from what the handover described (cloud
DB, not local), which changes the safety posture for every DB-touching step.

---

## 2. Repository & worktree map

**Local branches of note:** `main`, `feat/referral-signup-lifecycle` (current),
`integration/bispun-final-pdf-review`, `fix/counselling-student-alt-phone`,
`qa-fix/counselling-studentaltphone`, `qa-fix/e2e-20261112`,
`feat/referrals-lifecycle`, `feat/referrals-integration`, plus mobile/release branches.

**Origin branches:** `main`, `feat/referral-signup-lifecycle`, `feat/referrals-integration`,
`fix/counselling-student-alt-phone`, `rc/consolidated-release-20261110`,
`integration/mobile-perf-a11y-20261112`, `finance-changes`, and a few more.
The integration branch `integration/bispun-final-pdf-review` is **NOT** on origin.

**Active worktrees (⚠️ owned by other sessions — do not modify):**
```
S:/Bispun                   feat/referral-signup-lifecycle   (this session)
S:/Bispun-final-review      integration/bispun-final-pdf-review
S:/Bispun-qa                fix/counselling-student-alt-phone
S:/Bispun-integ             integration/mui-yc
S:/Bispun-integration       integration/mobile-perf-a11y-20261112
S:/Bispun-mobile            feat/mobile-ui-optimization
S:/Bispun-pr13-integration  rc/consolidated-release-20261110
S:/Bispun-release           release/android-signing-prep
S:/Bispun-stab              feat/referrals-integration
```

**Working tree of `S:\Bispun`:** clean on tracked files (no staged/unstaged diffs). Only
untracked artifacts present: numerous `MOBILE-*.md` / `BISPUN-*.md` reports,
`android/local.properties.bak`, `scripts/provisionQaTestCompany.js`.

---

## 3. Counselling P1 — CONFIRMED still live on `main` (highest-priority finding)

**The bug:** `server/routes/clientCounselling.js` reads, writes, and filters on
`studentAltPhone`, but the `CounsellingSession` Prisma model does not define it on
`main`/current branch.

Code references (current branch) in [server/routes/clientCounselling.js](server/routes/clientCounselling.js):
- `:96`  — returns `alternatePhone: session.studentAltPhone`
- `:173` — search filter `{ studentAltPhone: { contains: search, mode: "insensitive" } }`
- `:410` — **create**: `studentAltPhone: cleanOptional(req.body?.alternatePhone ?? req.body?.studentAltPhone)`
- `:473–475` — **update**: writes `data.studentAltPhone`

Schema state:
- `origin/main` → `CounsellingSession.studentAltPhone` count = **0** (field absent)
- current branch `feat/referral-signup-lifecycle` → field **absent** from `CounsellingSession`
  (the `studentAltPhone` at `prisma/schema.prisma:784` belongs to the **Admission** model, a different model)
- `integration/bispun-final-pdf-review` → field **present** in `CounsellingSession` (the fix)

**Impact:** On `main`, a counselling create/update that supplies an alternate phone — and
any counselling search — passes an unknown field to Prisma, producing a validation error →
**HTTP 500**. Local unit tests do not exercise this path against a real Prisma client, which
is why 119/119 can pass while the bug remains.

**Status:** FIX NOT ON MAIN. It exists only on an unpushed local branch. Needs a decision on
how to land it (see §7). Requires schema change + migration; **must not** be applied to the
cloud DB without explicit approval.

---

## 4. Test evidence (verified this session)

Command: `npm test` (runs `node --test` over 16 unit files in `server/lib`, `server/routes`, `src/lib`).

```
# tests 119
# pass 119
# fail 0
# duration_ms ~3299
```
✅ **119/119 pass** on `feat/referral-signup-lifecycle`.

Not present / not run on this branch:
- "35 API integration" suite and "5-gap closure" suite — these were authored on the
  integration/qa-fix branches (`ad57772`, `60c3861`, `qa-fix/e2e-20261112`) and are not
  checked out here. They were **not** executed; the 146/146 total is therefore **not**
  reproduced on this branch.
- Production `vite build` — not run this session.
- Lint / typecheck — no `lint`/`typecheck` scripts defined in `package.json`.

---

## 5. Environment reality vs. handover claims

| Item | Handover said | Actual (this machine) |
|---|---|---|
| QA database | local Postgres `bispun_final`, port 5432 | **Neon cloud** `...neon.tech/neondb` (`.env` `DATABASE_URL`) |
| Deploy model | Render uses `prisma db push` | `package.json` has `"prisma:push": "prisma db push"` — consistent, but prod config not verified from here |
| Migrations dir | migration `0010` for altPhone | **No `prisma/migrations/` dir.** Raw SQL lives in `prisma/pending-migrations/` (0001–0009 + prod reconciliation SQL). No `0010`. |

**Safety consequence:** Because the configured DB is a **cloud** instance, I am treating all
schema/data operations against it as potentially production-affecting. No `prisma db push`,
no migration apply, no seed was run, and none should be without explicit per-action approval.

`prisma/pending-migrations/` present: `0001`–`0009` (several variants incl. `0005P` prod-safe,
`0008a/0008b` referral split), `APPLY_prod_reconciliation_20261111.sql`. These are **raw SQL,
not Prisma-managed migrations**, which corroborates the "db push doesn't install custom
triggers" concern — to be reverified against the real Render/Neon config (needs access).

---

## 6. What is confirmed working

- Git repository integrity; all claimed commits present locally.
- 119/119 unit tests on the current branch.
- Referral signup lifecycle code is on the current branch (`fa0518f`) and `main`-merged;
  referral unit tests (`referralRewards`, `adminReferralsAuth`, `referralLink`) pass.
- `studentAltPhone` correctly present on the **Admission** model (unrelated to the P1).

## 7. What remains / needs decision or access

**Code/QA I can do safely here (no approval needed):**
- Reproduce build (`vite build`) and run integration/gap suites by checking out the relevant
  branches in a *new* branch/worktree (not the sibling worktrees).
- Full PDF §1–§21 requirement-to-code status matrix (static source verification).
- Draft the beginner manual-testing guide in PDF order.

**Needs your approval (safety-gated per the handover's own rules):**
- Landing the Counselling P1 fix onto `main` (schema + migration).
- Any `prisma db push` / migration / seed against the Neon DB.
- Pushing the local-only integration branch to origin; any merge to `main`.
- Vercel/Render deployment or config inspection with real credentials.

**Needs access I don't have in this session (mark BLOCKED):**
- Production DB read evidence (Neon prod), Vercel/Render dashboards.
- Live browser E2E against the deployed app; Android device/emulator verification
  (owned by Mobile Track B worktrees — not to be modified here).

---

## 8. Non-negotiable safety posture (reaffirmed)

No production DB writes · no migrations · no seeding · no payouts · no customer sends ·
no push/merge/deploy without explicit approval · no branch deletion · no destructive git ·
no modifying sibling worktrees. All of the above held in this session.
