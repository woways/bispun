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
  FileText,
  ReceiptIndianRupee,
  Download,
  RotateCcw,
} from "lucide-react";

import {
  Badge,
  StatCard,
} from "../../components/ui";

import { apiRequest } from "../../lib/api";
import BillingReceiptModal from "../../components/BillingReceiptModal";

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function planTone(plan) {
  if (plan === "advanced") return "amber";
  if (plan === "pro") return "indigo";
  return "slate";
}

function subscriptionTone(status) {
  if (status === "ACTIVE") return "emerald";
  if (status === "TRIAL") return "amber";
  if (status === "PAST_DUE") return "rose";
  return "slate";
}

function paymentTone(status) {
  if (status === "CAPTURED") return "emerald";
  if (status === "FAILED") return "rose";
  if (status === "AUTHORIZED") return "amber";
  return "slate";
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const EMPTY_FILTERS = {
  month: "",
  dateFrom: "",
  dateTo: "",
  companyId: "",
  planKey: "",
  status: "",
};

export default function Billing() {
  const [view, setView] = useState("subscriptions");
  const [data, setData] = useState({ totals: {}, clients: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [payments, setPayments] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState({});
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  async function loadBilling() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/api/admin/global-billing");
      setData(result);
    } catch (loadError) {
      setError(loadError?.data?.message || "Unable to load billing");
    } finally {
      setLoading(false);
    }
  }

  async function loadPayments(nextFilters = appliedFilters) {
    setPaymentLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "1000" });
      if (nextFilters.companyId) params.set("companyId", nextFilters.companyId);
      if (nextFilters.planKey) params.set("planKey", nextFilters.planKey);
      if (nextFilters.status) params.set("status", nextFilters.status);
      if (nextFilters.dateFrom) params.set("dateFrom", nextFilters.dateFrom);
      if (nextFilters.dateTo) params.set("dateTo", nextFilters.dateTo);

      const result = await apiRequest(`/api/admin/payments?${params.toString()}`);
      setPayments(result.payments || []);
      setPaymentSummary(result.summary || {});
    } catch (loadError) {
      setError(loadError?.data?.message || "Unable to load invoices and receipts");
    } finally {
      setPaymentLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  useEffect(() => {
    if (view === "documents") loadPayments(appliedFilters);
  }, [view, appliedFilters]);

  const clients = useMemo(() => {
    let rows = data.clients || [];
    if (statusFilter !== "all") {
      rows = rows.filter((client) => client.subscriptionStatus === statusFilter);
    }
    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter(
        (client) =>
          client.name?.toLowerCase().includes(query) ||
          client.brandName?.toLowerCase().includes(query) ||
          client.planName?.toLowerCase().includes(query)
      );
    }
    return rows;
  }, [data.clients, search, statusFilter]);

  const filteredPayments = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();
    if (!query) return payments;
    return payments.filter((payment) =>
      [
        payment.company?.name,
        payment.company?.brandName,
        payment.plan?.name,
        payment.receipt,
        payment.providerPaymentId,
        payment.providerOrderId,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [payments, paymentSearch]);

  const plans = useMemo(() => {
    const map = new Map();
    (data.clients || []).forEach((client) => {
      if (client.plan && client.planName) map.set(client.plan, client.planName);
    });
    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [data.clients]);

  const totals = data.totals || {};

  function applyMonth(value) {
    setFilters((current) => {
      if (!value) return { ...current, month: "", dateFrom: "", dateTo: "" };
      const [year, month] = value.split("-").map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      return {
        ...current,
        month: value,
        dateFrom: `${value}-01`,
        dateTo: `${value}-${String(lastDay).padStart(2, "0")}`,
      };
    });
  }

  async function openReceipt(payment) {
    setReceiptOpen(true);
    setReceiptData(null);
    setReceiptLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/api/admin/payments/${payment.id}/receipt`);
      setReceiptData(data.receipt || null);
    } catch (loadError) {
      setReceiptOpen(false);
      setError(loadError?.data?.message || "Unable to load payment receipt");
    } finally {
      setReceiptLoading(false);
    }
  }

  function exportPayments() {
    const rows = [
      ["Date", "Client", "Plan", "Invoice / Receipt No", "Subtotal", "GST", "Amount Paid", "Status", "Payment ID"],
      ...filteredPayments.map((payment) => [
        formatDate(payment.paidAt || payment.createdAt),
        payment.company?.name || "",
        payment.plan?.name || "",
        payment.receipt || payment.id,
        payment.subtotal || 0,
        payment.gstAmount || 0,
        payment.amount || 0,
        payment.status,
        payment.providerPaymentId || "",
      ]),
    ];
    downloadCsv(`bispun-invoices-receipts-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">Billing</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Bispun subscriptions, invoices and receipts across all clients.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (view === "documents" ? loadPayments(appliedFilters) : loadBilling())}
          disabled={loading || paymentLoading}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <RefreshCw size={13} className={loading || paymentLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setView("subscriptions")}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold ${view === "subscriptions" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          <CreditCard size={14} /> Subscriptions
        </button>
        <button
          type="button"
          onClick={() => setView("documents")}
          className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold ${view === "documents" ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}
        >
          <ReceiptIndianRupee size={14} /> Invoices & Receipts
        </button>
      </div>

      {view === "subscriptions" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active Subscriptions" value={totals.activeSubscriptions || 0} icon={CheckCircle2} tone="emerald" />
            <StatCard label="Trials" value={totals.trialSubscriptions || 0} icon={Clock} tone="amber" />
            <StatCard label="Past Due" value={totals.pastDueSubscriptions || 0} icon={AlertCircle} tone="rose" />
            <StatCard label="Cancelled / Expired" value={Number(totals.cancelledSubscriptions || 0) + Number(totals.expiredSubscriptions || 0)} icon={XCircle} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <StatCard label="Annual Recurring Value" value={formatMoney(totals.annualRecurringValue)} icon={DollarSign} tone="indigo" />
            <StatCard label="Current Subscription Value" value={formatMoney(totals.totalSubscriptionValue)} icon={CreditCard} tone="emerald" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-xs font-medium text-slate-700">SaaS billing only</div>
            <div className="mt-1 text-xs text-slate-500">
              This page contains only Bispun subscription billing. It does not expose client admissions revenue, expenses, incentives, profit or collections.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {[
              ["all", "All"],
              ["ACTIVE", "Active"],
              ["TRIAL", "Trial"],
              ["PAST_DUE", "Past Due"],
              ["CANCELLED", "Cancelled"],
              ["EXPIRED", "Expired"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`h-8 rounded-lg px-3 text-xs font-semibold ${statusFilter === key ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}

            <div className="relative ml-auto w-full sm:w-72">
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search client..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Loading billing...
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    {['Client','Plan','Billing Cycle','Amount','Annual Value','Status','Start','Renewal','Grace Ends','End'].map((label) => (
                      <th key={label} className="px-4 py-3 text-left">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                      <td className="px-4 py-3"><div className="font-medium text-slate-900">{client.name}</div><div className="mt-0.5 text-xs text-slate-500">{client.brandName || '—'}</div></td>
                      <td className="px-4 py-3"><Badge tone={planTone(client.plan)}>{client.planName || 'No Plan'}</Badge></td>
                      <td className="px-4 py-3 text-slate-700"><div>Annual</div><div className="mt-0.5 text-[11px] text-slate-400">{client.renewalMode || 'MANUAL'}</div></td>
                      <td className="px-4 py-3 font-medium text-slate-900">{formatMoney(client.amount)}</td>
                      <td className="px-4 py-3 font-medium text-indigo-700">{formatMoney(client.annualValue)}</td>
                      <td className="px-4 py-3"><Badge tone={subscriptionTone(client.subscriptionStatus)}>{client.subscriptionStatus || 'No Subscription'}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(client.startDate)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(client.renewalDate)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(client.graceEndsAt)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(client.endDate)}</td>
                    </tr>
                  ))}
                  {!clients.length ? <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">No subscriptions found.</td></tr> : null}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Successful Payments" value={paymentSummary.byStatus?.CAPTURED?.count || 0} icon={CheckCircle2} tone="emerald" />
            <StatCard label="Subtotal Collected" value={formatMoney(paymentSummary.subtotalValue)} icon={FileText} tone="indigo" />
            <StatCard label="GST Collected" value={formatMoney(paymentSummary.gstValue)} icon={ReceiptIndianRupee} tone="amber" />
            <StatCard label="Total Collected" value={formatMoney(paymentSummary.capturedValue)} icon={CreditCard} tone="emerald" />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Month</span>
                <input type="month" value={filters.month} onChange={(event) => applyMonth(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px]" />
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">From</span>
                <input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, month: "", dateFrom: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px]" />
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">To</span>
                <input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, month: "", dateTo: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-[13px]" />
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Client</span>
                <select value={filters.companyId} onChange={(event) => setFilters((current) => ({ ...current, companyId: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]">
                  <option value="">All clients</option>
                  {(data.clients || []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Plan</span>
                <select value={filters.planKey} onChange={(event) => setFilters((current) => ({ ...current, planKey: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]">
                  <option value="">All plans</option>
                  {plans.map((plan) => <option key={plan.key} value={plan.key}>{plan.name}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</span>
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px]">
                  <option value="">All statuses</option>
                  {['CAPTURED','CREATED','AUTHORIZED','FAILED','REFUNDED'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setAppliedFilters({ ...filters })} className="h-9 rounded-lg bg-indigo-600 px-4 text-[12px] font-bold text-white hover:bg-indigo-700">Apply Filters</button>
              <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setAppliedFilters(EMPTY_FILTERS); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"><RotateCcw size={12} /> Reset</button>
              <div className="relative ml-auto w-full sm:w-72">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} placeholder="Search client, invoice, payment ID..." className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-[13px]" />
              </div>
              <button type="button" onClick={exportPayments} disabled={!filteredPayments.length} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 disabled:opacity-40"><Download size={12} /> Export CSV</button>
            </div>
          </div>

          {paymentLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading invoices and receipts...</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">All Client Invoices & Receipts</div>
                <div className="mt-0.5 text-xs text-slate-500">Use the month and client filters for month-end reconciliation.</div>
              </div>
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr>
                    {['Date','Client','Plan','Invoice / Receipt No','Subtotal','GST','Paid','Status','Documents'].map((label) => <th key={label} className="px-4 py-3 text-left">{label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(payment.paidAt || payment.createdAt)}</td>
                      <td className="px-4 py-3"><div className="font-medium text-slate-900">{payment.company?.name || '—'}</div><div className="text-[11px] text-slate-400">{payment.company?.brandName || ''}</div></td>
                      <td className="px-4 py-3 text-slate-700">{payment.plan?.name || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{payment.receipt || payment.id}</td>
                      <td className="px-4 py-3">{formatMoney(payment.subtotal)}</td>
                      <td className="px-4 py-3">{formatMoney(payment.gstAmount)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{formatMoney(payment.amount)}</td>
                      <td className="px-4 py-3"><Badge tone={paymentTone(payment.status)}>{payment.status}</Badge></td>
                      <td className="px-4 py-3">
                        {payment.status === 'CAPTURED' ? (
                          <button
                            type="button"
                            onClick={() => openReceipt(payment)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                          >
                            <ReceiptIndianRupee size={11} /> View Receipt
                          </button>
                        ) : <span className="text-xs text-slate-400">Available after payment</span>}
                      </td>
                    </tr>
                  ))}
                  {!filteredPayments.length ? <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-500">No payment records found for these filters.</td></tr> : null}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2"><CalendarDays size={15} className="text-indigo-600" /><div className="text-sm font-semibold text-slate-900">Month-end checking</div></div>
            <div className="mt-1 text-xs text-slate-500">Select a month to review every client's successful payment, subtotal, GST, invoice and receipt from one place.</div>
          </div>
        </>
      )}

      <BillingReceiptModal
        open={receiptOpen}
        loading={receiptLoading}
        receipt={receiptData}
        onClose={() => { setReceiptOpen(false); setReceiptData(null); }}
        onError={setError}
      />
    </div>
  );
}
