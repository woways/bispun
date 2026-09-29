import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  Building2,
  Users,
  UserCheck,
  TrendingUp,
  CheckCircle2,
  Link2,
  Database,
  Ticket,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  Badge,
  StatCard,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";

function planTone(plan) {
  if (plan === "advanced") {
    return "amber";
  }

  if (plan === "pro") {
    return "indigo";
  }

  return "slate";
}

function companyTone(status) {
  if (status === "ACTIVE") {
    return "emerald";
  }

  if (status === "TRIAL") {
    return "amber";
  }

  if (status === "SUSPENDED") {
    return "rose";
  }

  return "slate";
}

function formatNumber(value) {
  return Number(
    value || 0
  ).toLocaleString("en-IN");
}

export default function Usage() {
  const [data, setData] =
    useState({
      totals: {},
      clients: [],
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [planFilter, setPlanFilter] =
    useState("all");

  async function loadUsage() {
    setLoading(true);
    setError("");

    try {
      const result =
        await apiRequest(
          "/api/admin/global-usage"
        );

      setData(result);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load usage"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsage();
  }, []);

  const clients =
    useMemo(() => {
      let rows =
        data.clients || [];

      if (
        planFilter !== "all"
      ) {
        rows =
          rows.filter(
            (client) =>
              client.plan ===
              planFilter
          );
      }

      const query =
        search
          .trim()
          .toLowerCase();

      if (query) {
        rows =
          rows.filter(
            (client) =>
              client.name
                ?.toLowerCase()
                .includes(query) ||
              client.brandName
                ?.toLowerCase()
                .includes(query) ||
              client.planName
                ?.toLowerCase()
                .includes(query)
          );
      }

      return rows;
    }, [
      data.clients,
      planFilter,
      search,
    ]);

  const totals =
    data.totals || {};

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity
              size={18}
              className="text-indigo-600"
            />

            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Usage
            </h1>
          </div>

          <p className="text-sm text-slate-500 mt-1">
            Account-level usage
            across Bispun clients.
            Only aggregate counts are
            displayed.
          </p>
        </div>

        <button
          type="button"
          onClick={
            loadUsage
          }
          disabled={loading}
          className="h-9 px-3.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-colors"
        >
          <RefreshCw
            size={13}
            className={
              loading
                ? "animate-spin"
                : ""
            }
          />

          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Clients"
          value={
            totals.companies ||
            0
          }
          icon={Building2}
          tone="indigo"
        />

        <StatCard
          label="Active Clients"
          value={
            totals.activeCompanies ||
            0
          }
          icon={CheckCircle2}
          tone="emerald"
        />

        <StatCard
          label="Total Users"
          value={formatNumber(
            totals.users
          )}
          icon={Users}
        />

        <StatCard
          label="Active Users"
          value={formatNumber(
            totals.activeUsers
          )}
          icon={UserCheck}
          tone="emerald"
        />

        <StatCard
          label="Total Leads"
          value={formatNumber(
            totals.leads
          )}
          icon={TrendingUp}
          tone="indigo"
        />

        <StatCard
          label="Admissions"
          value={formatNumber(
            totals.admissions
          )}
          icon={CheckCircle2}
          tone="emerald"
        />

        <StatCard
          label="UTM Links"
          value={formatNumber(
            totals.utmLinks
          )}
          icon={Link2}
        />

        <StatCard
          label="Lead Datasets"
          value={formatNumber(
            totals.leadDatasets
          )}
          icon={Database}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Support Tickets"
          value={formatNumber(
            totals.supportTickets
          )}
          icon={Ticket}
          tone="amber"
        />

        <StatCard
          label="Open Support Tickets"
          value={formatNumber(
            totals.openSupportTickets
          )}
          icon={AlertCircle}
          tone="amber"
        />
      </div>

      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-medium text-slate-700">
          Privacy boundary
        </div>

        <div className="text-xs text-slate-500 mt-1">
          This page shows only
          account-level counts required
          for SaaS usage management.
          Bispun does not display
          lead identities, admission
          records, client revenue,
          expenses, incentives or other
          private operational data here.
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {[
          ["all", "All Plans"],
          ["basic", "Basic"],
          ["pro", "Pro"],
          [
            "advanced",
            "Advanced",
          ],
        ].map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setPlanFilter(
                  key
                )
              }
              className={`h-8 px-3 text-xs font-semibold rounded-lg transition-colors ${
                planFilter ===
                key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          )
        )}

        <div className="relative ml-auto w-full sm:w-72">
          <Search
            size={14}
            className="absolute left-2.5 top-2.5 text-slate-400"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search client..."
            className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl py-20 flex items-center justify-center gap-2 text-sm text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Loader2
            size={16}
            className="animate-spin"
          />

          Loading usage...
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  Client
                </th>

                <th className="px-4 py-3 text-left">
                  Plan
                </th>

                <th className="px-4 py-3 text-left">
                  Users
                </th>

                <th className="px-4 py-3 text-left">
                  Active
                </th>

                <th className="px-4 py-3 text-left">
                  Leads
                </th>

                <th className="px-4 py-3 text-left">
                  Admissions
                </th>

                <th className="px-4 py-3 text-left">
                  UTM
                </th>

                <th className="px-4 py-3 text-left">
                  Datasets
                </th>

                <th className="px-4 py-3 text-left">
                  Tickets
                </th>

                <th className="px-4 py-3 text-left">
                  Open
                </th>

                <th className="px-4 py-3 text-left">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {clients.map(
                (client) => (
                  <tr
                    key={
                      client.id
                    }
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {client.name}
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5">
                        {client.brandName ||
                          client.slug}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        tone={planTone(
                          client.plan
                        )}
                      >
                        {client.planName ||
                          "No Plan"}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatNumber(
                        client.users
                      )}
                    </td>

                    <td className="px-4 py-3 text-emerald-700 font-medium">
                      {formatNumber(
                        client.activeUsers
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatNumber(
                        client.leads
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatNumber(
                        client.admissions
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatNumber(
                        client.utmLinks
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatNumber(
                        client.leadDatasets
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {formatNumber(
                        client.supportTickets
                      )}
                    </td>

                    <td className="px-4 py-3 text-amber-700 font-medium">
                      {formatNumber(
                        client.openSupportTickets
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        tone={companyTone(
                          client.status
                        )}
                      >
                        {client.status}
                      </Badge>
                    </td>
                  </tr>
                )
              )}

              {!clients.length && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No clients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
