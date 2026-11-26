import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

/* Searchable single-select. A disclosure button opens a popover with a search
   box and a filterable list of plain option buttons — NOT a full ARIA combobox
   (per the accessibility review: labelled input + plain buttons, no listbox/
   option role contract to honor). Value is the selected option's `value`.

   Props:
     value           selected value (string)
     onChange(value) called with the chosen value
     options         array of { value, label } or plain strings
     placeholder     text shown when nothing is selected
     ariaLabel       accessible name for the trigger + search (when no visible label)
     ariaLabelledby  id of a visible label element (preferred when present)
     loading         show "Loading…" in the trigger
     disabled        disable the trigger
     buttonClassName override the trigger classes (keeps focus ring) */

function normalize(option) {
  return typeof option === "string" ? { value: option, label: option } : option;
}

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  ariaLabel,
  ariaLabelledby,
  loading = false,
  disabled = false,
  required = false,
  invalid = false,
  errorId,
  buttonClassName,
}) {
  const uid = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [announce, setAnnounce] = useState("");

  const opts = useMemo(() => options.map(normalize), [options]);
  const current = opts.find((o) => o.value === value) || null;
  const q = query.trim().toLowerCase();
  const matches = q
    ? opts.filter((o) => String(o.label).toLowerCase().includes(q))
    : opts;

  // SC 4.1.3: announce filter results (count / "No matches") to screen readers
  // without moving focus, since the shrinking list is otherwise silent.
  useEffect(() => {
    if (!open || !q) {
      setAnnounce("");
      return;
    }
    setAnnounce(
      matches.length
        ? `${matches.length} ${matches.length === 1 ? "result" : "results"}`
        : "No matches"
    );
  }, [open, q, matches.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // Keyboard parity with outside-click: close when focus leaves the widget
    // (e.g. Tab past the last option) so the popover never orphans.
    const onFocusOut = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.relatedTarget)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    const root = rootRef.current;
    root?.addEventListener("focusout", onFocusOut);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      root?.removeEventListener("focusout", onFocusOut);
      clearTimeout(t);
    };
  }, [open]);

  function choose(v) {
    onChange?.(v);
    setQuery("");
    setOpen(false);
    triggerRef.current?.focus();
  }

  const triggerCls =
    buttonClassName ||
    "flex w-full items-center justify-between gap-2 h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white text-left focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && errorId ? errorId : undefined}
        aria-label={ariaLabelledby ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledby}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={triggerCls}
      >
        <span className={`truncate ${current ? "text-slate-900" : "text-slate-600"}`}>
          {loading ? "Loading…" : current ? current.label : placeholder}
        </span>
        <ChevronDown size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.14)]">
          <div className="relative border-b border-slate-100 p-2">
            <Search
              size={14}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              id={`${uid}-search`}
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={`Search ${ariaLabel || "options"}`}
              placeholder="Search…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[14px] text-slate-900 outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <li className="px-3 py-2.5 text-[13px] text-slate-500">No matches</li>
            ) : (
              matches.map((o) => {
                const selected = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => choose(o.value)}
                      aria-current={selected ? "true" : undefined}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[14px] transition hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none ${
                        selected ? "font-semibold text-indigo-700" : "text-slate-700"
                      }`}
                    >
                      <span className="truncate">
                        {o.label}
                        {selected ? <span className="sr-only"> (selected)</span> : null}
                      </span>
                      {selected ? <Check size={14} aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
