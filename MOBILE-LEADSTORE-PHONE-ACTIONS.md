# Bispun CRM — Mobile Lead Store phone-action occlusion (investigation + proposed fix)

Date: 2026-11-02 · `integration/mui-yc` · worktree `S:\Bispun-integ` · investigated live at
375px against bispun-mobile-dev. **Read-only investigation + accessibility review. No files
changed. Awaiting approval before any edit. Nothing pushed/merged/deployed.**

## Verdict: GENUINE mobile usability problem (not an automation limitation)

The Lead Store "Leads" table freezes more column width than the phone screen has, so the
phone-action controls are painted under the frozen columns and can't be tapped.

Measured live at 375px (`div.overflow-x-auto`, content width 350px):

| Frozen column | Width | Sticky | Lines (LeadStore.jsx) |
|---|---|---|---|
| Checkbox | 44px | `left-0 z-30` | th 4267 / td 4332 |
| Lead ID | 72px | `left-11 z-20` | th 4277 / td 4346 |
| **Name** | **200px** | `left-[116px] z-20` | th 4281 / td 4352 |
| **Actions** | **~128px** | `right-0 z-20` | th 4294 / td 4460 |

**Frozen left 316px + frozen right 128px = ~444px of frozen columns on a 350px table.** The
frozen blocks overlap and cover the full width, so the static middle columns **Phone**
(td 4406) and **Alternative Phone** (td 4416) — which host the `PhoneAction` control
(Copy, Dial `tel:`, **Dial & track**, WhatsApp, SMS; L298–442) — are permanently occluded.

Confirmed by DOM probing (not just automation):
- Swept all horizontal scroll positions → the phone button is **never** topmost (always under
  frozen Name on the left or frozen Actions on the right); `tappable:false` everywhere.
- At scrollLeft=150, probes across the whole row (x=80→320) **all** hit frozen cells.
- A tap on the phone cell hits the frozen Name/Actions cell → opens **Edit Lead**.

**Scope:** blocks **every** phone action on mobile (Dial & Track, Dial, WhatsApp, SMS) — the
primary call workflow is unreachable on phones. Keyboard/screen-reader users are unaffected
(`sticky` changes paint only, not DOM/tab order), so this is a pointer/touch-occlusion defect.
**Severity: CRITICAL for mobile.** This lives in the Lead Store table structure (pre-existing
in the rewrite), surfaced now because a lead exists to test with.

## Your checks — answered
1. Placement: Phone / Alternative Phone columns (scrollable middle); trigger's accessible name = the number.
2. Reachable by horizontal scroll? **No** — frozen columns span the full width; the middle never surfaces tappably.
3. Click opens menu vs Edit Lead? On mobile it hits the overlapping frozen cell → **Edit Lead**.
4. Dial & Track open/close on mobile? **Entry point unreachable** from the table (the modal itself works — desktop-verified).
5. Focus-return: separate minor issue (below).

## Proposed smallest fix (accessibility-reviewed) — NOT applied, awaiting approval

### Fix 1 — table occlusion (CRITICAL). 4 class edits, desktop byte-identical.
Make the two widest frozen columns sticky **only at `lg`+** (the file's existing responsive
convention, e.g. `min-h-[44px] lg:min-h-0`). Positioning utilities only; leave `z-*`, `bg-*`,
`border-*`, widths untouched.

| Line | From | To |
|---|---|---|
| 4281 (Name th) | `sticky left-[116px]` | `lg:sticky lg:left-[116px]` |
| 4352 (Name td) | `sticky left-[116px]` | `lg:sticky lg:left-[116px]` |
| 4294 (Actions th) | `sticky right-0` | `lg:sticky lg:right-0` |
| 4460 (Actions td) | `sticky right-0` | `lg:sticky lg:right-0` |

- **Desktop (≥lg):** `lg:` variants restore identical sticky + offsets → rendered desktop unchanged.
- **Mobile (<lg):** only checkbox+Lead ID stay frozen (116px), leaving a ~234px clear band; the
  Phone cell scrolls into it and all middle/Actions cells lay out in normal flow — nothing paints
  over the phone button, so taps land on it. Row identity (checkbox + Lead ID) preserved.
- Optional stronger variant (8 edits): also `lg:`-guard checkbox (4267/4332) + Lead ID
  (4277/4346) so the mobile table is a plain scroller with zero frozen overlap by construction.

### Fix 2 — Dial & Track focus-return (MINOR). 1-line edit.
`useOverlayDismiss` captures `document.activeElement` on open, but the "Dial & track" menu item
unmounts (`setMenu(null)`) before the modal mounts, so focus is already on `<body>`; on close it
returns to `<body>`. Smallest fix — focus the row's persistent phone trigger first (ref already
exists at PhoneAction L300/371):

```
onClick={() => { setMenu(null); onDial(); }}
→ onClick={() => { setMenu(null); triggerRef.current?.focus(); onDial(); }}
```

### Optional minor — tap target (WCAG 2.5.5)
The phone trigger is inline text (~20px tall). Optional: `inline-flex min-h-[44px] items-center lg:min-h-0`
for a 44px mobile target. Not required to close the critical defect.

## Preserved by both fixes (verified)
Lead Store rewrite, simplified Lead IDs, `alternatePhone`, Smart Nurture, WhatsApp/SMS, mobile
2-col KPI grids, and desktop layout — all untouched (additive `lg:` guards + one focus call).

## Recommendation
Apply **Fix 1** (4 edits) to close the critical mobile blocker, plus **Fix 2** (1 line) for the
focus return. All in `integration/mui-yc` only; after editing I'd rebuild and re-verify on the
emulator/375px, run a11y/tests/build, and **not** push/merge/deploy.

**STOP — this is a genuine mobile blocker. The accessibility review is done and the fix is
scoped. Approve and I'll apply Fix 1 (+ Fix 2, + optional tap target) in the integration
worktree only. No files changed yet.**
