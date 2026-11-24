# Bispun CRM — Mobile UI & Animation Design Proposal (Priority 5, 2026-11-03)

Branch target: `fix/bispun-web-mobile-stabilization` (S:\Bispun-stab). **Proposal only — no UI code edited
until accessibility-lead review.** Desktop CRM is untouched (every mobile piece is gated `lg:hidden`).

## Direction (per brief)
Clean · bright · modern · professional · **fast** · smooth. Keep Bispun branding. **Lightweight CSS/transform
transitions only — no new libraries, no heavy blur, no scroll-hijack, no constant motion.** Everything honors
`prefers-reduced-motion` and keeps ≥44px targets + existing focus/dialog semantics.

## What already exists and is good (DO NOT redesign)
- `src/components/mobileUi.jsx`: `BottomSheet` (real `role=dialog`, focus trap, Esc + Android back, scroll
  lock, focus return), `MobileBottomNav` (non-color active cue: top bar + bold + thicker icon, `aria-current`),
  `MobileRecordCard`, `MobileActionMenu`, `MobileFilterSheet`. Safe-area insets handled (top header + bottom
  nav). Prior mobile work (compact KPI grids, keyboard-safe chat composer, calendar agenda) is already in.
- Brand tokens: `brand-*` **and** `indigo-*` both map to runtime `--brand-*` CSS vars (themeable) — so focus
  rings (`indigo-400`) and active (`brand-600`) are already the same brand color. Semantic colors
  (accent/amber, success/emerald, rose/red) are intentionally fixed.
- **The gap is MOTION**, not structure: sheets/menus pop in with no transition, the bottom-nav active
  indicator doesn't move, module switches are instant/janky, and there is **no global reduced-motion rule**.

## 1. Motion system (foundation — add once, reuse everywhere)
A tiny shared layer in `src/index.css` (no libs):
- Tokens: `--ease-standard: cubic-bezier(.2,0,0,1)`; durations `--dur-fast:120ms` (press), `--dur-base:200ms`
  (sheets/fades), `--dur-slow:280ms` (sheet slide). Consistent everywhere.
- **Global reduced-motion guard:** `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{
  animation-duration:.001ms!important; transition-duration:.001ms!important; } }` — one rule makes the whole
  app honor the OS setting (today only the auth screen does).
- Keyframes: `sheetIn` (translateY(8–16px)+fade→0), `fadeIn`, `backdropIn` (opacity), `skeletonShimmer`
  (already used). All opacity/transform only (GPU-cheap; no layout thrash, no blur animation).

## 2. Area-by-area (focused, low-risk)
- **BottomSheet / More sheet / all modals:** backdrop `backdropIn` + panel `sheetIn` (slide-up) on open.
  Entrance via CSS animation on mount (no behavior change); optional exit = short unmount delay (only if it
  stays simple). Reduced-motion → instant. One change covers every sheet/menu/filter app-wide.
- **MobileBottomNav:** animate the active top-bar indicator sliding between tabs + color/weight transition
  (`--dur-base`); add press feedback `active:scale-95` on cells. Keep `aria-current` + non-color cue.
- **Dashboard / KPI cards (`ui.jsx`):** keep compact 2-col grid; add a subtle staggered `fadeIn` on first
  paint and consistent card tokens (radius `rounded-2xl`, `shadow-brand-sm`, equal padding). No layout change.
- **Lead Store (mobile cards):** press feedback + consistent card/badge spacing; row actions already ≥44px.
- **Chat:** new-message appearance = short `fadeIn`+slight rise on the last bubble only (no list reflow);
  keep the keyboard-safe composer as-is.
- **Calendar:** cross-fade on month/agenda change; keep the agenda layout.
- **Loading skeletons:** standardize one shimmer; reduced-motion shows a static placeholder.
- **Page/module transitions:** a 150–200ms `fadeIn` on module mount (perceived speed); never block input or
  delay route render. Pairs with the proposed (separate) `React.lazy` module split from PERF-4.
- **Touch interactions:** shared `active:scale-[.98]`/opacity press affordance on buttons/cards; no hover-only
  cues on touch.

## 3. Consistency pass
Durations/easing from the tokens above; card radius/shadow/padding unified; one shimmer; brand color via
tokens (no hardcoded hex for brand); keep semantic colors fixed.

## 4. Implementation plan (phased, each testable at 375/390/1440)
1. Motion tokens + global reduced-motion rule in `index.css` (foundation).
2. `BottomSheet` entrance animation (covers all sheets/menus/filters).
3. `MobileBottomNav` active-indicator + press feedback.
4. KPI/card consistency + press affordance.
5. Module-mount fade + skeleton standardization.
Each step: build + verify at mobile 375/390 and desktop 1440 (desktop unaffected: `lg:hidden`), retest on
Android emulator when available.

## 5. Accessibility requirements (baked in — for a11y-lead to confirm)
- Global `prefers-reduced-motion` disables all of the above.
- No animation changes focus order, dialog semantics, `aria-current`, or target size.
- Active/selected states keep a non-color cue (not animation-only).
- Press feedback is visual only; no reliance on motion to convey state.
- Contrast unchanged (brand tokens already AA in current usage).

**Next:** accessibility-lead reviews this proposal; then implement steps 1–5 as focused commits on
`fix/bispun-web-mobile-stabilization`. No push/merge/deploy.
