# Bispun CRM Android — Stage 0–6 Engineering Handover (2026-11-13)

**Candidate branch:** `integration/mobile-deeplinks-candidate-20261113` @ `8339b77`
**Worktree:** `S:\Bispun-cand-deeplinks` (isolated). **Nothing pushed, merged, or deployed.**
**Base:** mobile line `integration/mobile-latest-20261113` @ `61a3bbd` (contains latest main `29283ec`).
**Repo:** woways/bispun.

## Commits on this candidate (over 61a3bbd)
| SHA | Change | Stage |
|---|---|---|
| `3d9269e` | feat: notification deep-link (af5c254 cherry-pick, clean — parent was 61a3bbd) | A/2/4 |
| `c6218dd` | a11y: deep-link ship-blockers F1 (ticket focus gap) + F2 (stale calendar alert) | A/5 |
| `392722f` | fix(android): declare POST_NOTIFICATIONS (Android 13+ push opt-in) | 4 |
| `ace45cc` | docs: QA guide §23 deep-link cases DL-01..DL-08 | 12 |
| `4dba481` | a11y(mobile): unread sr-only, clear-search target size, loading role=status | 5 |
| `8339b77` | fix(mobile-chat): open thread on latest message + reduced-motion-safe scroll | 2/5 |

## Stage status
| Stage | Implemented (code) | Automated verified | Device verified | Manual QA pending | Blockers |
|---|---|---|---|---|---|
| 0 Baseline/integration | ✅ latest main included; deep-link integrated; no dup backend; secrets clean | ✅ git verified; 104/105 tests | — | — | none |
| 1 Shell/navigation | ✅ (audit: clean) | ✅ build + backStack/moduleBack tests | ⬜ | M3–M5 | none |
| B1 Dashboard | ✅ charts a11y + greeting + perf intact (audit: no dropped cols) | ✅ build | ⬜ | M2 | none |
| 2 All CRM modules | ✅ no dropped data; **chat open-on-latest fixed** | ✅ build 104/105 | ⬜ | M6–M17, §21, DL-01..08 | calendar-editor-keyboard (verify-on-device, §Deferred) |
| 3 Login/performance | ✅ login verified earlier; perf split intact; session/logout cleanup present | ✅ logoutFlow tests | ⬜ login ok | perf M1 | physical-device perf numbers |
| 4 Native/FCM + D-07 | ✅ native actions + FCM token lifecycle + **POST_NOTIFICATIONS fixed** | ✅ pushService/pushDispatch tests | ⬜ | M18–M20 | **FCM token AUTHENTICATION_FAILED (emulator GMS); needs real device** |
| D-07 Reminder+sound | ✅ worker + channel + sound + tap all in code | ✅ unit (contract) | ⬜ | D07-01..08 | isolated worker run + real-device delivery |
| 5 Security/accessibility | ✅ role-visibility CLEAN (mobile==desktop gate); a11y fixes; reduced-motion full | ✅ build; a11y-lead PASS ×2 | ⬜ | M18–M20, 4-role | F3/F4/F5 deferred (user-level) |
| 6 Regression/release | ✅ build + cap sync green; release-readiness reviewed | ✅ 104/105 (1 env-gated) | ⬜ APK via Studio | — | APK assembly = Android Studio GUI (sandbox blocks Gradle) |

## Automated evidence (on 8339b77)
- **Unit/regression:** `npm test` → **104/105 pass**. Sole failure `adminReferralsAuth.test.js` = `DATABASE_URL is not configured` (env-gated by design; NOT a regression; prod creds deliberately not used).
- **Web build:** `vite build` → clean (recharts on-demand chunks intact; ClientPortal builds).
- **Capacitor sync:** `npx cap sync android` → clean (web assets copied, 2 plugins).
- **Accessibility:** two independent accessibility-lead passes; all applied fixes PASS, no regressions.

