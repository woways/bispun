import {
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Crown,
} from "lucide-react";

import {
  PLANS,
  MODULE_META,
} from "../data/tenants";

const TONES = {
  slate:
    "bg-slate-100 text-slate-700 border-slate-200",
  indigo:
    "bg-indigo-50 text-indigo-700 border-indigo-100",
  emerald:
    "bg-emerald-50 text-emerald-700 border-emerald-100",
  amber:
    "bg-amber-50 text-amber-700 border-amber-100",
  rose:
    "bg-rose-50 text-rose-700 border-rose-100",
  purple:
    "bg-purple-50 text-purple-700 border-purple-100",
  sky:
    "bg-sky-50 text-sky-700 border-sky-100",
};

const STAT_TONES = {
  indigo:
    "bg-indigo-50 text-indigo-600 border-indigo-100",
  emerald:
    "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber:
    "bg-amber-50 text-amber-600 border-amber-100",
  rose:
    "bg-rose-50 text-rose-600 border-rose-100",
  slate:
    "bg-slate-50 text-slate-600 border-slate-200",
};

export const StatCard = ({
  label,
  value,
  delta,
  icon: Icon,
  tone = "indigo",
}) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-400">
          {label}
        </div>

        <div className="mt-2 text-[22px] leading-none font-bold tracking-tight text-slate-950">
          {value}
        </div>
      </div>

      <div
        className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
          STAT_TONES[tone] ||
          STAT_TONES.indigo
        }`}
      >
        <Icon size={17} />
      </div>
    </div>

    {delta && (
      <div
        className={`mt-3 pt-3 border-t border-slate-100 text-[11px] font-medium flex items-center gap-1 ${
          delta.startsWith("-")
            ? "text-rose-600"
            : "text-emerald-600"
        }`}
      >
        {delta.startsWith("-") ? (
          <ArrowDownRight size={12} />
        ) : (
          <ArrowUpRight size={12} />
        )}

        {delta} vs last month
      </div>
    )}
  </div>
);

export const Badge = ({
  children,
  tone = "slate",
}) => (
  <span
    className={`inline-flex items-center border px-2 py-0.5 rounded-md text-[11px] leading-4 font-semibold whitespace-nowrap ${
      TONES[tone] ||
      TONES.slate
    }`}
  >
    {children}
  </span>
);

export const stageTone = (
  stage
) =>
  ({
    New: "sky",
    NEW: "sky",
    Contacted: "indigo",
    CONTACTED: "indigo",
    Qualified: "purple",
    QUALIFIED: "purple",
    Counselling: "amber",
    COUNSELLING: "amber",
    Admitted: "emerald",
    ADMITTED: "emerald",
    Lost: "rose",
    LOST: "rose",
  }[stage] || "slate");

export const statusTone = (
  status
) =>
  ({
    active: "emerald",
    ACTIVE: "emerald",

    trial: "amber",
    TRIAL: "amber",

    suspended: "rose",
    SUSPENDED: "rose",

    Completed: "emerald",
    COMPLETED: "emerald",

    Ongoing: "sky",
    ONGOING: "sky",

    Pending: "amber",
    PENDING: "amber",

    Scheduled: "sky",
    SCHEDULED: "sky",

    Sent: "sky",
    SENT: "sky",

    Negotiating: "amber",
    NEGOTIATING: "amber",

    Accepted: "emerald",
    ACCEPTED: "emerald",

    "Converted-to-lead":
      "emerald",

    Lost: "rose",
    LOST: "rose",

    "In-progress":
      "amber",
    IN_PROGRESS:
      "amber",

    Cancelled: "rose",
    CANCELLED: "rose",

    Rejected: "rose",
    REJECTED: "rose",

    Approved: "emerald",
    APPROVED: "emerald",

    Paid: "emerald",
    PAID: "emerald",
  }[status] ||
  "slate");

export const PlanPill = ({
  plan,
}) => {
  const safePlan =
    PLANS[plan]
      ? plan
      : "basic";

  const tone =
    safePlan ===
    "basic"
      ? "slate"
      : safePlan ===
        "pro"
      ? "indigo"
      : "amber";

  return (
    <Badge tone={tone}>
      {
        PLANS[
          safePlan
        ].name
      }
    </Badge>
  );
};

export const UpgradeGate = ({
  module,
  currentPlan,
  onUpgrade,
}) => {
  const moduleMeta =
    MODULE_META[module];

  const required =
    moduleMeta?.plan ||
    "pro";

  const requiredPlan =
    PLANS[required];

  const safeCurrentPlan =
    PLANS[currentPlan]
      ? currentPlan
      : "basic";

  if (
    !moduleMeta ||
    !requiredPlan
  ) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
          <div className="text-base font-bold text-slate-900">
            Module unavailable
          </div>

          <div className="text-sm text-slate-500 mt-2">
            This module is not available
            for the current workspace.
          </div>
        </div>
      </div>
    );
  }

  // CA-011: if the client is already on (or above) the required plan, this
  // module was turned off by the admin — don't ask them to buy a plan they have.
  const PLAN_RANK = {
    basic: 1,
    pro: 2,
    advanced: 3,
  };
  const alreadyOnPlan =
    (PLAN_RANK[safeCurrentPlan] || 0) >=
    (PLAN_RANK[required] || 99);

  if (alreadyOnPlan) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center mb-4">
            <Lock size={20} />
          </div>

          <div className="text-lg font-bold tracking-tight text-slate-950">
            {moduleMeta.label} isn't enabled
          </div>

          <div className="text-sm text-slate-600 mt-2 leading-relaxed">
            This module is part of your{" "}
            <span className="font-semibold text-slate-800">
              {PLANS[safeCurrentPlan].name}
            </span>{" "}
            plan but has been turned off for
            your workspace. Contact your
            administrator to enable it.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[55vh]">
      <div className="max-w-md text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
          <Lock size={20} />
        </div>

        <div className="text-lg font-bold tracking-tight text-slate-950">
          {
            moduleMeta.label
          }{" "}
          requires the{" "}
          {
            requiredPlan.name
          }{" "}
          plan
        </div>

        <div className="text-sm text-slate-600 mt-2 leading-relaxed">
          You're currently on{" "}
          <span className="font-semibold text-slate-800">
            {
              PLANS[
                safeCurrentPlan
              ].name
            }
          </span>
          . Upgrade to{" "}
          <span className="font-semibold text-slate-800">
            {
              requiredPlan.name
            }
          </span>{" "}
          at ₹
          {requiredPlan.price.toLocaleString(
            "en-IN"
          )}
          /month to unlock this module.
        </div>

        <div className="mt-4 text-xs text-slate-500">
          {
            requiredPlan.tagline
          }
        </div>

        <button
          type="button"
          onClick={
            onUpgrade
          }
          className="mt-5 h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 shadow-sm"
        >
          <Crown
            size={14}
          />

          Upgrade to{" "}
          {
            requiredPlan.name
          }
        </button>
      </div>
    </div>
  );
};

export const SectionHeader = ({
  title,
  subtitle,
  action,
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">
        {title}
      </h1>

      {subtitle && (
        <p className="text-sm text-slate-500 mt-1">
          {subtitle}
        </p>
      )}
    </div>

    {action && (
      <div className="flex-shrink-0">
        {action}
      </div>
    )}
  </div>
);

export const Table = ({
  columns,
  rows,
  empty,
}) => (
  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50/80 border-b border-slate-200">
          <tr>
            {columns.map(
              (
                column,
                index
              ) => (
                <th
                  key={
                    index
                  }
                  className="text-left px-4 py-3 font-semibold text-slate-500 text-[10px] uppercase tracking-[0.08em] whitespace-nowrap"
                >
                  {
                    column
                  }
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.length ===
          0 ? (
            <tr>
              <td
                colSpan={
                  columns.length
                }
                className="text-center py-12 text-sm text-slate-500"
              >
                {empty ||
                  "No data yet"}
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
      </table>
    </div>
  </div>
);
