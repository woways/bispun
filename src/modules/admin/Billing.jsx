import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DollarSign,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Search,
  CalendarDays,
} from "lucide-react";

import {
  Badge,
  StatCard,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";

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

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function planTone(plan) {
  if (plan === "advanced") {
    return "amber";
  }

  if (plan === "pro") {
    return "indigo";
  }

  return "slate";
}

function subscriptionTone(status) {
  if (status === "ACTIVE") {
    return "emerald";
  }

  if (status === "TRIAL") {
    return "amber";
  }

  if (status === "PAST_DUE") {
    return "rose";
  }

  if (
    status === "CANCELLED" ||
    status === "EXPIRED"
  ) {
    return "slate";
  }

  return "slate";
}

export default function Billing() {
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

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [payments, setPayments] =
    useState([]);

  async function loadBilling() {
    setLoading(true);
    setError("");

    try {
      const [
        result,
        paymentResult,
      ] = await Promise.all([
        apiRequest(
          "/api/admin/global-billing"
        ),
        apiRequest(
          "/api/admin/payments?limit=50"
        ),
      ]);

      setData(result);
      setPayments(
        paymentResult.payments || []
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load billing"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  const clients =
    useMemo(() => {
      let rows =
        data.clients || [];

      if (
        statusFilter !== "all"
      ) {
        rows =
          rows.filter(
            (client) =>
              client.subscriptionStatus ===
              statusFilter
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
      search,
      statusFilter,
    ]);

  const totals =
    data.totals || {};

  const paymentSummary =
    useMemo(() => {
      return payments.reduce(
        (summary, payment) => {
          summary.total += 1;

          if (
            payment.status ===
            "CAPTURED"
          ) {
            summary.captured +=
              1;
            summary.capturedValue +=
              Number(
                payment.amount ||
                  0
              );
          }

          if (
            payment.status ===
            "FAILED"
          ) {
            summary.failed +=
              1;
          }

          return summary;
        },
        {
          total: 0,
          captured: 0,
          failed: 0,
          capturedValue: 0,
        }
      );
    }, [payments]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign
              size={18}
              className="text-indigo-600"
            />

            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Billing
            </h1>
          </div>

          <p className="text-sm text-slate-500 mt-1">
            Bispun SaaS
            subscriptions across all
            client companies.
          </p>
        </div>

        <button
          type="button"
          onClick={
            loadBilling
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
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Active Subscriptions"
          value={
            totals.activeSubscriptions ||
            0
          }
          icon={CheckCircle2}
          tone="emerald"
        />

        <StatCard
          label="Trials"
          value={
            totals.trialSubscriptions ||
            0
          }
          icon={Clock}
          tone="amber"
        />

        <StatCard
          label="Past Due"
          value={
            totals.pastDueSubscriptions ||
            0
          }
          icon={AlertCircle}
          tone="rose"
        />

        <StatCard
          label="Cancelled / Expired"
          value={
            Number(
              totals.cancelledSubscriptions ||
                0
            ) +
            Number(
              totals.expiredSubscriptions ||
                0
            )
          }
          icon={XCircle}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Annual Recurring Value"
          value={formatMoney(
            totals.annualRecurringValue
          )}
          icon={DollarSign}
          tone="indigo"
        />

        <StatCard
          label="Current Subscription Value"
          value={formatMoney(
            totals.totalSubscriptionValue
          )}
          icon={CreditCard}
          tone="emerald"
        />
      </div>

      <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4">
        <div className="text-xs font-medium text-slate-700">
          SaaS billing only
        </div>

        <div className="text-xs text-slate-500 mt-1">
          This page contains only
          Bispun subscription
          billing. It does not expose
          client admissions revenue,
          expenses, incentives, profit,
          collections or other private
          financial records.
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {[
          ["all", "All"],
          ["ACTIVE", "Active"],
          ["TRIAL", "Trial"],
          [
            "PAST_DUE",
            "Past Due",
          ],
          [
            "CANCELLED",
            "Cancelled",
          ],
          [
            "EXPIRED",
            "Expired",
          ],
        ].map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setStatusFilter(
                  key
                )
              }
              className={`h-8 px-3 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter ===
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

          Loading billing...
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
                  Billing Cycle
                </th>

                <th className="px-4 py-3 text-left">
                  Amount
                </th>

                <th className="px-4 py-3 text-left">
                  Annual Value
                </th>

                <th className="px-4 py-3 text-left">
                  Status
                </th>

                <th className="px-4 py-3 text-left">
                  Start
                </th>

                <th className="px-4 py-3 text-left">
                  Renewal
                </th>

                <th className="px-4 py-3 text-left">
                  Grace Ends
                </th>

                <th className="px-4 py-3 text-left">
                  End
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
                          "—"}
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
                      <div>Annual</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {client.renewalMode || "MANUAL"}
                      </div>
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-900">
                      {formatMoney(
                        client.amount
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium text-indigo-700">
                      {formatMoney(
                        client.annualValue
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        tone={subscriptionTone(
                          client.subscriptionStatus
                        )}
                      >
                        {client.subscriptionStatus ||
                          "No Subscription"}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(
                        client.startDate
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(
                        client.renewalDate
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(
                        client.graceEndsAt
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(
                        client.endDate
                      )}
                    </td>
                  </tr>
                )
              )}

              {!clients.length && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No subscriptions
                    found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}


      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Captured Payments"
          value={paymentSummary.captured}
          icon={CheckCircle2}
          tone="emerald"
        />

        <StatCard
          label="Captured Value"
          value={formatMoney(
            paymentSummary.capturedValue
          )}
          icon={CreditCard}
          tone="indigo"
        />

        <StatCard
          label="Failed Payments"
          value={paymentSummary.failed}
          icon={AlertCircle}
          tone="rose"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900">
            Razorpay Payment Transactions
          </div>

          <div className="text-xs text-slate-500 mt-0.5">
            Recent Bispun subscription payment attempts and successful captures.
          </div>
        </div>

        <div className="overflow-x-auto">
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
                  Cycle
                </th>
                <th className="px-4 py-3 text-left">
                  Discount
                </th>
                <th className="px-4 py-3 text-left">
                  Amount
                </th>
                <th className="px-4 py-3 text-left">
                  Status
                </th>
                <th className="px-4 py-3 text-left">
                  Payment ID
                </th>
                <th className="px-4 py-3 text-left">
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {payments.map(
                (payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {payment.company?.name || "—"}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-700">
                      {payment.plan?.name || "—"}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      Annual
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {Number(payment.discountAmount || 0) > 0 ? (
                        <span className="text-rose-600">
                          − {formatMoney(payment.discountAmount)}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {formatMoney(payment.amount)}
                      {Number(payment.discountAmount || 0) > 0 && (
                        <div className="text-[11px] font-normal text-slate-400 line-through">
                          {formatMoney(
                            payment.listPrice || payment.amount
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          payment.status === "CAPTURED"
                            ? "emerald"
                            : payment.status === "FAILED"
                            ? "rose"
                            : payment.status === "AUTHORIZED"
                            ? "amber"
                            : "slate"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      <div className="font-mono">
                        {payment.providerPaymentId || "—"}
                      </div>

                      {payment.failureReason && (
                        <div className="mt-1 max-w-xs text-[10px] text-rose-600 font-sans">
                          {payment.failureReason}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-500">
                      {formatDate(
                        payment.paidAt ||
                          payment.createdAt
                      )}
                    </td>
                  </tr>
                )
              )}

              {!payments.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No payment transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <CalendarDays
            size={15}
            className="text-indigo-600"
          />

          <div className="text-sm font-semibold text-slate-900">
            Billing management
          </div>
        </div>

        <div className="text-xs text-slate-500 mt-1">
          To change a specific client's
          plan, billing cycle, status,
          renewal date or end date, open
          Clients → Client 360 →
          Subscription / Billing.
        </div>
      </div>
    </div>
  );
}
