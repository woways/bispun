import { useEffect, useRef, useState } from "react";

import { apiRequest } from "../../lib/api";
import ReferralHome from "./ReferralHome";
import MyReferrals from "./MyReferrals";

// Map legacy ?tab= values (home/referrals/earnings) onto the two-tab layout so
// old links / notifications keep working.
function normalizeTab(requested) {
  if (requested === "leads" || requested === "referrals") return "leads";
  return "program";
}

const TABS = [
  { key: "program", label: "Referral program" },
  { key: "leads", label: "My Referrals" },
];

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

  const tabRefs = useRef({});

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

  // Tabs pattern keyboard support (roving tabindex + Arrow/Home/End).
  function onTabKeyDown(e) {
    const order = TABS.map((t) => t.key);
    const i = order.indexOf(tab);
    let ni = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") ni = (i + 1) % order.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") ni = (i - 1 + order.length) % order.length;
    else if (e.key === "Home") ni = 0;
    else if (e.key === "End") ni = order.length - 1;
    if (ni < 0) return;
    e.preventDefault();
    const key = order[ni];
    setTab(key);
    tabRefs.current[key]?.focus();
  }

  const activeTab = TABS.find((t) => t.key === tab) || TABS[0];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-600">Rewards</div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-slate-900">Referrals</h1>
        </div>
        <div role="tablist" aria-label="Referral views" onKeyDown={onTabKeyDown} className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  tabRefs.current[t.key] = el;
                }}
                role="tab"
                id={`reftab-${t.key}`}
                aria-selected={on}
                aria-controls={`refpanel-${t.key}`}
                tabIndex={on ? 0 : -1}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
                  on ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* One panel at a time. The keyed wrapper gives a reduced-motion-safe fade on
          switch; focus stays on the activated tab (not pulled into the panel). */}
      <div
        key={tab}
        role="tabpanel"
        id={`refpanel-${activeTab.key}`}
        aria-labelledby={`reftab-${activeTab.key}`}
        tabIndex={0}
        className="cb-fade-in focus-visible:outline-none"
      >
        {tab === "program" ? (
          <ReferralHome currentUser={currentUser} code={code} rewardProgram={rewardProgram} />
        ) : (
          <MyReferrals currentUser={currentUser} />
        )}
      </div>
    </div>
  );
}
