# Bispun CRM — Consolidation Matrix

**Integration branch:** `integration/bispun-final-pdf-review` = `origin/main (8dff6d1)` + 5 commits.
**Build:** green · **Unit:** 106/106 · **Integration API:** 35/35 (see Regression Report).

## Merge order applied (low-risk → additive)
| # | Source | Commit(s) on branch | Features | Files | Conflicts | Result |
|---|---|---|---|---|---|---|
| 1 | Track B integration `1df0c75` (base) | `81c0b07`, `0ab5a50`, `1df0c75` | recharts lazy-load (eager JS ↓), motion polish, sr-only chart data tables (a11y), **§18 greeting = `user?.name \|\| tenant?.ownerName \|\| "there"`** | `src/modules/client/Dashboard.jsx`, `DashboardCharts.jsx`, `admin/AdminDashboard*.jsx`, `ChartSkeleton.jsx`, `mobileUi.jsx`, `index.css`, `vite.config.js` | n/a (branch base) | ✅ frontend-only; backend identical to main |
| 2 | QA branch `3588725` → `60c3861` | QA integration suite + provisioning | API integration test suite, `provisionQaTestCompany.js`, `test:integration` script, QA report | `server/__tests__/api.integration.test.js`, `scripts/provisionQaTestCompany.js`, `package.json`, `QA_REPORT_e2e_20261112.md` | none (clean cherry-pick) | ✅ |
| 3 | Admin reset `0084f2d` → `fcb7a11` | Super-Admin→Client-Admin password reset (dev) | `adminClients.js` route + integration test | `server/routes/adminClients.js`, `clientAdminPasswordReset.integration.test.mjs` | none (clean cherry-pick) | ✅ |

## Deliberately excluded
| Source | Why excluded | Where it lives (preserved) |
|---|---|---|
| `fa0518f` referral signup attribution | Financial/referral-logic conflict with merged lifecycle; resolves open business decision §20.9 (Earned event); schema change to `CrmReferral`; migration number collision (`0008`) | `origin/feat/referral-signup-lifecycle` |
| `53ccc29` finance centering | No-op — content identical to main | `origin/finance-changes` |
| `011faf4` counselling studentAltPhone P1 | Active other session's new work; not in approved list | `qa-fix/counselling-studentaltphone` (worktree `S:\Bispun-qa`) |
| my `cc10898` Dashboard.jsx greeting variant | Superseded by Track B's a11y-recommended variant (would conflict) | `qa-fix/e2e-20261112` |

## Dependencies & regression risks
- **Greeting (§18):** integration carries Track B's a11y variant only; no duplicate. `User.name` is a required column, so the `tenant?.ownerName` fallback is effectively unreachable → **no wrong-identity risk** (documented; no code change made).
- **recharts lazy-load:** build confirms `generateCategoricalChart` (recharts) is now a **separate chunk**, not in the eager `index` bundle — Track B's perf goal achieved in the consolidated build.
- **Backend unchanged vs main** (except the additive admin-reset route) → the full backend QA (106 unit + 35 integration, role/tenant/isolation, chat 2-user, Lead IDs, finance writes, referrals no-double-credit, account deletion) **carries over** to this branch.
- **No financial/referral logic was changed** (fa0518f held) → no double-credit / double-referral risk introduced.

## What is where
- **In this local integration branch:** everything in the "merge order" table above.
- **On GitHub main (`8dff6d1`):** everything except the 5 consolidation commits (Track B, QA suite, admin-reset are NOT on main).
- **Verified in production:** NONE of the consolidation (prod frontend is a stale build; see Deployment Readiness).
