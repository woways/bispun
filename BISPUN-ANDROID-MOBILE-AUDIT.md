# Bispun CRM — Android Mobile Audit (2026-11-19)

**Build audited:** installed APK = `mainmerge @ 040cd29` (PR #31 mobile UI line), appId `com.bispun.crm`, v1.0.
**Device:** Android emulator-5554, **software GPU (swiftshader)** — hardware GPU crashes the WebView on this host.
**Backend:** Blue dev on host `:4001` (app targets `10.0.2.2:4001`), healthy. **Tenant/role:** "Student Mentor (Dev)" admin.
**latest main:** `a8708f9`. **Important:** this APK is **behind main** (see §C) — visual results are for the mobile-UI build, not a full latest-main build.

> These are **emulator visual + interaction** results, not real-device or full functional E2E PASS.

## A. Screen-by-screen audit
| Module | Visual UI | Navigation | Functional | Branding | Result | Evidence |
|---|---|---|---|---|---|---|
| App startup / Login | Clean, logo centered, email/password, show-password, Sign in, Remember me | — | Login works (reached dashboard) | Bispun | **PASS** | a01, emu_demo2 |
| Dashboard | KPI grid (2-col), Business Pulse, Revenue Trend chart, Leads-by-Source gauge | Bottom nav, sticky header | KPIs load | Tenant "Student Mentor (Dev)" | **PASS** | a01, a02 |
| Leads (Lead Store) | KPI cards + action buttons wrap well | Tab works | Loads | Bispun | **PASS (minor)** | a03 |
| Admissions | All/Domestic/Intl tabs, Export, search | Tab works | Loads (0 rows) | Student Mentor | **PASS (minor)** | a04 |
| Finance (Revenue) | KPI cards, no overflow | Tab works | Loads | — | **PASS** | a05 |
| More sheet | Grouped bottom sheet, safe-area padding, Log out | Opens/scrolls/closes | — | My Store hidden ✅ | **PASS** | a06, a07 |
| Chats (list) | Header, New, search, conversation row | Opens | Loads | — | **PASS** | b02 |
| Chat view / Meet | Header (Meet/video btn, search, overflow), composer (emoji, Meet, send) | Back → returns to nav origin | Messages loading; **Meet not launched (no real meetings)** | — | **PASS (visual); Meet E2E NOT TESTED** | b03, b04 |
| Referrals — Program | Earned/Awaiting/Credited cards, stage pipeline (Link→Referred) | Tab toggle | Loads (₹0) | — | **PASS** | b05 |
| Referrals — My Referrals | Tag-a-referral, Total/In-progress/Admitted, share code/link | Tab toggle | Loads | — | **PASS — but stale copy "Share & earn" (see §C)** | b06 |
| Analytics / Insights | Overview/Year tabs, KPI cards, Source-wise chart | Opens | Loads | — | **PASS** | b07 |
| Notifications | Bottom sheet, Mark all read | Opens | List loading | — | **PASS (visual)** | b08 |
| Goals, UTM Leads, Search, Calendar, Help & Support | — | present in nav | — | — | **NOT TESTED** (accessible; not individually captured) | — |
| Counselling, Walk-ins | — | not in this role's nav | — | — | **NOT TESTED** (permission/config, not a bug) | — |
| Android Back | — | returns to prior screen, app doesn't exit/crash | — | — | **PASS** | b04 |

## B. Bug / issue list
| Priority | Module | Issue | Root cause | Fix | Status |
|---|---|---|---|---|---|
| Low | Lead Store | "All Leads (0" filter label clipped; leads **table horizontally scrolls** (EMAIL off-screen) | wide table/filter row not stacked for narrow screens | stack/card layout via `native:` only (desktop unchanged), a11y review | **Not fixed** — belongs on the mobile branch (PR #31); see §C. Reported, not applied (avoid overwriting owner's branch) |
| Low | Admissions | Filter row horizontally scrolls (TO DATE off-screen) | same pattern | same | **Not fixed** — same rationale |
| N/A | Auth | "Unexpected logout" during audit | **Explicit logout** — my automated tap hit the More-sheet "Log out" control (see §D). Not an app defect. | none | **No bug** |

No clipping/overlap of interactive controls, no buttons outside the viewport, no keyboard-trapped forms, and no broken/stretched logos were observed on the screens tested.

## C. Build currency / consolidation (KEY)
- The installed APK (`040cd29`, PR #31 "mobile/stage0-6-deeplinks-a11y") shows **old referral copy "Share & earn"**, whereas latest main (via PR #44) uses **"Share your link"**. So **the APK predates recent main fixes** (referral copy/link, counselling P1, Meet server-side announcement, Super-Admin payout reference).
- Conversely, **latest main (`a8708f9`) does NOT contain the mobile-UI stage0-6 work** — that's still in unmerged **PR #31**.
- Therefore neither artifact is a complete "latest mobile build." A truly current mobile APK requires **PR #31 merged into latest main, then rebuilt**.

**PR status:**
- **PR #31** (Android UI, stage0-6/deeplinks/a11y): OPEN, **mergeable (CLEAN)**. Emulator-visual PASS, but merging Android UI requires **real-device acceptance** (Pixel 6 screenshots, APK build, web-isolation, overflow/nav/modal regression) — **GATED**, not satisfiable on this emulator.
- **PR #24** (mobile perf/a11y): OPEN, **DRAFT + DIRTY** (conflicts) → owner must resolve; **not ready**.
- I did **not** merge or modify either (other developers' work; no force-push; no new branches).

## D. Session-loss root cause (evidence)
Backend `:4001` logs: `POST /auth/login 200` → `GET /auth/me 200` → **`POST /auth/logout 200`** → `GET /auth/me 401`. The only caller of `/auth/logout` is the **Log out button** (`ClientPortal.jsx:2200`); there is **no auto-logout on background 401** (that bug was already fixed, `api.js:108`). Auth **token is in `localStorage`** (persists across reloads). **"Remember me" = email-prefill only**, not session lifetime. → **The logout was an explicit action (automated tap landed on "Log out"), not a crash, token-expiry, or persistence defect. Severity: not a bug.**

## E. Performance
- Cold launch + first WebView load under **swiftshader software rendering is slow** and produced transient ANR dialogs earlier — **emulator/host-GPU limitation**, not an application performance defect (hardware GPU separately crashes the WebView on this host).
- Once loaded, every screen rendered correctly; navigation worked. No app-level perf defect evidenced.
- **Real-device performance (smoothness, cold-launch, scroll) = NOT TESTED** and must be verified on a physical Pixel 6 before any release-readiness claim.

## F. Branding
- **Bispun**: app name ("Bispun"), launcher icon, splash, login — consistent. ✅
- **Tenant (Student Mentor (Dev))**: header shows the **tenant's own identity**, not hardcoded Bispun — correct tenant-branding behavior. ✅
- **Student Mentor** experience appears in this dev tenant throughout (it IS the tenant). ✅
- No broken/stretched logos or cross-screen inconsistency observed. **Woways** company identity: not surfaced on the screens tested (NOT TESTED where it would appear, e.g., invoices/legal).

## G. Isolation / safety honored
No code changed this audit. My Store untouched (and correctly hidden). Settings/Permissions untouched. No production DB/Pond use (Blue dev only). No real payments/SMS/WhatsApp/Meet triggered. No merge/push/force-push.

## H. What remains
- Real-device (Pixel 6) run for performance + Android acceptance (gates PR #31).
- Rebuild a current mobile APK = PR #31 ∪ latest main, then re-audit.
- Live: Goals, UTM, Search, Calendar, Help & Support; Meet multi-user; Counselling/Walk-ins (needs a role that has them).
- Optional low-priority mobile table/filter stacking fixes (on the mobile branch, a11y-reviewed).
