# Bispun CRM — Isolated Integration Merge (conflict resolution)

Date: 2026-11-02 · **Local & isolated only. No push, no merge to main, no changes
to `feat/mobile-ui-optimization` or `feat/your-changes`, no migrations, no deploy.**

## Integration branch
- **Branch:** `integration/mui-yc`
- **Worktree:** `S:\Bispun-integ` (separate from the main checkout)
- **Commit:** **`85a4f8d`** — merge of `origin/feat/your-changes` (`d0628dc`) into
  `main`(`496fa88`) + `feat/mobile-ui-optimization`(`c6b55cc`).
- Built off `origin/main`; merged ours (clean) then your-changes (3 conflicts, now
  resolved).

## Exact files changed by the conflict resolution
`src/modules/client/Help.jsx`, `src/modules/client/LeadStore.jsx`,
`src/modules/client/Revenue.jsx` (the 3 conflicted files). The rest of the merge
(`prisma/schema.prisma`, `server/routes/clientLeadStore.js`, `adminPlans.js`,
`clientBilling.js`, `ClientPortal.jsx`, `Analytics.jsx`, `Counselling.jsx`,
`MyStore.jsx`, `UTMLeads.jsx`, `Walkins.jsx`, `ui.jsx`, admin `Plans.jsx`, and our
mobile files) auto-merged cleanly.

## How each conflict was resolved (rule: keep B's structure, re-apply A's a11y)
| File | Conflict | Resolution |
|---|---|---|
| **Help.jsx** | KPI card header: our `justify-between`+`min-w-0`+contrast vs their `flex-row-reverse justify-end` | **Kept their** `flex-row-reverse items-start justify-end` layout **+ re-applied our** `min-w-0` and `text-slate-500 lg:text-slate-400` contrast. |
| **Revenue.jsx** | Same KPI-card header pattern | Same: their layout + our `min-w-0` (contrast token already auto-merged). |
| **LeadStore.jsx #3** | Same KPI-card header pattern | Same: their layout + our `min-w-0` + contrast. |
| **LeadStore.jsx #2** | Lead row action menu: ours had "Dial & track" (call-center) + WhatsApp + SMS; theirs simplified to a `tel:` "Dial number" link | **Kept their** `tel:` "Dial number" link **+ re-added our** WhatsApp and SMS native-action buttons (`openWhatsApp`/`openSMS`). |
| **LeadStore.jsx #1** | Imports: ours added NurtureCenter, CallCenterModal, nativeActions | **Kept** `openWhatsApp/openSMS` (used by the buttons above); **dropped** NurtureCenter/CallCenterModal imports because **their rewrite removed all usage** of those components (no dangling refs — verified 0). |

## Features preserved from BOTH developers
**From your-changes (woways):** the full Lead Store rewrite + Lead ID improvements,
`Lead.alternatePhone`, the simplified `tel:` dial link, and their updated card
layout (`flex-row-reverse`), plus Revenue/Help/Analytics/MyStore/Counselling/UTM/
Walk-ins changes and the billing/plans work.
**From mobile-ui-optimization (ours):** the mobile **2-column KPI grids** (desktop
columns unchanged — `2xl:grid-cols-4` in Help/LeadStore, `xl:grid-cols-3` in
Revenue), **mobile contrast tokens** (`text-slate-500 lg:text-slate-400`), **value
anti-clipping** (`break-words tabular-nums` + `min-w-0`), and the mobile
**WhatsApp/SMS native actions**.

## ⚠️ Functionality intentionally NOT re-integrated (needs your decision)
Their Lead Store rewrite **removed** two features that exist on our branch, and
re-adding them is beyond a conflict resolution (it needs re-wiring their rewritten
structure: state, renders, the `onDial` prop):
- **Smart Nurture** (`NurtureCenter`).
- **Call-center "Dial & track"** (`CallCenterModal` via `onDial`) — replaced here by
  their plain `tel:` dial link.
I did **not** silently keep or drop these beyond what keeps the build clean — flagging
for the developers to decide whether to re-add them into the rewritten Lead Store.

## Test / build / schema results (on `integration/mui-yc`)
| Check | Result |
|---|---|
| `npx vite build` | ✅ **clean** (only the pre-existing >500 kB chunk warning) |
| `node --test` (server + src/lib) | ✅ **40 passed, 0 failed** |
| `npx prisma validate` | ✅ **schema valid** |
| `node --check server/routes/clientLeadStore.js` | ✅ syntax OK |
| Conflict markers remaining | ✅ none |
| Our a11y preserved | ✅ 2-col grids, contrast tokens, `min-w-0`, WhatsApp/SMS all present |

**Prisma compatibility (no migration applied):** the merged schema adds only
**additive** changes — `DeviceToken` model + `deviceTokens` relations (our mobile
push stack) and `Lead.alternatePhone` (their rewrite). No column drops/renames/type
changes. **A non-destructive migration (new table + nullable column) must be applied
to the target DB before the merged backend runs**; I did **not** apply it.

## Remaining issues / what still needs testing
1. **Decision:** whether to re-integrate Smart Nurture + Call-center tracking (above).
2. **Migration:** apply the additive migration (DeviceToken + `alternatePhone`) to
   `bispun-mobile-dev` before runtime testing — not done.
3. **Live layout/regression testing needs the dev backend + manual login** (it's
   currently down): visually compare **Lead Store, Revenue, Help** (and the other
   touched modules) on **mobile and desktop**, and functionally test the rewritten
   Lead Store (lead IDs, alternatePhone, filters, actions). Static checks pass, but
   a running app is required for the visual/functional pass.
4. **Retest scope after this merge:** Lead Store (major), Revenue, Help, Analytics,
   My Store, Counselling, UTM Leads, Walk-ins — mobile + desktop.

## Final recommendation for QA
The conflicts resolve cleanly and the integration **builds, tests, and validates**.
Recommended next steps (your call): (a) decide on Smart Nurture / Call-center
re-integration; (b) bring the dev backend up + apply the additive migration to
`bispun-mobile-dev`; (c) run mobile + desktop QA on the affected modules against
`integration/mui-yc`; then decide the real merge path to `main` (remembering a
`main` merge auto-deploys production).

**STOP — isolated integration complete on `integration/mui-yc` @ `85a4f8d`. Nothing
pushed/merged/deployed; original branches and `main` untouched; no migrations run.**
