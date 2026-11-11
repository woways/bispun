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

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// Reward tiers come from the backend reward program (rewardProgram.slabs,
// sourced from REFERRAL_SLABS on the server) — never hardcoded here — so the UI
// always reflects the approved business rules.
function slabsToTiers(slabs) {
  return (Array.isArray(slabs) ? slabs : []).map((s) => ({
    range: s.label ?? (s.max == null ? `${s.min}+` : `${s.min}–${s.max}`),
    amount: Number(s.rate) || 0,
    key: s.key,
  }));
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
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setV(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return asMoney ? money(Math.round(v)) : Math.round(v).toLocaleString("en-IN");
}

const CARD = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function ReferralHome({ currentUser, code, rewardProgram }) {
  const [copied, setCopied] = useState("");
  // Persistent (always-mounted) live region text for screen-reader clipboard
  // feedback — a late-inserted aria-live region is unreliable (WCAG 4.1.3).
  const [copiedMsg, setCopiedMsg] = useState("");
  const copyTimerRef = useRef(0);

  const summary = rewardProgram?.summary || {};
  const successful = summary.successfulCount ?? 0;
  const earned = summary.earned ?? summary.totalEarnings ?? 0;
  const credited = summary.credited ?? 0;
  const pendingCredit = summary.pendingCredit ?? Math.max(0, earned - credited);
  const tiers = slabsToTiers(rewardProgram?.slabs);
  const activeSlabKey = summary.slab?.key;
  const expect = rewardProgram?.creditExpectationDays || { min: 5, max: 8 };

  const referred = rewardProgram?.referrals || [];
  const creditedHistory = (rewardProgram?.payouts || []).filter((p) => p.status === "PAID");

  const link = code ? `https://www.bispun.com/?ref=${encodeURIComponent(code)}` : "";

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
      // Await the async clipboard write so success is announced only on success.
      const result = navigator.clipboard?.writeText(text);
      if (result && typeof result.then === "function") {
        result.then(onSuccess).catch(onFailure);
      } else {
        onSuccess();
      }
    } catch (error) {
      onFailure(error);
    }
  }

  // Stepper navigation: move focus (not just scroll) to the target section so
  // keyboard and screen-reader users land inside it (WCAG 2.4.3).
  function goToStage(key) {
    const el = document.getElementById(`referral-stage-${key}`);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }

  const steps = [
    { key: "link", label: "Referral link", value: "Share to start", icon: Link2, done: Boolean(code) },
    { key: "referred", label: "Referred", value: `${referred.length} joined`, icon: Users, done: referred.length > 0 },
    { key: "earned", label: "Earned", value: money(earned), icon: BadgeIndianRupee, done: earned > 0 },
    { key: "credited", label: "Credited", value: money(credited), icon: Wallet, done: credited > 0 },
  ];
  // First not-yet-done stage = the "current" step in the journey.
  const currentStepIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="space-y-5 cb-fade-in">
      {/* Always-mounted live region for clipboard feedback (WCAG 4.1.3). */}
      <span role="status" aria-live="polite" className="sr-only">
        {copiedMsg}
      </span>

      {/* IDENTITY */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[13px] font-bold text-slate-700">
          {initialsOf(currentUser?.name)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-slate-900">{currentUser?.name || "You"}</span>
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

      {/* JOURNEY STEPPER — premium 4-stage cards with completed / current /
          upcoming states. State is conveyed by icon + text, never colour alone. */}
      <nav aria-label="Referral journey">
        <ol className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isCurrent = i === currentStepIndex;
            const stateText = step.done ? "completed" : isCurrent ? "current step" : "upcoming";
            return (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={() => goToStage(step.key)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    step.done
                      ? "border-indigo-200 bg-indigo-50/50"
                      : isCurrent
                      ? "border-indigo-300 bg-white ring-1 ring-indigo-200"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span
                    className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                      step.done || isCurrent ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {step.done && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                        <Check size={10} aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-slate-900">
                      {step.label}
                      {isCurrent && (
                        <span className="ml-1.5 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                          Now
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-slate-500">{step.value}</span>
                    <span className="sr-only"> — {stateText}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* STAGE 1 — REFERRAL LINK */}
      <section
        id="referral-stage-link"
        tabIndex={-1}
        aria-labelledby="stage-link-title"
        className={`${CARD} scroll-mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
      >
        <div className="flex items-center gap-2">
          <Link2 size={18} aria-hidden="true" className="text-indigo-600" />
          <h2 id="stage-link-title" className="text-[17px] font-semibold text-slate-950">
            1 · Your referral link
          </h2>
        </div>
        <p className="mt-1 text-[13px] text-slate-500">
          Share your link or code. When a business signs up for Bispun CRM using it, they appear under
          <span className="font-semibold text-slate-700"> Referred</span> and you start earning a reward.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Referral code</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="truncate text-[16px] font-bold tracking-[0.12em] text-slate-900">{code || "…"}</span>
            <button
              type="button"
              onClick={() => copy(code, "code", "Referral code")}
              disabled={!code}
              aria-label="Copy referral code"
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copied === "code" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied === "code" ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <a
            href={link ? `https://wa.me/?text=${encodeURIComponent(`Check this out: ${link}`)}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={link ? undefined : "true"}
            className={`inline-flex h-11 flex-1 basis-[200px] items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              link ? "bg-indigo-600 hover:bg-indigo-700" : "pointer-events-none bg-slate-300"
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
            className="inline-flex h-11 flex-1 basis-[200px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.98] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {copied === "link" ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {copied === "link" ? "Link copied" : "Copy referral link"}
          </button>
        </div>
      </section>

      {/* STAGE 2 — REFERRED */}
      <section
        id="referral-stage-referred"
        tabIndex={-1}
        aria-labelledby="stage-referred-title"
        className={`${CARD} scroll-mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
      >
        <div className="flex items-center gap-2">
          <Users size={18} aria-hidden="true" className="text-indigo-600" />
          <h2 id="stage-referred-title" className="text-[17px] font-semibold text-slate-950">
            2 · Referred <span className="text-[14px] font-medium text-slate-500">({referred.length})</span>
          </h2>
        </div>
        <p className="mt-1 text-[13px] text-slate-500">Businesses that signed up for Bispun CRM using your link.</p>

        {referred.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <Users size={22} aria-hidden="true" />
            </span>
            <div className="mt-3 text-[14px] font-semibold text-slate-800">No referrals yet</div>
            <p className="mt-1 max-w-xs text-[12.5px] text-slate-500">
              Share your referral link — businesses that sign up with it will appear here.
            </p>
            <button
              type="button"
              onClick={() => copy(link, "link", "Referral link")}
              disabled={!link}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Link2 size={15} aria-hidden="true" />
              Copy referral link
            </button>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {referred.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-600">
                    {initialsOf(item.company?.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-slate-900">
                      {item.company?.name || "Bispun client"}
                    </div>
                    <div className="mt-0.5 text-[12px] text-slate-500">
                      {item.company?.planName || "CRM plan"} · Joined {formatDate(item.qualifiedAt || item.createdAt)}
                    </div>
                  </div>
                </div>
                <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 size={12} aria-hidden="true" /> Qualified
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* STAGE 3 — EARNED */}
      <section
        id="referral-stage-earned"
        tabIndex={-1}
        aria-labelledby="stage-earned-title"
        className={`${CARD} scroll-mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
      >
        <div className="flex items-center gap-2">
          <BadgeIndianRupee size={18} aria-hidden="true" className="text-indigo-600" />
          <h2 id="stage-earned-title" className="text-[17px] font-semibold text-slate-950">
            3 · Earned
          </h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[20px] sm:text-[26px] font-bold tabular-nums text-slate-950">
              <Count to={earned} money />
            </div>
            <div className="text-[13px] text-slate-500">Total earned</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-[20px] sm:text-[26px] font-bold tabular-nums text-slate-950">
              <Count to={successful} />
            </div>
            <div className="text-[13px] text-slate-500">Successful referrals</div>
          </div>
          <div className="col-span-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 lg:col-span-1">
            <div className="text-[20px] sm:text-[26px] font-bold tabular-nums text-indigo-700">
              {money(summary.rate)}
            </div>
            <div className="text-[13px] text-slate-600">
              Current rate{summary.slab?.label ? ` · ${summary.slab.label} slab` : ""}
            </div>
          </div>
        </div>

        {tiers.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Reward slabs</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {tiers.map((t) => {
                const active = t.key === activeSlabKey;
                return (
                  <div
                    key={t.key}
                    className={`rounded-xl border p-3 ${
                      active ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-100" : "border-slate-200 bg-slate-50/60"
                    }`}
                  >
                    <div className="text-[12px] font-bold uppercase tracking-wide text-slate-600">
                      {t.range} referrals
                    </div>
                    <div className="mt-1 text-[20px] font-bold text-slate-950">{money(t.amount)}</div>
                    <div className="text-[12px] text-slate-500">per successful referral</div>
                    {active && (
                      <div className="mt-2 inline-flex rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                        Current slab
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-900">
          Rewards unlock only after a referred business joins or purchases Bispun CRM with your code. Pending enquiries do
          not earn rewards.
        </div>
      </section>

      {/* STAGE 4 — CREDITED */}
      <section
        id="referral-stage-credited"
        tabIndex={-1}
        aria-labelledby="stage-credited-title"
        className={`${CARD} scroll-mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
      >
        <div className="flex items-center gap-2">
          <Wallet size={18} aria-hidden="true" className="text-indigo-600" />
          <h2 id="stage-credited-title" className="text-[17px] font-semibold text-slate-950">
            4 · Credited
          </h2>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} aria-hidden="true" className="text-emerald-600" />
              <span className="text-[13px] font-semibold text-emerald-800">Credited to you</span>
            </div>
            <div className="mt-2 text-[22px] sm:text-[26px] font-bold tabular-nums text-emerald-700">
              {money(credited)}
            </div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center gap-2">
              <Clock3 size={16} aria-hidden="true" className="text-amber-600" />
              <span className="text-[13px] font-semibold text-amber-800">Awaiting credit</span>
            </div>
            <div className="mt-2 text-[22px] sm:text-[26px] font-bold tabular-nums text-amber-700">
              {money(pendingCredit)}
            </div>
            {pendingCredit > 0 && (
              <div className="mt-1 text-[12px] text-amber-800">
                Expected in about {expect.min}–{expect.max} days after being verified by Bispun.
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 text-[12px] leading-5 text-slate-500">
          Credits are confirmed by the Bispun team. You cannot mark your own rewards as credited — you will get an
          <span className="font-semibold text-slate-700"> “Amount credited”</span> notification when it is done.
        </p>

        <div className="mt-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Credit history</h3>
          {creditedHistory.length === 0 ? (
            <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-[13px] text-slate-500">
              No amounts credited yet.
            </div>
          ) : (
            <div
              className="mt-2 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              tabIndex={0}
              role="group"
              aria-label="Credit history (scrollable)"
            >
              <table className="min-w-full text-left text-xs">
                <caption className="sr-only">Credit history: date credited, amount and reference</caption>
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th scope="col" className="px-2 py-2.5">Credited on</th>
                    <th scope="col" className="px-2 py-2.5">Amount</th>
                    <th scope="col" className="px-2 py-2.5">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {creditedHistory.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-2.5 text-slate-600">{formatDate(item.paidAt || item.processedAt)}</td>
                      <td className="px-2 py-2.5 font-semibold text-slate-900">{money(item.amount)}</td>
                      <td className="px-2 py-2.5 text-slate-500">{item.paymentReference || item.adminNote || "—"}</td>
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
