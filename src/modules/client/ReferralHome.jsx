import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  Link2,
  Share2,
  Users,
  CheckCircle2,
  Clock3,
  ArrowRight,
  BadgeIndianRupee,
  Wallet,
} from "lucide-react";

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

// Reward tiers are derived from the backend reward program (rewardProgram.slabs,
// sourced from REFERRAL_SLABS on the server) — never hardcoded here — so the UI
// always reflects the approved business rules.
function slabsToTiers(slabs) {
  return (Array.isArray(slabs) ? slabs : []).map((s, i) => ({
    name: `Tier ${i + 1}`,
    range: s.label ?? (s.max == null ? `${s.min}+` : `${s.min}–${s.max}`),
    amount: Number(s.rate) || 0,
    min: Number(s.min) || 0,
    max: s.max == null ? Infinity : Number(s.max),
  }));
}

function tierInfo(successful, tiers) {
  if (!tiers.length) return null;
  const n = Number(successful) || 0;
  const idx = tiers.findIndex((t) => n >= t.min && n <= t.max);
  const activeIndex = n <= 0 ? 0 : idx === -1 ? tiers.length - 1 : idx;
  const active = tiers[activeIndex];
  const toNext = active.max === Infinity ? 0 : Math.max(0, active.max + 1 - n);
  const span = active.max === Infinity ? 1 : active.max - active.min + 1;
  const done = Math.min(span, Math.max(0, n - active.min + 1));
  const pct = active.max === Infinity ? 100 : Math.round((done / span) * 100);
  return { activeIndex, active, toNext, pct };
}

function referralStatus(item) {
  const stage = item?.lead?.stage ?? item?.stage;
  const isLost = item?.lead?.isLost ?? item?.isLost;
  if (isLost) return { label: "Lost", cls: "text-slate-500", dot: "bg-slate-300" };
  if (stage === "ADMITTED")
    return { label: "Admitted", cls: "text-emerald-700", dot: "bg-emerald-500" };
  return { label: "In progress", cls: "text-amber-700", dot: "bg-amber-500" };
}

