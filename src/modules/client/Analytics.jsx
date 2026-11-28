import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  LabelList,
} from "recharts";

import {
  TrendingUp,
  UserCheck,
  Percent,
  Loader2,
  RefreshCw,
  AlertCircle,
  Users,
  Target,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
  GitCompareArrows,
  MoreVertical,
  Search,
  ChevronsUpDown,
  Download,
} from "lucide-react";

import {
  apiRequest,
} from "../../lib/api";
import { Capacitor } from "@capacitor/core";

// The horizontal chart scroll affordance exists ONLY in the native app (the
// `native:overflow-x-auto` wrapper). Tailwind can scope CSS classes to `.native`
// but NOT plain JSX attributes, so gate the scroll-group semantics
// (tabIndex/role/aria-label) on the same native runtime — otherwise the WEB gets
// a focusable group that announces horizontal scrolling it does not have.
const IS_NATIVE = Capacitor?.isNativePlatform?.() === true;
const nativeScrollGroup = (label) =>
  IS_NATIVE ? { tabIndex: 0, role: "group", "aria-label": label } : {};

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
];

function money(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString(
    "en-IN"
  )}`;
}

function AnalyticsMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "indigo",
  onClick = null,
}) {
  const tones = {
    indigo:
      "bg-indigo-50 text-indigo-600 border-indigo-100",

    emerald:
      "bg-emerald-50 text-emerald-600 border-emerald-100",

    amber:
      "bg-amber-50 text-amber-600 border-amber-100",

    slate:
      "bg-slate-50 text-slate-600 border-slate-200",
  };

  // When onClick is provided the whole card becomes an interactive button that
  // drills into the records behind the metric (Analytics §10.1).
  const clickable = typeof onClick === "function";

  return (
    <div
      {...(clickable
        ? {
            role: "button",
            tabIndex: 0,
            onClick,
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {})}
      className={`bg-white border border-slate-200 rounded-xl p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all ${
        clickable
          ? "cursor-pointer hover:border-indigo-300 hover:shadow-[0_8px_24px_rgba(79,70,229,0.12)] focus:outline-none focus:ring-2 focus:ring-indigo-400"
          : "hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center ${
            tones[
              tone
            ] ||
            tones.indigo
          }`}
        >
          <Icon
            size={17}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[18px] sm:text-[22px] leading-tight font-bold tracking-tight text-slate-950 tabular-nums">
              {value}
            </span>
            <span className="truncate text-[13px] sm:text-[13px] font-semibold text-slate-700">
              {label}
            </span>
          </div>

          <div className="mt-1 truncate text-[11px] leading-4 text-slate-400">
            {clickable ? (
              <span className="inline-flex items-center gap-1 text-indigo-600 font-medium">
                {detail} <span aria-hidden>&rarr;</span>
              </span>
            ) : (
              detail
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  badge,
  legend,
  children,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-slate-900">
            {title}
          </h3>

          {subtitle && (
            <p className="text-[13px] text-slate-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {badge != null && (
          <span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {badge}
          </span>
        )}
      </div>

      {legend && <div className="mt-4">{legend}</div>}

      <div className={legend ? "mt-2" : "mt-5"}>
        {children}
      </div>
    </div>
  );
}

// Small colored-dot + label legend row. Dots are decorative (color is backed by
// the text label beside them), so they are hidden from assistive tech.
function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600"
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default function Analytics({ selectedYear = "all", onDrill = null }) {
  const [
    data,
    setData,
  ] = useState({
    summary: {},
    sourceConversion: [],
    leadsByStage: [],
    monthlyActivity: [],
    employeePerformance: [],
    topCampaigns: [],
    comparison: null,
  });

  const [
    loading,
    setLoading,
  ] = useState(
    true
  );

  const [
    error,
    setError,
  ] = useState("");

  const currentYear = new Date().getFullYear();

  const baseYear =
    selectedYear !== "all" && Number(selectedYear)
      ? Number(selectedYear)
      : currentYear;

  const [
    compareYear,
    setCompareYear,
  ] = useState(baseYear - 1);

  const [analyticsTab, setAnalyticsTab] = useState("overview");

  // Header overflow ("⋮") menu holding the Refresh action.
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const refreshItemRef = useRef(null);
  const firstMetricRef = useRef(null);
  const selectAllRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocPointer(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    // Move focus into the popover when it opens (first drillable metric, else Refresh).
    (firstMetricRef.current || refreshItemRef.current)?.focus();
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, [menuOpen]);

  function closeMenuAndRefocus() {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
  }

  // Campaigns table: client-side search + sortable columns (restyle only — the
  // underlying topCampaigns payload is unchanged).
  const [campaignQuery, setCampaignQuery] = useState("");
  const [campaignSort, setCampaignSort] = useState({
    key: "leads",
    dir: "desc",
  });

  // Campaigns table row selection (by campaign name). Export acts on the
  // selection, or on all shown rows when nothing is selected.
  const [selectedCampaigns, setSelectedCampaigns] = useState(
    () => new Set()
  );

  function toggleCampaignSort(key) {
    setCampaignSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" ? "asc" : "desc" }
    );
  }

  // Redirect off a section the viewer is no longer permitted to open.
  useEffect(() => {
    const allowed = data.allowedSections;
    if (allowed && !allowed[analyticsTab]) {
      const first = ["overview", "comparison"].find((s) => allowed[s]);
      if (first) setAnalyticsTab(first);
    }
  }, [data.allowedSections, analyticsTab]);

  async function loadAnalytics() {
    setLoading(
      true
    );

    setError("");

    try {
      const result =
        await apiRequest(
          `/api/client/analytics?year=${encodeURIComponent(selectedYear)}&compareYear=${encodeURIComponent(compareYear)}`
        );

      setData(
        result
      );
    } catch (error) {
      setError(
        error
          ?.data
          ?.message ||
          "Unable to load analytics"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  useEffect(() => {
    const nextBaseYear =
      selectedYear !== "all" && Number(selectedYear)
        ? Number(selectedYear)
        : new Date().getFullYear();

    setCompareYear((current) =>
      current === nextBaseYear ? nextBaseYear - 1 : current
    );
  }, [selectedYear]);

  useEffect(() => {
    loadAnalytics();
  }, [selectedYear, compareYear]);

  const summary =
    data.summary || {};

  const totalStageLeads =
    data.leadsByStage.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item.value ||
            0
        ),
      0
    );

  const comparison = data.comparison || null;
  const primaryYear = comparison?.primaryYear || baseYear;
  const comparisonYear = comparison?.compareYear || compareYear;

  // The overview cards reflect the global workspace year. Pass it on drill-down
  // only when it is a concrete year (not the "all" workspace), so the records
  // list opens scoped to the same period (Analytics §10.3).
  const overviewDrillYear =
    selectedYear && selectedYear !== "all" && Number.isFinite(Number(selectedYear))
      ? Number(selectedYear)
      : undefined;

  // The headline KPIs now live inside the header "Key Metrics" popover (same
  // values + drill-downs as the old body cards — nothing removed, just moved).
  const metricTones = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  const keyMetrics = [
    {
      label: "Total Leads",
      value: Number(summary.totalLeads || 0).toLocaleString("en-IN"),
      icon: Users,
      toneClass: metricTones.indigo,
      onClick: onDrill
        ? () => onDrill("total-leads", { year: overviewDrillYear })
        : null,
    },
    {
      label: "Total Admissions",
      value: Number(summary.totalAdmissions || 0).toLocaleString("en-IN"),
      icon: UserCheck,
      toneClass: metricTones.emerald,
      onClick: onDrill
        ? () => onDrill("admissions", { year: overviewDrillYear })
        : null,
    },
    {
      label: "Conversion Rate",
      value: `${summary.conversionRate || 0}%`,
      icon: Percent,
      toneClass: metricTones.emerald,
      onClick: null,
    },
    {
      label: "Tracked Stages",
      value: data.leadsByStage.length,
      icon: Target,
      toneClass: metricTones.slate,
      onClick: null,
    },
  ];

  function percentChange(current, previous) {
    const currentValue = Number(current || 0);
    const previousValue = Number(previous || 0);

    if (previousValue === 0) {
      return currentValue === 0 ? 0 : null;
    }

    return Number(
      (((currentValue - previousValue) / previousValue) * 100).toFixed(1)
    );
  }

  function formatComparisonValue(value, type = "number") {
    if (type === "money") return money(value);
    if (type === "percent") return `${Number(value || 0)}%`;
    return Number(value || 0).toLocaleString("en-IN");
  }

  function ComparisonChange({ current, previous }) {
    const change = percentChange(current, previous);
    const positive = change !== null && change > 0;
    const negative = change !== null && change < 0;

    if (change === null) {
      return (
        <span className="text-[13px] font-semibold text-slate-500">
          New vs zero in {comparisonYear}
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 text-[13px] font-semibold ${
          positive
            ? "text-emerald-700"
            : negative
              ? "text-rose-700"
              : "text-slate-500"
        }`}
      >
        {positive ? (
          <ArrowUp size={12} />
        ) : negative ? (
          <ArrowDown size={12} />
        ) : (
          <Minus size={12} />
        )}
        {change > 0 ? "+" : ""}
        {change}% vs {comparisonYear}
      </span>
    );
  }


  // Derived campaign rows for the restyled "All Campaigns" table.
  const campaignRows = data.topCampaigns || [];
  const campaignFilter = campaignQuery.trim().toLowerCase();

  const filteredCampaigns = campaignFilter
    ? campaignRows.filter((row) =>
        String(row.campaign || "")
          .toLowerCase()
          .includes(campaignFilter)
      )
    : campaignRows;

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    const { key, dir } = campaignSort;

    if (key === "name") {
      const result = String(a.campaign || "").localeCompare(
        String(b.campaign || "")
      );
      return dir === "asc" ? result : -result;
    }

    const aValue = Number(a[key] || 0);
    const bValue = Number(b[key] || 0);
    return dir === "asc" ? aValue - bValue : bValue - aValue;
  });

  const campaignTotals = filteredCampaigns.reduce(
    (totals, row) => ({
      leads: totals.leads + Number(row.leads || 0),
      admissions: totals.admissions + Number(row.admissions || 0),
    }),
    { leads: 0, admissions: 0 }
  );

  const campaignSortOptions = [
    { key: "leads", label: "Leads" },
    { key: "admissions", label: "Admissions" },
    { key: "conversion", label: "Conversion" },
    { key: "name", label: "Name" },
  ];

  // Selection state over the currently shown rows.
  const visibleCampaignKeys = sortedCampaigns.map((row) => row.campaign);
  const selectedVisibleCount = visibleCampaignKeys.filter((key) =>
    selectedCampaigns.has(key)
  ).length;
  const allVisibleSelected =
    visibleCampaignKeys.length > 0 &&
    selectedVisibleCount === visibleCampaignKeys.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && !allVisibleSelected;

  // indeterminate is a DOM property, not an attribute — set it imperatively.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected, selectedVisibleCount, visibleCampaignKeys.length]);

  function toggleAllCampaigns() {
    setSelectedCampaigns((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleCampaignKeys.forEach((key) => next.delete(key));
      } else {
        visibleCampaignKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  }

  function toggleCampaign(key) {
    setSelectedCampaigns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Export the selection (or all shown rows when nothing is selected) to CSV.
  function exportCampaignsCsv() {
    const rows = selectedCampaigns.size
      ? sortedCampaigns.filter((row) => selectedCampaigns.has(row.campaign))
      : sortedCampaigns;

    if (!rows.length) return;

    const cell = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = [
      ["Campaign", "Leads", "Admissions", "Conversion %"].join(","),
      ...rows.map((row) =>
        [row.campaign, row.leads, row.admissions, row.conversion]
          .map(cell)
          .join(",")
      ),
    ];

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // Accessible sort indicator for a column header: aria-sort value + a
  // non-color arrow glyph (hidden from AT since aria-sort already conveys it).
  function columnSortState(key) {
    if (campaignSort.key !== key) return "none";
    return campaignSort.dir === "asc" ? "ascending" : "descending";
  }

  function SortHeader({ label, columnKey, align = "left", numeric = false }) {
    const state = columnSortState(columnKey);
    const active = state !== "none";
    return (
      <th
        scope="col"
        aria-sort={state}
        className={`px-3 py-2.5 text-[10px] uppercase tracking-[0.08em] font-semibold whitespace-nowrap ${
          align === "right" ? "text-right" : "text-left"
        }`}
      >
        <button
          type="button"
          onClick={() => toggleCampaignSort(columnKey)}
          className={`inline-flex items-center gap-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
            align === "right" ? "flex-row-reverse" : ""
          } ${active ? "text-indigo-700" : "text-slate-500 hover:text-slate-700"}`}
        >
          <span>{label}</span>
          {active ? (
            campaignSort.dir === "asc" ? (
              <ArrowUp size={12} aria-hidden="true" />
            ) : (
              <ArrowDown size={12} aria-hidden="true" />
            )
          ) : (
            <ChevronsUpDown
              size={12}
              aria-hidden="true"
              className="text-slate-300"
            />
          )}
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-4">

      {/* PAGE HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Insights &middot; Business Analytics
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Analytics
          </h1>

          <p className="mt-1 text-[13px] text-slate-500">
            Monitor lead performance,
            source conversion,
            admissions, campaigns and
            employee productivity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented view switch (toggle-button model: aria-pressed) */}
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            {(!data.allowedSections || data.allowedSections.overview) && (
              <button
                type="button"
                onClick={() => setAnalyticsTab("overview")}
                aria-pressed={analyticsTab === "overview"}
                className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  analyticsTab === "overview"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                <TrendingUp size={14} aria-hidden="true" />
                Overview
              </button>
            )}

            {(!data.allowedSections || data.allowedSections.comparison) && (
              <button
                type="button"
                onClick={() => setAnalyticsTab("comparison")}
                aria-pressed={analyticsTab === "comparison"}
                className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[13px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  analyticsTab === "comparison"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                <GitCompareArrows size={14} aria-hidden="true" />
                Year Comparison
              </button>
            )}
          </div>

          {/* Overflow menu — holds the Refresh action */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              ref={menuTriggerRef}
              onClick={() => setMenuOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setMenuOpen(false);
              }}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-label="Key metrics and more actions"
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <MoreVertical size={16} aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                role="group"
                aria-labelledby="analytics-keymetrics-label"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    closeMenuAndRefocus();
                  }
                }}
                className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
              >
                <p
                  id="analytics-keymetrics-label"
                  className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  Key Metrics
                </p>

                {keyMetrics.map((metric, index) => {
                  const Icon = metric.icon;
                  const drillable = typeof metric.onClick === "function";

                  const inner = (
                    <>
                      <span
                        className={`h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center ${metric.toneClass}`}
                      >
                        <Icon size={15} aria-hidden="true" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-slate-500">
                          {metric.label}
                        </span>
                        <span className="block text-[13px] font-bold tabular-nums text-slate-950">
                          {metric.value}
                        </span>
                      </span>

                      {drillable && (
                        <span
                          aria-hidden="true"
                          className="shrink-0 text-slate-400"
                        >
                          &rarr;
                        </span>
                      )}
                    </>
                  );

                  return drillable ? (
                    <button
                      key={metric.label}
                      type="button"
                      ref={index === 0 ? firstMetricRef : null}
                      onClick={() => {
                        metric.onClick();
                        closeMenuAndRefocus();
                      }}
                      title={`View ${metric.label} records`}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-indigo-50/70 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div
                      key={metric.label}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2"
                    >
                      {inner}
                    </div>
                  );
                })}

                <hr className="my-1.5 border-slate-100" />

                <button
                  type="button"
                  ref={refreshItemRef}
                  disabled={loading}
                  onClick={() => {
                    loadAnalytics();
                    closeMenuAndRefocus();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <RefreshCw
                    size={14}
                    aria-hidden="true"
                    className={loading ? "animate-spin" : ""}
                  />
                  Refresh data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 border border-rose-200 bg-rose-50 rounded-lg text-[13px] text-rose-700">
          <AlertCircle
            size={15}
          />

          {error}
        </div>
      )}

      {/* LOADING */}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 flex items-center justify-center gap-2 text-[13px] text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Loader2
            size={17}
            className="animate-spin"
          />

          Loading analytics...
        </div>
      ) : (
        <>

          {analyticsTab === "comparison" && (
            <>
          {/* YEAR COMPARISON */}

          {comparison && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                      <GitCompareArrows size={17} />
                    </div>

                    <div>
                      <h2 className="text-[13px] font-bold text-slate-900">
                        Year Comparison
                      </h2>
                      <p className="mt-1 text-[13px] text-slate-500">
                        Compare {primaryYear} performance against another year.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 inline-flex items-center text-[13px] font-bold text-slate-700">
                      {primaryYear}
                    </div>

                    <span className="text-[13px] font-semibold text-slate-400">
                      vs
                    </span>

                    <select
                      value={compareYear}
                      onChange={(event) =>
                        setCompareYear(Number(event.target.value))
                      }
                      className="h-9 px-3 border border-slate-200 bg-white rounded-lg text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                    >
                      {Array.from({ length: 8 }, (_, index) => currentYear - index)
                        .filter((year) => year !== primaryYear)
                        .map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="overflow-x-auto native:[-webkit-overflow-scrolling:touch] native:overscroll-x-contain">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="w-[36%] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Parameter
                        </th>
                        <th className="w-[32%] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          {primaryYear}
                        </th>
                        <th className="w-[32%] px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          {comparisonYear}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {[
                        {
                          label: "Total Leads",
                          current: comparison.primary.totalLeads,
                          previous: comparison.compare.totalLeads,
                          type: "number",
                          drillKey: "total-leads",
                        },
                        {
                          label: "Admissions",
                          current: comparison.primary.totalAdmissions,
                          previous: comparison.compare.totalAdmissions,
                          type: "number",
                          drillKey: "admissions",
                        },
                        {
                          // Computed metric: no single record set. Its two inputs
                          // are the Total Leads and Admissions rows above, each of
                          // which is drillable on its own (Analytics §10.4).
                          label: "Conversion Rate",
                          current: comparison.primary.conversionRate,
                          previous: comparison.compare.conversionRate,
                          type: "percent",
                          drillKey: null,
                        },
                        {
                          label: "Potential Revenue",
                          current: comparison.primary.potentialRevenue,
                          previous: comparison.compare.potentialRevenue,
                          type: "money",
                          drillKey: "potential-revenue",
                        },
                        {
                          label: "Received Revenue",
                          current: comparison.primary.receivedAmount,
                          previous: comparison.compare.receivedAmount,
                          type: "money",
                          drillKey: "received-revenue",
                        },
                        {
                          label: "Pending Revenue",
                          current: comparison.primary.pendingAmount,
                          previous: comparison.compare.pendingAmount,
                          type: "money",
                          drillKey: "pending-revenue",
                        },
                      ].map((row) => {
                        const canDrill = Boolean(onDrill && row.drillKey);
                        const cellBtn = (yr) =>
                          canDrill
                            ? {
                                role: "button",
                                tabIndex: 0,
                                title: `View ${row.label} records for ${yr}`,
                                onClick: () =>
                                  onDrill(row.drillKey, { year: yr }),
                                onKeyDown: (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onDrill(row.drillKey, { year: yr });
                                  }
                                },
                                className:
                                  "cursor-pointer rounded-md -mx-1 px-1 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400",
                              }
                            : {};
                        return (
                        <tr
                          key={row.label}
                          className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-4 py-2 text-[13px] font-semibold text-slate-700">
                            {row.label}
                          </td>

                          <td className="px-4 py-2">
                            <div
                              {...cellBtn(primaryYear)}
                            >
                              <div
                                className={`text-[14px] font-bold tabular-nums ${
                                  canDrill ? "text-indigo-700" : "text-slate-950"
                                }`}
                              >
                                {formatComparisonValue(row.current, row.type)}
                              </div>
                              <div className="mt-0.5">
                                <ComparisonChange
                                  current={row.current}
                                  previous={row.previous}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-2">
                            <div
                              {...cellBtn(comparisonYear)}
                              className={
                                canDrill
                                  ? "cursor-pointer rounded-md -mx-1 px-1 text-[14px] font-semibold tabular-nums text-indigo-700 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  : "text-[14px] font-semibold tabular-nums text-slate-600"
                              }
                            >
                              {formatComparisonValue(row.previous, row.type)}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ChartCard
                  title={`Monthly Leads — ${primaryYear} vs ${comparisonYear}`}
                  subtitle="Month-by-month lead generation comparison."
                >
                  <div className="native:-mx-2 native:overflow-x-auto native:px-2" {...nativeScrollGroup(`Monthly Leads chart, ${primaryYear} vs ${comparisonYear}; scroll horizontally to view all months`)}>
                  <div className="native:min-w-[460px]">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={comparison.monthly}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                      />
                      <XAxis
                        dataKey="m"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="primaryLeads"
                        name={`${primaryYear} Leads`}
                        stroke="#6366f1"
                        strokeWidth={2.5}
                      />
                      <Line
                        type="monotone"
                        dataKey="compareLeads"
                        name={`${comparisonYear} Leads`}
                        stroke="#94a3b8"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                  </div>
                </ChartCard>

                <ChartCard
                  title={`Monthly Admissions — ${primaryYear} vs ${comparisonYear}`}
                  subtitle="Month-by-month admissions comparison."
                >
                  <div className="native:-mx-2 native:overflow-x-auto native:px-2" {...nativeScrollGroup(`Monthly Admissions chart, ${primaryYear} vs ${comparisonYear}; scroll horizontally to view all months`)}>
                  <div className="native:min-w-[460px]">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={comparison.monthly}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#e2e8f0"
                      />
                      <XAxis
                        dataKey="m"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "#64748b" }}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="primaryAdmissions"
                        name={`${primaryYear} Admissions`}
                        stroke="#10b981"
                        strokeWidth={2.5}
                      />
                      <Line
                        type="monotone"
                        dataKey="compareAdmissions"
                        name={`${comparisonYear} Admissions`}
                        stroke="#94a3b8"
                        strokeWidth={2.5}
                        strokeDasharray="5 5"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                  </div>
                </ChartCard>
              </div>

              <ChartCard
                title={`Monthly Received Revenue — ${primaryYear} vs ${comparisonYear}`}
                subtitle="Compare actual received admission revenue month by month."
              >
                <div className="native:-mx-2 native:overflow-x-auto native:px-2" {...nativeScrollGroup(`Monthly Received Revenue chart, ${primaryYear} vs ${comparisonYear}; scroll horizontally to view all months`)}>
                <div className="native:min-w-[460px]">
                <ResponsiveContainer width="100%" height={290}>
                  <BarChart data={comparison.monthly}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="m"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(value) =>
                        `₹${Number(value || 0).toLocaleString("en-IN")}`
                      }
                    />
                    <Tooltip formatter={(value) => money(value)} />
                    <Bar
                      dataKey="primaryRevenue"
                      name={`${primaryYear} Received`}
                      fill="#6366f1"
                      radius={[5, 5, 0, 0]}
                    />
                    <Bar
                      dataKey="compareRevenue"
                      name={`${comparisonYear} Received`}
                      fill="#cbd5e1"
                      radius={[5, 5, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                </div>
                </div>
              </ChartCard>
            </div>
          )}

            </>
          )}

          {analyticsTab === "overview" && (
            <>
          {/* PRIMARY CHARTS */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* SOURCE CONVERSION */}

            <ChartCard
              title="Source-wise Conversion"
              subtitle="Conversion rate across lead acquisition channels."
              badge={`${data.sourceConversion.length} channels`}
            >
              {data
                .sourceConversion
                .length >
              0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={
                    280
                  }
                >
                  <BarChart
                    data={
                      data
                        .sourceConversion
                    }
                    margin={{
                      top:
                        5,
                      right:
                        10,
                      left:
                        -10,
                      bottom:
                        0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={
                        false
                      }
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="name"
                      axisLine={
                        false
                      }
                      tickLine={
                        false
                      }
                      tick={{
                        fontSize:
                          11,
                        fill:
                          "#64748b",
                      }}
                    />

                    <YAxis
                      axisLine={
                        false
                      }
                      tickLine={
                        false
                      }
                      tick={{
                        fontSize:
                          11,
                        fill:
                          "#64748b",
                      }}
                      tickFormatter={(
                        value
                      ) =>
                        `${value}%`
                      }
                    />

                    <Tooltip
                      cursor={{
                        fill:
                          "#f8fafc",
                      }}
                      formatter={(
                        value,
                        name
                      ) =>
                        name ===
                        "Conversion"
                          ? `${value}%`
                          : value
                      }
                      contentStyle={{
                        borderRadius:
                          10,
                        border:
                          "1px solid #e2e8f0",
                        boxShadow:
                          "0 8px 24px rgba(15,23,42,0.08)",
                        fontSize:
                          12,
                      }}
                    />

                    <Bar
                      dataKey="conversion"
                      name="Conversion"
                      fill="#6366f1"
                      radius={[
                        6,
                        6,
                        0,
                        0,
                      ]}
                      maxBarSize={
                        46
                      }
                    >
                      <LabelList
                        dataKey="conversion"
                        position="top"
                        formatter={(value) => `${value}%`}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          fill: "#334155",
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[13px] text-slate-500">
                  No source conversion
                  data yet.
                </div>
              )}
            </ChartCard>

            {/* STAGES */}

            <ChartCard
              title="Lead Stage Distribution"
              subtitle="How leads spread across the CRM pipeline."
              badge={`${totalStageLeads} leads`}
            >
              {data
                .leadsByStage
                .length >
              0 ? (
                <div className="grid md:grid-cols-[1fr_180px] items-center gap-2">
                  <div className="relative">
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[26px] font-bold leading-none tracking-tight text-slate-950 tabular-nums">
                      {totalStageLeads}
                    </span>
                    <span className="mt-1 text-[11px] font-medium text-slate-400">
                      total leads
                    </span>
                  </div>
                  <ResponsiveContainer
                    width="100%"
                    height={
                      280
                    }
                  >
                    <PieChart>
                      <Pie
                        data={
                          data
                            .leadsByStage
                        }
                        dataKey="value"
                        nameKey="name"
                        innerRadius={
                          62
                        }
                        outerRadius={
                          98
                        }
                        paddingAngle={
                          3
                        }
                      >
                        {data.leadsByStage.map(
                          (
                            item,
                            index
                          ) => (
                            <Cell
                              key={
                                item.name
                              }
                              fill={
                                COLORS[
                                  index %
                                    COLORS.length
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip
                        contentStyle={{
                          borderRadius:
                            10,
                          border:
                            "1px solid #e2e8f0",
                          boxShadow:
                            "0 8px 24px rgba(15,23,42,0.08)",
                          fontSize:
                            12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    {data.leadsByStage.map(
                      (
                        stage,
                        index
                      ) => (
                        <div
                          key={
                            stage.name
                          }
                          className="flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  COLORS[
                                    index %
                                      COLORS.length
                                  ],
                              }}
                            />

                            <span className="text-[13px] text-slate-600 truncate">
                              {
                                stage.name
                              }
                            </span>
                          </div>

                          <span className="text-[13px] font-semibold text-slate-900">
                            {
                              stage.value
                            }
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[13px] text-slate-500">
                  No lead stage data
                  yet.
                </div>
              )}
            </ChartCard>
          </div>

          {/* SECONDARY CHARTS */}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* MONTHLY */}

            <ChartCard
              title="Monthly Activity"
              subtitle="Lead generation and admissions over time."
              legend={
                <ChartLegend
                  items={[
                    { label: "Leads", color: "#6366f1" },
                    { label: "Admissions", color: "#10b981" },
                  ]}
                />
              }
            >
              {data
                .monthlyActivity
                .length >
              0 ? (
                <div
                  role="img"
                  aria-label={`Monthly activity area chart of leads and admissions over ${data.monthlyActivity.length} months.`}
                >
                <ResponsiveContainer
                  width="100%"
                  height={
                    280
                  }
                >
                  <AreaChart
                    data={
                      data
                        .monthlyActivity
                    }
                    margin={{
                      top:
                        5,
                      right:
                        10,
                      left:
                        -10,
                      bottom:
                        0,
                    }}
                  >
                    <defs>
                      <linearGradient id="activityLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="activityAdmissions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={
                        false
                      }
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="m"
                      axisLine={
                        false
                      }
                      tickLine={
                        false
                      }
                      tick={{
                        fontSize:
                          11,
                        fill:
                          "#64748b",
                      }}
                    />

                    <YAxis
                      axisLine={
                        false
                      }
                      tickLine={
                        false
                      }
                      tick={{
                        fontSize:
                          11,
                        fill:
                          "#64748b",
                      }}
                    />

                    <Tooltip
                      contentStyle={{
                        borderRadius:
                          10,
                        border:
                          "1px solid #e2e8f0",
                        boxShadow:
                          "0 8px 24px rgba(15,23,42,0.08)",
                        fontSize:
                          12,
                      }}
                    />

                    <Area
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#activityLeads)"
                      dot={false}
                      activeDot={{ r: 5 }}
                    />

                    <Area
                      type="monotone"
                      dataKey="admissions"
                      name="Admissions"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#activityAdmissions)"
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[13px] text-slate-500">
                  No monthly activity
                  yet.
                </div>
              )}
            </ChartCard>

            {/* EMPLOYEES */}

            <ChartCard
              title="Employee Performance"
              subtitle="Lead ownership and admissions by employee."
              legend={
                <ChartLegend
                  items={[
                    { label: "Leads", color: "#cbd5e1" },
                    { label: "Admissions", color: "#10b981" },
                  ]}
                />
              }
            >
              {data
                .employeePerformance
                .length >
              0 ? (
                <div
                  role="img"
                  aria-label={`Employee performance bar chart comparing leads and admissions across ${data.employeePerformance.length} employees.`}
                >
                <ResponsiveContainer
                  width="100%"
                  height={
                    280
                  }
                >
                  <BarChart
                    data={
                      data
                        .employeePerformance
                    }
                    margin={{
                      top:
                        5,
                      right:
                        10,
                      left:
                        -10,
                      bottom:
                        0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={
                        false
                      }
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="name"
                      axisLine={
                        false
                      }
                      tickLine={
                        false
                      }
                      tick={{
                        fontSize:
                          11,
                        fill:
                          "#64748b",
                      }}
                    />

                    <YAxis
                      axisLine={
                        false
                      }
                      tickLine={
                        false
                      }
                      allowDecimals={
                        false
                      }
                      tick={{
                        fontSize:
                          11,
                        fill:
                          "#64748b",
                      }}
                    />

                    <Tooltip
                      cursor={{
                        fill:
                          "#f8fafc",
                      }}
                      contentStyle={{
                        borderRadius:
                          10,
                        border:
                          "1px solid #e2e8f0",
                        boxShadow:
                          "0 8px 24px rgba(15,23,42,0.08)",
                        fontSize:
                          12,
                      }}
                    />

                    <Bar
                      dataKey="leads"
                      name="Leads"
                      fill="#cbd5e1"
                      radius={[
                        5,
                        5,
                        0,
                        0,
                      ]}
                    />

                    <Bar
                      dataKey="admissions"
                      name="Admissions"
                      fill="#10b981"
                      radius={[
                        5,
                        5,
                        0,
                        0,
                      ]}
                    />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[13px] text-slate-500">
                  No employee
                  performance data yet.
                </div>
              )}
            </ChartCard>
          </div>

          {/* CAMPAIGNS */}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <BarChart3
                      size={15}
                      className="text-indigo-600"
                      aria-hidden="true"
                    />

                    <h3 className="text-[13px] font-bold text-slate-900">
                      All Campaigns
                    </h3>

                    <span
                      aria-live="polite"
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500"
                    >
                      {sortedCampaigns.length} shown
                    </span>
                  </div>

                  <p className="text-[13px] text-slate-500 mt-1">
                    Ranked by lead and admission performance &middot; click a header to sort.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={exportCampaignsCsv}
                  disabled={!sortedCampaigns.length}
                  aria-label="Export campaigns to CSV"
                  className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-indigo-600 text-white text-[13px] font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <Download size={14} aria-hidden="true" />
                  Export
                </button>
              </div>

              {/* Controls: wide search (left) + Sort (far right) */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    size={15}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="search"
                    value={campaignQuery}
                    onChange={(event) => setCampaignQuery(event.target.value)}
                    aria-label="Search campaigns"
                    placeholder="Search campaign name..."
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div className="sm:ml-auto flex items-center gap-2">
                  <label
                    htmlFor="campaign-sort"
                    className="text-[13px] font-semibold text-slate-500"
                  >
                    Sort
                  </label>
                  <select
                    id="campaign-sort"
                    value={campaignSort.key}
                    onChange={(event) => {
                      const key = event.target.value;
                      setCampaignSort({
                        key,
                        dir: key === "name" ? "asc" : "desc",
                      });
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    {campaignSortOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b border-slate-200 bg-slate-50/95">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 w-10">
                      <input
                        type="checkbox"
                        ref={selectAllRef}
                        checked={allVisibleSelected}
                        onChange={toggleAllCampaigns}
                        disabled={!sortedCampaigns.length}
                        aria-label="Select all campaigns"
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                      />
                    </th>

                    <th
                      scope="col"
                      className="px-3 py-2.5 text-left text-[10px] uppercase tracking-[0.08em] font-semibold text-slate-500 whitespace-nowrap w-12"
                    >
                      #
                    </th>

                    <SortHeader label="Campaign" columnKey="name" />
                    <SortHeader label="Leads" columnKey="leads" />
                    <SortHeader label="Admissions" columnKey="admissions" />
                    <SortHeader label="Conversion" columnKey="conversion" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sortedCampaigns.map(
                    (
                      campaign,
                      index
                    ) => (
                      <tr
                        key={
                          campaign.campaign
                        }
                        className={`group transition-colors ${
                          selectedCampaigns.has(campaign.campaign)
                            ? "bg-indigo-50/50"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedCampaigns.has(campaign.campaign)}
                            onChange={() => toggleCampaign(campaign.campaign)}
                            aria-label={`Select ${campaign.campaign}`}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-400"
                          />
                        </td>

                        <td className="px-3 py-2.5">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-indigo-50 px-1.5 text-[12px] font-bold text-indigo-600 tabular-nums">
                            {index + 1}
                          </span>
                        </td>

                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-slate-900">
                            {
                              campaign.campaign
                            }
                          </div>
                        </td>

                        <td className="px-3 py-2.5 text-slate-700 tabular-nums">
                          {
                            campaign.leads
                          }
                        </td>

                        <td className="px-3 py-2.5 font-semibold text-emerald-700 tabular-nums">
                          {
                            campaign.admissions
                          }
                        </td>

                        <td className="px-3 py-2.5">
                          <div className="inline-flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{
                                  width:
                                    `${Math.min(
                                      Number(
                                        campaign.conversion ||
                                          0
                                      ),
                                      100
                                    )}%`,
                                }}
                              />
                            </div>

                            <span className="text-[13px] font-semibold text-slate-700 tabular-nums">
                              {
                                campaign.conversion
                              }
                              %
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  )}

                  {!campaignRows.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-[13px] text-slate-500"
                      >
                        No campaign data
                        yet.
                      </td>
                    </tr>
                  )}

                  {campaignRows.length > 0 && !sortedCampaigns.length && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-[13px] text-slate-500"
                      >
                        No campaigns match &ldquo;{campaignQuery.trim()}&rdquo;.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {sortedCampaigns.length > 0 && (
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 text-[13px]">
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className="text-slate-500"
                >
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {selectedCampaigns.size} selected
                  </span>
                  <span className="text-slate-400">
                    {" "}
                    &middot; {sortedCampaigns.length} of {campaignRows.length} campaigns
                  </span>
                </span>
                <span className="font-semibold text-slate-600 tabular-nums">
                  &Sigma; {campaignTotals.leads} leads &middot; {campaignTotals.admissions} admissions
                </span>
              </div>
            )}
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}