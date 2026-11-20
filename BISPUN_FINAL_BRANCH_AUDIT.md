# Bispun CRM — Final Branch Audit

**Date:** 2026-11-12 · **Integration branch:** `integration/bispun-final-pdf-review` (isolated worktree `S:\Bispun-final-review`)
**Method:** read-only `git fetch` + per-commit inspection across the shared object store. **No push/merge/deploy/reset/branch-deletion. No other worktree modified.**

## 1. Verified repository state
- **origin/main = `8dff6d1`** (PR #22 — Help & Support §12 + dashboard view renames §14.4–14.7). Confirmed current tip.
- No `prisma/migrations/` (Prisma managed) directory — schema sync is via `prisma db push`; all SQL lives in `prisma/pending-migrations/` (manual).

## 2. Worktrees observed (NONE modified by me except my own new one)
| Worktree | Branch | Note |
|---|---|---|
| `S:\Bispun-qa` | **`qa-fix/counselling-studentaltphone` @ 011faf4** | **Repurposed by another active session** since my last turn — now holds a NEW counselling P1 fix on top of my `1044bbe`. Treated as actively-owned; untouched. |
| `S:\Bispun-mobile` | `feat/mobile-ui-optimization` @ 1deffa3 | Track B. Untouched. |
| `S:\Bispun-integration` | `integration/mobile-perf-a11y-20261112` @ 1df0c75 | Track B integration. Untouched. |
| `S:\Bispun-final-review` | **`integration/bispun-final-pdf-review`** | **My new isolated consolidation worktree.** |
| others (`Bispun`, `Bispun-integ`, `Bispun-pr13-integration`, `Bispun-release`, `Bispun-stab`) | various | Untouched. |

## 3. Referenced commits — verified
| SHA | In main? | Subject | Disposition |
|---|---|---|---|
| `8dff6d1` | — (is main) | PR#22 help/dashboard | **base** |
| `1df0c75` | NOT | Track B greeting fix (§18) | **included** (consolidation base) |
| `0ab5a50` | NOT | a11y sr-only chart tables | **included** |
| `81c0b07` | NOT | recharts lazy-load + motion | **included** |
| `1deffa3` | NOT | greeting fix on mobile branch | superseded by `1df0c75` (same change, integration copy) |
| `3588725` | NOT | QA integration suite + provisioning | **included** (cherry-pick → `60c3861`) |
| `cc10898` | NOT | QA verification docs + my greeting variant | docs re-authored here; **greeting hunk excluded** (Track B's wins) |
| `1044bbe` | NOT | QA consolidation note | folded into these reports |
| `c714a7d` | **IN main** | referrals 4-stage lifecycle | already integrated |
| `fa0518f` | NOT | referral signup attribution (REFERRED→EARNED, ?ref) | **EXCLUDED — see §4** |
| `53ccc29` | NOT | finance drill-down centering | **EXCLUDED — no-op** (content byte-identical to main; branch is behind) |
| `0084f2d` | NOT | admin password reset (dev) | **included** (cherry-pick → `fcb7a11`) |
| `011faf4` | NOT | counselling studentAltPhone P1 (NEW) | **EXCLUDED — active other session's new work, not in approved list** (flagged for your decision) |

## 4. Excluded work — reasons (STOP conditions honored)
- **`fa0518f` (referral signup attribution): EXCLUDED — financial/referral-logic conflict + unresolved business rule.** It is built on top of the merged lifecycle but **evolves the referral financial model**: makes `CrmReferral.referredCompanyId` nullable, adds `pendingSignupId`/`referredEmail`/`referredName`, flips the default status `SUCCESSFUL`→`REFERRED`, and adds migration `0008_referral_referred_stage.sql` that **collides in number with main's `0008_add_account_deletion_request.sql`**. It also **decides the event that qualifies a referral as "Earned"** (payment captured) — which the PDF lists as **open decision §20.9**. Adopting it silently would resolve an open business rule and change financial logic. **Held for your explicit decision** (see GO/NO-GO).
- **`53ccc29` (finance): EXCLUDED — redundant.** `git diff origin/main..53ccc29 -- src/modules/client/Revenue.jsx` is empty; the §9 finance work is already in main. The branch is behind main.
- **`011faf4` (counselling P1): EXCLUDED — active work.** Appeared mid-task in the repurposed `S:\Bispun-qa`; not in the approved commit list; another session is actively working it. Flagged so you can decide whether to fold it in.

## 5. Nothing lost
All unique commits and branches are preserved as refs (no deletion, no reset). Excluded items remain fully available on their branches for a later, deliberate decision.
