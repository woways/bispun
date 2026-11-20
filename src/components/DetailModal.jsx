import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { pushBackInterceptor } from "../lib/backStack";

// The single, consistent drill-down popup used by every metric / KPI / dataset
// card across the client portal. Clicking a card opens this modal OVER the
// current page (no navigation); Close / X / Escape / Android-back return the
// user to exactly where they were. Styled to match the app's existing
// "Total Tickets" dialog: a dimmed overlay + a white card with a title + muted
// subtitle + X, a scrollable records body, and a footer with a count + Close.
//
// Accessibility (accessibility-lead requirements):
//   - role="dialog" + aria-modal + aria-labelledby(title) + aria-describedby(subtitle).
//   - Focus trap + focus-to-first (the X) on open + focus RESTORE to the invoking
//     card on close (the card is captured as document.activeElement at open).
//   - Escape closes (stopPropagation so it never reaches module/section back);
//     Android hardware Back closes via the shell's LIFO backStack interceptor.
//   - Body scroll lock while open; the modal body scrolls independently.
//   - A dialog-scoped polite live region announces loading / loaded / empty.
//   - 44px touch targets on X and Close; ring-indigo-500 focus ring.
//
// Props mirror the records shape modules already build:
//   open, title, subtitle, onClose
//   columns (string[]) + rows (<tr>[]) + empty + caption   -> renders a table
//   children                                                -> arbitrary body
//   loading, error                                          -> async states
//   countLabel                                              -> footer label override
const FOCUSABLE_SELECTOR =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function DetailModal({
  open,
  title,
  subtitle,
  columns,
  rows,
  empty = "No records found",
  caption,
  children,
  loading = false,
  error = "",
  countLabel,
  onClose,
  displayMode = "modal",
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const subtitleId = useId();
  const [padLeft, setPadLeft] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || displayMode === "page") return undefined;
    // Capture the invoking card so focus returns to it on close.
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE_SELECTOR);
    (first || panel)?.focus?.();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Center within the content area (right of the desktop sidebar), matching the
    // existing ticket dialog.
    const measure = () => {
      const main =
        typeof document !== "undefined" ? document.querySelector("main") : null;
      setPadLeft(main ? Math.max(0, main.getBoundingClientRect().left) : 0);
    };
    measure();
    window.addEventListener("resize", measure);
    // Android hardware Back (and the shared Escape path) close the top overlay.
    const unregister = pushBackInterceptor(() => onCloseRef.current?.());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", measure);
      unregister();
      restoreRef.current?.focus?.();
    };
  }, [open, displayMode]);

  if (!open) return null;

  const hasTable = Array.isArray(columns);
  const bodyRows = Array.isArray(rows) ? rows : [];
  const count = hasTable ? bodyRows.length : null;

  const statusText = loading
    ? "Loading records…"
    : error
      ? "Couldn't load records"
      : hasTable
        ? bodyRows.length
          ? `${bodyRows.length} records loaded`
          : empty
        : "";

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCloseRef.current?.();
      return;
    }
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = panel.querySelectorAll(FOCUSABLE_SELECTOR);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  };

  if (displayMode === "page") {
    return (
      <section className="admissions-drilldown-page min-w-0 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => onCloseRef.current?.()}
              className="inline-flex h-9 items-center gap-2 rounded-lg px-1 text-[13px] font-semibold text-slate-500 transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Back
            </button>
            <h1 className="mt-2 text-[26px] font-bold tracking-[-0.035em] text-slate-950">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-[14px] text-slate-500">{subtitle}</p>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-12 text-center text-[13px] font-medium text-rose-700">
            {error}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-[13px] text-slate-500">
            Loading…
          </div>
        ) : (
          children
        )}
      </section>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
      style={padLeft ? { paddingLeft: padLeft } : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl outline-none sm:max-w-3xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[16px] font-bold text-slate-900">
              {title}
            </h2>
            {subtitle ? (
              <p id={subtitleId} className="mt-0.5 text-[13px] text-slate-500">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          aria-busy={loading || undefined}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div aria-live="polite" aria-atomic="true" className="sr-only">
            {statusText}
          </div>

          {error ? (
            <div className="px-5 py-12 text-center text-[13px] font-medium text-rose-700">
              {error}
            </div>
          ) : loading ? (
            <div className="px-5 py-12 text-center text-[13px] text-slate-500">
              Loading…
            </div>
          ) : hasTable ? (
            bodyRows.length ? (
              <div
                className="overflow-x-auto"
                tabIndex={0}
                role="group"
                aria-label={`${title || "Records"} table — scroll sideways to see all columns`}
              >
                <table className="min-w-full text-sm [&_td]:whitespace-nowrap">
                  {caption || title ? (
                    <caption className="sr-only">{caption || title}</caption>
                  ) : null}
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
                    <tr>
                      {columns.map((column, index) => (
                        <th
                          key={index}
                          scope="col"
                          className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">{bodyRows}</tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-12 text-center text-[13px] text-slate-500">
                {empty}
              </div>
            )
          ) : (
            <div className="px-5 py-5">{children}</div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <span className="text-[12px] font-semibold text-slate-500">
            {countLabel != null
              ? countLabel
              : count != null
                ? `${count.toLocaleString("en-IN")} record${count === 1 ? "" : "s"}`
                : ""}
          </span>
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            className="inline-flex h-11 items-center rounded-lg bg-indigo-600 px-4 text-[12px] font-bold text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
