# Bispun Mobile CRM — Android Emulator Verification Report

Date: 2026-11-01 · Branch: `feat/mobile-ui-optimization`
Device: Android emulator `emulator-5554`, 1080×2400 (411×914 CSS px), QA tenant
account **"Bispun Mobile QA"** (`QA (dev test)` workspace), dev backend.
Method: `adb install -r` + real `input tap`/`swipe`/`keyevent` + `exec-out
screencap`, with Chrome DevTools Protocol (debug WebView) used to measure exact
element geometry. No app data was cleared; nothing was committed/pushed.

> ## Overall status: PARTIALLY VERIFIED — NOT yet READY FOR MANUAL QA
> Chat keyboard-safety, Calendar mobile redesign, Android Back, the compact KPI
> grids, scrolling, session persistence and notifications all **PASS**. But one
> real layout bug was found (**Chat list header hidden behind the top bar on
> first render**) and two flows are **NOT TESTED** for environment reasons
> (no second user in the dev tenant to open a real chat thread; desktop web not
> testable on a phone APK). Fix the header issue, then this is QA-ready.

---

## APK verification (all PASS)

| Check | Result | Evidence |
|---|---|---|
| APK timestamp current | ✅ PASS | Built 18:48, after the 18:18 `cap sync` of Chat/Calendar assets |
| Package ID | ✅ PASS | `com.bispun.crm`, launchable `com.bispun.crm.MainActivity` (aapt) |
| Synced Chat/Calendar assets | ✅ PASS | APK bundles `crm-assets/ClientPortal-DFy1wepf.js` — identical hash to current `dist/` |
| `adjustResize` compiled in | ✅ PASS | `windowSoftInputMode="adjustResize"` present in merged + packaged manifests |
| Signing compatibility | ✅ PASS | `adb install -r` → Success; `firstInstallTime` (2026-10-30) preserved = data not wiped |

---

## Feature verification (requested items 1–10)