## Deep-link (contract reconciled with Track A)
Canonical: `calendar#event:<id>` + `help#ticket:<id>` (+ legacy lead + module-only + LEAD_FOLLOWUP preserved). Parser routes on targetType (prefix non-routing); mobilePush allowlist + dispatcher platform-identical; tenant-scoped `GET /calendar/:id`; cold-start buffered; invalid → safe degrade. Track A mirrored F1/F2 onto their consolidated line (`ab32470`).

## Fixed this drive (verified)
1. **POST_NOTIFICATIONS** — targetSdk 36; neither app nor push plugin declared it → runtime opt-in auto-denied on Android 13+ (broke notifications + D-07). Added to app manifest.
2. **Chat opened on oldest message** — no scroll-to-latest on conversation open; added open-jump (instant), reset per-conversation counter.
3. **Stage-5 mobile a11y** — notification unread exposed to SR (was color-only, 1.4.1); clear-search target ≥24px (2.5.8); notifications loading announced (4.1.3); chat smooth-scrolls now honor prefers-reduced-motion.
4. **Deep-link a11y F1/F2** — ticket-path interim focus; stale calendar alert cleared on close.

## Deferred (documented — NOT edited; user/product-level)
- **Calendar editor behind soft keyboard (P2, verify-on-device):** `CalendarModal` editor lacks the `visualViewport` keyboard-aware sizing that `ChatPanel` has; Save/Create footer may be covered when the keyboard is open. Proposed fix: mirror ChatPanel's visualViewport handler. Not applied — unconfirmable without a device (desktop browsers don't emulate soft-keyboard resize) and avoids a speculative edit.
- **Mobile-web browser Back exits SPA (P3):** module switches use `replaceState`; native app (primary target) is unaffected (its own back-stack handles it). Changing to pushState risks double-handling native back — leave to a deliberate decision.
- **A11y F3** nested `aria-modal` (calendar+editor); **F4** `role=alert`+focus double-announce; **F5** `useOverlayDismiss` no real Tab-trap (WCAG 2.4.3, inert-on-shell proposed). Touch shared hook/modal nesting — user-level.
- **Entitlement gap (product/security):** `chats`, `goals-and-targets`, `my-referrals`, `my-store` skip client-side plan/feature gating on BOTH web and mobile (server-authoritative; NOT a mobile-vs-desktop mismatch). Confirm intended.

## External blockers (cannot be closed in this environment)
- **FCM token AUTHENTICATION_FAILED** — config proven correct earlier (host key check HTTP 200); root cause = emulator GMS not checked in. Needs a real Android device or a Google-Play-enabled image. Do NOT regenerate credentials.
- **D-07 live delivery PASS** — needs the reminder worker run on an isolated non-prod backend (dev has `DISABLE_BACKGROUND_WORKERS=true`) + real-device FCM. Coordinate isolated test with Track A; do not enable prod workers.
- **Physical-device performance numbers** — emulator software-GPU timings are not valid; needs a real phone.

## User actions required
1. **Android Studio GUI build** of the debug APK (CLI Gradle blocked by sandbox loopback) from this candidate — then install/verify on device.
2. **Real device (or Play-enabled emulator)** for FCM token + D-07 + perf.
3. **Firebase Console**: confirm nothing else needed once on a real device (token path otherwise ready).
4. **Release**: bump `versionCode`/`versionName` (currently 1/"1.0"); set prod `VITE_API_URL` (HTTPS); place `google-services.json` for release; no deploy/publish without approval.
5. **Merge decision**: whether to PR/merge this candidate to the mobile line and how to converge with Track A's `integration/notif-deeplinks-consolidated`.

## Release-readiness snapshot
appId `com.bispun.crm`; minSdk 24 / target 36; cleartext limited to `10.0.2.2`/`localhost`; `api.js` throws in prod without `VITE_API_URL`; release signing reads external `keystore.properties`; no secrets committed (only `.env.example`, `keystore.properties.example`).

---

## Cross-track convergence + PR-readiness (round 2 — no push)
**Track A latest (verified live):** `integration/notif-deeplinks-consolidated` @ `3506059` (F1/F2 applied at `ab32470`, on `aa278d1`).
**My candidate:** `integration/mobile-deeplinks-candidate-20261113` @ `96cec91`.

