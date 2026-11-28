import { useEffect, useRef, useState } from "react";
import { MoreVertical, Award, Clock3, CheckCircle2 } from "lucide-react";

import { apiRequest } from "../../lib/api";
import ReferralHome from "./ReferralHome";
import MyReferrals from "./MyReferrals";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

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
  const [earningsMenuOpen, setEarningsMenuOpen] = useState(false);
  const earningsMenuRef = useRef(null);
  const earningsTriggerRef = useRef(null);

  // Earnings disclosure: close on outside-click; Escape closes + returns focus
  // to the ⋮ trigger (WAI-ARIA disclosure correctness).
  useEffect(() => {
    if (!earningsMenuOpen) return undefined;
    function onDocMouseDown(e) {
      if (earningsMenuRef.current && !earningsMenuRef.current.contains(e.target)) {
        setEarningsMenuOpen(false);
      }
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setEarningsMenuOpen(false);
        earningsTriggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [earningsMenuOpen]);

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

  const summary = rewardProgram?.summary || {};
  const earned = summary.earned ?? summary.totalEarnings ?? 0;
  const credited = summary.credited ?? 0;
  const pendingCredit = summary.pendingCredit ?? Math.max(0, earned - credited);
  const successful = summary.successfulCount ?? 0;
  const expect = rewardProgram?.creditExpectationDays || { min: 5, max: 8 };
  const paidCount = (rewardProgram?.payouts || []).filter((p) => p.status === "PAID").length;
  const earningsItems = [
    {
      label: "Total earned",
      value: money(earned),
      icon: Award,
      tone: "bg-brand-50 text-brand-600",
      sub: `From ${successful} successful referral${successful === 1 ? "" : "s"}`,
    },
    {
      label: "Awaiting credit",
      value: money(pendingCredit),
      icon: Clock3,
      tone: "bg-amber-50 text-amber-600",
      sub: `Expected in ${expect.min}–${expect.max} days`,
    },
    {
      label: "Credited to you",
      value: money(credited),
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-600",
      sub: `${paidCount} payment${paidCount === 1 ? "" : "s"} received`,
    },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-600">Rewards</div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-slate-900">Referrals</h1>
        </div>
        <div className="flex items-center gap-2">
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

          {/* Earnings summary — ⋮ disclosure beside the view tabs */}
          <div className="relative shrink-0" ref={earningsMenuRef}>
            <button
              type="button"
              ref={earningsTriggerRef}
              onClick={() => setEarningsMenuOpen((o) => !o)}
              aria-expanded={earningsMenuOpen}
              aria-label="Earnings summary"
              className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <MoreVertical size={18} aria-hidden="true" />
            </button>

            {earningsMenuOpen ? (
              <div
                role="group"
                aria-label="Earnings summary"
                className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.18)]"
              >
                {earningsItems.map((m, i) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setEarningsMenuOpen(false);
                        setTab("program");
                        requestAnimationFrame(() => tabRefs.current.program?.focus());
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <span className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg ${m.tone}`} aria-hidden="true">
                        <Icon size={16} strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-slate-600">{m.label}</span>
                        <span className="block truncate text-[11px] text-slate-400">{m.sub}</span>
                      </span>
                      <span className="shrink-0 text-[14px] font-bold tabular-nums text-slate-900">{m.value}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
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
