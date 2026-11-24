import { useEffect, useId, useRef, useState } from "react";
import { X, Search, UserRound } from "lucide-react";

/* Searchable multi-guest picker. Replaces the single "Assigned to" select:
   type to search company users, click to add, each guest becomes a removable
   chip. Value is an array of { userId, name, email }. Plain buttons + labelled
   input (not a full ARIA combobox) per the accessibility review. */

function initials(name, email) {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function GuestPicker({
  value = [],
  onChange,
  users = [],
  ariaLabelledby,
}) {
  const uid = useId();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [announce, setAnnounce] = useState("");

  const selectedIds = new Set(
    (value || []).map((g) => g.userId || g.id).filter(Boolean)
  );
  const q = query.trim().toLowerCase();
  const matches = q
    ? users
        .filter(
          (u) =>
            !selectedIds.has(u.id) &&
            ((u.name || "").toLowerCase().includes(q) ||
              (u.email || "").toLowerCase().includes(q))
        )
        .slice(0, 6)
    : [];

  // SC 4.1.3: announce result state / add / remove without moving focus.
  useEffect(() => {
    if (!q) {
      setAnnounce("");
      return;
    }
    setAnnounce(
      matches.length
        ? `${matches.length} ${matches.length === 1 ? "result" : "results"}`
        : "No matching people."
    );
  }, [q, matches.length]);

  function addGuest(u) {
    onChange?.([...(value || []), { userId: u.id, name: u.name, email: u.email }]);
    setQuery("");
    setAnnounce(`${u.name || u.email || "Guest"} added`);
  }
  function removeGuest(idx) {
    const removed = (value || [])[idx];
    onChange?.((value || []).filter((_, i) => i !== idx));
    setAnnounce(`${removed?.name || removed?.email || "Guest"} removed`);
    // Keep focus in the picker instead of letting it fall to <body>.
    inputRef.current?.focus();
  }

  return (
    <div>
      {value && value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((g, i) => (
            <li key={g.userId || g.email || g.name || i}>
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pl-2.5 pr-1 text-[12px] font-semibold text-slate-800">
                {g.name || g.email || "Guest"}
                <button
                  type="button"
                  onClick={() => removeGuest(i)}
                  aria-label={`Remove ${g.name || g.email || "guest"}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-slate-600 transition hover:bg-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id={uid}
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-labelledby={ariaLabelledby}
          aria-label={ariaLabelledby ? undefined : "Add guest"}
          placeholder="Search people to add…"
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {matches.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-sm">
          {matches.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => addGuest(u)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50 focus-visible:bg-slate-100 focus-visible:outline-none"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-slate-800">
                  {initials(u.name, u.email)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-slate-800">
                    {u.name || u.email || "User"}
                  </span>
                  {u.email && u.name && (
                    <span className="block truncate text-[11px] text-slate-500">
                      {u.email}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {q && matches.length === 0 && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
          <UserRound size={12} aria-hidden="true" />
          No matching people.
        </p>
      )}

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