**Reconciliation result — compatible, no divergence:**
- Deep-link CORE files are **byte-identical** across the two lines (diff=0): `src/lib/notificationTarget.js`, `src/lib/mobilePush.js`, `server/lib/calendarReminders.js`, `server/lib/notifications.js`, `server/routes/clientCalendar.js`. ⇒ no duplicate F1/F2, **one canonical backend producer** (`calendar#event` / `help#ticket`).
- **Contract parse verified live (all forms):** `dashboard#event:<id>`→event (back-compat), `calendar#event:<id>`→event (canonical), `help#ticket:<id>`→ticket, `lead-store#lead:<id>`→lead, module-only `help`→module, legacy `LEAD_FOLLOWUP:<id>` marker→lead. Tenant-scope + cold-start buffering unchanged.
- My candidate additionally carries (NOT on Track A's line): `392722f` POST_NOTIFICATIONS, `8339b77` chat scroll, `4dba481` Stage-5 mobile a11y. **Recommend Track A pick up POST_NOTIFICATIONS** on any Android-shipping line.

**PR-readiness (prepared, NOT pushed/opened per directive):**
- Source: `integration/mobile-deeplinks-candidate-20261113` @ `96cec91`.
- Proposed target: `integration/mobile-latest-20261113` @ `61a3bbd` (the mobile line) — **clean fast-forward, 0 behind / 7 ahead, no conflicts**. (NOT Production `main` — that needs separate authorization.)
- Files changed vs target: 15 (manifest, 5 server deep-link files, 6 src files, 2 docs, QA guide).
- Accessibility evidence: 2 independent accessibility-lead passes, all applied fixes PASS.
- Automated: 104/105 (`adminReferralsAuth` env-gated only); vite build + cap sync green.
- Blockers: FCM token (device), D-07 delivery (device + isolated worker), physical-device perf.

**FCM config vs intended (no secrets):** packaged `google-services.json` → `project_id: bispun-crm`, package `com.bispun.crm`, api_key present (len 39, valid format). ⇒ **client config matches intended project; AUTHENTICATION_FAILED is a device-specific failure (emulator GMS check-in), NOT a config failure.** Do not regenerate credentials.

**D-07 isolated test procedure (coordinated with Track A; device part still blocked):**
- In-app reminder CREATION is already **API-verified by Track A** (exactly-once dedup via `CALENDAR_REMINDER:<eventId>` marker; 10-min threshold: 8-min event → reminder, 15-min → none). Not re-run here (no duplication).
- To reproduce in-app on an ISOLATED non-prod backend (`bispun-mobile-dev`), least blast radius first:
  - (a) ON-DEMAND (no workers): auth as the assigned user → create event `startAt` in (now, now+10min] → `GET /api/client/notifications` (or `/unread-count`); `ensureCalendarRemindersForUser` creates the REMINDER notification on that request (deduped). actionModule = `calendar#event:<id>`.
  - (b) WORKER: set `ENABLE_CALENDAR_REMINDER_WORKER=true` while KEEPING `DISABLE_BACKGROUND_WORKERS=true` (starts ONLY the 20s reminder worker, not nurture/subscription). Never unset the prod guard; dev DB only.
- **Remaining D-07 gap = device-observable only:** push fan-out (pushService→FCM) + audible sound + tap→event. Blocked by FCM token (AUTHENTICATION_FAILED / no device). Use a dev FCM project + test device tokens. Do NOT mark D-07 PASS until observed on a real device.

**Android build-prep (candidate worktree):** `google-services.json` placed (gitignored), web assets synced, POST_NOTIFICATIONS in manifest, API `10.0.2.2:4001`. APK assembly = **Android Studio GUI** (Gradle CLI blocked by sandbox loopback). Note: this worktree's `node_modules` is a junction to `S:\Bispun-integration` — builds on this machine; run `npm install` if the worktree is moved.
