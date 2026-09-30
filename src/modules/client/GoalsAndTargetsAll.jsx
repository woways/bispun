import { Fragment, useEffect, useMemo, useState } from "react";

import {
  Loader2,
  ChevronLeft,
  AlertCircle,
  Search,
  X,
  Filter,
  Download,
} from "lucide-react";

import { apiRequest } from "../../lib/api";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];
const ROLE_LABELS = {
  CLIENT_ADMIN: "Client Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};
const LAUNCH_YEAR = 2026;

function initialsOf(name) {
  return String(name || "?").split(" ").filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join("").toUpperCase();
}

export default function GoalsAndTargetsAll({ onBack }) {
  const currentYear = new Date().getFullYear();

  const [years, setYears] = useState([Math.max(LAUNCH_YEAR, currentYear)]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState([]);
  const [deptFilter, setDeptFilter] = useState([]);
  const [monthFilter, setMonthFilter] = useState([]); // 1-12
  const [open, setOpen] = useState(""); // which dropdown is open

  const yearChoices = useMemo(() => {
    const start = Math.max(LAUNCH_YEAR, currentYear);
    const arr = [];
    for (let y = start + 2; y >= LAUNCH_YEAR; y -= 1) arr.push(y);
    return arr;
  }, [currentYear]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(
        `/api/client/targets/all?years=${years.join(",")}`
      );
      setEmployees(Array.isArray(data.employees) ? data.employees : []);
    } catch (err) {
      setError(err?.data?.message || "Unable to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years]);

  const roles = ["CLIENT_ADMIN", "MANAGER", "EMPLOYEE"];
  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach((e) => {
      const d = String(e.department || "").trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  // Widest week count across all months shown, for column layout.
  const maxWeeks = useMemo(() => {
    let mx = 4;
    employees.forEach((e) =>
      e.months.forEach((m) => {
        mx = Math.max(mx, m.weeks.length);
      })
    );
    return mx;
  }, [employees]);
  const weekIdx = Array.from({ length: maxWeeks }, (_, i) => i + 1);

  // Apply employee-level filters (role, dept, search) and month filter.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => (roleFilter.length ? roleFilter.includes(e.role) : true))
      .filter((e) =>
        deptFilter.length
          ? deptFilter.includes(String(e.department || "").trim())
          : true
      )
      .filter((e) =>
        q
          ? [e.name, e.email, e.department, e.id].some((v) =>
              String(v || "").toLowerCase().includes(q)
            )
          : true
      )
      .map((e) => ({
        ...e,
        months: monthFilter.length
          ? e.months.filter((m) => monthFilter.includes(m.month))
          : e.months,
      }))
      .filter((e) => e.months.length > 0);
  }, [employees, roleFilter, deptFilter, search, monthFilter]);

  // Grand totals across everyone shown.
  const totals = useMemo(() => {
    let totalTarget = 0;
    let totalAchieved = 0;
    filtered.forEach((e) =>
      e.months.forEach((m) => {
        totalTarget += m.monthlyTarget || 0;
        totalAchieved += m.totalAchieved || 0;
      })
    );
    const pct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
    return { totalTarget, totalAchieved, pct, empCount: filtered.length };
  }, [filtered]);

  function toggle(arrSetter, arr, val) {
    arrSetter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  // ---- CSV export (respects current filters) ------------------------------
  function csvCell(v) {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    if (filtered.length === 0) return;

    const header = ["Employee", "Department / Role", "Month", "Year", "Monthly Target"];
    weekIdx.forEach((w) => header.push(`W${w} Target`, `W${w} Achieved`, `W${w} Conv%`));
    header.push("Overall Achieved", "Overall %");

    const rows = [header];

    filtered.forEach((emp) => {
      emp.months.forEach((m) => {
        const row = [
          emp.name,
          emp.department || emp.roleLabel || ROLE_LABELS[emp.role] || "",
          MONTH_NAMES[m.month - 1],
          m.year,
          m.monthlyTarget ?? "",
        ];
        weekIdx.forEach((wnum) => {
          const w = m.weeks.find((x) => x.week === wnum);
          if (w) row.push(w.target ?? "", w.achieved ?? "", w.percent ?? "");
          else row.push("", "", "");
        });
        row.push(m.totalAchieved ?? "", m.overallPercent ?? "");
        rows.push(row);
      });
    });

    rows.push([
      `All (${totals.empCount})`,
      "All months",
      "",
      "",
      totals.totalTarget,
      ...Array(weekIdx.length * 3).fill(""),
      totals.totalAchieved,
      totals.pct,
    ]);

    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-targets-${years.join("-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function pctPill(p) {
    const cls =
      p >= 100 ? "bg-brand-50 text-brand-700"
      : p > 0 ? "bg-indigo-50 text-indigo-600"
      : "bg-slate-100 text-slate-400";
    return <span className={`rounded-full px-2 py-0.5 text-[12px] font-bold ${cls}`}>{p}%</span>;
  }

  // A small dropdown component.
  function Dropdown({ id, label, items, selected, onToggle, onClear, render }) {
    const isOpen = open === id;
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(isOpen ? "" : id)}
          className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold ${
            selected.length ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Filter size={13} />
          {label}{selected.length ? ` · ${selected.length}` : ""}
        </button>
        {isOpen && (
          <>
            <button type="button" aria-label="Close" onClick={() => setOpen("")} className="fixed inset-0 z-[10] cursor-default" />
            <div className="absolute left-0 top-11 z-[20] max-h-64 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              {items.length === 0 ? (
                <div className="px-3 py-4 text-center text-[13px] text-slate-400">None.</div>
              ) : (
                <>
                  {items.map((it) => {
                    const val = render.value(it);
                    const on = selected.includes(val);
                    return (
                      <button key={val} type="button" onClick={() => onToggle(val)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] font-semibold ${on ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}>
                        {render.label(it)}
                        <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"}`}>
                          {on && <span className="text-[13px] font-bold">✓</span>}
                        </span>
                      </button>
                    );
                  })}
                  {selected.length > 0 && (
                    <button type="button" onClick={onClear} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[13px] font-bold text-rose-600 hover:bg-rose-50">Clear</button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // Sticky column widths.
  const NAME_W = 150;
  const MONTH_W = 120;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700">
            <ChevronLeft size={14} /> Back to Team View
          </button>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">All employees · full year</h1>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-semibold text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-500 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, name or department"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs font-medium text-slate-700 outline-none focus:border-brand-400 focus:bg-white"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={14} /></button>
          )}
        </div>

        <Dropdown id="year" label="Year" items={yearChoices} selected={years}
          onToggle={(v) => { const next = years.includes(v) ? years.filter((x)=>x!==v) : [...years, v]; setYears(next.length ? next : [Math.max(LAUNCH_YEAR, currentYear)]); }}
          onClear={() => setYears([Math.max(LAUNCH_YEAR, currentYear)])}
          render={{ value: (y) => y, label: (y) => y }} />

        <Dropdown id="role" label="Role" items={roles} selected={roleFilter}
          onToggle={(v) => toggle(setRoleFilter, roleFilter, v)} onClear={() => setRoleFilter([])}
          render={{ value: (r) => r, label: (r) => ROLE_LABELS[r] || r }} />

        <Dropdown id="dept" label="Department" items={departments} selected={deptFilter}
          onToggle={(v) => toggle(setDeptFilter, deptFilter, v)} onClear={() => setDeptFilter([])}
          render={{ value: (d) => d, label: (d) => d }} />

        <Dropdown id="month" label="Months" items={Array.from({length:12},(_,i)=>i+1)} selected={monthFilter}
          onToggle={(v) => toggle(setMonthFilter, monthFilter, v)} onClear={() => setMonthFilter([])}
          render={{ value: (m) => m, label: (m) => MONTH_NAMES[m-1] }} />

        <span className="ml-auto text-[13px] font-semibold text-slate-400">{filtered.length} employees</span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading...
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="border-collapse text-center text-[13px]" style={{ minWidth: "max-content" }}>
              <thead>
                <tr className="text-slate-500">
                  <th className="sticky left-0 z-20 bg-slate-50 px-3 py-3 text-left text-[13px] font-semibold uppercase tracking-wide" style={{ width: NAME_W, minWidth: NAME_W }} rowSpan={2}>Employee</th>
                  <th className="sticky z-20 bg-slate-50 px-3 py-3 text-left text-[13px] font-semibold uppercase tracking-wide" style={{ left: NAME_W, width: MONTH_W, minWidth: MONTH_W }} rowSpan={2}>Month</th>
                  <th className="bg-slate-50 px-2 py-3 text-[13px] font-semibold uppercase tracking-wide" rowSpan={2}>Target</th>
                  {weekIdx.map((w) => (
                    <th key={`w${w}`} className="border-l border-slate-200 bg-slate-50 px-2 py-2 text-[13px] font-semibold uppercase tracking-wide text-slate-600" colSpan={3}>Week {w}</th>
                  ))}
                  <th className="border-l border-slate-200 bg-slate-50 px-2 py-3 text-[13px] font-semibold uppercase tracking-wide" rowSpan={2}>Overall<br/>Achieved</th>
                  <th className="border-l border-slate-200 bg-brand-50/70 px-2 py-3 text-[13px] font-semibold uppercase tracking-wide text-brand-600" rowSpan={2}>Overall<br/>%</th>
                </tr>
                <tr className="text-[13px] uppercase tracking-wide text-slate-400">
                  {weekIdx.map((w) => (
                    <Fragment key={`h${w}`}>
                      <th className="border-l border-slate-100 bg-slate-50/60 px-2 py-1.5 font-semibold">Tgt</th>
                      <th className="bg-slate-50/60 px-2 py-1.5 font-semibold">Ach</th>
                      <th className="bg-slate-50/60 px-2 py-1.5 font-semibold">Conv%</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((emp) =>
                  emp.months.map((m, mi) => (
                    <tr key={`${emp.id}-${m.year}-${m.month}`} className="hover:bg-[#fafbff]">
                      {/* Employee name — only on first month row, sticky */}
                      {mi === 0 ? (
                        <td rowSpan={emp.months.length} className="sticky left-0 z-10 border-r border-slate-100 bg-white px-3 py-3 text-left align-top" style={{ width: NAME_W, minWidth: NAME_W }}>
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-bold text-white">{initialsOf(emp.name)}</span>
                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-bold text-slate-900">{emp.name}</div>
                              <div className="truncate text-[13px] text-slate-400">{emp.department || emp.roleLabel || ROLE_LABELS[emp.role] || ""}</div>
                            </div>
                          </div>
                        </td>
                      ) : null}
                      {/* Month — sticky */}
                      <td className="sticky z-10 border-r border-slate-100 bg-white px-3 py-3 text-left" style={{ left: NAME_W, width: MONTH_W, minWidth: MONTH_W }}>
                        <div className="font-bold text-slate-700">{MONTH_ABBR[m.month - 1]}</div>
                        <div className="text-[13px] text-slate-400">{m.year}</div>
                      </td>
                      {/* Monthly target */}
                      <td className="px-2 py-3 font-bold text-slate-800">{m.monthlyTarget || "—"}</td>
                      {/* Weeks */}
                      {weekIdx.map((wnum) => {
                        const w = m.weeks.find((x) => x.week === wnum);
                        if (!w) return (
                          <Fragment key={`e${wnum}`}>
                            <td className="border-l border-slate-50 bg-slate-50/40" /><td className="bg-slate-50/40" /><td className="bg-slate-50/40" />
                          </Fragment>
                        );
                        return (
                          <Fragment key={`c${wnum}`}>
                            <td className="border-l border-slate-50 px-2 py-3 font-semibold text-slate-500">{w.target}</td>
                            <td className="px-2 py-3 font-bold text-slate-900">{w.achieved}</td>
                            <td className="px-2 py-3">{pctPill(w.percent)}</td>
                          </Fragment>
                        );
                      })}
                      {/* Overall achieved */}
                      <td className="border-l border-slate-50 px-2 py-3 font-bold text-slate-800">{m.totalAchieved}</td>
                      {/* Overall % */}
                      <td className="border-l border-slate-50 bg-brand-50/40 px-2 py-3">
                        <span className={`text-[13px] font-bold ${m.overallPercent >= 100 ? "text-brand-700" : "text-brand-700"}`}>{m.overallPercent}%</span>
                      </td>
                    </tr>
                  ))
                )}
                {filtered.length === 0 && (
                  <tr><td colSpan={4 + maxWeeks * 3} className="px-4 py-10 text-center text-xs text-slate-500">No employees match.</td></tr>
                )}
              </tbody>
              {/* Grand totals */}
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold">
                    <td className="sticky left-0 z-10 bg-slate-100 px-3 py-3.5 text-left text-[12px] uppercase tracking-wide text-slate-700" style={{ width: NAME_W }}>All ({totals.empCount})</td>
                    <td className="sticky z-10 bg-slate-100 px-3 py-3.5 text-left text-[13px] text-slate-500" style={{ left: NAME_W, width: MONTH_W }}>All months</td>
                    <td className="px-2 py-3.5 text-[13px] text-slate-900">{totals.totalTarget}</td>
                    {weekIdx.map((w) => (
                      <Fragment key={`tf${w}`}>
                        <td className="border-l border-slate-100 bg-slate-50/80" /><td className="bg-slate-50/80" /><td className="bg-slate-50/80" />
                      </Fragment>
                    ))}
                    <td className="border-l border-slate-100 px-2 py-3.5 text-[13px] text-slate-900">{totals.totalAchieved}</td>
                    <td className="border-l border-slate-100 bg-brand-100/50 px-2 py-3.5">
                      <span className={`text-[15px] ${totals.pct >= 100 ? "text-brand-700" : "text-brand-700"}`}>{totals.pct}%</span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
