# Bispun CRM — Pre-Merge Production Safety Check

Date: 2026-11-01 · Read-only + isolated integration build. **No merges, pushes to
main, branch deletions, production changes, or data resets.**

## Recommendation: GO (conditional) — code is integration-ready; the merge itself is a PRODUCTION RELEASE

The 3-way integration is clean and green, and the mobile UI + auth are verified
on-device. **But merging to `main` auto-deploys to production (Render API + Vercel
web)** — so treat the merge as a release, and ideally clear the creds/record-gated
runtime checks in dev first (see "Needs your authorization").

---

## 1. Heads verified (ls-remote)
| Ref | SHA |
|---|---|
| `origin/main` | `496fa88` (OTP onboarding; unchanged) |
| `origin/feat/mobile-ui-optimization` | `c6b55cc` |
| `origin/feat/your-changes` | `64eeb05` |

## 2. Older mobile branches contained in mobile-ui-optimization — ✅ CONFIRMED
`feat/bispun-mobile-capacitor`, `feat/mobile-native-actions`,
`feat/mobile-notifications`, `feat/mobile-notifications-handover` are **all
ancestors of** `feat/mobile-ui-optimization`. Merging ours delivers all four;
they become safe to archive post-merge.

## 7. Isolated combined integration (main + ours + your-changes) — ✅ PASS
Built in a throwaway worktree off `origin/main`, merging both branches:
- Merge `feat/mobile-ui-optimization` → **clean** (0 conflicts)
- Merge `feat/your-changes` → **clean** (0 conflicts)
- `node --test` → **40 passed, 0 failed**
- `npx vite build` → **clean** (only pre-existing chunk-size warning)
Worktree removed afterward; real `node_modules` verified intact.

## 8. Runtime risks / missing tests / uncommitted
- **Uncommitted:** none on tracked files. Untracked = my report `.md` files +
  `android/local.properties.bak` (excluded from any commit). Nothing pending on
  the branches.
- **Missing/untested at runtime** (see §3–6): desktop logged-in smoke, OTP+mobile-
  auth coexistence, push *delivery*, billing/plans flows, chat send/attachments.
- **Risk:** the dev backend is very slow (login ~11.8 s; Neon cold-starts); not a
  code risk but affects QA and could cause transient logouts under severe latency
  (optional auth-resilience hardening noted earlier).

## 10. Does merging main trigger production deploys? — ⚠️ YES
`BISPUN_PAYMENT_LINKS_CHANGES.md` documents: "push to `main` → **Render (API) and
Vercel (web) auto-deploy**." No GitHub Actions / `render.yaml` in-repo; it's the
Render + Vercel dashboard GitHub integrations on `main`. `vercel.json` only holds
an SPA rewrite. **Merging these PRs into `main` will ship both API and web to
production.** Plan it as a release with a rollback path; confirm the Vercel/Render
"production branch" is `main` in their dashboards.

## 3–6. Checked at code/build level; runtime needs authorization
| # | Area | Code/build status | Runtime status |
|---|---|---|---|
| 3 | **Desktop CRM smoke** | Layouts `lg:`-gated and unchanged (verified in UI pass; combined build clean) | ⚠️ NOT RUN — desktop uses httpOnly-cookie login; needs a QA login |
| 4 | **OTP onboarding + mobile auth together** | No file conflict (OTP = `admin/Clients.jsx`, `admin/VerifiedInput.jsx`; mobile auth = server auth/middleware + `ClientLogin.jsx`); combined builds + unit tests pass; mobile login/session verified on-device | ⚠️ OTP onboarding flow NOT exercised — needs test records/creds |
| 5 | **Firebase push** | Integration present (device-token register route, push services, FCM setup doc) | ✅ **Token registration tested** (`POST /device-tokens/register → 200` during login). ⚠️ Push **delivery + cold-start tap-nav NOT tested** — needs an authorized FCM push to the device |
| 6 | **Billing/Plans (your-changes)** | `clientBilling.js`, `adminPlans.js`, `admin/Plans.jsx` merge clean + build clean; **no production/runtime writes performed** | ⚠️ Billing/plan flows NOT exercised at runtime — needs dev records/creds |

## Needs your authorization (per your "stop and ask" rule)
To complete the remaining runtime checks in **dev only**, I need you to either run
them or explicitly authorize + designate safe test data:
1. **Desktop smoke:** authorize me to log into the dev web app with the QA account
   (or you log in and I verify), to smoke ClientPortal, Settings, admin Clients/Plans.
2. **OTP onboarding + auth:** authorize creating a **dev-only** onboarding/OTP test
   record (name the account/data to use), or run it yourself.
3. **Billing/Plans runtime:** authorize a **dev-only** billing/plan test action (no
   production), or run it yourself.
4. **Firebase push delivery:** authorize sending a **dev** test push to the
   emulator (and confirm an FCM test key/device is available).
I will not create accounts/records or use credentials without this.

## 9. Recommended PR merge order + post-merge checks
**Order (no merges performed):**
1. **PR A:** `feat/mobile-ui-optimization` → `main` — clean; delivers the whole
   mobile stack (Capacitor, mobile Bearer auth incl. Dev 2's `mobile-native-
   actions`, push, handover, Chat/Calendar/KPI UI + A/B fixes).
2. **PR B:** `feat/your-changes` → `main` — clean; billing/plans + icons/
   responsiveness.
3. **Archive** the 4 contained branches after PR A merges (your call; no deletion done).

**Post-merge checks (production, since main auto-deploys):**
- Watch **Render (API)** and **Vercel (web)** deploys complete without errors.
- Prod smoke: web desktop login + a couple modules; mobile login/session; OTP
  onboarding; a push; a billing/plan read.
- Monitor error rates; keep a **rollback** ready (revert the merge commits →
  auto-redeploys previous state).

## Final: GO / NO-GO
- **Code integration readiness: GO.** Clean 3-way merge, 40/40 tests, clean build,
  containment confirmed, mobile UI + auth verified on-device.
- **Production merge: conditional GO** — because `main` auto-deploys to prod,
  proceed only when you're ready to release, with rollback planned, and ideally
  after the four creds/record-gated runtime checks above are cleared in dev.

**STOP — awaiting your approval to merge, and your authorization for the gated
runtime tests. No merges, pushes, deploys, or data changes were made.**
