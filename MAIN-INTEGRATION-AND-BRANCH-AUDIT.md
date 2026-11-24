# Bispun — Main integration & branch audit

**Date:** 2026-11-18 · Repo: `woways/bispun`

## 1. Super Admin fix — integration result ✅ DONE
- Commit `896875d` (optional Payment/UTR reference + note on Mark Credited, Source column, clearer "Payout & credit history" labels, a11y) was integrated into main.
- git's HTTPS transport was broken this session (see §9), so I recreated the exact 2-file change on the remote via the authenticated **GitHub Git Data API through `gh`** (blobs → tree → commit → branch ref), then opened **PR #46** and merged it. No tokens exposed, no force-push, branch protection respected.
- **PR #46: MERGED** (required checks **Vercel build + conflict-and-syntax PASSED** — the authoritative verification). Head branch auto-deleted on merge.

## 2. Final GitHub main commit
**`a34923e`** (`Merge pull request #46`). Verified via `gh api` before the host degraded further.

## 3. Branches audited
20 local branches + 8 worktrees audited offline. Remote PR/branch cross-check was partially blocked when `gh` began OOMing (§9). Open PRs known: **#43 (draft, notification deep-links) — preserved**; #20/#44/#45/#46 merged.

**Category A — fully merged, obsolete:**
- `fix/meet-shared-announcement` (be801da) — **deleted (local)**
- `fix/referrals-coupons-safe-fixes` (a8ae4dc) — **deleted (local)**
- `verify/superadmin-coupons-referrals` — merged via #46; remote head auto-deleted; local copy still checked out in my worktree (harmless).
- `backup/main-pre-merge-20261107` — merged but a **backup → intentionally preserved**.

**Category B — active development (preserve):** every worktree branch has commits that advanced *this session* (other devs/sessions working): `feat/referral-signup-lifecycle` (S:/Bispun, primary), `integration/bispun-final-pdf-review`, `mobile/stage0-6-deeplinks-a11y`, `integration/notification-deeplinks-consolidated` (PR #43), `qa-fix/notification-deeplinks-backend`, `fix/counselling-student-alt-phone`, `release/android-signing-prep`.

**Category C — unique unmerged, not mine (preserve, integrate after their own testing):** `feat/mobile-ui-optimization`, `feat/notification-deep-links`, `integration/mobile-latest-20261113`, `integration/mobile-perf-a11y-20261112`, `qa-fix/e2e-20261112`.

**Category D — likely stale/duplicate (verify before any cleanup — NOT deleted):** `integration/notif-deeplinks-consolidated` (vs the `...notification...` one), `qa-fix/counselling-studentaltphone` (vs `fix/counselling-student-alt-phone`), `rc/android-signed-20261109` (vs `release/android-signing-prep`). These need the owning dev to confirm before removal.

## 4. Branches safely deleted
**2** (local, fully-merged, not checked out, `git branch -d` merged-only): `fix/meet-shared-announcement`, `fix/referrals-coupons-safe-fixes`.
Their **remote** counterparts and all other remote cleanup could **not** be performed — git push/delete is broken and `gh` is OOMing (§9).

## 5. Preserved + reasons
All Category B/C/D branches and all 8 worktrees preserved: they are other developers'/sessions' active streams (worktree HEADs advanced this session), hold unique unmerged work I'm not authorized to verify/integrate, carry an open PR (#43), or are backups. "Do not blindly merge integration branches / never run destructive cleanup against unverified work."

## 6. Remaining unique unmerged changes
The Category C/D branches may hold unique approved work, but I could not verify them against the true remote main (gh OOM). They must be integrated by their owners after their own testing — not consolidated blindly here.

## 7. Tests passed/failed/not executed
- **PR #46 required CI: PASSED** (Vercel build + conflict-and-syntax) — authoritative.
- The 2-file change is byte-identical to the last green local run (**140/140 tests + `vite build` PASS**).
- **This turn's local re-run: NOT RELIABLE / NOT EXECUTED** — the host OOM'd (`vite` "memory allocation failed"; the test runner aborted after 69–99 of 140). Environment fault, not code.
- Live Super Admin browser + real Razorpay payment flows: **NOT TESTED** (need live credentials).

## 8. Production deployment status
- No schema change in this release; Render build command already `npm install && npx prisma generate` (no `db push`) — not reintroduced.
- Frontend auto-deploys via Vercel on merge; the `source` column populates after the **Render backend redeploy**. `0008a`/`0008b` referral-lifecycle migrations remain a separate, pre-existing deployment item.
- **My Store untouched.** No production migration run. No unsafe deploy performed.

## 9. Genuinely unavoidable manual actions
1. **Environment/host recovery (blocker):** mid-session the host became resource-exhausted — git's HTTPS transport stopped working (`git fetch/push/ls-remote` → "Could not read from remote repository", while `curl` and `gh` reached GitHub; not a credential issue — `gh auth git-credential` returns a valid token), then `vite`/node and finally `gh` itself began failing with out-of-memory. **Restart the session/host** (and if git push still fails afterward, run `gh auth setup-git` once) to restore normal git operations.
2. **Remote branch cleanup (once tools recover):** delete the remote heads of the two merged branches above if still present, and have owners confirm the Category D duplicates before removing them. Suggested, after recovery:
   ```
   gh api -X DELETE repos/woways/bispun/git/refs/heads/fix/meet-shared-announcement
   gh api -X DELETE repos/woways/bispun/git/refs/heads/fix/referrals-coupons-safe-fixes
   ```
3. **Render backend redeploy** to make the backend `source` field (and the earlier coupon/Meet backend fixes) live.
