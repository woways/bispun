import { useState } from "react";

import {
  Copy,
  Check,
  Share2,
  Users,
  TrendingUp,
  Gift,
  ChevronDown,
  Link2,
} from "lucide-react";

function initialsOf(name) {
  return String(name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/* ---- Interactive "How referral works" pipeline ---- */
const HOW_STEPS = [
  {
    label: "Share",
    title: "Share your referral link",
    body:
      "Copy your unique code or link and send it to anyone — via WhatsApp, email, or a QR code. Every share is tracked to you.",
    icon: Share2,
  },
  {
    label: "They refer",
    title: "They get referred",
    body:
      "When the person enters the pipeline, they're tagged to you. No manual work — the system links them to your referral.",
    icon: Users,
  },
  {
    label: "Track",
    title: "Track their progress",
    body:
      "Watch each referral move through the stages live. Nudge them with a reminder whenever they stall.",
    icon: TrendingUp,
  },
  {
    label: "Earn",
    title: "Earn your reward",
    body:
      "When your referral reaches the reward stage, your earning unlocks automatically.",
    icon: Gift,
  },
];

const FAQS = [
  [
    "How do I refer someone?",
    "Copy your referral link or code from your profile and share it. When they enter the pipeline, they're tagged to you automatically.",
  ],
  [
    "When do I earn my reward?",
    "Rewards unlock only when the referred customer joins or purchases Bispun CRM using your referral code. The amount depends on your current slab.",
  ],
  [
    "How much can I earn per referral?",
    "1–5 successful CRM referrals earn ₹2,500 each, 6–10 earn ₹3,000 each, and 11+ earn ₹4,000 each. Your current slab rate applies to all successful referrals.",
  ],
  [
    "Where do I see my referrals?",
    "Open the My Referrals tab to see everyone you've referred and their current stage, updated live.",
  ],
];

function StatCard({ label, value, description, valueClass = "text-slate-950" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_6px_18px_rgba(79,70,229,0.08)]">
      <div className="text-[12px] font-semibold uppercase tracking-[0.09em] text-slate-400">
        {label}
      </div>

      <div className={`mt-2 text-[26px] font-bold leading-none tracking-tight ${valueClass}`}>
        {value}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 text-[13px] font-medium leading-5 text-slate-500">
        {description}
      </div>
    </div>
  );
}

export default function ReferralHome({
  currentUser,
  code,
  stats,
  onGoReferrals,
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState("");
  const [openFaq, setOpenFaq] = useState(-1);

  const link = code ? `https://www.bispun.com/?ref=${encodeURIComponent(code)}` : "";
  const Step = HOW_STEPS[active];

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
    <div className="space-y-7">
      {/* KPI CARDS */}
      <section className="grid gap-5 sm:grid-cols-3">
        <StatCard
          label="Total Referrals"
          value={stats?.total ?? 0}
          description="Total people referred"
        />

        <StatCard
          label="Admitted"
          value={stats?.admitted ?? 0}
          description="Students admitted"
          valueClass="text-emerald-600"
        />

        <StatCard
          label="In Progress"
          value={stats?.inProgress ?? 0}
          description="Referrals currently in progress"
          valueClass="text-amber-600"
        />
      </section>

      {/* REFERRER + REFERRAL CODE */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
        <div className="grid lg:grid-cols-[1fr_300px]">
          <div className="p-5 sm:p-6">
            {/* Identity */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-5">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-[22px] font-bold text-white shadow-sm">
                  {initialsOf(currentUser?.name)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[19px] font-semibold tracking-[-0.015em] text-slate-950">
                      {currentUser?.name || "You"}
                    </h2>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active referrer
                    </span>
                  </div>

                  <p className="mt-1 text-[14px] text-slate-500">
                    {currentUser?.jobTitle ||
                      currentUser?.department ||
                      "Referrer"}
                  </p>
                </div>
              </div>
            </div>

            <div className="my-6 h-px bg-slate-100" />

            {/* Referral code */}
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                Your Referral Code
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <div className="flex h-12 min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-4">
                  <span className="truncate text-[16px] font-bold tracking-[0.03em] text-slate-900">
                    {code || "…"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => copy(code, "code")}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  {copied === "code" ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  {copied === "code" ? "Copied" : "Copy Code"}
                </button>
              </div>
            </div>
          </div>

          {/* Share actions — stacked, not side-by-side */}
          <div className="border-t border-slate-100 bg-slate-50/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex h-full flex-col">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                  Share Referral
                </div>
                <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
                  Use your preferred sharing method.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Check this out: ${link}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Share2 size={16} />
                  Share on WhatsApp
                </a>

                <button
                  type="button"
                  onClick={() => copy(link, "link")}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {copied === "link" ? (
                    <Check size={16} />
                  ) : (
                    <Link2 size={16} />
                  )}
                  {copied === "link" ? "Link Copied" : "Copy Referral Link"}
                </button>
              </div>

              <div className="mt-auto pt-6 text-[12px] leading-5 text-slate-400">
                Your referral code and link are unique to your account.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REFER MORE */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-[0_6px_20px_rgba(79,70,229,0.07)] transition-all duration-200 hover:border-indigo-400 hover:shadow-[0_10px_28px_rgba(79,70,229,0.10)]">
        <div className="absolute inset-y-0 left-0 w-2 bg-indigo-600" />
        <div className="grid min-h-[170px] md:grid-cols-[1fr_220px]">
          <div className="flex flex-col justify-center p-5 pl-7 sm:p-6 sm:pl-8">
            <div className="flex items-start gap-5">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Gift size={21} />
              </div>

              <div className="min-w-0">
                <h2 className="text-[21px] font-semibold tracking-[-0.015em] text-slate-950">
                  Refer more. Earn more.
                </h2>

                <p className="mt-1 text-[14px] leading-6 text-slate-600">
                  Share your link and watch your referrals progress live.
                </p>
              </div>
            </div>

            <div className="mt-7">
              <button
                type="button"
                onClick={onGoReferrals}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-[13px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
              >
                Go to My Referrals →
              </button>
            </div>
          </div>

          <div className="hidden items-center justify-center border-l border-indigo-100 bg-indigo-50/60 md:flex">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-indigo-100 bg-white text-indigo-600 shadow-sm">
              <Gift size={30} />
            </div>
          </div>
        </div>
      </section>

      {/* HOW REFERRAL WORKS */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)] sm:p-6">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-slate-950">
            How Referral Works
          </h2>
          <p className="mt-1 text-[13px] text-slate-500">
            From share to reward in 4 steps.
          </p>
        </div>

        <div className="mt-6">
          <div className="relative">
            <div className="pointer-events-none absolute left-[13%] right-[13%] top-6 hidden h-px bg-indigo-200 md:block" />

            <div className="relative z-10 grid gap-6 md:grid-cols-4">
              {HOW_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === active;

                return (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => setActive(index)}
                    className="group flex items-start gap-3 text-left md:flex-col md:items-center md:text-center"
                  >
                    <span
                      className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border transition ${
                        isActive
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                          : "border-indigo-100 bg-indigo-50 text-indigo-600 group-hover:border-indigo-200 group-hover:bg-indigo-100"
                      }`}
                    >
                      <Icon size={19} />
                    </span>

                    <span>
                      <span
                        className={`block text-[14px] font-semibold ${
                          isActive
                            ? "text-indigo-700"
                            : "text-slate-900"
                        }`}
                      >
                        {index + 1}. {step.label}
                      </span>

                      <span className="mt-1 block text-[13px] leading-5 text-slate-500">
                        {step.title}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-7 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3.5">
              <div className="text-[14px] font-semibold text-indigo-800">
                {Step.title}
              </div>

              <p className="mt-1 text-[13px] leading-5 text-slate-600">
                {Step.body}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* REFERRAL MILESTONES */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)] sm:p-6">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-slate-950">
            Referral Milestones
          </h2>

          <p className="mt-1 text-[13px] text-slate-500">
            Your reward level grows as successful referrals increase.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50/40">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold text-slate-900">
                Tier 1
              </span>

              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[12px] font-semibold text-indigo-700">
                1–5 successful
              </span>
            </div>

            <p className="mt-2 text-[13px] text-slate-600">
              ₹2,500 per successful referral
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50/40">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold text-slate-900">
                Tier 2
              </span>

              <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[12px] font-semibold text-indigo-700">
                6–10 successful
              </span>
            </div>

            <p className="mt-2 text-[13px] text-slate-600">
              ₹3,000 per successful referral
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all duration-200 hover:border-indigo-300 hover:bg-indigo-50/40">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold text-slate-900">
                Tier 3
              </span>

              <span className="rounded-full border border-indigo-100 bg-white px-2.5 py-1 text-[12px] font-semibold text-indigo-700">
                11+ successful
              </span>
            </div>

            <p className="mt-2 text-[13px] text-slate-600">
              ₹4,000 per successful referral
            </p>
          </div>
        </div>

        <p className="mt-4 text-[12px] leading-5 text-slate-500">
          Example: 3 successful referrals = 3 × ₹2,500 = ₹7,500; 7 successful referrals = 7 × ₹3,000 = ₹21,000.
        </p>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-slate-950">
          Frequently Asked Questions
        </h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
          {FAQS.map(([question, answer], index) => (
            <div
              key={question}
              className="border-b border-slate-100 last:border-b-0"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenFaq(openFaq === index ? -1 : index)
                }
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="text-[14px] font-semibold text-slate-900">
                  {question}
                </span>

                <ChevronDown
                  size={18}
                  className={`flex-shrink-0 text-slate-400 transition-transform ${
                    openFaq === index ? "rotate-180" : ""
                  }`}
                />
              </button>

              {openFaq === index && (
                <div className="px-5 pb-4 text-[13px] leading-6 text-slate-500">
                  {answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
