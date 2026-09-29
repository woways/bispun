import {
  useEffect,
  useState,
} from "react";

import {
  BarChart3,
  Building2,
  Users,
  DollarSign,
  CheckCircle2,
  RefreshCw,
  Loader2,
} from "lucide-react";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  StatCard,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";

const PIE_COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#64748b",
];

function formatMoney(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0,
    }
  )}`;
}

export default function Analytics() {
  const [data, setData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    try {
      const result =
        await apiRequest(
          "/api/admin/analytics"
        );

      setData(result);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load analytics"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-20 flex items-center justify-center gap-2 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <Loader2
          size={17}
          className="animate-spin"
        />

        Loading analytics...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-rose-200 rounded-xl p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="text-sm text-rose-700">
          {error ||
            "Unable to load analytics"}
        </div>

        <button
          type="button"
          onClick={
            loadAnalytics
          }
          className="mt-4 h-9 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <RefreshCw
            size={14}
          />
          Retry
        </button>
      </div>
    );
  }

  const summary =
    data.summary || {};

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3
              size={18}
              className="text-indigo-600"
            />

            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Analytics
            </h1>
          </div>

          <p className="text-sm text-slate-500 mt-1">
            SaaS growth,
            subscriptions, plans,
            users and recurring
            subscription value.
          </p>
        </div>

        <button
          type="button"
          onClick={
            loadAnalytics
          }
          className="h-9 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <RefreshCw
            size={13}
          />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Clients"
          value={
            summary.totalClients ||
            0
          }
          icon={Building2}
          tone="indigo"
        />

        <StatCard
          label="Active Clients"
          value={
            summary.activeClients ||
            0
          }
          icon={CheckCircle2}
          tone="emerald"
        />

        <StatCard
          label="Total Users"
          value={Number(
            summary.totalUsers ||
              0
          ).toLocaleString(
            "en-IN"
          )}
          icon={Users}
        />

        <StatCard
          label="Annual Recurring Value"
          value={formatMoney(
            summary.annualRecurringValue
          )}
          icon={DollarSign}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
        <div className="min-w-0 overflow-hidden bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.045)] transition-shadow">
          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Client Growth
          </h3>

          <p className="text-xs text-slate-500 mt-1 mb-4">
            New and cumulative
            Bispun clients over
            the last 12 months.
          </p>

          <ResponsiveContainer
            width="100%"
            height={280}
          >
            <LineChart
              data={
                data.clientGrowth ||
                []
              }
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />

              <XAxis
                dataKey="label"
                fontSize={11}
                stroke="#64748b"
              />

              <YAxis
                fontSize={11}
                stroke="#64748b"
              />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="cumulativeClients"
                name="Total Clients"
                stroke="#6366f1"
                strokeWidth={2}
              />

              <Line
                type="monotone"
                dataKey="newClients"
                name="New Clients"
                stroke="#10b981"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="min-w-0 overflow-hidden bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.045)] transition-shadow">
          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Plan Distribution
          </h3>

          <p className="text-xs text-slate-500 mt-1 mb-3">
            Client companies by
            subscription plan.
          </p>

          <ResponsiveContainer
            width="100%"
            height={230}
          >
            <PieChart>
              <Pie
                data={
                  data.planDistribution ||
                  []
                }
                dataKey="clients"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
              >
                {(
                  data.planDistribution ||
                  []
                ).map(
                  (item, index) => (
                    <Cell
                      key={
                        item.key
                      }
                      fill={
                        PIE_COLORS[
                          index %
                            PIE_COLORS.length
                        ]
                      }
                    />
                  )
                )}
              </Pie>

              <Tooltip />
            </PieChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            {(
              data.planDistribution ||
              []
            ).map(
              (item, index) => (
                <div
                  key={
                    item.key
                  }
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          PIE_COLORS[
                            index %
                              PIE_COLORS.length
                          ],
                      }}
                    />

                    <span className="text-slate-700">
                      {item.name}
                    </span>
                  </div>

                  <span className="font-medium text-slate-900">
                    {item.clients}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
        <div className="min-w-0 overflow-hidden bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.045)] transition-shadow">
          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Users by Client
          </h3>

          <p className="text-xs text-slate-500 mt-1 mb-4">
            Account user counts by
            client company.
          </p>

          <ResponsiveContainer
            width="100%"
            height={280}
          >
            <BarChart
              data={
                data.usersByClient ||
                []
              }
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />

              <XAxis
                dataKey="name"
                fontSize={10}
                stroke="#64748b"
              />

              <YAxis
                fontSize={11}
                stroke="#64748b"
              />

              <Tooltip />

              <Bar
                dataKey="users"
                name="Users"
                fill="#6366f1"
                radius={[
                  4,
                  4,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="min-w-0 overflow-hidden bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.045)] transition-shadow">
          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Annual Value by Client
          </h3>

          <p className="text-xs text-slate-500 mt-1 mb-4">
            Annual SaaS subscription
            value.
          </p>

          <ResponsiveContainer
            width="100%"
            height={280}
          >
            <BarChart
              data={
                data.arrByClient ||
                []
              }
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />

              <XAxis
                dataKey="name"
                fontSize={10}
                stroke="#64748b"
              />

              <YAxis
                fontSize={11}
                stroke="#64748b"
                tickFormatter={(
                  value
                ) =>
                  `₹${Math.round(
                    value / 1000
                  )}k`
                }
              />

              <Tooltip
                formatter={(
                  value
                ) =>
                  formatMoney(
                    value
                  )
                }
              />

              <Bar
                dataKey="annualValue"
                name="Annual Value"
                fill="#10b981"
                radius={[
                  4,
                  4,
                  0,
                  0,
                ]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-5">
        <div className="min-w-0 overflow-hidden bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.045)] transition-shadow">
          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Subscription Status
          </h3>

          <div className="mt-4 space-y-3">
            {(
              data.subscriptionStatus ||
              []
            ).map(
              (item) => (
                <div
                  key={
                    item.status
                  }
                  className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0"
                >
                  <span className="text-sm text-slate-600">
                    {
                      item.status
                    }
                  </span>

                  <span className="text-sm font-bold tracking-tight text-slate-950">
                    {
                      item.count
                    }
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:shadow-[0_10px_30px_rgba(15,23,42,0.045)] transition-shadow">
          <h3 className="text-sm font-bold tracking-tight text-slate-950">
            Company Status
          </h3>

          <div className="mt-4 space-y-3">
            {(
              data.companyStatus ||
              []
            ).map(
              (item) => (
                <div
                  key={
                    item.status
                  }
                  className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0"
                >
                  <span className="text-sm text-slate-600">
                    {
                      item.status
                    }
                  </span>

                  <span className="text-sm font-bold tracking-tight text-slate-950">
                    {
                      item.count
                    }
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-medium text-slate-700">
          Analytics privacy
        </div>

        <div className="text-xs text-slate-500 mt-1">
          These analytics use
          Bispun account,
          subscription and aggregate
          usage information only.
          Individual client leads,
          admissions, revenue,
          expenses, incentives and
          other private operational
          records are not displayed.
        </div>
      </div>
    </div>
  );
}