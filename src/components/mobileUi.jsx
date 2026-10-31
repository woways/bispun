// Reusable MOBILE-ONLY presentation components (every piece here is gated to
// `lg:hidden`, so the desktop UI is never affected). They let a screen keep its
// existing desktop <table>/toolbar unchanged and render a compact, accessible
// card/sheet version below the `lg` (1024px) breakpoint.
//
// Accessibility contract (verified in the Stage 1 a11y review):
//   - BottomSheet is a real dialog: role="dialog" + aria-modal, focus moves in
//     on open, Tab is trapped, Escape AND the Android hardware back button both
//     close it (shared LIFO stack), focus returns to the trigger, background
//     scroll is locked.
//   - Icon-only triggers must be given a UNIQUE accessible name by the caller
//     (e.g. MobileActionMenu `label="Actions for INV-204"`).
//   - Callers passing controls into MobileFilterSheet must label each control.

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, MoreVertical, SlidersHorizontal, LayoutGrid } from "lucide-react";
import { Badge } from "./ui";
import { pushBackInterceptor } from "../lib/backStack";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessible bottom-sheet dialog (mobile/tablet only — hidden at lg+).
 * Props: open, onClose, title?, ariaLabel?, maxWidth?, children.
 * Provide `data-autofocus` on a child to receive initial focus; otherwise the
 * panel itself is focused.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  ariaLabel,
  maxWidth = "max-w-md",
  children,
}) {
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const titleId = useId();

  // Keep the latest onClose in a ref so the open-effect below depends ONLY on
  // `open`. Callers pass a fresh onClose arrow each render; without this the
  // effect would re-run every parent render (e.g. while notifications load),
  // thrashing focus and scroll-lock. It must run exactly once per open/close.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    // Remember what to return focus to, then move focus into the sheet.
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const panel = panelRef.current;
    const autofocus = panel?.querySelector("[data-autofocus]");
    (autofocus || panel)?.focus?.();

    // Lock background scroll.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Android hardware back closes the top-most overlay first (LIFO).
    const unregister = pushBackInterceptor(() => onCloseRef.current?.());

    return () => {
      document.body.style.overflow = previousOverflow;
      unregister();
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === "function") el.focus();
    };
  }, [open]);

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll(FOCUSABLE);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    []
  );

  if (!open) return null;

  return createPortal(
    <div className="lg:hidden fixed inset-0 z-[100] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => onClose?.()}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...(title ? { "aria-labelledby": titleId } : { "aria-label": ariaLabel })}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`relative w-full ${maxWidth} max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.22)] focus:outline-none`}
      >
        {title && (
          <div className="sticky top-0 z-10 bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 id={titleId} className="text-[15px] font-bold text-slate-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => onClose?.()}
              aria-label="Close"
              className="h-9 w-9 -mr-1 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

/**
 * One record rendered as a card. Use inside a caller-owned
 * `<div role="list" aria-label="…" className="lg:hidden">` beside the existing
 * `hidden lg:block` table. Fields render as a <dl> so each label is associated
 * with its value for screen readers.
 * Props: eyebrow?, title?, badges?[{tone,label}], fields?[{label,value,full?}], actions?
 */
export function MobileRecordCard({
  eyebrow,
  title,
  badges = [],
  fields = [],
  actions,
}) {
  return (
    <div role="listitem" className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <div className="text-[12px] font-mono font-medium text-slate-500">
              {eyebrow}
            </div>
          )}
          {title && (
            <div className="mt-0.5 text-[15px] font-semibold text-slate-900 break-words">
              {title}
            </div>
          )}
        </div>
        {actions && (
          <div className="shrink-0 flex items-center gap-1">{actions}</div>
        )}
      </div>

      {badges.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {badges.map((badge, index) => (
            <Badge key={index} tone={badge.tone}>
              {badge.label}
            </Badge>
          ))}
        </div>
      )}

      {fields.length > 0 && (
        <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
          {fields.map((field, index) => (
            <div key={index} className={field.full ? "col-span-2" : "min-w-0"}>
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                {field.label}
              </dt>
              <dd className="text-[13px] text-slate-700 break-words">
                {field.value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Three-dot trigger that opens a bottom action sheet of buttons (dialog pattern,
 * NOT role="menu"). Caller passes ONLY permission-allowed items and handles any
 * confirmation inside item.onClick.
 * Props: label (UNIQUE accessible name, e.g. "Actions for INV-204"),
 *        items[{ label, icon?, onClick, destructive? }].
 */
export function MobileActionMenu({ label = "Actions", items = [] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <MoreVertical size={18} aria-hidden="true" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Actions">
        <div className="p-2">
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              data-autofocus={index === 0 ? "" : undefined}
              onClick={() => {
                setOpen(false);
                item.onClick?.();
              }}
              className={`w-full min-h-[48px] px-3 flex items-center gap-3 rounded-lg text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                item.destructive
                  ? "text-rose-600 hover:bg-rose-50"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {item.icon && <item.icon size={18} aria-hidden="true" />}
              {item.label}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

/**
 * "Filters" trigger that opens a bottom sheet holding the filter controls passed
 * as children. Caller must give each child control its own label.
 * Props: activeCount?, title?, children.
 */
export function MobileFilterSheet({ activeCount = 0, title = "Filters", children }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={activeCount > 0 ? `${title}, ${activeCount} active` : title}
        onClick={() => setOpen(true)}
        className="h-11 px-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        {title}
        {activeCount > 0 && (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold"
          >
            {activeCount}
          </span>
        )}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="p-4 space-y-3">{children}</div>
      </BottomSheet>
    </>
  );
}

/**
 * Mobile bottom navigation bar (lg:hidden; desktop sidebar is untouched).
 * Primary tabs switch the app view (not ARIA tabs) → <nav> + <button> +
 * aria-current="page". Active state uses a non-color cue (top bar + bold +
 * thicker icon) in addition to the brand color (WCAG 1.4.1); inactive is
 * slate-600 (AA). The bar respects the device safe-area inset, and the app's
 * main content must add matching bottom padding so nothing is obscured.
 *
 * Props:
 *  - items: [{ key, label, icon }] (already permission-filtered by caller)
 *  - activeKey: the key to mark current (caller maps module → nav key)
 *  - onSelect(key), onMore(), moreOpen
 */
export function MobileBottomNav({ items = [], activeKey, onSelect, onMore, moreOpen }) {
  const cell =
    "relative flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400";
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        {items.map((item) => {
          const active = activeKey === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect?.(item.key)}
              className={`${cell} ${active ? "text-brand-600" : "text-slate-600"}`}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-brand-600"
                />
              )}
              <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
              <span className={`text-[11px] leading-tight ${active ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={!!moreOpen}
          onClick={() => onMore?.()}
          className={`${cell} text-slate-600`}
        >
          <LayoutGrid size={20} strokeWidth={2} aria-hidden="true" />
          <span className="text-[11px] leading-tight font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
