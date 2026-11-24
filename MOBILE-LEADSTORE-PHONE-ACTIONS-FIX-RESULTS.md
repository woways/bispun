# Bispun CRM — Mobile Lead Store phone-actions fix: verification results

Date: 2026-11-02 · Branch **`integration/mui-yc`** · worktree `S:\Bispun-integ` ·
**commit `70b8209`** (on `9730561`). Verified live at 375px and 1440px against
bispun-mobile-dev using the existing QA lead. **Local only — no record created/deleted,
nothing pushed/merged/deployed, no call/message sent.**

## Changes applied (1 file, 6 edits — `src/modules/client/LeadStore.jsx`)
- **Fix 1 (occlusion):** gate the **Name** and **Actions** sticky columns to `lg`+
  (`sticky …` → `lg:sticky …`) — th L4281/L4294, td L4352/L4460. Static below lg.
- **Fix 2 (focus):** in the "Dial & track" menu item, `triggerRef.current?.focus()`
  before `onDial()`, so closing the modal restores focus to the row's phone trigger.
- **Fix 3 (tap target):** phone trigger `inline-flex min-h-[44px] items-center … lg:min-h-0`.

## Before → After (measured, 375px)
| | Before | After |
|---|---|---|
| Sticky columns | 4 (checkbox+Lead ID+**Name**+**Actions**) | **2** (checkbox+Lead ID) |
| Frozen width | 316px left + 128px right = **444px** on a 350px table | **116px** left only |
| Phone/Alt-Phone columns | occluded — covered by frozen cols | **static, in normal flow** |
| Phone button tappable (any scroll pos) | **false** everywhere | **true** |
| Tap result | hit frozen Name/Actions → **Edit Lead** | **phone menu opens** |
| Phone trigger height | ~20px | **44px** |

## Verification — PASS / FAIL
| # | Check | Result |
|---|---|---|
| 1 | Responsive sticky fix (Name+Actions), desktop preserved | ✅ PASS |
| 2 | Dial & Track focus returns to the persistent phone trigger | ✅ PASS — activeElement = "Copy or dial this number" (not `<body>`) |
| 3 | Phone trigger ≥44px mobile touch target | ✅ PASS — 44px at <lg, `lg:min-h-0` on desktop |
| 4 | Preserved: rewrite, Lead IDs, alternatePhone, Smart Nurture, Dial & Track, WhatsApp/SMS, KPI grids, desktop | ✅ PASS — only 6 style/1-line edits; no logic/width/z changes |
| 5 | Accessibility review + tests + build | ✅ PASS — accessibility-lead recommended these exact fixes; `vite build` clean; `node --test` **40/40**; `prisma validate` valid |
| 6 | 375px: Phone & Alternative Phone actions reachable + tappable after horizontal scroll | ✅ PASS — both render as reachable buttons; Phone menu opens with **Copy number · Dial number · Dial & track · WhatsApp · Message (SMS)** |
| 7 | Open & close Dial & Track on mobile (no call) | ✅ PASS — opens (`role=dialog`, `aria-modal`, titled, focus inside); Escape closes; **no call placed** |
| 8 | Desktop sticky columns unchanged at 1440px | ✅ PASS — 4 sticky columns, offsets identical (checkbox left:0, Lead ID left:44px, Name left:116px, Actions right:0) |
| 9 | Used existing QA lead; no records created/deleted | ✅ PASS |

## Evidence captured
- Mobile before: phone button `tappable:false` at every scroll position; frozen width 444px > 350px.
- Mobile after: only checkbox+Lead ID sticky; phone button 91×44px, `tappable:true`; **menu opened** (Copy/Dial/Dial & track/WhatsApp/SMS); Dial & Track modal opened and Escape-closed; **focus returned to the phone trigger**.
- Desktop after (1440px): 4 sticky columns with identical offsets — frozen layout byte-identical.

## Commit
- **`70b82096fac436f9cbbaa0ad6b4e61d6939154a5`** (short **`70b8209`**) on `integration/mui-yc`.
- 1 file changed, 6 insertions(+), 5 deletions(-). Local commit only.

## Status
🟢 **Mobile phone-actions blocker resolved and verified; desktop unchanged.** The QA test
lead (LEAD ID 1) is still in place (not deleted, per instruction). Nothing pushed, merged,
or deployed; no DB/record changes.

**STOP — fix applied, verified, and committed as `70b8209` on `integration/mui-yc`.**
