import { useEffect, useState } from "react";

import { apiRequest } from "../../lib/api";
import ReferralHome from "./ReferralHome";
import MyReferrals from "./MyReferrals";

// Map legacy ?tab= values (home/referrals/earnings) onto the two-tab layout so
// old links / notifications keep working.
function normalizeTab(requested) {
  if (requested === "leads" || requested === "referrals") return "leads";
  return "program";
}

export default function Referrals({ currentUser }) {
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "program";
    return normalizeTab(new URLSearchParams(window.location.search).get("tab"));
  });
  const [code, setCode] = useState("");
  const [rewardProgram, setRewardProgram] = useState({
    slabs: [],
    creditExpectationDays: { min: 5, max: 8 },
    summary: {
      successfulCount: 0,
      rate: 0,
      totalEarnings: 0,
      earned: 0,
      credited: 0,
      pendingCredit: 0,
      slab: null,
    },
    referrals: [],
    payouts: [],
  });

  async function loadSummary() {
    try {
      const data = await apiRequest("/api/client/referrals/me");
      setCode(data.code || "");
      if (data.rewardProgram) setRewardProgram(data.rewardProgram);
    } catch {
      // Keep the page usable if the referral summary request fails.
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tab === "program") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", tab);
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [tab]);

  const TABS = [
    { key: "program", label: "Referral program" },
    { key: "leads", label: "My Referrals" },
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
              aria-current={tab === t.key ? "page" : undefined}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${
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

      {tab === "program" && (
        <ReferralHome currentUser={currentUser} code={code} rewardProgram={rewardProgram} />
      )}

      {tab === "leads" && <MyReferrals currentUser={currentUser} />}
    </div>
  );
}
