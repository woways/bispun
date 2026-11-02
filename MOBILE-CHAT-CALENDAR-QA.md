# Bispun Mobile CRM — Chat & Calendar Final Pass + Manual QA Handover

Branch: `feat/mobile-ui-optimization`
Scope of this pass: **Phase 1 (Chat)** and **Phase 2 (Calendar)** mobile UI + Android
keyboard/composer fix, plus the accessibility items the review flagged.
All changes are mobile-only (gated below Tailwind `lg` / 1024px) **except** two
deliberate, benign cross-platform additions noted under "Desktop impact".

> **Overall status: PARTIALLY VERIFIED — READY FOR APK BUILD + MANUAL QA.**
> Code is implemented, the production web build is clean, Capacitor assets are
> synced, and all 40 automated tests pass. The **debug APK and on-device
> emulator checks are NOT done here** because the Gradle CLI is still blocked by
> the known `Unable to establish loopback connection` error. Build the APK in
> Android Studio (steps below), then I can run the adb emulator verification, or
> you can follow the manual checklist.

Nothing has been committed or pushed. The last committed work is Stage B
(`0e9fa2c`). This pass is uncommitted in the working tree, awaiting your review.

---

## 1. What changed (files)

| File | Change |
|---|---|
| `src/lib/useOverlayDismiss.js` | **NEW.** Shared hook: routes Android hardware-back + Escape through `backStack` for an overlay, and moves focus into a dialog on open / restores it on close. |
| `src/components/BackButtonHandler.jsx` | Wires the **Escape key** to the same dismissal path as hardware-back (closes the top-most overlay). Runs on web + device. Yields to handlers that already consumed the key. |
| `src/modules/client/ChatPanel.jsx` | Keyboard-safe composer, full-bleed mobile layout, 44px touch targets, non-stealing auto-scroll + "New messages" pill, polite live region, dialog a11y, mobile contrast tokens, IME-safe Enter. |
| `src/modules/client/CalendarModal.jsx` | Mobile = month picker + selected-day agenda (week grid hidden below `lg`); keyboard-safe event editor (pinned footer, scrolling body); dialog a11y; accessible date cells; mobile contrast + 44px targets. |
| `android/app/src/main/AndroidManifest.xml` | `android:windowSoftInputMode="adjustResize"` so the WebView resizes when the keyboard opens (standard Capacitor practice; supports the composer fix). |

Preserved intact: B1/B2/B3/B3.1 and Stage B. Desktop CRM, marketing site,
Developer 2 work, backend, and financial logic untouched.

---

## 2. Chat — what to expect on mobile

- **Composer no longer hides behind the keyboard.** The panel height tracks the
  visual viewport (`visualViewport` + `adjustResize`); when the keyboard opens the
  message list shrinks and the input + Send stay visible.
- **Full-bleed layout** below `lg` (no wasted side margins / card border).
- **44px touch targets** on Send, Emoji, Meeting, Back, header Search/Options.
- **Enter sends, Shift+Enter = newline**, and Enter is ignored mid-IME
  composition (no half-typed sends).
- **Reading older messages is no longer interrupted** — auto-scroll only jumps to
  the newest message when you're already near the bottom or you sent it; otherwise
  a **"New messages"** pill appears to jump down on demand.
- **Back behavior:** hardware Back (and Escape) closes an open emoji picker /
  menu / dialog first, then returns a thread to the conversation list.
- **Screen readers:** new incoming messages are announced politely; dialogs are
  `role="dialog" aria-modal`; icon buttons and search inputs are labelled.

## 3. Calendar — what to expect on mobile

- **No more squeezed 7-day grid.** Below `lg` the view is the **compact month
  picker + the selected day's agenda list**. The full week/day grid returns on
  desktop (`lg`+).
- **Event editor is keyboard-safe:** the sheet is height-bounded, the body
  scrolls, and **Save / Cancel / Delete stay pinned and visible** above the
  keyboard.
- **Accessible dates:** each day cell announces its full date, marks today
  (`aria-current`), the selected day (`aria-pressed`), and whether it "has events".
- **Back / Escape:** closes the event editor first (editor only), then the calendar.

---

## 4. Build the debug APK in Android Studio

The web build + Capacitor sync are already done, so the Android project is ready.

```bash
npx cap open android
```

Then in Android Studio:
1. Let Gradle finish syncing (bottom status bar).
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. When it finishes, click **locate** — the file is
   `android/app/build/outputs/apk/debug/app-debug.apk` (package `com.bispun.crm`).
