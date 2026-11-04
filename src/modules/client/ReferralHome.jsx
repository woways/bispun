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
    <div className="mx-auto max-w-[900px] space-y-7 cb-fade-in">
      {/* EARNINGS HERO */}
      <section className="cb-fade-in-up">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-[13px] font-bold text-indigo-700">
            {initialsOf(currentUser?.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14.5px] font-semibold text-slate-900">
                {currentUser?.name || "You"}
              </span>
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
                Active referrer
              </span>
            </div>
            <div className="text-[12px] text-slate-500">
              {currentUser?.jobTitle || currentUser?.department || "Referrer"}
            </div>
          </div>
        </div>

        <div className="mt-5 text-[13px] text-slate-500">Total earned</div>
        <div className="mt-1 text-[clamp(34px,6vw,46px)] font-bold leading-none tracking-[-0.02em] text-slate-900 tabular-nums">
          <Count to={totalEarned} money />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-[12px] text-slate-500">Available to redeem</div>
            <div className="mt-0.5 text-[16px] font-semibold text-emerald-700 tabular-nums">
              <Count to={redeemable} money />
            </div>
          </div>
          <div>
            <div className="text-[12px] text-slate-500">Successful referrals</div>
            <div className="mt-0.5 text-[16px] font-semibold text-slate-900 tabular-nums">
              {successful}
            </div>
          </div>
          <button
            type="button"
            onClick={onRedeem}
            disabled={redeemable <= 0}
            className="ml-auto inline-flex h-11 items-center rounded-xl bg-indigo-600 px-5 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,0.8)] transition hover:bg-indigo-700 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Redeem
          </button>
        </div>
      </section>

      <div className="h-px bg-slate-100" />

      {/* CODE + SHARE */}
      <section className="cb-fade-in-up">
        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Your referral code
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 py-3.5 pl-5 pr-3.5">
          <span className="truncate text-[15px] font-bold tracking-[0.14em] text-slate-900">
            {code || "…"}
          </span>
          <button
            type="button"
            onClick={() => copy(code, "code")}
            aria-label="Copy referral code"
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {copied === "code" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied === "code" ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Check this out: ${link}`)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 flex-1 basis-[200px] items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[14px] font-semibold text-white shadow-[0_8px_20px_-10px_rgba(79,70,229,0.8)] transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Share2 size={16} aria-hidden="true" />
            Share on WhatsApp
            <span className="sr-only"> (opens in new tab)</span>
          </a>
          <button
            type="button"
            onClick={() => copy(link, "link")}
            aria-label="Copy referral link"
            className="inline-flex h-12 flex-1 basis-[200px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {copied === "link" ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {copied === "link" ? "Link copied" : "Copy referral link"}
          </button>
        </div>
      </section>

      {/* STATS */}
      <section className="flex overflow-hidden rounded-2xl border border-slate-200 cb-fade-in-up">
        <StatCell icon={Users} tone="brand" value={stats?.total ?? 0} label="Total referrals" />
        <StatCell icon={CheckCircle2} tone="good" value={stats?.admitted ?? 0} label="Admitted" first={false} />
        <StatCell icon={Clock3} tone="warn" value={stats?.inProgress ?? 0} label="In progress" first={false} />
      </section>

      {/* TIERS (rendered from backend reward slabs) */}
      {tier && (
      <section className="cb-fade-in-up">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[18px] font-bold tracking-[-0.01em] text-slate-900">
            Reward tiers
          </h2>
          {tier.active.max !== Infinity && (
            <span className="text-[13px] text-slate-500">
              {tier.toNext} more to{" "}
              {tiers[Math.min(tier.activeIndex + 1, tiers.length - 1)].name}
            </span>
          )}
        </div>
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
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
                <div className={`mt-0.5 text-[22px] font-bold tracking-[-0.01em] ${here ? "text-indigo-700" : "text-slate-900"}`}>
                  {money(t.amount)}
                </div>
                <div className={`text-[12.5px] ${here ? "font-semibold text-indigo-700" : "text-slate-500"}`}>
                  {t.name}{here ? " · current" : ""}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {/* RECENT REFERRALS */}
      <section className="cb-fade-in-up">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.01em] text-slate-900">
              Recent referrals
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Where your latest referrals stand.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoReferrals}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-indigo-700 hover:gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            View all <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center text-[13.5px] text-slate-500">
            No referrals yet. Share your link to get started.
          </div>
        ) : (
          <div className="mt-3">
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
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[12px] font-semibold text-indigo-700">
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
      </section>
    </div>
  );
}

function StatCell({ icon: Icon, tone, value, label, first = true }) {
  const iconCls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-600"
      : tone === "warn"
      ? "bg-amber-50 text-amber-600"
      : "bg-indigo-50 text-indigo-600";
  const valueCls =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
      ? "text-amber-700"
      : "text-slate-900";
  return (
    <div className={`flex-1 px-4 py-4 sm:px-5 ${first ? "" : "border-l border-slate-200"}`}>
      <span className={`mb-3 flex h-8 w-8 items-center justify-center rounded-[9px] ${iconCls}`}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className={`text-[24px] font-bold tracking-[-0.01em] tabular-nums ${valueCls}`}>
        <Count to={value} />
      </div>
      <div className="text-[12.5px] text-slate-500">{label}</div>
    </div>
  );
}
