import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  Link2,
  Share2,
  Users,
  CheckCircle2,
  Clock3,
  BadgeIndianRupee,
  Wallet,
  Award,
  ChevronRight,
  ChevronDown,
  Lock,
  Search,
} from "lucide-react";

import { buildReferralSignupUrl } from "../../lib/referralLink";

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function initialsOf(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

// Reward tiers come from the backend reward program (never hardcoded) so the UI
// always reflects the approved business rules.
function slabsToTiers(slabs) {
  return (Array.isArray(slabs) ? slabs : []).map((s) => ({
    range: s.label ?? (s.max == null ? `${s.min}+` : `${s.min}–${s.max}`),
    amount: Number(s.rate) || 0,
    key: s.key,
  }));
}

// Public QR service (no key). The referral link is non-sensitive.
function qrUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`;
}

const STAGES = [
  { key: "link", label: "Link", icon: Link2 },
  { key: "referred", label: "Referred", icon: Users },
  { key: "earned", label: "Earned", icon: BadgeIndianRupee },
  { key: "credited", label: "Credited", icon: Wallet },
];

const CARD = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function ReferralHome({ currentUser, code, rewardProgram }) {
  const [active, setActive] = useState("link");
  const [refSearch, setRefSearch] = useState("");
  const [copied, setCopied] = useState("");
  // Always-mounted live region for clipboard feedback (WCAG 4.1.3).
  const [copiedMsg, setCopiedMsg] = useState("");
  const copyTimerRef = useRef(0);
  const tabRefs = useRef({});

  const summary = rewardProgram?.summary || {};
  const successful = summary.successfulCount ?? 0;
  const earned = summary.earned ?? summary.totalEarnings ?? 0;
  const credited = summary.credited ?? 0;
  const pendingCredit = summary.pendingCredit ?? Math.max(0, earned - credited);
  const tiers = slabsToTiers(rewardProgram?.slabs);
  const activeSlabKey = summary.slab?.key;
  const expect = rewardProgram?.creditExpectationDays || { min: 5, max: 8 };

  const referred = rewardProgram?.referrals || [];
  const refQ = refSearch.trim().toLowerCase();
  const shownReferred = referred.filter((item) => {
    if (!refQ) return true;
    const name = item.company?.name || item.referredName || "";
    const plan = item.company?.planName || "";
    return [name, plan].some((v) => String(v || "").toLowerCase().includes(refQ));
  });
  const creditedHistory = (rewardProgram?.payouts || []).filter((p) => p.status === "PAID");

  // Configurable base (never hard-coded to prod); empty when there's no code so
  // all share/copy controls stay disabled until a code exists.
  const link = code
    ? buildReferralSignupUrl({
        configuredBase: import.meta.env.VITE_PUBLIC_SIGNUP_URL,
        origin: typeof window !== "undefined" ? window.location.origin : "",
        code,
      })
    : "";

  useEffect(() => () => window.clearTimeout(copyTimerRef.current), []);

  function copy(text, which, label) {
    if (!text) return;
    const onSuccess = () => {
      setCopied(which);
      setCopiedMsg(`${label} copied`);
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => {
        setCopied("");
        setCopiedMsg("");
      }, 1600);
    };
    const onFailure = (error) => {
      console.error("Unable to copy referral value:", error);
      setCopied("");
      setCopiedMsg(`Could not copy ${label.toLowerCase()}`);
    };
    try {
      const result = navigator.clipboard?.writeText(text);
      if (result && typeof result.then === "function") result.then(onSuccess).catch(onFailure);
      else onSuccess();
    } catch (error) {
      onFailure(error);
    }
  }

  const stageStatus = {
    link: code ? "Shared" : "Set up",
    referred: `${referred.length} joined`,
    earned: money(earned),
    credited: `${money(credited)} / ${money(earned)}`,
  };

  // Tabs pattern keyboard support (WAI-ARIA APG): Arrow keys + Home/End with
  // roving tabindex and automatic activation.
  function onTabKeyDown(e) {
    const order = STAGES.map((s) => s.key);
    const i = order.indexOf(active);
    let ni = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") ni = (i + 1) % order.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") ni = (i - 1 + order.length) % order.length;
    else if (e.key === "Home") ni = 0;
    else if (e.key === "End") ni = order.length - 1;
    if (ni < 0) return;
    e.preventDefault();
    const key = order[ni];
    setActive(key);
    tabRefs.current[key]?.focus();
  }

  return (
    <div className="space-y-5">
      {/* Always-mounted live region for clipboard feedback. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copiedMsg}
      </span>

      {/* STAGE SWITCHER (Tabs) — top content block */}
      <div role="tablist" aria-label="Referral stages" onKeyDown={onTabKeyDown} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {STAGES.map((s) => {
          const Icon = s.icon;
          const on = active === s.key;
          return (
            <button
              key={s.key}
              ref={(el) => {
                tabRefs.current[s.key] = el;
              }}
              role="tab"
              id={`rstab-${s.key}`}
              aria-selected={on}
              aria-controls={`rspanel-${s.key}`}
              tabIndex={on ? 0 : -1}
              type="button"
              onClick={() => setActive(s.key)}
              className={`flex min-h-[116px] flex-col gap-2 rounded-2xl border p-3.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                on ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span
                  className={`grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl ${
                    on ? "bg-brand-600 text-white" : "bg-slate-100 text-brand-600"
                  }`}
                  aria-hidden="true"
                >
                  <Icon size={18} />
                </span>
                <span className="text-right text-[12px] font-bold text-brand-700">{stageStatus[s.key]}</span>
              </span>
              <span className="text-[13.5px] font-semibold text-slate-900">{s.label}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-brand-700">
                {on ? (
                  <>
                    Showing <ChevronDown size={13} aria-hidden="true" />
                  </>
                ) : (
                  <>
                    View details <ChevronRight size={13} aria-hidden="true" />
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* STAGE 1 — LINK */}
      <section
        role="tabpanel"
        id="rspanel-link"
        aria-labelledby="rstab-link"
        tabIndex={0}
        hidden={active !== "link"}
        className={`${CARD} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
      >
        <h2 className="text-[17px] font-semibold text-slate-950">Your referral link</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Copy your unique link or code and share it. When a business signs up for Bispun CRM with it, they appear under
          <span className="font-semibold text-slate-700"> Referred</span>.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Referral code</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[16px] font-bold tracking-[0.12em] text-slate-900">{code || "…"}</span>
            <button
              type="button"
              onClick={() => copy(code, "code", "Referral code")}
              disabled={!code}
              aria-label="Copy referral code"
              className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copied === "code" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-3 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600">
            {link || "Your link will appear here"}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={link ? `https://wa.me/?text=${encodeURIComponent(`Join Bispun CRM: ${link}`)}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={link ? undefined : "true"}
            className={`inline-flex h-11 flex-1 basis-[200px] items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
              link ? "bg-brand-600 hover:bg-brand-700" : "pointer-events-none bg-slate-300"
            }`}
          >
            <Share2 size={16} aria-hidden="true" />
            Share on WhatsApp
            <span className="sr-only"> (opens in new tab)</span>
          </a>
          <button
            type="button"
            onClick={() => copy(link, "link", "Referral link")}
            disabled={!link}
            aria-label="Copy referral link"
            className="inline-flex h-11 flex-1 basis-[200px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-[14px] font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copied === "link" ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {copied === "link" ? "Link copied" : "Copy referral link"}
          </button>
        </div>

        {/* Scan to refer */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 native:flex-nowrap">
          <div className="flex-shrink-0 rounded-xl border border-slate-200 bg-white p-2">
            {link ? (
              <img src={qrUrl(link)} alt="QR code linking to your referral signup page" width="104" height="104" className="rounded" />
            ) : (
              <div className="grid h-[104px] w-[104px] place-items-center text-slate-300">
                <Link2 size={32} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-slate-900">Scan to refer</div>
            <p className="mt-1 text-[12.5px] text-slate-500">
              Point a phone camera at this code to open your signup link — handy in person or on a printed flyer.
            </p>
          </div>
        </div>
      </section>

      {/* STAGE 2 — REFERRED */}
      <section
        role="tabpanel"
        id="rspanel-referred"
        aria-labelledby="rstab-referred"
        tabIndex={0}
        hidden={active !== "referred"}
        className={`${CARD} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-slate-950">
              Referred <span className="text-[14px] font-medium text-slate-500">({referred.length})</span>
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              <span className="font-semibold text-slate-700">Referred</span> = signed up with your link ·{" "}
              <span className="font-semibold text-slate-700">Earned</span> = activated, so a reward is yours.
            </p>
          </div>
          {referred.length > 0 && (
            <div className="relative w-full sm:w-auto">
              <label htmlFor="referred-search" className="sr-only">Search referred businesses</label>
              <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="referred-search"
                type="search"
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                placeholder="Search businesses"
                className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 text-[13px] outline-none transition focus:border-brand-400 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:w-56"
              />
            </div>
          )}
        </div>

        {/* Always-mounted polite live region: result count */}
        <span role="status" aria-live="polite" className="sr-only">
          {`${shownReferred.length} referred ${shownReferred.length === 1 ? "business" : "businesses"} shown`}
        </span>

        {referred.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Users size={22} aria-hidden="true" />
            </span>
            <div className="mt-3 text-[14px] font-semibold text-slate-800">No referrals yet</div>
            <p className="mt-1 max-w-xs text-[12.5px] text-slate-500">
              Share your referral link — businesses that sign up with it will appear here.
            </p>
          </div>
        ) : shownReferred.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-[13px] text-slate-500">
            No businesses match your search.
          </div>
        ) : (
          <div
            className="mt-3 overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            tabIndex={0}
            role="group"
            aria-label="Referred businesses (scrollable)"
          >
            <table className="w-full min-w-[560px] text-[13px]">
              <caption className="sr-only">Referred businesses: name, plan, joined date and status</caption>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Business</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Plan</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Joined</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shownReferred.map((item) => {
                  const isEarned = item.status === "EARNED";
                  const displayName = item.company?.name || item.referredName || "New signup";
                  const plan = isEarned ? (item.company?.planName || "CRM plan") : "—";
                  const joined = formatDate(isEarned ? (item.qualifiedAt || item.createdAt) : item.createdAt);
                  return (
                    <tr key={item.id} className="group transition-colors hover:bg-slate-50/80">
                      <th scope="row" className="px-4 py-3 text-left font-normal">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-semibold text-brand-700">
                            {initialsOf(displayName)}
                          </span>
                          <span className="font-semibold text-slate-900">{displayName}</span>
                        </div>
                      </th>
                      <td className={`px-4 py-3 ${plan === "—" ? "text-slate-300" : "text-slate-600"}`}>{plan}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{joined}</td>
                      <td className="px-4 py-3">
                        {isEarned ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                            <CheckCircle2 size={12} aria-hidden="true" /> Earned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                            <Clock3 size={12} aria-hidden="true" /> Referred
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* STAGE 3 — EARNED */}
      <section
        role="tabpanel"
        id="rspanel-earned"
        aria-labelledby="rstab-earned"
        tabIndex={0}
        hidden={active !== "earned"}
        className={`${CARD} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
      >
        <h2 className="text-[17px] font-semibold text-slate-950">Earned</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-[22px] font-bold tabular-nums text-slate-950">{money(earned)}</div>
            <div className="text-[13px] text-slate-500">Total earned</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-[22px] font-bold tabular-nums text-slate-950">{successful}</div>
            <div className="text-[13px] text-slate-500">Successful referrals</div>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="text-[22px] font-bold tabular-nums text-brand-700">{money(summary.rate)}</div>
            <div className="text-[13px] text-slate-600">
              Current rate{summary.slab?.label ? ` · ${summary.slab.label}` : ""}
            </div>
          </div>
        </div>

        {tiers.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Reward slabs</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {tiers.map((t) => {
                const activeTier = t.key === activeSlabKey;
                return (
                  <div
                    key={t.key}
                    className={`rounded-xl border p-3 ${
                      activeTier ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="text-[12px] font-bold uppercase tracking-wide text-slate-600">{t.range} referrals</div>
                    <div className="mt-1 text-[20px] font-bold text-slate-950">{money(t.amount)}</div>
                    <div className="text-[12px] text-slate-500">per successful referral</div>
                    {activeTier && (
                      <div className="mt-2 inline-flex rounded-full bg-brand-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                        Current slab
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[12.5px] leading-5 text-slate-600">
          Rewards unlock only after a referred business <span className="font-semibold text-slate-800">activates</span> Bispun
          CRM with your code. Signups that haven’t paid don’t earn a reward yet.
        </div>
      </section>

      {/* STAGE 4 — CREDITED */}
      <section
        role="tabpanel"
        id="rspanel-credited"
        aria-labelledby="rstab-credited"
        tabIndex={0}
        hidden={active !== "credited"}
        className={`${CARD} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500`}
      >
        <h2 className="text-[17px] font-semibold text-slate-950">Credited</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-brand-700">
              <CheckCircle2 size={16} aria-hidden="true" /> Credited to you
            </div>
            <div className="mt-2 text-[24px] font-bold tabular-nums text-brand-700">{money(credited)}</div>
            <div className="mt-0.5 text-[12px] text-slate-500">
              {creditedHistory.length} payment{creditedHistory.length === 1 ? "" : "s"} received
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
              <Clock3 size={16} aria-hidden="true" /> Awaiting credit
            </div>
            <div className="mt-2 text-[24px] font-bold tabular-nums text-slate-900">{money(pendingCredit)}</div>
            {pendingCredit > 0 && (
              <div className="mt-0.5 text-[12px] text-slate-500">
                Expected in about {expect.min}–{expect.max} days after verification.
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[12px] leading-5 text-slate-500">
          <Lock size={15} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-slate-400" />
          <span>
            Crediting is handled by the Bispun team — you can’t mark your own rewards as credited. You’ll get an{" "}
            <span className="font-semibold text-slate-700">“Amount credited”</span> notification when it’s done.
          </span>
        </div>

        <div className="mt-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Credit history</h3>
          {creditedHistory.length === 0 ? (
            <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-[13px] text-slate-500">
              No amounts credited yet.
            </div>
          ) : (
            <div
              className="mt-2 overflow-x-auto rounded-xl border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              tabIndex={0}
              role="group"
              aria-label="Credit history (scrollable)"
            >
              <table className="min-w-full text-left text-[13px]">
                <caption className="sr-only">Credit history: date credited, amount and reference</caption>
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Credited on</th>
                    <th scope="col" className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Amount</th>
                    <th scope="col" className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditedHistory.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 tabular-nums">{formatDate(item.paidAt || item.processedAt)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 tabular-nums">{money(item.amount)}</td>
                      <td className="px-4 py-3 text-slate-500">{item.paymentReference || item.adminNote || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
