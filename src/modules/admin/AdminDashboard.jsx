import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  Ticket,
  Activity,
  RefreshCw,
  Loader2,
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  Badge,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";

function AdminMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "indigo",
  featured = false,
}) {
  const tones = {
    indigo:
      "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald:
      "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber:
      "bg-amber-50 text-amber-600 border-amber-100",
    rose:
      "bg-rose-50 text-rose-600 border-rose-100",
    slate:
      "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div
      className={`rounded-xl p-4 border transition-all ${
        featured
          ? "bg-slate-950 border-slate-950 shadow-[0_10px_30px_rgba(15,23,42,0.14)]"
          : "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[10px] font-semibold uppercase tracking-[0.09em] ${
            featured ? "text-slate-400" : "text-slate-400"
          }`}>
            {label}
          </div>

          <div className={`mt-2 text-[22px] leading-none font-bold tracking-tight ${
            featured ? "text-white" : "text-slate-950"
          }`}>
            {value}
          </div>
        </div>

        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
            featured
              ? "bg-white/10 border-white/10 text-white"
              : tones[tone] || tones.indigo
          }`}
        >
          <Icon size={17} />
        </div>
      </div>

      <div className={`mt-3 pt-3 border-t text-[11px] ${
        featured
          ? "border-white/10 text-slate-400"
          : "border-slate-100 text-slate-500"
      }`}>
        {detail}
      </div>
    </div>
  );
}

function statusTone(status) {
  if (
    ["COMPLETED", "CLOSED"].includes(
      status
    )
  ) {
    return "emerald";
  }

  if (
    ["APPROVED", "IN_PROGRESS", "DEVELOPMENT"].includes(
      status
    )
  ) {
    return "indigo";
  }

  if (status === "REJECTED") {
    return "rose";
  }

  return "amber";
}

function money(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString(
    "en-IN",
    {
      maximumFractionDigits: 0,
    }
  )}`;
}

export default function AdminDashboard({
  onGoto,
}) {
  const [
    data,
    setData,
  ] = useState({
    usage: null,
    billing: null,
    support: null,
    analytics: null,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [
        usage,
        billing,
        support,
        analytics,
      ] = await Promise.all([
        apiRequest(
          "/api/admin/global-usage"
        ),
        apiRequest(
          "/api/admin/global-billing"
        ),
        apiRequest(
          "/api/admin/support?scope=support"
        ),
        apiRequest(
          "/api/admin/analytics"
        ),
      ]);

      setData({
        usage,
        billing,
        support,
        analytics,
      });
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load platform overview"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const totals =
    useMemo(() => {
      const usage =
        data.usage?.totals || {};

      const billing =
        data.billing?.totals || {};

      const clients =
        data.usage?.clients || [];

      return {
        total:
          usage.companies || 0,

        active:
          usage.activeCompanies || 0,

        trial:
          clients.filter(
            (client) =>
              client.status ===
              "TRIAL"
          ).length,

        suspended:
          clients.filter(
            (client) =>
              client.status ===
              "SUSPENDED"
          ).length,

        users:
          usage.users || 0,

        leads:
          usage.leads || 0,

        admissions:
          usage.admissions || 0,

        arr:
          billing.annualRecurringValue ||
          0,
      };
    }, [data]);

  const growthData =
    data.analytics?.clientGrowth ||
    [];

  const recentTickets =
    (data.support?.tickets || [])
      .slice(0, 5);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl py-20 flex items-center justify-center gap-2 text-sm text-slate-500">
        <Loader2
          size={17}
          className="animate-spin"
        />
        Loading platform overview...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Platform / Overview
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Platform Overview
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Real-time Bispun client, subscription, usage and support overview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDashboard}
            className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 shadow-sm"
          >
            <RefreshCw size={13} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() =>
              onGoto("clients")
            }
            className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 shadow-sm"
          >
            <Building2 size={14} />
            View Clients
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <AdminMetric
          label="Total Clients"
          value={totals.total}
          icon={Building2}
          detail="All registered client workspaces"
          tone="indigo"
        />

        <AdminMetric
          label="Active Clients"
          value={totals.active}
          icon={CheckCircle2}
          detail="Companies currently active"
          tone="emerald"
        />

        <AdminMetric
          label="Trial Clients"
          value={totals.trial}
          icon={Clock}
          detail="Companies currently in trial"
          tone="amber"
        />

        <AdminMetric
          label="Suspended"
          value={totals.suspended}
          icon={AlertCircle}
          detail="Client workspaces with blocked access"
          tone="rose"
        />

        <AdminMetric
          label="Total Users"
          value={Number(
            totals.users
          ).toLocaleString("en-IN")}
          icon={Users}
          detail="Users across all client workspaces"
          tone="slate"
        />

        <AdminMetric
          label="Platform Leads"
          value={Number(
            totals.leads
          ).toLocaleString("en-IN")}
          icon={TrendingUp}
          detail="Aggregate lead count only"
          tone="indigo"
        />

        <AdminMetric
          label="Admissions"
          value={Number(
            totals.admissions
          ).toLocaleString("en-IN")}
          icon={CheckCircle2}
          detail="Aggregate admission count only"
          tone="emerald"
        />

        <AdminMetric
          label="Annual Recurring Value"
          value={money(
            totals.arr
          )}
          icon={DollarSign}
          detail="Active SaaS subscription value"
          featured
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Activity
                  size={15}
                  className="text-indigo-600"
                />

                <h3 className="text-sm font-bold text-slate-900">
                  Client Growth
                </h3>
              </div>

              <p className="text-xs text-slate-500 mt-1">
                Real client growth over the last 12 months.
              </p>
            </div>

            <Badge tone="indigo">
              Database
            </Badge>
          </div>

          <div className="mt-5">
            <ResponsiveContainer
              width="100%"
              height={280}
            >
              <AreaChart
                data={growthData}
                margin={{
                  top: 5,
                  right: 10,
                  left: -10,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="clientGrowthGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#6366f1"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="100%"
                      stopColor="#6366f1"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e2e8f0"
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 11,
                    fill: "#64748b",
                  }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  tick={{
                    fontSize: 11,
                    fill: "#64748b",
                  }}
                />

                <Tooltip />

                <Area
                  type="monotone"
                  dataKey="cumulativeClients"
                  name="Total Clients"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#clientGrowthGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Ticket
                  size={15}
                  className="text-indigo-600"
                />

                <h3 className="text-sm font-bold text-slate-900">
                  Recent Support
                </h3>
              </div>

              <p className="text-xs text-slate-500 mt-1">
                Latest real client support tickets.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onGoto("support")
              }
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
            >
              View all
              <ArrowUpRight size={12} />
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {recentTickets.map(
              (ticket) => (
                <div
                  key={ticket.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {ticket.title}
                    </div>

                    <div className="text-xs text-slate-500 mt-1 truncate">
                      {ticket.company?.name || "Unknown client"}
                      {" · "}
                      {ticket.typeLabel}
                    </div>
                  </div>

                  <Badge
                    tone={statusTone(
                      ticket.status
                    )}
                  >
                    {ticket.statusLabel}
                  </Badge>
                </div>
              )
            )}

            {!recentTickets.length && (
              <div className="py-10 text-center text-xs text-slate-500">
                No support tickets yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-medium text-slate-700">
          Super Admin privacy boundary
        </div>

        <div className="text-xs text-slate-500 mt-1">
          Dashboard metrics use aggregate counts, subscription records and support metadata. Private client revenue, expenses, incentives and detailed CRM records are not shown.
        </div>
      </div>
    </div>
  );
}
