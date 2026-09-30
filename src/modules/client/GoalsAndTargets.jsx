import { Fragment, useEffect, useMemo, useState } from "react";

import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Target as TargetIcon,
  Search,
  X,
  Filter,
  Download,
  CalendarDays,
  Trophy,
  Gauge,
} from "lucide-react";

import GoalsAndTargetsAll from "./GoalsAndTargetsAll";

import { apiRequest } from "../../lib/api";

import sharedGoalsIllustration from "../../assets/Shared goals-amico.svg";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_ABBR = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];
// Quarter → months it covers. "all" shows the full year.
const QUARTERS = {
  q1: [1, 2, 3],
  q2: [4, 5, 6],
  q3: [7, 8, 9],
  q4: [10, 11, 12],
};
const QUARTER_TABS = [
  ["all", "Full year"],
  ["q1", "Q1 · Jan–Mar"],
  ["q2", "Q2 · Apr–Jun"],
  ["q3", "Q3 · Jul–Sep"],
  ["q4", "Q4 · Oct–Dec"],
];

// CA-021: a week's "achieved" can only be entered once that week has started.
function isFutureWeekCell(year, month, wnum) {
  const now = new Date();
  const cy = now.getFullYear();
  if (year > cy) return true;
  if (year < cy) return false;
  const cm = now.getMonth() + 1;
  if (month > cm) return true;
  if (month < cm) return false;
  // Current month: the week is in the future if its first day is after today.
  return (wnum - 1) * 7 + 1 > now.getDate();
}

function initialsOf(name) {
  return String(name || "?").split(" ").filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join("").toUpperCase();
}