| # | Feature | Result | Notes |
|---|---|---|---|
| 1 | Chat conversation **list** UI | ✅ PASS | Full-bleed list, search, empty state render correctly |
| 1 | Chat **list header** (avatar/Chats/Select/New) | ❌ **FAIL** | Hidden behind the fixed app top bar on **initial** render (see Issue A). Self-corrects after any reflow (keyboard/resize/re-nav). |
| 1 | Chat **thread** UI (open conversation) | ⚠️ NOT TESTED | Dev QA tenant has **no other users** ("No people found" in New chat), so a real thread couldn't be opened. List↔thread toggle and thread markup are present in code. |
| 2 | Keyboard open/close + composer visibility | ✅ PASS | Measured: keyboard open → WebView resized 914→578px (adjustResize) → chat panel shrank 826→410px → focused input stayed visible above the keyboard. Composer uses the same panel-height mechanism. |
| 3 | Message send / scroll / attachments | ⚠️ NOT TESTED | Blocked by the same "no second user" limitation (can't reach a thread). Not a code failure. |
| 4 | Calendar month picker + agenda + editor | ✅ PASS | Mobile shows month picker + "SUNDAY, 1 NOV" agenda (no cramped week grid); day tap updates agenda; event editor keyboard-safe — **Create/Cancel stayed visible above the keyboard**. |
| 5 | Android Back + overlay dismissal | ✅ PASS | New-chat dialog: Back closes dialog, stays on list. Editor: Back closes editor only, calendar stays. Module: Back Chats→Dashboard. Calendar: Back→underlying module. |
| 6 | Dashboard / Lead Store / Admissions / Revenue / Analytics / Referrals / Help / Settings | ✅ PASS | All load and render correctly on mobile; content clears the status bar; no horizontal overflow. |
| 7 | New compact KPI layouts | ✅ PASS | Dashboard 2×2, Lead Store 2×2, Revenue 2-col (6), Analytics 2×2, Help 2×2; Admissions 2+1, Referrals 2+1. Amounts not clipped. |
| 8 | Vertical scroll + bottom nav (every module) | ✅ PASS | Dashboard scrolls to charts; bottom nav stays fixed on all modules; no status-bar overlap on module pages. |
| 9 | Session persistence | ✅ PASS | After `install -r`, app auto-restored to the Dashboard **without re-login**. |
| 9 | Notifications | ✅ PASS | Bell (9+) opens panel; list loads real entries (sign-in alerts, a submitted support ticket); "Mark all read" present. |
| 9 | Role-based navigation | ⚠️ PARTIAL | QA account has broad admin access and sees all authorized modules; module-permission gating code is intact. Not tested across multiple roles (only one QA account available). |
| 10 | Desktop CRM regression | ⚠️ NOT TESTED HERE | This is the Android phone APK; desktop = the web app in a browser. All changes are `lg:`-gated and the web build is clean, so desktop web is unchanged by code — but that was not exercised on this device. |
| — | UTM Leads (bonus) | ✅ PASS | Generator form renders cleanly, no overflow. |

---

## Issues found

### A. (FAIL) Chat list header is behind the app top bar on first render
- **What:** On first open of Chats, the header row (your avatar, "Chats", Select,
  **+ New**) sits *behind* the fixed top bar; only the search box shows below it.
  So the **New** button isn't tappable until you interact.
- **Measured:** chat root top = 12px; top bar bottom = 81px → header (12–78px) is
  under the bar. After any reflow (focusing search, rotating, re-navigating) it
  corrects to top = 92px (below the bar) and the header shows normally.
- **Root cause:** **pre-existing** CSS margin-collapse on `<main>` (`margin-top:
  80px` collapses, so every module's content box starts at y≈0). Other modules
  are saved by their own top spacing; the chat header sits flush at the top and
  lands behind the bar. The chat root class is unchanged from before this pass —
  this was not introduced by the Chat/Calendar edits, but it is in scope to fix.
- **Impact:** medium — first impression is broken and New-chat is momentarily
  unreachable; self-heals on any interaction.
- **Suggested fix (needs your approval — not done):** stop `<main>`'s top margin
  collapsing (e.g. give the scroll container `display:flow-root`/`overflow` or
  convert the `mt` offset to padding on a wrapper), or add a small top offset to
  the chat panel on mobile. Would re-run the accessibility check and re-verify.

### B. (MINOR) Calendar modal header slightly overlaps the status bar
- The full-screen Calendar modal (`h-[100dvh]`) has no top safe-area inset, so
  the "Calendar" title sits under the status-bar icons at the very top.
- **Impact:** low (cosmetic); calendar is fully usable.
- **Suggested fix:** add `padding-top: env(safe-area-inset-top)` to the calendar
  modal header on mobile.

---

## Manual QA checklist (beginner-friendly)

Prereqs: dev backend running; emulator/device with the current `app-debug.apk`
installed via `adb install -r` (keeps your login). Use **dev QA data only**.

### Chat
1. Open **More → Chats**. *Expected:* header shows avatar, "Chats", Select, **+ New**.
   *Known issue A:* on first open the header may be hidden behind the top bar —
   tap the search box once and it appears. **Fail** if it never appears.
2. Tap the **search box**. *Expected:* keyboard opens; the search field stays
   visible above it; layout doesn't jump. **Pass** if visible.
3. (Needs a 2nd dev user) Tap **+ New → pick a person → Start chat**. Open the
   thread, tap the message box. *Expected:* composer + Send stay above the
   keyboard; typing works; Enter sends, Shift+Enter = newline.
4. Send a test message; scroll up to read history while a new message arrives.
   *Expected:* view doesn't jump; a "New messages" pill appears to jump down.
5. Press **Android Back** inside a thread. *Expected:* returns to the chat list.

### Calendar
1. **More → Calendar.** *Expected:* month picker + selected-day agenda (no week grid).
2. Tap a different day / use ‹ › / **Today**. *Expected:* selection + agenda update.
3. Tap **New event**, then the **Title** field. *Expected:* **Cancel/Create event
   stay visible above the keyboard**; the form body scrolls.
4. Press **Back** twice. *Expected:* 1st closes keyboard, 2nd closes the editor
   only (calendar stays). Back again closes the calendar.

### KPI modules (Dashboard, Lead Store, Admissions, Revenue, Analytics, Referrals, Help)
1. Open each. *Expected:* compact 2-column KPI cards (2×2 or 2+1), numbers not cut off.
2. Scroll down. *Expected:* page scrolls, bottom nav stays fixed, no sideways scroll.

### Session / Notifications / Settings
1. Close and reopen the app. *Expected:* stays logged in (no re-login).
2. Tap the **bell**. *Expected:* notifications list loads; "Mark all read" works.
3. **More → Settings.** *Expected:* sections (Company/Branding/Users…) and forms load.

### Desktop (on a computer browser, not the phone)
1. Open the web CRM at desktop width. *Expected:* two-pane Chat, full Calendar
   week grid, original KPI layouts — unchanged.

---

## Not done / environment limits
- Real chat thread (open/send/attachments): blocked — **no second user** in the
  dev QA tenant. Seed a 2nd dev user to complete items 1(thread) & 3.
- Desktop regression: not runnable on the phone APK; verify in a desktop browser.
- Multi-role access: only one QA account available.

## What was NOT changed
No code was modified during verification. No commits, pushes, or deploys. App
data preserved. The Chat/Calendar implementation files are exactly as left after
the previous pass; fixes for Issues A/B are proposed, not applied.
