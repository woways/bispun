import { useEffect, useMemo, useState } from "react";
import {
  BadgeIndianRupee,
  CheckCircle2,
  Clock3,
  Gift,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";

import { apiRequest } from "../../lib/api";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function statusClass(status) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700";
  if (status === "APPROVED") return "bg-indigo-50 text-indigo-700";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

export default function Referrals() {
  const [data, setData] = useState({ totals: {}, referrers: [], slabs: [], payoutRequests: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest("/api/admin/referrals");
      setData(result || { totals: {}, referrers: [], slabs: [], payoutRequests: [] });
    } catch (err) {
      setError(err?.data?.message || "Unable to load referrals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updatePayout(item, status) {
    let paymentReference = "";
    let adminNote = "";

    if (status === "PAID") {
      paymentReference = window.prompt("Enter payment / UTR reference for this payout:") || "";
      if (!paymentReference.trim()) return;
    }
    if (status === "REJECTED") {
      adminNote = window.prompt("Reason for rejecting this payout request:") || "";
      if (!adminNote.trim()) return;
    }

    setBusyId(item.id);
    setError("");
    try {
      await apiRequest(`/api/admin/referrals/payouts/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, paymentReference, adminNote }),
      });
      await load();
    } catch (err) {
      setError(err?.data?.message || "Unable to update payout request");
    } finally {
      setBusyId("");
    }
  }

  const rows = useMemo(() => data.referrers || [], [data.referrers]);
  const payouts = useMemo(() => data.payoutRequests || [], [data.payoutRequests]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Rewards</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">CRM Referrals & Payouts</h1>
          <p className="mt-1 text-sm text-slate-500">Track referral earnings, redemption requests and actual payouts from one place.</p>
        </div>
        <button onClick={load} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Users size={18} className="text-indigo-600"/><div className="mt-3 text-2xl font-bold">{data.totals?.referrers || 0}</div><div className="text-xs text-slate-500">Active referrers</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><CheckCircle2 size={18} className="text-emerald-600"/><div className="mt-3 text-2xl font-bold">{data.totals?.successful || 0}</div><div className="text-xs text-slate-500">Successful purchases</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><BadgeIndianRupee size={18} className="text-amber-600"/><div className="mt-3 text-2xl font-bold">{money(data.totals?.rewards)}</div><div className="text-xs text-slate-500">Total earned</div></div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm"><Wallet size={18} className="text-emerald-600"/><div className="mt-3 text-2xl font-bold text-emerald-700">{money(data.totals?.paid)}</div><div className="text-xs text-slate-500">Paid to users</div></div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm"><Clock3 size={18} className="text-indigo-600"/><div className="mt-3 text-2xl font-bold text-indigo-700">{money(data.totals?.outstanding)}</div><div className="text-xs text-slate-500">Outstanding liability</div></div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Gift size={16} className="text-indigo-600"/> Slab Structure</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(data.slabs || []).map((slab) => (
            <div key={slab.key} className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-3">
              <div className="text-xs font-semibold text-slate-500">{slab.label} successful referrals</div>
              <div className="mt-1 text-lg font-bold text-indigo-700">{money(slab.rate)} <span className="text-xs font-medium text-slate-500">/ referral</span></div>
            </div>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Payout Requests</div>
            <div className="mt-0.5 text-xs text-slate-500">Approve requests, then mark them paid after transferring the money.</div>
          </div>
          <div className="text-xs font-semibold text-slate-500">Pending {money(data.totals?.pending)} · Approved {money(data.totals?.approved)}</div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading payout requests...</div>
        ) : payouts.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No payout requests yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reference / Note</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.referrer?.name || "—"}</div><div className="mt-0.5 text-slate-400">{item.referrer?.email || ""}</div></td>
                    <td className="px-4 py-3 text-slate-600">{item.referrer?.company?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(item.requestedAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{money(item.amount)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>{item.status}</span></td>
                    <td className="px-4 py-3 text-slate-500">{item.paymentReference || item.adminNote || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.status === "PENDING" && (
                          <>
                            <button disabled={busyId === item.id} onClick={() => updatePayout(item, "APPROVED")} className="rounded-lg bg-indigo-600 px-2.5 py-1.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">Approve</button>
                            <button disabled={busyId === item.id} onClick={() => updatePayout(item, "REJECTED")} className="rounded-lg border border-rose-200 px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>
                          </>
                        )}
                        {item.status === "APPROVED" && (
                          <button disabled={busyId === item.id} onClick={() => updatePayout(item, "PAID")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Mark Paid</button>
                        )}
                        {["PAID", "REJECTED"].includes(item.status) && <span className="text-slate-400">Completed</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">Referrer Earnings</div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading referrals...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No successful CRM referrals yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr><th className="px-4 py-3">Referrer</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Successful</th><th className="px-4 py-3">Slab</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Earned</th><th className="px-4 py-3">Paid</th><th className="px-4 py-3">In process</th><th className="px-4 py-3">Available</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.referrer.id} className="align-top">
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{row.referrer.name}</div><div className="mt-0.5 text-slate-400">{row.referrer.company?.name || "—"}</div></td>
                    <td className="px-4 py-3 font-mono text-slate-700">{row.referrer.referralCode || "—"}</td>
                    <td className="px-4 py-3 font-semibold">{row.summary.successfulCount}</td>
                    <td className="px-4 py-3">{row.summary.slab?.label || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-indigo-700">{money(row.summary.rate)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{money(row.summary.totalEarnings)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">{money(row.summary.paidAmount)}</td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{money(Number(row.summary.pendingAmount || 0) + Number(row.summary.approvedAmount || 0))}</td>
                    <td className="px-4 py-3 font-bold text-indigo-700">{money(row.summary.availableToRedeem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