const LAUNCH_YEAR = 2026;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function GoalsAndTargets({ currentUser, selectedYear }) {
  // Who can see the Team tab: admins, anyone granted the permission, and
  // managers (the backend scopes a manager's Team view to their own reports).
  const isAdmin =
    currentUser?.role === "CLIENT_ADMIN" ||
    currentUser?.role === "MANAGER" ||
    currentUser?.permissions?.canViewTeamTargets === true;

  const year = selectedYear === "all" ? new Date().getFullYear() : Number(selectedYear) || new Date().getFullYear();

  const [view, setView] = useState("me"); // "me" | "team"
  const [showAll, setShowAll] = useState(false);

  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [roster, setRoster] = useState([]);
  const [rosterSearch, setRosterSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState([]); // selected departments
  const [deptOpen, setDeptOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState([]); // selected roles
  const [roleOpen, setRoleOpen] = useState(false);
  const [teamAverage, setTeamAverage] = useState(0);
  const [teamLoading, setTeamLoading] = useState(false);
  const [drill, setDrill] = useState(null);
  const [quarter, setQuarter] = useState("all"); // all | q1 | q2 | q3 | q4

  /* ---- Load ------------------------------------------------------ */
  async function loadMe() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/api/client/targets/me?year=${year}`);
      setMonths(Array.isArray(data.months) ? data.months : []);
    } catch (err) {
      setError(err?.data?.message || "Unable to load targets");
    } finally {
      setLoading(false);
    }
  }
  async function loadTeam() {
    setTeamLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/api/client/targets/team?year=${year}`);
      setRoster(Array.isArray(data.roster) ? data.roster : []);
      setTeamAverage(Number(data.teamAverage || 0));
    } catch (err) {
      setError(err?.data?.message || "Unable to load team");
    } finally {
      setTeamLoading(false);
    }
  }
  async function loadDrill(userId) {
    setError("");
    try {
      const data = await apiRequest(
        `/api/client/targets/user/${userId}?year=${year}`
      );
      setDrill({
        owner: data.owner,
        months: Array.isArray(data.months) ? data.months : [],
      });
    } catch (err) {
      setError(err?.data?.message || "Unable to load user");
    }
  }

  useEffect(() => {
    if (view === "me") loadMe();
    else loadTeam();
    setDrill(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, year]);

  /* ---- Actions --------------------------------------------------- */
  async function setAchieved(month, week, value) {
    if (isFutureWeekCell(year, month, week)) return;
    const v = Math.max(0, value);
    try {
      const data = await apiRequest("/api/client/targets/me/achieved", {
        method: "PATCH",
        body: JSON.stringify({ year, month, week, value: v }),
      });
      setMonths((cur) => cur.map((m) => (m.month === month ? data.target : m)));
    } catch (err) {
      setError(err?.data?.message || "Unable to save");
    }
  }

  async function setTargetValue(ownerId, month, scope, week, value) {
    const v = Math.max(0, Number(value) || 0);
    try {
      const body = { ownerId, year, month, scope, value: v };
      if (scope === "week") body.week = week;
      const data = await apiRequest("/api/client/targets/target", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setDrill((d) =>
        d
          ? { ...d, months: d.months.map((m) => (m.month === month ? data.target : m)) }
          : d
      );
    } catch (err) {
      setError(err?.data?.message || "Unable to set target");
    }
  }

  const ROLE_LABELS = {
    CLIENT_ADMIN: "Client Admin",
    MANAGER: "Manager",
    EMPLOYEE: "Employee",
  };

  // Fixed role set (roles are a known list, not derived from data).
  const roles = ["CLIENT_ADMIN", "MANAGER", "EMPLOYEE"];

  function toggleRole(x) {
    setRoleFilter((cur) => (cur.includes(x) ? cur.filter((y) => y !== x) : [...cur, x]));
  }

  const departments = useMemo(() => {
    const set = new Set();
    roster.forEach((r) => {
      const d = String(r.department || "").trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [roster]);

  const filteredRoster = useMemo(() => {
    let list = roster;
    if (deptFilter.length > 0) {
      list = list.filter((r) => deptFilter.includes(String(r.department || "").trim()));
    }
    if (roleFilter.length > 0) {
      list = list.filter((r) => roleFilter.includes(r.role));
    }
    const q = rosterSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.name, r.email, r.department, r.id]
          .some((v) => String(v || "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [roster, deptFilter, roleFilter, rosterSearch]);

  function toggleDept(d) {
    setDeptFilter((cur) =>
      cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]
    );
  }

  // Group the (filtered) roster by role → Admin, each Manager with their
  // assigned employees nested, then any employees without a manager.
  const grouped = useMemo(() => {
    const admins = [];
    const managers = [];
    const empByMgr = new Map();
    const unassigned = [];
    const mgrIds = new Set(
      filteredRoster.filter((r) => r.role === "MANAGER").map((r) => r.id)
    );
    filteredRoster.forEach((r) => {
      if (r.role === "CLIENT_ADMIN") {
        admins.push(r);
      } else if (r.role === "MANAGER") {
        managers.push(r);
      } else if (r.managerId && mgrIds.has(r.managerId)) {
        if (!empByMgr.has(r.managerId)) empByMgr.set(r.managerId, []);
        empByMgr.get(r.managerId).push(r);
      } else {
        unassigned.push(r);
      }
    });
    return { admins, managers, empByMgr, unassigned };
  }, [filteredRoster]);

  /* ---- Derived: year average for the ring ------------------------ */
  function yearAverage(monthRows) {
    const vals = monthRows
      .filter((m) => m.monthlyTarget > 0)
      .map((m) => m.overallPercent);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }
  function bestMonth(monthRows) {
    const withT = monthRows.filter((m) => m.monthlyTarget > 0);
    if (!withT.length) return null;
    return [...withT].sort((a, b) => b.overallPercent - a.overallPercent)[0];
  }

  /* ---- UI bits --------------------------------------------------- */

  function pctPill(p) {
    const cls =
      p >= 100
        ? "bg-brand-50 text-brand-700"
        : p > 0
        ? "bg-indigo-50 text-indigo-600"
        : "bg-slate-100 text-slate-400";
    return (
      <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${cls}`}>
        {p}%
      </span>
    );
  }

  // ---- CSV export for one person's months (respects the quarter filter) ----
  function csvCell(v) {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportMonthsCsv(monthRows, ownerName) {
    if (!monthRows || monthRows.length === 0) return;
    const maxW = monthRows.reduce((mx, m) => Math.max(mx, m.weeks.length), 4);
    const wIdx = Array.from({ length: maxW }, (_, i) => i + 1);

    const header = ["Month", "Year", "Monthly Target"];
    wIdx.forEach((w) => header.push(`W${w} Target`, `W${w} Achieved`, `W${w} Conv%`));
    header.push("Overall Achieved", "Overall %");

    const rows = [header];
    monthRows.forEach((m) => {
      const row = [MONTH_NAMES[m.month - 1], year, m.monthlyTarget ?? ""];
      wIdx.forEach((wnum) => {
        const w = m.weeks.find((x) => x.week === wnum);
        if (w) row.push(w.target ?? "", w.achieved ?? "", w.percent ?? "");
        else row.push("", "", "");
      });
      row.push(m.totalAchieved ?? "", m.overallPercent ?? "");
      rows.push(row);
    });

    const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(ownerName || "targets").replace(/\s+/g, "-").toLowerCase()}-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Quarter toolbar (filter tabs on the left, export on the right).
  function QuarterToolbar({ monthRows, ownerName }) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Quarter</span>
          <div className="flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {QUARTER_TABS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setQuarter(key)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${
                  quarter === key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => exportMonthsCsv(monthRows, ownerName)}
          disabled={!monthRows || monthRows.length === 0}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>
    );
  }

  // Apply the current quarter filter to a set of month rows.
  function applyQuarter(monthRows) {
    return quarter === "all"
      ? monthRows
      : monthRows.filter((m) => QUARTERS[quarter].includes(m.month));
  }

  // Compact year summary: one ring + four business-useful KPI cards.
  function AnalysisCard(monthRows, name) {
    const avg = yearAverage(monthRows);
    const best = bestMonth(monthRows);
    const tracked = monthRows.filter((m) => m.monthlyTarget > 0).length;
    const targetHit = monthRows.filter(
      (m) => m.monthlyTarget > 0 && Number(m.overallPercent || 0) >= 100
    ).length;
    const targetHitRate = tracked > 0 ? Math.round((targetHit / tracked) * 100) : 0;
    const performanceStatus =
      tracked === 0
        ? "No data"
        : avg >= 100
        ? "Ahead"
        : avg >= 80
        ? "On track"
        : "Needs focus";

    const circ = 326.7;
    const shown = Math.min(100, avg);
    const offset = circ - (circ * shown) / 100;

    const cards = [
      {
        label: "Months tracked",
        value: tracked,
        note: "of 12 months",
        icon: CalendarDays,
      },
      {
        label: "Best month",
        value: best ? `${MONTH_ABBR[best.month - 1]} · ${best.overallPercent}%` : "—",
        note: best ? "Highest achievement" : "No target data yet",
        icon: Trophy,
      },
      {
        label: "Target hit",
        value: `${targetHit} / ${tracked || 0}`,
        note: tracked ? `${targetHitRate}% of tracked months` : "No tracked months",
        icon: TargetIcon,
      },
      {
        label: "Performance status",
        value: performanceStatus,
        note: "Based on year average",
        icon: Gauge,
      },
    ];

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {name ? `${name} · ` : ""}{year} year average
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[12px] font-semibold text-slate-500">
            Full year
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[150px_minmax(0,1fr)] lg:items-center xl:grid-cols-[150px_minmax(0,1fr)_145px]">
          <div className="flex items-center justify-center">
            <div className="relative h-28 w-28 flex-shrink-0">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="14"
                  className="text-brand-100"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                  className="text-brand-600"
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[24px] font-extrabold leading-none tracking-tight">
                  {avg}%
                </div>
                <div className="text-[11px] font-semibold text-slate-500">year avg</div>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 2xl:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600">
                      <Icon size={15} />
                    </span>

                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-bold uppercase tracking-[0.04em] text-slate-500">
                        {card.label}
                      </div>
                      <div className="mt-0.5 truncate text-[16px] font-bold tracking-tight text-slate-900">
                        {card.value}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
                        {card.note}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden xl:flex items-end justify-center self-stretch">
            <img
              src={sharedGoalsIllustration}
              alt=""
              aria-hidden="true"
              className="h-[118px] w-auto max-w-[140px] object-contain"
            />
          </div>
        </div>
      </div>
    );
  }

  // The premium table. mode: "achieved" | "target" | "none"
  function TargetTable(monthRows, mode, ownerId) {
    const maxWeeks = monthRows.reduce((mx, m) => Math.max(mx, m.weeks.length), 4);
    const weekIdx = Array.from({ length: maxWeeks }, (_, i) => i + 1);

    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.05)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-[11px]">
            <thead>
              <tr className="text-slate-500">
                <th className="bg-slate-50/80 px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" rowSpan={2}>
                  Month
                </th>
                <th className="bg-slate-50/80 px-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider" rowSpan={2}>
                  Mth<br />Tgt
                </th>
                {weekIdx.map((w) => (
                  <th key={`w${w}`} className="border-l border-slate-100 bg-slate-50/80 px-1 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600" colSpan={3}>
                    W{w}
                  </th>
                ))}
                <th className="border-l border-slate-100 bg-brand-50/70 px-1.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-brand-600" rowSpan={2}>
                  Overall<br />Conv%
                </th>
              </tr>
              <tr className="text-[10px] uppercase tracking-wide text-slate-400">
                {weekIdx.map((w) => (
                  <Fragment key={`h${w}`}>
                    <th className="border-l border-slate-100 bg-slate-50/50 px-1 py-1.5 font-semibold">Tgt</th>
                    <th className="bg-slate-50/50 px-1 py-1.5 font-semibold">Ach</th>
                    <th className="bg-slate-50/50 px-1 py-1.5 font-semibold">%</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthRows.map((m) => (
                <tr key={m.month} className="transition-colors hover:bg-[#fafbff]">
                  {/* Month */}
                  <td className="px-2 py-2.5 text-left">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-[10px] font-bold text-brand-600">
                        {MONTH_ABBR[m.month - 1]}
                      </span>
                      <div>
                        <div className="text-[11px] font-bold text-slate-800">{MONTH_NAMES[m.month - 1]}</div>
                      </div>
                    </div>
                  </td>

                  {/* Monthly target — admin types it directly */}
                  <td className="px-1.5 py-2.5">
                    {mode === "target" ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        defaultValue={m.monthlyTarget}
                        onInput={(e) => {
                          e.target.value = e.target.value.replace(/[^0-9]/g, "");
                        }}
                        onBlur={(e) =>
                          setTargetValue(ownerId, m.month, "monthly", null, e.target.value)
                        }
                        className="w-12 rounded-lg border border-slate-200 bg-white px-1 py-0.5 text-center text-[12px] font-bold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                      />
                    ) : (
                      <span className="text-[13px] font-bold text-slate-800">{m.monthlyTarget}</span>
                    )}
                  </td>

                  {/* Weeks */}
                  {weekIdx.map((wnum) => {
                    const w = m.weeks.find((x) => x.week === wnum);
                    if (!w) {
                      return (
                        <Fragment key={`e${wnum}`}>
                          <td className="border-l border-slate-50 bg-slate-50/40" />
                          <td className="bg-slate-50/40" />
                          <td className="bg-slate-50/40" />
                        </Fragment>
                      );
                    }
                    return (
                      <Fragment key={`c${wnum}`}>
                        {/* Target */}
                        <td className="border-l border-slate-50 px-1 py-2.5">
                          {mode === "target" ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              defaultValue={w.target}
                              onInput={(e) => {
                                e.target.value = e.target.value.replace(/[^0-9]/g, "");
                              }}
                              onBlur={(e) => setTargetValue(ownerId, m.month, "week", wnum, e.target.value)}
                              className="w-10 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-center text-[11px] font-bold text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            />
                          ) : (
                            <span className="font-semibold text-slate-500">{w.target}</span>
                          )}
                        </td>
                        {/* Achieved */}
                        <td className="px-1 py-2.5">
                          {mode === "achieved" ? (
                            <input
                              key={`ach-${year}-${m.month}-${wnum}-${w.achieved}`}
                              type="text"
                              inputMode="numeric"
                              defaultValue={w.achieved}
                              disabled={isFutureWeekCell(year, m.month, wnum)}
                              title={
                                isFutureWeekCell(year, m.month, wnum)
                                  ? "This week hasn't started yet."
                                  : undefined
                              }
                              onInput={(e) => {
                                e.target.value = e.target.value.replace(/[^0-9]/g, "");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              onBlur={(e) => {
                                const next = Number(e.target.value) || 0;
                                if (next !== Number(w.achieved || 0)) {
                                  setAchieved(m.month, wnum, next);
                                } else {
                                  e.target.value = String(w.achieved);
                                }
                              }}
                              className="w-10 rounded-md border border-slate-200 bg-white px-1 py-0.5 text-center text-[12px] font-bold text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          ) : (
                            <span className="text-[12px] font-bold text-slate-900">{w.achieved}</span>
                          )}
                        </td>
                        {/* Conv% */}
                        <td className="px-1 py-2.5">
                          {w.target > 0 ? (
                            pctPill(w.percent)
                          ) : (
                            <span className="text-[11px] font-bold text-slate-400">
                              —
                            </span>
                          )}
                        </td>
                      </Fragment>
                    );
                  })}

                  {/* Overall */}
                  <td className="border-l border-slate-50 bg-brand-50/40 px-1.5 py-2.5">
                    <span
                      className={`text-[13px] font-bold ${
                        m.overallPercent >= 100 ? "text-brand-700" : "text-brand-700"
                      }`}
                    >
                      {m.monthlyTarget > 0 ? `${m.overallPercent}%` : "—"}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Total year — auto, read-only */}
              {(() => {
                const totalMonthly = monthRows.reduce((s, m) => s + (m.monthlyTarget || 0), 0);
                const totalAchieved = monthRows.reduce((s, m) => s + (m.totalAchieved || 0), 0);
                const totalPct = totalMonthly > 0 ? Math.round((totalAchieved / totalMonthly) * 100) : 0;
                return (
                  <tr className="border-t-2 border-slate-200 bg-slate-50/70">
                    <td className="px-2 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-700">
                      {quarter === "all"
                        ? "Total year"
                        : `Total ${quarter.toUpperCase()}`}
                    </td>
                    <td className="px-1.5 py-2.5 text-[13px] font-bold text-slate-900">{totalMonthly}</td>
                    {weekIdx.map((w) => (
                      <Fragment key={`tf${w}`}>
                        <td className="border-l border-slate-100 bg-slate-50/70" />
                        <td className="bg-slate-50/70" />
                        <td className="bg-slate-50/70" />
                      </Fragment>
                    ))}
                    <td className="border-l border-slate-100 bg-brand-100/50 px-1.5 py-2.5">
                      <span className={`text-[13px] font-bold ${totalPct >= 100 ? "text-brand-700" : "text-brand-700"}`}>
                        {totalMonthly > 0 ? `${totalPct}%` : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // One person row in the grouped Team view. Clicking your own row opens your
  // "My Target" page; clicking anyone else opens their target drill-down.
  function PersonRow({ person, you = false, nested = false, isManager = false }) {
    return (
      <button
        type="button"
        onClick={() =>
          person.id === currentUser?.id ? setView("me") : loadDrill(person.id)
        }
        className={`flex w-full items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-slate-50 ${
          nested ? "py-2.5" : "py-3"
        }`}
      >
        <span
          className={`flex items-center justify-center rounded-full font-semibold text-white ${
            nested ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-[13px]"
          } ${isManager ? "bg-brand-700" : you ? "bg-brand-600" : "bg-brand-500"}`}
        >
          {initialsOf(person.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`${nested ? "text-[13px]" : "text-sm"} font-bold text-slate-900`}>
              {person.name}
            </span>
            {you && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                You
              </span>
            )}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              {person.roleLabel || ROLE_LABELS[person.role] || person.role}
            </span>
          </div>
          <div className="truncate text-[12px] text-slate-500">
            {person.jobTitle || person.email}
          </div>
        </div>
        <div className="hidden w-28 sm:block">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
              style={{ width: `${Math.min(100, person.yearAveragePercent)}%` }}
            />
          </div>
        </div>
        <span className="w-12 text-right text-sm font-bold text-brand-600">
          {person.yearAveragePercent}%
        </span>
        <ChevronRight size={16} className="text-slate-300" />
      </button>
    );
  }

  function GroupBlock({ title, count, children }) {
    return (
      <div>
        <div className="mb-1.5 flex items-center gap-2 px-1">
          <span className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
            {title}
          </span>
          {typeof count === "number" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
              {count}
            </span>
          )}
        </div>
        <div className="space-y-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {children}
        </div>
      </div>
    );
  }

  /* ---- Render ---------------------------------------------------- */

  if (showAll) {
    return <GoalsAndTargetsAll onBack={() => setShowAll(false)} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.16em] text-brand-500">
            Performance
          </div>
          <h1 className="flex items-center gap-2 text-[24px] font-semibold tracking-[-0.02em] text-slate-900">
            <TargetIcon size={20} className="text-brand-600" />
            My Targets
          </h1>
        </div>

        {isAdmin && (
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setView("me")}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
                view === "me" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              My Target
            </button>
            <button
              type="button"
              onClick={() => setView("team")}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
                view === "team" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              Team Target
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* MY PAGE */}
      {view === "me" && (
        loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : (
          <>
            {AnalysisCard(months, null)}
            <div className="rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-2.5 text-[12px] font-semibold text-brand-700">
              Type what you achieved each week, then press Enter or click away to save. Targets and percentages are automatic.
            </div>
            {/* Quarter filter (Q1–Q4) + export */}
            <QuarterToolbar monthRows={applyQuarter(months)} ownerName={currentUser?.name} />
            {TargetTable(applyQuarter(months), "achieved", currentUser?.id)}
          </>
        )
      )}

      {/* TEAM VIEW */}
      {view === "team" && isAdmin && (
        drill ? (
          <>
            <button
              type="button"
              onClick={() => setDrill(null)}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
            >
              <ChevronLeft size={14} /> Back to team
            </button>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-[13px] font-semibold text-white">
                {initialsOf(drill.owner?.name)}
              </span>
              <div>
                <div className="text-sm font-bold text-slate-900">{drill.owner?.name}</div>
                <div className="text-[13px] text-slate-500">{drill.owner?.jobTitle || drill.owner?.email}</div>
              </div>
            </div>
            {AnalysisCard(drill.months, drill.owner?.name)}
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[12px] font-semibold text-indigo-700">
              Type each <b>Week Target</b> (numbers only). Monthly Target = sum of week targets. Achieved is entered by the employee.
            </div>
            <QuarterToolbar monthRows={applyQuarter(drill.months)} ownerName={drill.owner?.name} />
            {TargetTable(applyQuarter(drill.months), "target", drill.owner?.id)}
          </>
        ) : teamLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : (
          <>
            <div className="text-[13px] font-medium text-slate-500">Company-wide performance overview</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Team average · {year}</div>
                <div className="mt-1 text-[30px] font-bold text-slate-900">{teamAverage}%</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Members</div>
                <div className="mt-1 text-[30px] font-bold text-slate-900">{roster.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Top performer</div>
                <div className="mt-1 text-sm font-bold text-emerald-600">
                  {roster.length
                    ? `${[...roster].sort((a,b)=>b.yearAveragePercent-a.yearAveragePercent)[0].name} — ${[...roster].sort((a,b)=>b.yearAveragePercent-a.yearAveragePercent)[0].yearAveragePercent}%`
                    : "—"}
                </div>
              </div>
            </div>

            {/* View all — full company breakdown */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-semibold text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-500 transition hover:bg-indigo-700"
              >
                View all
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Search + department filter */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
              <div className="relative min-w-[220px] flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Search by name, email, id or department"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs font-medium text-slate-700 outline-none focus:border-brand-400 focus:bg-white"
                />
                {rosterSearch && (
                  <button
                    type="button"
                    onClick={() => setRosterSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDeptOpen((o) => !o)}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold ${
                    deptFilter.length ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Filter size={13} />
                  Department{deptFilter.length ? ` · ${deptFilter.length}` : ""}
                </button>

                {deptOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => setDeptOpen(false)}
                      className="fixed inset-0 z-[10] cursor-default"
                    />
                    <div className="absolute right-0 top-11 z-[20] max-h-64 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      {departments.length === 0 ? (
                        <div className="px-3 py-4 text-center text-[13px] text-slate-400">
                          No departments set on employees.
                        </div>
                      ) : (
                        <>
                          {departments.map((d) => {
                            const on = deptFilter.includes(d);
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => toggleDept(d)}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] font-semibold ${
                                  on ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                {d}
                                <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"}`}>
                                  {on && <span className="text-[13px] font-bold">✓</span>}
                                </span>
                              </button>
                            );
                          })}
                          {deptFilter.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setDeptFilter([])}
                              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[13px] font-bold text-rose-600 hover:bg-rose-50"
                            >
                              Clear filter
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleOpen((o) => !o)}
                  className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-semibold ${
                    roleFilter.length ? "border-brand-300 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Filter size={13} />
                  Role{roleFilter.length ? ` · ${roleFilter.length}` : ""}
                </button>
                {roleOpen && (
                  <>
                    <button type="button" aria-label="Close" onClick={() => setRoleOpen(false)} className="fixed inset-0 z-[10] cursor-default" />
                    <div className="absolute right-0 top-11 z-[20] w-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                      {roles.length === 0 ? (
                        <div className="px-3 py-4 text-center text-[13px] text-slate-400">No roles found.</div>
                      ) : (
                        <>
                          {roles.map((x) => {
                            const on = roleFilter.includes(x);
                            return (
                              <button key={x} type="button" onClick={() => toggleRole(x)}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] font-semibold ${on ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}>
                                {ROLE_LABELS[x] || x}
                                <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"}`}>
                                  {on && <span className="text-[13px] font-bold">✓</span>}
                                </span>
                              </button>
                            );
                          })}
                          {roleFilter.length > 0 && (
                            <button type="button" onClick={() => setRoleFilter([])} className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[13px] font-bold text-rose-600 hover:bg-rose-50">Clear filter</button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              <span className="ml-auto text-[13px] font-semibold text-slate-400">
                {filteredRoster.length} of {roster.length}
              </span>
            </div>

            {/* Grouped: Admin → Managers (with their employees) → Unassigned */}
            <div className="space-y-4">
              {grouped.admins.length > 0 && (
                <GroupBlock title="Admin" count={grouped.admins.length}>
                  {grouped.admins.map((r) => (
                    <PersonRow key={r.id} person={r} you={r.id === currentUser?.id} />
                  ))}
                </GroupBlock>
              )}

              {grouped.managers.length > 0 && (
                <GroupBlock title="Managers & Teams" count={grouped.managers.length}>
                  {grouped.managers.map((mgr) => {
                    const team = grouped.empByMgr.get(mgr.id) || [];
                    return (
                      <div key={mgr.id} className="rounded-xl bg-slate-50/50 p-1">
                        <PersonRow
                          person={mgr}
                          you={mgr.id === currentUser?.id}
                          isManager
                        />
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-brand-100 pl-2">
                          {team.map((emp) => (
                            <PersonRow key={emp.id} person={emp} nested />
                          ))}
                          {team.length === 0 && (
                            <div className="px-3 py-2 text-[12px] text-slate-400">
                              No employees assigned yet.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </GroupBlock>
              )}

              {grouped.unassigned.length > 0 && (
                <GroupBlock title="Unassigned employees" count={grouped.unassigned.length}>
                  {grouped.unassigned.map((r) => (
                    <PersonRow key={r.id} person={r} you={r.id === currentUser?.id} />
                  ))}
                </GroupBlock>
              )}

              {filteredRoster.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500 shadow-sm">
                  No employees match.
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
