import { useEffect, useState } from "react";
import {
  BadgeIndianRupee,
  CheckCircle2,
  Clock3,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { apiRequest } from "../../lib/api";
import ReferralHome from "./ReferralHome";
import MyReferrals from "./MyReferrals";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function payoutStatusClass(status) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700";
  if (status === "APPROVED") return "bg-indigo-50 text-indigo-700";
  if (status === "REJECTED") return "bg-rose-50 text-rose-700";
  return "bg-amber-50 text-amber-700";
}

export default function Referrals({ currentUser }) {
  const [tab, setTab] = useState("home");
  const [code, setCode] = useState("");
  const [stats, setStats] = useState({ total: 0, admitted: 0, inProgress: 0 });
  const [rewardProgram, setRewardProgram] = useState({
    slabs: [],
    summary: {
      successfulCount: 0,
      rate: 0,
      totalEarnings: 0,
      paidAmount: 0,
      pendingAmount: 0,
      approvedAmount: 0,
      availableToRedeem: 0,
      slab: null,
    },
    referrals: [],
    payouts: [],
  });
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSummary() {
    try {
      const data = await apiRequest("/api/client/referrals/me");
      setCode(data.code || "");
      setStats(data.stats || { total: 0, admitted: 0, inProgress: 0 });
      setRewardProgram(data.rewardProgram || {});
    } catch {
      // Keep the rest of the page usable if referral summary fails.
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  async function requestRedemption(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const amount = Number(redeemAmount);
    const available = Number(rewardProgram.summary?.availableToRedeem || 0);

    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Enter a valid amount in whole rupees.");
      return;
    }
    if (amount > available) {
      setError(`You can currently redeem up to ${money(available)}.`);
      return;
    }

    setRedeeming(true);
    try {
      const data = await apiRequest("/api/client/referrals/redeem", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      setMessage(data?.message || "Redemption request submitted.");
      setRedeemAmount("");
      await loadSummary();
    } catch (err) {
      setError(err?.data?.message || "Unable to submit redemption request.");
    } finally {
      setRedeeming(false);
    }
  }

  const TABS = [
    { key: "home", label: "Home" },
    { key: "referrals", label: "My Referrals" },
    { key: "earnings", label: "Earnings" },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-600">Rewards</div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-slate-900">Referrals</h1>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition ${
                tab === t.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "home" && (
        <ReferralHome
          currentUser={currentUser}
          code={code}
          stats={stats}
          onGoReferrals={() => setTab("referrals")}
        />
      )}

      {tab === "referrals" && <MyReferrals currentUser={currentUser} />}

      {tab === "earnings" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <div className="mt-3 text-[28px] font-bold text-slate-950">{rewardProgram.summary?.successfulCount || 0}</div>
              <div className="text-[13px] text-slate-500">Successful CRM referrals</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <BadgeIndianRupee size={18} className="text-indigo-600" />
              <div className="mt-3 text-[28px] font-bold text-slate-950">{money(rewardProgram.summary?.totalEarnings)}</div>
              <div className="text-[13px] text-slate-500">Total earned</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Wallet size={18} className="text-emerald-600" />
              <div className="mt-3 text-[28px] font-bold text-emerald-700">{money(rewardProgram.summary?.paidAmount)}</div>
              <div className="text-[13px] text-slate-500">Paid to you</div>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm">
              <TrendingUp size={18} className="text-indigo-600" />
              <div className="mt-3 text-[28px] font-bold text-indigo-700">{money(rewardProgram.summary?.availableToRedeem)}</div>
              <div className="text-[13px] text-slate-600">Available to redeem</div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold text-slate-950">Redeem Earnings</h2>
                  <p className="mt-1 text-[13px] text-slate-500">Submit a payout request whenever you have an available balance.</p>
                </div>
                {(Number(rewardProgram.summary?.pendingAmount || 0) + Number(rewardProgram.summary?.approvedAmount || 0)) > 0 && (
                  <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
                    {money(Number(rewardProgram.summary?.pendingAmount || 0) + Number(rewardProgram.summary?.approvedAmount || 0))} in process
                  </div>
                )}
              </div>

              <form onSubmit={requestRedemption} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="flex-1">
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Redemption amount</span>
                  <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
                    <span className="mr-2 text-sm font-semibold text-slate-500">₹</span>
                    <input
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Enter amount"
                      inputMode="numeric"
                      className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={redeeming || Number(rewardProgram.summary?.availableToRedeem || 0) <= 0}
                  className="h-11 rounded-xl bg-indigo-600 px-5 text-[13px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {redeeming ? "Submitting..." : "Request Payout"}
                </button>
              </form>

              <div className="mt-2 text-[11px] text-slate-400">Available balance: {money(rewardProgram.summary?.availableToRedeem)}</div>
              {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-medium text-emerald-700">{message}</div>}
              {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-700">{error}</div>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-[17px] font-semibold text-slate-950">Current Slab</h2>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-4 text-white">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{rewardProgram.summary?.slab?.label || "No slab yet"}</div>
                  <div className="mt-1 text-2xl font-bold">{money(rewardProgram.summary?.rate)}</div>
                  <div className="text-[11px] text-slate-400">per successful referral</div>
                </div>
                <TrendingUp size={24} className="text-indigo-300" />
              </div>
              <p className="mt-3 text-[12px] leading-5 text-slate-500">Your current slab rate is applied to all successful CRM referrals when calculating total earnings.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[17px] font-semibold text-slate-950">Slab Structure</h2>
            <p className="mt-1 text-[13px] text-slate-500">The rate increases with your total number of successful CRM referrals.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {(rewardProgram.slabs || []).map((slab) => {
                const active = rewardProgram.summary?.slab?.key === slab.key;
                return (
                  <div key={slab.key} className={`rounded-xl border p-4 ${active ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-slate-50/60"}`}>
                    <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{slab.label} successful referrals</div>
                    <div className="mt-2 text-[24px] font-bold text-slate-950">{money(slab.rate)}</div>
                    <div className="text-[12px] text-slate-500">per successful referral</div>
                    {active && <div className="mt-3 inline-flex rounded-full bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white">Current slab</div>}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-900">
              Earnings unlock only after the referred customer joins or purchases Bispun CRM using your referral code. Pending enquiries do not earn rewards.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 size={17} className="text-indigo-600" />
              <h2 className="text-[17px] font-semibold text-slate-950">Payout History</h2>
            </div>
            {(rewardProgram.payouts || []).length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-[13px] text-slate-500">No payout requests yet.</div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr><th className="px-2 py-3">Requested</th><th className="px-2 py-3">Amount</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Payment reference</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rewardProgram.payouts.map((item) => (
                      <tr key={item.id}>
                        <td className="px-2 py-3 text-slate-600">{new Date(item.requestedAt).toLocaleDateString("en-IN")}</td>
                        <td className="px-2 py-3 font-semibold text-slate-900">{money(item.amount)}</td>
                        <td className="px-2 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${payoutStatusClass(item.status)}`}>{item.status}</span></td>
                        <td className="px-2 py-3 text-slate-500">{item.paymentReference || item.adminNote || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[17px] font-semibold text-slate-950">Successful CRM Referrals</h2>
            {(rewardProgram.referrals || []).length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-[13px] text-slate-500">No successful CRM purchases through your referral code yet.</div>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {rewardProgram.referrals.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="text-[14px] font-semibold text-slate-900">{item.company?.name || "Bispun client"}</div>
                      <div className="mt-0.5 text-[12px] text-slate-500">{item.company?.planName || "CRM plan"}</div>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">Successful</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