function prefersReducedMotion() {
  try {
    return (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

// Lightweight count-up using requestAnimationFrame (no animation library).
// Honours prefers-reduced-motion by jumping straight to the final value.
function Count({ to, money: asMoney = false }) {
  const target = Number(to) || 0;
  const [v, setV] = useState(target);
  const rafRef = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setV(target);
      return undefined;
    }
    const duration = 900;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setV(from + (target - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return asMoney ? money(Math.round(v)) : Math.round(v).toLocaleString("en-IN");
}

const CARD = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function ReferralHome({
  currentUser,
  code,
  stats,
  rewardProgram,
  referrals = [],
  onGoReferrals,
  onRedeem,
}) {
  const [copied, setCopied] = useState("");

  const summary = rewardProgram?.summary || {};
  const successful = summary.successfulCount ?? stats?.admitted ?? 0;
  const totalEarned = summary.totalEarnings ?? 0;
  const redeemable = summary.availableToRedeem ?? 0;
  const tiers = slabsToTiers(rewardProgram?.slabs);
  const tier = tierInfo(successful, tiers);

  const link = code
    ? `https://www.bispun.com/?ref=${encodeURIComponent(code)}`
    : "";
  const recent = (referrals || []).slice(0, 4);

  function copy(text, which) {
    if (!text) return;
    try {
      navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied(""), 1400);
    } catch (error) {
      console.error("Unable to copy referral value:", error);
    }
  }

  return (
    <div className="space-y-5 cb-fade-in">
      {/* IDENTITY */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-700">
          {initialsOf(currentUser?.name)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-slate-900">
              {currentUser?.name || "You"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Active referrer
            </span>
          </div>
          <div className="text-[12px] text-slate-500">
            {currentUser?.jobTitle || currentUser?.department || "Referrer"}
          </div>
        </div>
      </div>

      {/* EARNINGS SUMMARY */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <div className={CARD}>
          <BadgeIndianRupee size={18} aria-hidden="true" className="text-indigo-600" />
          <div className="mt-3 text-[20px] sm:text-[28px] font-bold break-words tabular-nums text-slate-950">
            <Count to={totalEarned} money />
          </div>
          <div className="text-[13px] text-slate-500">Total earned</div>
        </div>

        <div className={CARD}>
          <CheckCircle2 size={18} aria-hidden="true" className="text-emerald-600" />
          <div className="mt-3 text-[20px] sm:text-[28px] font-bold break-words tabular-nums text-slate-950">
            <Count to={successful} />
          </div>
          <div className="text-[13px] text-slate-500">Successful referrals</div>
        </div>

        <div className="col-span-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 shadow-sm lg:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Wallet size={18} aria-hidden="true" className="text-indigo-600" />
              <div className="mt-3 text-[20px] sm:text-[28px] font-bold break-words tabular-nums text-indigo-700">
                <Count to={redeemable} money />
              </div>
              <div className="text-[13px] text-slate-600">Available to redeem</div>
            </div>
            <button
              type="button"
              onClick={onRedeem}
              disabled={redeemable <= 0}
              className="inline-flex h-9 flex-shrink-0 items-center rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Redeem
            </button>
          </div>
        </div>
      </div>

      {/* SHARE & EARN */}
      <div className={CARD}>
        <h2 className="text-[17px] font-semibold text-slate-950">Share &amp; earn</h2>
        <p className="mt-1 text-[13px] text-slate-500">Copy your code or link and share it anywhere.</p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Referral code</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[16px] font-bold tracking-[0.12em] text-slate-900">
              {code || "…"}
            </span>
            <button
              type="button"
              onClick={() => copy(code, "code")}
              aria-label="Copy referral code"
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {copied === "code" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Check this out: ${link}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 flex-1 basis-[200px] items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[14px] font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Share2 size={16} aria-hidden="true" />
            Share on WhatsApp
            <span className="sr-only"> (opens in new tab)</span>
          </a>
          <button
            type="button"
            onClick={() => copy(link, "link")}
            aria-label="Copy referral link"
            className="inline-flex h-11 flex-1 basis-[200px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {copied === "link" ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {copied === "link" ? "Link copied" : "Copy referral link"}
          </button>
        </div>
      </div>

      {/* PIPELINE + REWARD TIERS (side by side) */}
      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        {/* REFERRAL PIPELINE */}
        <div className={CARD}>
          <h2 className="text-[17px] font-semibold text-slate-950">Referral pipeline</h2>
          <p className="mt-1 text-[13px] text-slate-500">How your referrals are progressing.</p>
          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100">
            <PipelineCell icon={Users} tone="brand" value={stats?.total ?? 0} label="Total referrals" />
            <PipelineCell icon={CheckCircle2} tone="good" value={stats?.admitted ?? 0} label="Admitted" />
            <PipelineCell icon={Clock3} tone="warn" value={stats?.inProgress ?? 0} label="In progress" />
          </div>
        </div>

        {/* REWARD TIERS (rendered from backend reward slabs) */}
        {tier && (
          <div className={CARD}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[17px] font-semibold text-slate-950">Reward tiers</h2>
              {tier.active.max !== Infinity && (
                <span className="text-[13px] text-slate-500">
                  {tier.toNext} more to{" "}
                  {tiers[Math.min(tier.activeIndex + 1, tiers.length - 1)].name}
                </span>
              )}
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${tier.pct}%` }}
              />
            </div>
            <div className="mt-4 grid grid-cols-3">
              {tiers.map((t, i) => {
                const here = i === tier.activeIndex;
                return (
                  <div key={t.name} className="border-l border-slate-100 px-4 first:border-l-0 first:pl-0">
                    <div className="text-[12px] text-slate-500">{t.range}</div>
                    <div className={`mt-0.5 text-[20px] sm:text-[22px] font-bold tracking-[-0.01em] ${here ? "text-indigo-700" : "text-slate-900"}`}>
                      {money(t.amount)}
                    </div>
                    <div className={`text-[12.5px] ${here ? "font-semibold text-indigo-700" : "text-slate-500"}`}>
                      {t.name}{here ? " · current" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RECENT REFERRALS */}
      <div className={CARD}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-slate-950">Recent referrals</h2>
            <p className="mt-1 text-[13px] text-slate-500">Where your latest referrals stand.</p>
          </div>
          <button
            type="button"
            onClick={onGoReferrals}
            className="inline-flex flex-shrink-0 items-center gap-1 rounded text-[13px] font-semibold text-indigo-700 hover:gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            View all <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-[13px] text-slate-500">
            No referrals yet. Share your link to get started.
          </div>
        ) : (
          <div className="mt-2">
            {recent.map((r, i) => {
              const lead = r?.lead ?? r ?? {};
              const name = lead.name ?? "—";
              const course = lead.course ?? "";
              const phone = lead.phone ?? "";
              const sub = [phone, course].filter(Boolean).join(" · ");
              const st = referralStatus(r);
              return (
                <div
                  key={lead.id ?? r.id ?? i}
                  className="flex items-center gap-3.5 border-t border-slate-100 py-3.5 first:border-t-0"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-600">
                    {initialsOf(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-slate-900">{name}</div>
                    {sub && <div className="truncate text-[12px] text-slate-500">{sub}</div>}
                  </div>
                  <span className={`inline-flex flex-shrink-0 items-center gap-1.5 text-[12.5px] font-semibold ${st.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} aria-hidden="true" />
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineCell({ icon: Icon, tone, value, label }) {
  const iconCls =
    tone === "good"
      ? "text-emerald-600"
      : tone === "warn"
      ? "text-amber-600"
      : "text-indigo-600";
  const valueCls =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-amber-700"
      : "text-slate-950";
  return (
    <div className="px-4 first:pl-0 last:pr-0">
      <Icon size={18} aria-hidden="true" className={iconCls} />
      <div className={`mt-3 text-[22px] sm:text-[26px] font-bold tracking-[-0.01em] tabular-nums ${valueCls}`}>
        <Count to={value} />
      </div>
      <div className="text-[12.5px] text-slate-500">{label}</div>
    </div>
  );
}
