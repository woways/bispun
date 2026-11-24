# Bispun CRM — Dial & Track QA (with one approved QA lead)

Date: 2026-11-02 · `integration/mui-yc @ 9730561` · frontend http://localhost:5174 →
dev API http://localhost:4000 → **bispun-mobile-dev (`ep-blue-mouse`)**. QA Admin login.
**Dev-only. No real call/SMS/WhatsApp/nurture sent. Nothing pushed/merged/deployed.**

## Pre-create checks — ✅ all passed
| Check | Result |
|---|---|
| Backend endpoint | **ep-blue-mouse-b4if0xzj (dev)**, `is_prod:false` |
| `DISABLE_BACKGROUND_WORKERS` | **true** (workers off) |
| Backend health | `/api/health` → connected |
| Lead details | synthetic: name "QA TEST - Dial and Track - DELETE ME", phone `9000000000`, alt `9000000001`, email `qa.dialtrack@example.com` (reserved/non-deliverable), Unassigned |

## 🔴 Important finding — the combined build needs `prisma generate` after the migration
The first **Add Lead** submit returned **500**. Backend error:
`Unknown argument 'alternatePhone'` at `server/routes/clientLeadStore.js:4199`
(`prisma.lead.findFirst` duplicate-check filters on `alternatePhone`).

Root cause: the generated Prisma client in `node_modules` had been generated from the
**main-branch schema**, where `alternatePhone` exists only on `WalkIn`, **not on `Lead`**.
Reads passed (they don't filter on it); the first **write** that referenced
`Lead.alternatePhone` failed. Fix applied: `npx prisma generate` from the integration
worktree (regenerates the client with `Lead.alternatePhone`) + backend restart. This is a
**codegen step, not a migration or `db push`** — no DB change.

**Action for release:** after applying the `Lead.alternatePhone` migration, you **must**
run `prisma generate` from the integration schema (and restart the API) or all Lead
creates/updates 500. (The migration alone is not enough.)

After the regenerate + restart, the create returned **201 Created**.

## Results

### Create one QA lead (normal workflow) — ✅ PASS
- `POST /api/client/lead-store/manual → 201`. Success toast shown. Only the create POST
  and a list-refresh GET fired — **no WhatsApp/SMS/call/nurture/notification** calls.
- Minor: the Name field validation rejected `&`/parentheses ("Use letters, spaces,
  apostrophes, periods or hyphens only") — working as intended; used a hyphenated name.

### Lead appears with Lead ID — ✅ PASS
- Row shows **LEAD ID 1**, name, PHONE `9000000000`, **ALTERNATIVE PHONE `9000000001`**
  (alternatePhone populates end-to-end), email, course; KPIs updated (Imported Leads 1).

### Phone actions menu — ✅ PASS
- Opens with **Copy number · Dial number (tel:) · Dial & track · WhatsApp · Message (SMS)** —
  all five **distinct**; "Dial & track" is separate from the quick "Dial number".

### Dial & Track modal — ✅ PASS (desktop)
| Aspect | Result |
|---|---|
| Visibility | Opens — "CLOUD TELEPHONY" + lead name + number |
| Fields/layout | **Calling Mode: CRM dial + call tracking** (explanatory text), **Dial & Track** button, **Call history** (loads) |
| APIs | `/telephony/status → 200`, `/telephony/history → 200`. **No call placed, no record submitted, no external provider contacted.** |
| Accessibility | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="callcenter-title"` (titled by lead name); close button labelled **"Close call center"**; **initial focus moved into the dialog** |
| Close | **Escape closes** the modal |

- ⚠️ **Minor a11y note:** on close, focus returned to `<body>` rather than a stable
  control, because the trigger was a **phone-menu item that unmounts** when the menu
  closes. (The Smart Nurture modal, triggered by a persistent header button, restored
  focus correctly.) Low severity; a fix would restore focus to the row's phone-action
  button. Not changed here.

### Android / Desktop compatibility — ✅ Desktop PASS · ⚠️ Mobile not fully exercised
- Desktop (1440×900): full PASS above.
- Mobile (375): Lead Store KPIs render 2-col and the row is present, but the **phone-action
  trigger sits in a horizontally-scrolled-off table column**, so automated clicks landed on
  the row's Edit control instead (Edit opened twice; **cancelled both times, no changes
  saved**). The CallCenterModal is a single viewport-responsive component (44px mobile
  targets, `lg:` breakpoints) already verified on desktop — mobile rendering is **implied by
  the responsive component but not screenshot-verified** due to the table-scroll obstacle.

## Scorecard
| Step | Verdict |
|---|---|
| Pre-create env checks | ✅ PASS |
| Create QA lead (after client regenerate) | ✅ PASS |
| Lead visible + Lead ID | ✅ PASS |
| Phone menu (Dial & track present + distinct) | ✅ PASS |
| Dial & Track modal — visibility/fields/a11y/close (desktop) | ✅ PASS (1 minor focus-return note) |
| No call initiated / no record submitted / no external provider | ✅ confirmed |
| Mobile modal | ⚠️ NOT fully exercised (table horizontal-scroll); component is responsive |

## Test data left in place (awaiting your cleanup decision)
**One lead remains** in bispun-mobile-dev: **LEAD ID 1 — "QA TEST - Dial and Track - DELETE
ME"** (`9000000000` / alt `9000000001` / `qa.dialtrack@example.com`, Unassigned). **Not
deleted** (per your instruction). Tell me if you want it removed — I'll delete only this one
lead via the app's Delete action on your go-ahead.

**STOP — Dial & Track verified on desktop. Key release note: run `prisma generate` after the
migration. Test lead retained; awaiting your cleanup decision. Nothing pushed/merged/deployed.**
