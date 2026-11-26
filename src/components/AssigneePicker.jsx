import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

/**
 * Searchable team-member picker (combobox).
 * Used by the Lead Store bulk-assign bar and the KPI drawer assign bar so a
 * long team list stays usable. Keyboard: Escape closes; the search input is
 * auto-focused; options are buttons with role="option".
 */
export default function AssigneePicker({
  assignees = [],
  value,
  onChange,
  placeholder = "Select team member",
  ariaLabel = "Assign to",
  disabled = false,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const uid = useId().replace(/:/g, "");

  const selected = assignees.find((u) => u.id === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const q = query.trim().toLowerCase();
  const filtered = !q
    ? assignees
    : assignees.filter(
        (u) =>
          String(u.name || "").toLowerCase().includes(q) ||
          String(u.email || "").toLowerCase().includes(q)
      );

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-indigo-100 disabled:opacity-60"
      >
        <span className={selected ? "truncate text-slate-800" : "truncate text-slate-400"}>
          {selected ? selected.name || selected.email || "User" : placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.18)]">
          <div className="relative border-b border-slate-100 p-2">
            <Search
              size={13}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team member…"
              aria-label="Search team member"
              aria-controls={`${uid}-list`}
              className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[13px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <ul id={`${uid}-list`} role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-slate-400">No matches</li>
            ) : (
              filtered.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={u.id === value}
                    onClick={() => {
                      onChange?.(u.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition ${
                      u.id === value
                        ? "bg-indigo-50 font-semibold text-indigo-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{u.name || u.email || "User"}</span>
                    {u.id === value ? (
                      <Check size={14} className="shrink-0 text-indigo-600" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
