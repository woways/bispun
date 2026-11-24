# Bispun CRM — Restored Smart Nurture + Dial & Track (isolated integration)

Date: 2026-11-02 · Branch **`integration/mui-yc`** · **new commit `9730561`**
(on top of merge `85a4f8d`) · worktree `S:\Bispun-integ`. **Local & isolated only —
no push/merge/migration/deploy; `main` and both feature branches untouched.**

## Exact files changed (3)
- `src/modules/client/LeadStore.jsx` — re-wire both features into the rewrite.
- `src/components/lead/NurtureCenter.jsx` — a11y wiring (dialog + hook + live regions).
- `src/components/lead/CallCenterModal.jsx` — a11y wiring + nested-anchor fix.

## Both features restored + entry points
**Smart Nurture (`NurtureCenter`)**
- Entry point: a **"Smart Nurture"** button in the Lead Store header toolbar
  (between Refresh and Add Lead) → opens `<NurtureCenter open … selectedLeadIds … />`.
- Operates on the current **`selectedLeadIds`** (bulk audience), same as the original.
- Original permissions / eligibility / scheduling / notifications / stop rules are
  **unchanged** — they live in the backend (`/api/client/nurture/*` + `nurtureEngine`),
  which was never removed; only the UI was. Restoring the UI re-enables access.

**Dial & Track (`CallCenterModal`)**
- Entry point: a per-lead **"Dial & track"** item in the phone action menu
  (`PhoneAction`, for both `phone` and `alternatePhone`) → `onDial` → `setCallLead(lead)`
  → opens `<CallCenterModal open={Boolean(callLead)} lead={callLead} … />`.
- **No duplicate action:** the developer's quick **"Dial number"** (`tel:` link) and our
  **"Dial & track"** (call-center modal: start call + log outcome/duration/notes) are
  kept as **distinct, separately-labelled** actions. WhatsApp/SMS actions untouched.
- Original modal, calling workflow and tracking behaviour are the original component,
  backed by `/api/client/telephony/*` (status/history/calls) — intact.

## Preserved (unchanged)
Developer rewrite (Lead IDs, `alternatePhone`, updated Lead Store); our mobile
**2-col KPI grids** (desktop columns intact), **contrast tokens**, **`min-w-0`**
anti-clip, and native **WhatsApp/SMS**. Desktop CRM layout unaffected.

## Accessibility (review run; ship-gate items addressed)
Both modals now have: `role="dialog" aria-modal="true" aria-labelledby` + title `id`;
**`useOverlayDismiss`** (Escape + Android back + focus-in/return) matching
CalendarModal/ChatPanel; **44px** labelled close buttons (mobile); error/success as
`role="alert"`/`role="status"` live regions. Triggers: "Smart Nurture" and
"Dial & track" have accessible names, 44px mobile target, `aria-haspopup="dialog"`
+ `aria-expanded`. Fixed an invalid **`<a>` nested inside a `<button>`** in the call-
history rows (now sibling controls). *Known/accepted:* the shared `useOverlayDismiss`
does not Tab-trap (repo-wide behaviour, consistent across all overlays) — not changed
here per the a11y lead's guidance.

## Verification results (on `9730561`)
| Check | Result |
|---|---|
| `npx vite build` | ✅ clean |
| `node --test` (server + src/lib) | ✅ **40 passed, 0 failed** |
| `npx prisma validate` | ✅ valid |
| Backend API compatibility | ✅ `/api/client/nurture` + `/api/client/telephony` mounted; every CallCenterModal endpoint (`/status`, `/history`, `/calls`, `/calls/:id`) matches |
| Duplicate actions | ✅ none (Dial number vs Dial & track are distinct) |
| Conflict markers | ✅ none |
| Nurture worker | gated by `DISABLE_BACKGROUND_WORKERS=true`; **no worker started** (server not run) |

**Regression tests:** these are React modal UIs calling backend APIs — the repo's
automated suite is pure-JS (`node:test`) with no React-component harness, so there's
no appropriate unit to add; coverage is the manual QA steps below. The existing 40
tests still pass.

## Remaining runtime testing requirements
Needs the dev backend up + an **additive migration applied** (the earlier `DeviceToken`
+ `Lead.alternatePhone` additive migration — **not applied; needs your approval**) +
manual login, with `DISABLE_BACKGROUND_WORKERS=true`.

### Mobile + Desktop QA steps
**Smart Nurture**
1. Open Lead Store → select one or more leads (checkboxes).
2. Click **Smart Nurture** (header). Modal opens showing the selected count.
3. Verify: sequences list loads; **New sequence** create form; **Process due now**;
   enrolling the selected leads; error/success banners; **Escape / back / X** all close
   it and return focus to the Smart Nurture button.
4. Mobile: modal is bottom-sheet, scrolls, controls reachable; Desktop: centered dialog.
5. *Do not send real WhatsApp/SMS/email;* keep background workers disabled.

**Dial & Track**
1. In a lead row, open the phone action menu → **Dial & track**. CallCenterModal opens.
2. Verify: calling mode/status; **Dial & Track / Call from CRM**; record outcome
   (connection/outcome/duration/notes) saves; **Call history** loads; a **Recording**
   link (if present) is a separate control from the row's edit; Escape/back/X close +
   focus returns.
3. Confirm **Dial number** (quick `tel:`), **WhatsApp**, **Message (SMS)** still work
   and are distinct from Dial & track. *Do not place real calls.*
4. Mobile + Desktop layout check.

**Regression:** re-verify Lead Store (Lead IDs, alternatePhone, filters, KPIs 2-col on
mobile), Revenue/Help/Analytics and the Chat/Calendar/Dashboard from earlier.

## Status
🟡 **Code-ready for dev QA.** NOT production-ready: apply the additive migration, run
the mobile + desktop QA above, keep workers disabled. A `main` merge still auto-deploys
production (Render + Vercel) — gated on your approval.

**Updated integration commit: `9730561` on `integration/mui-yc`. STOP for your approval.**
