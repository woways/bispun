# Bispun CRM — Post-merge branch cleanup plan (read-only; awaiting approval)

Date: 2026-11-02 · `origin/main` = **`c349759`** (PR #3 merge; not protected). **No branch deleted.
Read-only audit. Nothing modified.**

## Phase 1 — Safety verification (all current)
- `origin/main` = `c349759`; still contains the merge commit; **no commits after it**.
- **PR #3 = MERGED** (mergeCommit `c349759`, 10:57:57 UTC). **Open PRs: none.**
- No new branches with active developer work; no new commits since the last audit.
- **main branch protection: NONE** (so no protection blocks cleanup; main is never deleted regardless).
- Worktrees: `S:\Bispun` → `feat/mobile-ui-optimization` (clean), `S:\Bispun-integ` → `integration/mui-yc`
  (clean). Both checked-out branches.
- All intended features remain in `main`; Android is buildable from `main` (android/, Capacitor, Firebase,
  google-services plugin wiring all present).

## Phase 2 — Containment reconfirmed vs latest `origin/main`
| Branch | Tip | Contained in main | Uncontained commits |
|---|---|---|---|
| integration/mui-yc | 70b8209 | ✅ yes | 0 |
| feat/mobile-ui-optimization | c6b55cc | ✅ yes | 0 |
| feat/your-changes | d0628dc | ✅ yes | 0 |
| feat/mobile-notifications | 38dadb2 | ✅ yes | 0 |
| feat/mobile-notifications-handover | 666cc31 | ✅ yes | 0 |
| feat/bispun-mobile-capacitor | 4f4ba21 | ✅ yes | 0 |
| feat/mobile-native-actions | d29381b | ⚠️ no | **1** — `d29381b` (`.gitignore` only; effect already in main — **verified redundant**) |

## Phase 4 — Deletion plan

### Table (remote branches)
| Branch | Remote exists | Fully merged | Active work | Safe to delete | Reason |
|---|---|---|---|---|---|
| `main` | ✅ | — | — | ❌ **NEVER** | Production branch |
| `integration/mui-yc` | ✅ | ✅ | none | ✅ YES | PR #3 head; fully merged; PR ref + merge history preserved after delete |
| `feat/mobile-ui-optimization` | ✅ | ✅ | none | ✅ YES | Fully contained in main |
| `feat/your-changes` | ✅ | ✅ | none | ✅ YES | Fully contained |
| `feat/mobile-notifications` | ✅ | ✅ | none | ✅ YES | Fully contained |
| `feat/mobile-notifications-handover` | ✅ | ✅ | none | ✅ YES | Fully contained |
| `feat/bispun-mobile-capacitor` | ✅ | ✅ | none | ✅ YES | Fully contained |
| `feat/mobile-native-actions` | ✅ | ⚠️ all but 1 | none | ⚠️ **SAFE AFTER EQUIVALENCE VERIFICATION** (done) | Only `d29381b` (gitignore) is unmerged; its effect is already in main — redundant. Delete to clean up, **or** keep to retain that commit. Your explicit call. |

### Classification
- **SAFE TO DELETE (fully merged):** `integration/mui-yc`, `feat/mobile-ui-optimization`,
  `feat/your-changes`, `feat/mobile-notifications`, `feat/mobile-notifications-handover`,
  `feat/bispun-mobile-capacitor`.
- **SAFE AFTER EQUIVALENCE VERIFICATION (verified redundant):** `feat/mobile-native-actions`.
- **KEEP — never delete:** `main`.
- **No branches are KEEP-for-active-work or unmerged-functionality** — none have pending work.

### 1. Exact REMOTE branches recommended for deletion
```
origin/integration/mui-yc
origin/feat/mobile-ui-optimization
origin/feat/your-changes
origin/feat/mobile-notifications
origin/feat/mobile-notifications-handover
origin/feat/bispun-mobile-capacitor
origin/feat/mobile-native-actions   ← only if you accept the redundant d29381b is discardable
```

### 2. Exact LOCAL branches recommended for deletion
(Local branches that exist, are merged, and are **not** checked out by a worktree)
```
feat/bispun-mobile-capacitor
feat/mobile-notifications
feat/mobile-notifications-handover
```
(There are no local `feat/your-changes` or `feat/mobile-native-actions` branches — remote-only.)

### 3. Branches to PRESERVE
- `main` (remote + local) — production, never delete.
- `feat/mobile-ui-optimization` (**local**) — checked out by `S:\Bispun` worktree → keep (remote may still be deleted).
- `integration/mui-yc` (**local**) — checked out by `S:\Bispun-integ` worktree → keep (remote may still be deleted).

### 4. Worktree cleanup prerequisites
- **None** for the recommended deletions (remote deletions are independent of local worktrees; the 3 local
  deletions are not checked out).
- To also delete the **local** `feat/mobile-ui-optimization` / `integration/mui-yc`, their worktrees
  (`S:\Bispun` / `S:\Bispun-integ`) would have to be removed or repointed first — **not recommended** (they
  are this session's active working directories). Keep them.

### 5. Remaining unmerged commits
- Only `d29381b` on `feat/mobile-native-actions` (a single `.gitignore` line, **verified redundant** — main
  already ignores `google-services.json`, `*service-account*.json`, `*serviceAccount*.json`, `*.keystore`,
  `*.jks`, `.env*`). Nothing functional is unmerged anywhere.

### 6. Can Android development continue from `main`?
✅ **Yes.** `android/app/build.gradle`, `AndroidManifest.xml`, `capacitor.config.json`,
`network_security_config.xml`, `src/lib/mobilePush.js` and the `google-services` plugin wiring are all in
`main`. The Android APK can be built from `main` (with prod `VITE_API_URL=https://api.bispun.com` +
`google-services.json` + signing). The old mobile branches are **not** needed for Android work.

## Phase 5 — STOP for approval
**No branch has been deleted.** On your explicit approval of the exact names, I will:
1. Delete only the approved **remote** branches (`git push origin --delete` / GitHub API).
2. Delete only the approved **local** branches that are not checked out by a worktree.
3. Not force-delete anything with unverified unique changes (native-actions is verified-redundant; only on your explicit OK).
4. Prune stale remote-tracking refs (`git fetch --prune`).
5. Verify `main` unchanged (`c349759`), production still healthy, and Android/Firebase/Capacitor code still in `main`.
6. Report the final remaining-branches list.

**Recommended approval set:** delete the **6 fully-merged** remote branches + their **3 deletable local**
counterparts; decide separately on `feat/mobile-native-actions` (safe but holds the one redundant commit).
Tell me which exact branches to delete.
