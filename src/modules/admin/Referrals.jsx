import { useEffect, useMemo, useRef, useState } from "react";
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
  const [feedback, setFeedback] = useState("");

  // Credit confirmation dialog (PDF 11.7).
  const dialogRef = useRef(null);
  const refreshRef = useRef(null);
  const [creditTarget, setCreditTarget] = useState(null);
  const [crediting, setCrediting] = useState(false);
  const [dialogError, setDialogError] = useState("");

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

  // Open/close the native <dialog> in step with React state. Native <dialog>
  // gives focus trap, Escape-to-close and focus return to the trigger for free.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (creditTarget && !d.open) {
      setDialogError("");
      d.showModal();
    }
  }, [creditTarget]);

  function closeDialog() {
    const d = dialogRef.current;
    if (d?.open) d.close();
  }

  function handleDialogClose() {
    setCreditTarget(null);
    setCrediting(false);
  }

  async function confirmCredit() {
    if (!creditTarget) return;
    const amount = Number(creditTarget.summary?.pendingCredit || 0);
    setCrediting(true);
    setDialogError("");
    try {
      await apiRequest("/api/admin/referrals/credit", {
        method: "POST",
        body: JSON.stringify({ referrerId: creditTarget.referrer.id }),
      });
      setFeedback(`Credited ${money(amount)} to ${creditTarget.referrer.name}.`);
      closeDialog();
      await load();
      // The triggering row button is replaced by a static span after reload, so
      // move focus to a stable element instead of letting it fall to <body>.
      refreshRef.current?.focus();
    } catch (err) {
      setDialogError(err?.data?.message || "Unable to credit referral");
      setCrediting(false);
    }
  }

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
      {/* Live region for credit action result (WCAG 4.1.3). */}
      <span role="status" aria-live="polite" className="sr-only">
        {feedback}
      </span>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">Rewards</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">CRM Referrals &amp; Credits</h1>
          <p className="mt-1 text-sm text-slate-500">Review referral earnings and mark amounts as credited after verifying payment.</p>
        </div>
        <button
          ref={refreshRef}
          onClick={load}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <RefreshCw size={14} aria-hidden="true" className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><Users size={18} aria-hidden="true" className="text-indigo-600"/><div className="mt-3 text-2xl font-bold">{data.totals?.referrers || 0}</div><div className="text-xs text-slate-500">Active referrers</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><CheckCircle2 size={18} aria-hidden="true" className="text-emerald-600"/><div className="mt-3 text-2xl font-bold">{data.totals?.successful || 0}</div><div className="text-xs text-slate-500">Successful purchases</div></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><BadgeIndianRupee size={18} aria-hidden="true" className="text-amber-600"/><div className="mt-3 text-2xl font-bold">{money(data.totals?.rewards)}</div><div className="text-xs text-slate-500">Total earned</div></div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm"><Wallet size={18} aria-hidden="true" className="text-emerald-600"/><div className="mt-3 text-2xl font-bold text-emerald-700">{money(data.totals?.paid)}</div><div className="text-xs text-slate-500">Credited to users</div></div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm"><Clock3 size={18} aria-hidden="true" className="text-indigo-600"/><div className="mt-3 text-2xl font-bold text-indigo-700">{money(data.totals?.outstanding)}</div><div className="text-xs text-slate-500">Awaiting credit</div></div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Gift size={16} aria-hidden="true" className="text-indigo-600"/> Slab Structure</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {(data.slabs || []).map((slab) => (
            <div key={slab.key} className="rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-3">
              <div className="text-xs font-semibold text-slate-600">{slab.label} successful referrals</div>
              <div className="mt-1 text-lg font-bold text-indigo-700">{money(slab.rate)} <span className="text-xs font-medium text-slate-500">/ referral</span></div>
            </div>
          ))}
        </div>
      </div>

      {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {/* REFERRER EARNINGS + CREDIT ACTION */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Referrer Earnings</div>
          <div className="mt-0.5 text-xs text-slate-500">Mark a referrer's earned-but-uncredited amount as credited after you have verified the payment.</div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading referrals...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No successful CRM referrals yet.</div>
        ) : (
          <div className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" tabIndex={0} role="group" aria-label="Referrer earnings (scrollable)">
            <table className="min-w-full text-left text-xs">
              <caption className="sr-only">Referrer earnings with earned, credited and awaiting-credit amounts and a credit action</caption>
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Referrer</th>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Successful</th>
                  <th scope="col" className="px-4 py-3">Slab</th>
                  <th scope="col" className="px-4 py-3">Rate</th>
                  <th scope="col" className="px-4 py-3">Earned</th>
                  <th scope="col" className="px-4 py-3">Credited</th>
                  <th scope="col" className="px-4 py-3">Awaiting credit</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const pending = Number(row.summary?.pendingCredit || 0);
                  return (
                    <tr key={row.referrer.id} className="align-top">
                      <td className="px-4 py-3"><div className="font-semibold text-slate-900">{row.referrer.name}</div><div className="mt-0.5 text-slate-500">{row.referrer.company?.name || "—"}</div></td>
                      <td className="px-4 py-3 font-mono text-slate-700">{row.referrer.referralCode || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{row.summary.successfulCount}</td>
                      <td className="px-4 py-3">{row.summary.slab?.label || "—"}</td>
                      <td className="px-4 py-3 font-semibold text-indigo-700">{money(row.summary.rate)}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{money(row.summary.earned ?? row.summary.totalEarnings)}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">{money(row.summary.credited ?? row.summary.paidAmount)}</td>
                      <td className="px-4 py-3 font-bold text-amber-700">{money(pending)}</td>
                      <td className="px-4 py-3">
                        {pending > 0 ? (
                          <button
                            type="button"
                            onClick={() => setCreditTarget(row)}
                            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                          >
                            Mark credited
                          </button>
                        ) : (
                          <span className="text-slate-500">Fully credited</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LEGACY PAYOUT REQUESTS (historical; clients no longer create new ones) */}
      {payouts.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Legacy Payout Requests</div>
              <div className="mt-0.5 text-xs text-slate-500">Earlier client-initiated requests. Resolve any that are still open; new crediting uses “Mark credited” above.</div>
            </div>
            <div className="text-xs font-semibold text-slate-500">Pending {money(data.totals?.pending)} · Approved {money(data.totals?.approved)}</div>
          </div>
          <div className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" tabIndex={0} role="group" aria-label="Legacy payout requests (scrollable)">
            <table className="min-w-full text-left text-xs">
              <caption className="sr-only">Legacy client-initiated payout requests</caption>
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">User</th>
                  <th scope="col" className="px-4 py-3">Company</th>
                  <th scope="col" className="px-4 py-3">Requested</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Reference / Note</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payouts.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3"><div className="font-semibold text-slate-900">{item.referrer?.name || "—"}</div><div className="mt-0.5 text-slate-500">{item.referrer?.email || ""}</div></td>
                    <td className="px-4 py-3 text-slate-600">{item.referrer?.company?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{new Date(item.requestedAt).toLocaleDateString("en-IN")}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{money(item.amount)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(item.status)}`}>{item.status}</span></td>
                    <td className="px-4 py-3 text-slate-500">{item.paymentReference || item.adminNote || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.status === "PENDING" && (
                          <>
                            <button disabled={busyId === item.id} onClick={() => updatePayout(item, "APPROVED")} className="rounded-lg bg-indigo-600 px-2.5 py-1.5 font-semibold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50">Approve</button>
                            <button disabled={busyId === item.id} onClick={() => updatePayout(item, "REJECTED")} className="rounded-lg border border-rose-200 px-2.5 py-1.5 font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50">Reject</button>
                          </>
                        )}
                        {item.status === "APPROVED" && (
                          <button disabled={busyId === item.id} onClick={() => updatePayout(item, "PAID")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50">Mark Paid</button>
                        )}
                        {["PAID", "REJECTED"].includes(item.status) && <span className="text-slate-500">Completed</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG — native <dialog> (focus trap, Escape, focus return) */}
      <dialog
        ref={dialogRef}
        onClose={handleDialogClose}
        aria-labelledby="credit-dialog-title"
        aria-describedby="credit-dialog-desc"
        className="w-[min(92vw,30rem)] rounded-2xl border border-slate-200 p-0 shadow-xl backdrop:bg-slate-900/50"
      >
        {creditTarget && (
          <div className="p-5">
            <h2 id="credit-dialog-title" className="text-[17px] font-semibold text-slate-950">
              Mark referral credited
            </h2>
            <p id="credit-dialog-desc" className="mt-2 text-[13px] leading-6 text-slate-600">
              You are about to mark <span className="font-bold text-slate-900">{money(creditTarget.summary?.pendingCredit)}</span> as
              credited to <span className="font-semibold text-slate-900">{creditTarget.referrer.name}</span>
              {creditTarget.referrer.company?.name ? ` (${creditTarget.referrer.company.name})` : ""}. This confirms the
              amount has been paid, records it in the credit history and sends them an “Amount credited” notification.
              This action cannot be undone.
            </p>

            {dialogError && (
              <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                {dialogError}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                autoFocus
                onClick={closeDialog}
                disabled={crediting}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCredit}
                disabled={crediting}
                aria-busy={crediting}
                className="h-10 rounded-xl bg-indigo-600 px-4 text-[13px] font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {crediting ? "Crediting…" : `Mark ${creditTarget.referrer.name} credited`}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
