import {
  useEffect,
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
} from "lucide-react";

import {
  apiRequest,
} from "../../lib/api";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
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
}) {
  const tones = {
    indigo:
      "bg-indigo-500 text-white",

    emerald:
      "bg-emerald-500 text-white",

    amber:
      "bg-amber-500 text-white",

    slate:
      "bg-slate-500 text-white",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold uppercase tracking-[0.09em] text-slate-400">
            {label}
          </div>

          <div className="mt-1.5 text-[24px] leading-none font-bold tracking-tight text-slate-950">
            {value}
          </div>

          <div className="mt-2 text-[13px] leading-5 text-slate-500">
            {detail}
          </div>
        </div>

        <div
          className={`w-10 h-10 rounded-xl flex flex-shrink-0 items-center justify-center ${
            tones[
              tone
            ] ||
            tones.indigo
          }`}
        >
          <Icon
            size={17}
          />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div>
        <h3 className="text-[15px] font-bold text-slate-900">
          {title}
        </h3>

        {subtitle && (
          <p className="text-[13px] text-slate-500 mt-1">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-5">
        {children}
      </div>
    </div>
  );
}

export default function Analytics({ selectedYear = "all" }) {
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
        <span className="text-[12px] font-semibold text-slate-500">
          New vs zero in {comparisonYear}
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
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


  return (
    <div className="space-y-4">

      {/* PAGE HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Insights / Business Analytics
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Analytics
          </h1>

          <p className="mt-1 text-[15px] text-slate-500">
            Monitor lead performance,
            source conversion,
            admissions, campaigns and
            employee productivity.
          </p>
        </div>

        <button
          type="button"
          onClick={
            loadAnalytics
          }
          disabled={
            loading
          }
          className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700 inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
        >
          <RefreshCw
            size={13}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh data
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 border border-rose-200 bg-rose-50 rounded-lg text-[15px] text-rose-700">
          <AlertCircle
            size={15}
          />

          {error}
        </div>
      )}

      {/* LOADING */}


      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <button
          type="button"
          onClick={() => setAnalyticsTab("overview")}
          className={`h-8 px-4 rounded-lg text-[13px] font-semibold transition-colors ${
            analyticsTab === "overview"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => setAnalyticsTab("comparison")}
          className={`h-8 px-4 rounded-lg text-[13px] font-semibold transition-colors ${
            analyticsTab === "comparison"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
          }`}
        >
          Year Comparison
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 flex items-center justify-center gap-2 text-[15px] text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Loader2
            size={17}
            className="animate-spin"
          />

          Loading analytics...
        </div>
      ) : (
        <>

          {analyticsTab === "overview" && (
            <>
          {/* KPI CARDS */}

          <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
            <AnalyticsMetric
              label="Total Leads"
              value={
                summary
                  .totalLeads ||
                0
              }
              icon={
                Users
              }
              detail="All leads recorded in the CRM"
              tone="indigo"
            />

            <AnalyticsMetric
              label="Total Admissions"
              value={
                summary
                  .totalAdmissions ||
                0
              }
              icon={
                UserCheck
              }
              detail="Successful admissions recorded"
              tone="emerald"
            />

            <AnalyticsMetric
              label="Conversion Rate"
              value={`${summary.conversionRate || 0}%`}
              icon={
                Percent
              }
              detail="Overall lead-to-admission conversion"
              tone="emerald"
            />

            <AnalyticsMetric
              label="Tracked Stages"
              value={
                data
                  .leadsByStage
                  .length
              }
              icon={
                Target
              }
              detail={`${totalStageLeads} leads distributed across stages`}
              tone="slate"
            />
          </div>

            </>
          )}

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
                      <h2 className="text-[15px] font-bold text-slate-900">
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="w-[36%] px-4 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Parameter
                        </th>
                        <th className="w-[32%] px-4 py-2 text-left text-[13px] font-bold text-slate-900">
                          {primaryYear}
                        </th>
                        <th className="w-[32%] px-4 py-2 text-left text-[13px] font-bold text-slate-900">
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
                        },
                        {
                          label: "Admissions",
                          current: comparison.primary.totalAdmissions,
                          previous: comparison.compare.totalAdmissions,
                          type: "number",
                        },
                        {
                          label: "Conversion Rate",
                          current: comparison.primary.conversionRate,
                          previous: comparison.compare.conversionRate,
                          type: "percent",
                        },
                        {
                          label: "Potential Revenue",
                          current: comparison.primary.potentialRevenue,
                          previous: comparison.compare.potentialRevenue,
                          type: "money",
                        },
                        {
                          label: "Received Revenue",
                          current: comparison.primary.receivedAmount,
                          previous: comparison.compare.receivedAmount,
                          type: "money",
                        },
                        {
                          label: "Pending Revenue",
                          current: comparison.primary.pendingAmount,
                          previous: comparison.compare.pendingAmount,
                          type: "money",
                        },
                      ].map((row) => (
                        <tr
                          key={row.label}
                          className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="px-4 py-2 text-[13px] font-semibold text-slate-700">
                            {row.label}
                          </td>

                          <td className="px-4 py-2">
                            <div className="text-[14px] font-bold tabular-nums text-slate-950">
                              {formatComparisonValue(row.current, row.type)}
                            </div>
                            <div className="mt-0.5">
                              <ComparisonChange
                                current={row.current}
                                previous={row.previous}
                              />
                            </div>
                          </td>

                          <td className="px-4 py-2 text-[14px] font-semibold tabular-nums text-slate-600">
                            {formatComparisonValue(row.previous, row.type)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ChartCard
                  title={`Monthly Leads — ${primaryYear} vs ${comparisonYear}`}
                  subtitle="Month-by-month lead generation comparison."
                >
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
                </ChartCard>

                <ChartCard
                  title={`Monthly Admissions — ${primaryYear} vs ${comparisonYear}`}
                  subtitle="Month-by-month admissions comparison."
                >
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
                </ChartCard>
              </div>

              <ChartCard
                title={`Monthly Received Revenue — ${primaryYear} vs ${comparisonYear}`}
                subtitle="Compare actual received admission revenue month by month."
              >
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
              subtitle="Compare conversion rates across lead acquisition channels."
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
                        42
                      }
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[15px] text-slate-500">
                  No source conversion
                  data yet.
                </div>
              )}
            </ChartCard>

            {/* STAGES */}

            <ChartCard
              title="Lead Stage Distribution"
              subtitle="Understand how leads are distributed across the CRM pipeline."
            >
              {data
                .leadsByStage
                .length >
              0 ? (
                <div className="grid md:grid-cols-[1fr_180px] items-center gap-2">
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
                <div className="h-[280px] flex items-center justify-center text-[15px] text-slate-500">
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
              subtitle="Lead generation and admission activity over time."
            >
              {data
                .monthlyActivity
                .length >
              0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={
                    280
                  }
                >
                  <LineChart
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

                    <Line
                      type="monotone"
                      dataKey="leads"
                      name="Leads"
                      stroke="#6366f1"
                      strokeWidth={
                        2.5
                      }
                      dot={{
                        r:
                          3,
                      }}
                      activeDot={{
                        r:
                          5,
                      }}
                    />

                    <Line
                      type="monotone"
                      dataKey="admissions"
                      name="Admissions"
                      stroke="#10b981"
                      strokeWidth={
                        2.5
                      }
                      dot={{
                        r:
                          3,
                      }}
                      activeDot={{
                        r:
                          5,
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[15px] text-slate-500">
                  No monthly activity
                  yet.
                </div>
              )}
            </ChartCard>

            {/* EMPLOYEES */}

            <ChartCard
              title="Employee Performance"
              subtitle="Compare lead ownership and admissions by employee."
            >
              {data
                .employeePerformance
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
              ) : (
                <div className="h-[280px] flex items-center justify-center text-[15px] text-slate-500">
                  No employee
                  performance data yet.
                </div>
              )}
            </ChartCard>
          </div>

          {/* CAMPAIGNS */}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3
                    size={15}
                    className="text-indigo-600"
                  />

                  <h3 className="text-[15px] font-bold text-slate-900">
                    Top Campaigns
                  </h3>
                </div>

                <p className="text-[13px] text-slate-500 mt-1">
                  Campaigns ranked by
                  lead and admission
                  performance.
                </p>
              </div>

              <div className="text-[13px] text-slate-500">
                {
                  data
                    .topCampaigns
                    .length
                }{" "}
                campaigns
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[15px]">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3 text-left text-[13px] uppercase tracking-[0.08em] font-semibold text-slate-500">
                      Campaign
                    </th>

                    <th className="px-5 py-3 text-left text-[13px] uppercase tracking-[0.08em] font-semibold text-slate-500">
                      Leads
                    </th>

                    <th className="px-5 py-3 text-left text-[13px] uppercase tracking-[0.08em] font-semibold text-slate-500">
                      Admissions
                    </th>

                    <th className="px-5 py-3 text-left text-[13px] uppercase tracking-[0.08em] font-semibold text-slate-500">
                      Conversion
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {data.topCampaigns.map(
                    (
                      campaign
                    ) => (
                      <tr
                        key={
                          campaign.campaign
                        }
                        className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">
                            {
                              campaign.campaign
                            }
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-slate-700 tabular-nums">
                          {
                            campaign.leads
                          }
                        </td>

                        <td className="px-5 py-3.5 font-semibold text-emerald-700 tabular-nums">
                          {
                            campaign.admissions
                          }
                        </td>

                        <td className="px-5 py-3.5">
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

                  {!data
                    .topCampaigns
                    .length && (
                    <tr>
                      <td
                        colSpan={
                          4
                        }
                        className="px-5 py-12 text-center text-[15px] text-slate-500"
                      >
                        No campaign data
                        yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}
        </>
      )}
    </div>
  );
}