4. Install without wiping data (keeps your login/session):
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```
5. Launch and confirm you're still logged in.

> Do **not** change firewall/antivirus to work around the Gradle CLI error —
> Android Studio builds fine; only the command-line daemon is blocked here.

After it's installed, tell me and I can run the adb emulator verification
(screens + taps + screenshots) for the key journeys, as in the earlier batches.

---

## 5. Manual QA checklist (per module)

Test at widths 320 / 360 / 390 / 412 / 768 and on desktop. Use **development QA
accounts only**; don't message real users or reset data.

### Chat
| Step | Do this | Pass = |
|---|---|---|
| List loads | Open Chats | Conversations show with names, previews, time, unread badges |
| Open thread | Tap a conversation | Thread fills the screen; Back arrow visible |
| Keyboard | Tap the message box | **Input + Send stay visible above the keyboard**; list shrinks |
| Multiline | Shift+Enter (or newline) | Box grows; layout doesn't break |
| Send | Type + Send (or Enter) | Message appears; view scrolls to it |
| Read history | Scroll up, then a new message arrives | View does **not** jump; "New messages" pill appears; tapping it jumps down |
| Attachments / emoji / meeting | Use each control | Work as before; targets easy to tap |
| Back | Hardware Back from thread | Returns to the list (doesn't exit app) |
| Back from overlay | Open emoji/menu, press Back | Overlay closes first |
| Long name/message | Open a long-title chat | No horizontal scroll |
| Desktop | Open Chats at desktop width | Two-pane layout unchanged |

### Calendar
| Step | Do this | Pass = |
|---|---|---|
| Open | Open Calendar on a phone width | Month picker + selected-day agenda (no cramped week grid) |
| Navigate | Prev/Next month, tap a day, Today | Selection + agenda update |
| Agenda | Tap a day with events | Events listed as readable cards |
| Create | New event → fill form | Fields readable; **Save/Cancel visible above keyboard** |
| Scroll form | Long form | Body scrolls; footer stays pinned |
| Edit / Delete | Open an event | Edit saves; Delete works (QA data only) |
| Validation | Submit invalid | Error messages visible |
| Back | Hardware Back in editor | Closes editor only; Back again closes calendar |
| Desktop | Open at desktop width | Full week/day grid unchanged |

### Regression spot-checks (unchanged modules)
Dashboard scroll + KPIs, Lead Store (2×2), Admissions (Domestic/International/
Walk-ins/Counselling), Revenue (2×2), Analytics, UTM Leads, Referrals, Help (2×2),
Notifications, Settings, More menu, and Android Back across modules (overlay-first
→ module history → root exit). Confirm no horizontal overflow, no status-bar
overlap, no bottom-nav obstruction, and amounts not clipped.

---

## 6. Desktop impact (intentional)

1. **Escape closes the top-most open overlay** everywhere (new keyboard a11y).
   It does not change any layout or workflow; it only adds a keyboard way to
   dismiss modals/menus that previously needed a click.
2. **Calendar event editor** is now height-bounded with a pinned footer at all
   sizes (better on small laptops). Desktop grid, sidebar, and the rest of the
   editor render as before (verified via `lg:`-gated classes).

Everything else is gated below `lg`, so desktop renders byte-identically.

---

## 7. Known limitations / not done here

- **APK + emulator run:** not performed (Gradle CLI blocked). Needs Android
  Studio build, then on-device verification (keyboard behavior especially must
  be confirmed on a real device/emulator — the visual-viewport fix is validated
  by build/logic, not yet on-device).
- **Focus trap (Tab cycling):** dialogs move focus in/out and expose
  `aria-modal`, but a full Tab-cycle trap for sighted keyboard users is not
  implemented. SR users are covered by `aria-modal`.
- **Event-editor form inputs** keep their existing small (12px) sizing; only the
  structure/footer were made keyboard-safe. A later pass could enlarge inputs.
- **Phase 3 full regression** is provided as the manual checklist above rather
  than executed here (requires the running APK).
- Chat message-action menu and emoji picker get Escape/Back dismissal and labels,
  but not full `role="menu"` arrow-key navigation.

---

## 8. Automated verification done here

- `npx vite build` — clean (only the pre-existing >500kB chunk-size warning).
- `npx cap sync android` — web assets + config copied into the Android project.
- `node --test` across server + `src/lib` suites — **40 passed, 0 failed.**

## 9. Rollback

Nothing committed. To discard this pass entirely:
```bash
git restore src/components/BackButtonHandler.jsx src/modules/client/ChatPanel.jsx src/modules/client/CalendarModal.jsx android/app/src/main/AndroidManifest.xml
rm src/lib/useOverlayDismiss.js
```
To discard just one file, restore that path only.
