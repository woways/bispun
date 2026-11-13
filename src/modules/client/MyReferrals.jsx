import { useEffect, useRef, useState } from "react";

import {
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Users,
  TrendingUp,
  Gift,
  QrCode,
  Plus,
  Search,
  X,
  Clock3,
  CheckCircle2,
  UserPlus,
  Link2,
  Mail,
  Share2,
} from "lucide-react";

import { apiRequest } from "../../lib/api";
import { buildReferralSignupUrl } from "../../lib/referralLink";

const STAGE_LABELS = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  COUNSELLING: "Counselling",
  ADMITTED: "Admitted",
  LOST: "Lost",
};
const STAGE_ORDER = ["NEW", "CONTACTED", "QUALIFIED", "COUNSELLING", "ADMITTED"];

function initialsOf(name) {
  return String(name || "?").split(" ").filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join("").toUpperCase();
}

// Generate a QR code image URL (free, no key) from a public QR service.
function qrUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text)}`;
}

/* ------------------------------------------------------------------ */
/* Interactive "How referral works" pipeline                          */
/* ------------------------------------------------------------------ */

const HOW_STEPS = [
  {
    key: "share",
    label: "Share",
    title: "Share your referral link",
    body: "Copy your unique code or link and send it to anyone — via WhatsApp, email, or a QR code. Every share is tracked to you.",
    icon: Share2,
  },
  {
    key: "refer",
    label: "They refer",
    title: "They get referred",
    body: "When the person enters the pipeline, they're tagged to you. No manual work — the system links them to your referral.",
    icon: Users,
  },
  {
    key: "track",
    label: "Track",
    title: "Track their progress",
    body: "Watch each referral move through the stages live on this page. Nudge them with a reminder whenever they stall.",
    icon: TrendingUp,
  },
  {
    key: "earn",
    label: "Earn",
    title: "Earn your reward",
    body: "When your referral reaches the reward stage, your earning unlocks automatically.",
    icon: Gift,
  },
];

function HowItWorks() {
  const [active, setActive] = useState(0);
  const Step = HOW_STEPS[active];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-[17px] font-semibold text-slate-950">How referral works</h2>
      <p className="mt-1 text-[13px] text-slate-500">From share to reward in 4 steps — tap a step to learn more.</p>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {HOW_STEPS.map((s, i) => {
          const Icon = s.icon;
          const on = i === active;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(i)}
              aria-current={on ? "step" : undefined}
              className="group flex flex-col items-center gap-3 rounded-xl p-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${
                  on
                    ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 bg-slate-50 text-slate-500 group-hover:border-slate-300 group-hover:text-slate-600"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className={`text-[12.5px] font-semibold ${on ? "text-indigo-700" : "text-slate-600"}`}>
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="text-[14px] font-semibold text-slate-900">{Step.title}</div>
        <div className="mt-1 text-[13px] leading-5 text-slate-600">{Step.body}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                          */
/* ------------------------------------------------------------------ */

const CARD = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";

export default function MyReferrals({ currentUser }) {
  const [code, setCode] = useState("");
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState({ total: 0, admitted: 0, inProgress: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [copiedMsg, setCopiedMsg] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState([]);
  const [leadLoading, setLeadLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [referrerId, setReferrerId] = useState("");
  const [tagging, setTagging] = useState("");

  const copyTimer = useRef(0);
  const tagBtnRef = useRef(null);
  const searchRef = useRef(null);
  const dialogRef = useRef(null);
  const wasOpenRef = useRef(false);

  const isAdmin =
    currentUser?.role === "CLIENT_ADMIN" ||
    currentUser?.permissions?.canViewTeamTargets === true;

  // Configurable base (never hard-coded to prod); empty when no code so share
  // controls stay disabled.
  const link = code
    ? buildReferralSignupUrl({
        configuredBase: import.meta.env.VITE_PUBLIC_SIGNUP_URL,
        origin: typeof window !== "undefined" ? window.location.origin : "",
        code,
      })
    : "";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/client/referrals/me");
      setCode(data.code || "");
      setReferrals(Array.isArray(data.referrals) ? data.referrals : []);
      setStats(data.stats || { total: 0, admitted: 0, inProgress: 0 });
    } catch (err) {
      setError(err?.data?.message || "Unable to load referrals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  // Dialog focus management (WCAG 2.4.3 / 4.1.2): focus the search on open,
  // return focus to the trigger on close.
  useEffect(() => {
    if (tagOpen) {
      wasOpenRef.current = true;
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      tagBtnRef.current?.focus();
    }
    return undefined;
  }, [tagOpen]);

  async function searchLeads(q) {
    setLeadLoading(true);
    try {
      const data = await apiRequest(`/api/client/referrals/leads?q=${encodeURIComponent(q)}`);
      setLeadResults(Array.isArray(data.leads) ? data.leads : []);
    } catch (err) {
      setError(err?.data?.message || "Unable to search leads");
    } finally {
      setLeadLoading(false);
    }
  }

  async function openTag() {
    setTagOpen(true);
    setLeadQuery("");
    setReferrerId("");
    searchLeads("");
    if (isAdmin && users.length === 0) {
      try {
        const data = await apiRequest("/api/client/referrals/users");
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch (e) {
        // non-fatal
      }
    }
  }

  async function tagLead(leadId) {
    setTagging(leadId);
    setError("");
    try {
      const body = { leadId };
      if (isAdmin && referrerId) body.referrerId = referrerId;
      await apiRequest("/api/client/referrals/tag", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setTagOpen(false);
      await load();
    } catch (err) {
      setError(err?.data?.message || "Unable to tag referral");
    } finally {
      setTagging("");
    }
  }

  function copy(text, which, label) {
    if (!text) return;
    const ok = () => {
      setCopied(which);
      setCopiedMsg(`${label} copied`);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => {
        setCopied("");
        setCopiedMsg("");
      }, 1600);
    };
    const fail = (e) => {
      console.error("Unable to copy referral value:", e);
      setCopied("");
      setCopiedMsg(`Could not copy ${label.toLowerCase()}`);
    };
    try {
      const r = navigator.clipboard?.writeText(text);
      if (r && typeof r.then === "function") r.then(ok).catch(fail);
      else ok();
    } catch (e) {
      fail(e);
    }
  }

  function onDialogKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setTagOpen(false);
      return;
    }
    if (e.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const convRate = stats.total > 0 ? Math.round((stats.admitted / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Always-mounted live region for clipboard feedback (WCAG 4.1.3). */}
      <span role="status" aria-live="polite" className="sr-only">
        {copiedMsg}
      </span>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle size={14} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* HERO HEADER — replaces the old lone-button top gap */}
      <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <UserPlus size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.01em] text-slate-950">Tag a referral</h2>
            <p className="mt-0.5 text-[13px] text-slate-600">Add people you referred manually and track their progress through every stage.</p>
          </div>
        </div>
        <button
          ref={tagBtnRef}
          type="button"
          onClick={openTag}
          className="inline-flex h-10 flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        >
          <Plus size={15} aria-hidden="true" />
          Tag a referral
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[13px] text-slate-500">
                <Users size={16} aria-hidden="true" className="text-indigo-600" /> Total referrals
              </div>
              <div className="mt-2 text-[28px] font-bold leading-none tabular-nums text-slate-950">{stats.total}</div>
              <div className="mt-1 text-[12px] text-slate-500">{convRate}% reached Admitted</div>
            </div>
            <div className="relative h-16 w-16 flex-shrink-0" aria-hidden="true">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#eef2ff" strokeWidth="4" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - convRate} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[12px] font-bold tabular-nums text-slate-900">{convRate}%</div>
            </div>
          </div>
        </div>
        <div className={CARD}>
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <Clock3 size={16} aria-hidden="true" className="text-amber-600" /> In progress
          </div>
          <div className="mt-2 text-[28px] font-bold leading-none tabular-nums text-amber-700">{stats.inProgress}</div>
          <div className="mt-1 text-[12px] text-slate-500">Moving through the stages</div>
        </div>
        <div className={CARD}>
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <CheckCircle2 size={16} aria-hidden="true" className="text-emerald-600" /> Admitted
          </div>
          <div className="mt-2 text-[28px] font-bold leading-none tabular-nums text-emerald-700">{stats.admitted}</div>
          <div className="mt-1 text-[12px] text-slate-500">Reached the final stage</div>
        </div>
      </div>

      {/* SHARE + QR */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_auto]">
        <div className={CARD}>
          <h2 className="text-[17px] font-semibold text-slate-950">Share &amp; earn</h2>
          <p className="mt-1 text-[13px] text-slate-500">Copy your code or link and share it anywhere.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Referral code</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[16px] font-bold tracking-[0.12em] text-slate-900">{code || "…"}</span>
                <button
                  type="button"
                  onClick={() => copy(code, "code", "Referral code")}
                  disabled={!code}
                  aria-label="Copy referral code"
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copied === "code" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                  {copied === "code" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Referral link</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-slate-700">{link || "…"}</span>
                <button
                  type="button"
                  onClick={() => copy(link, "link", "Referral link")}
                  disabled={!link}
                  aria-label="Copy referral link"
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {copied === "link" ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                  {copied === "link" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <a
              href={link ? `https://wa.me/?text=${encodeURIComponent(`Check this out: ${link}`)}` : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={link ? undefined : "true"}
              className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                link ? "bg-indigo-600 hover:bg-indigo-700" : "pointer-events-none bg-slate-300"
              }`}
            >
              <Share2 size={15} aria-hidden="true" /> Share on WhatsApp
              <span className="sr-only"> (opens in new tab)</span>
            </a>
            <a
              href={link ? `mailto:?subject=${encodeURIComponent("My referral link")}&body=${encodeURIComponent(link)}` : undefined}
              aria-disabled={link ? undefined : "true"}
              className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                link
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
              }`}
            >
              <Mail size={15} aria-hidden="true" /> Share via Email
            </a>
          </div>
        </div>

        {/* QR card */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
          <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Scan to refer</div>
          <div className="mt-3 rounded-xl border border-slate-200 p-2">
            {link ? (
              <img src={qrUrl(link)} alt="QR code for your referral link" width="132" height="132" className="rounded" />
            ) : (
              <div className="flex h-[132px] w-[132px] items-center justify-center text-slate-300">
                <QrCode size={40} aria-hidden="true" />
              </div>
            )}
          </div>
          <a
            href={link ? qrUrl(link) : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={link ? undefined : "true"}
            className={`mt-3 rounded text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              link ? "text-indigo-600 hover:text-indigo-700" : "pointer-events-none text-slate-300"
            }`}
          >
            Open QR
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <HowItWorks />

      {/* REFERRAL LIST with live stages */}
      <div className={CARD}>
        <h2 className="text-[17px] font-semibold text-slate-950">Your referrals</h2>
        <p className="mt-1 text-[13px] text-slate-500">Track how each referral is moving through the stages.</p>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 size={16} aria-hidden="true" className="animate-spin" /> Loading…
          </div>
        ) : referrals.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <Users size={22} aria-hidden="true" />
            </span>
            <div className="mt-3 text-[14px] font-semibold text-slate-800">No referrals tagged yet</div>
            <p className="mt-1 max-w-xs text-[12.5px] text-slate-500">Tag a lead you referred and watch it move through the stages here.</p>
            <button
              type="button"
              onClick={openTag}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Plus size={15} aria-hidden="true" /> Tag a referral
            </button>
          </div>
        ) : (
          <ul className="mt-5 space-y-4">
            {referrals.map((r) => {
              const stageName = STAGE_LABELS[r.lead.stage] || r.lead.stage;
              return (
                <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[12px] font-semibold text-slate-600">
                      {initialsOf(r.lead.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold text-slate-900">{r.lead.name}</div>
                      <div className="text-[13px] text-slate-500">{r.lead.phone}{r.lead.course ? ` · ${r.lead.course}` : ""}</div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                        r.lead.isLost
                          ? "bg-rose-50 text-rose-700"
                          : r.lead.stage === "ADMITTED"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {r.lead.isLost ? "Lost" : stageName}
                    </span>
                  </div>
                  <span className="sr-only">
                    Stage: {r.lead.isLost ? "Lost" : stageName}
                  </span>
                  {/* stage rail — decorative; the badge + sr-only text carry the meaning */}
                  <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
                    {STAGE_ORDER.map((st, i) => (
                      <span
                        key={st}
                        className={`h-1.5 flex-1 rounded-full ${
                          r.lead.isLost
                            ? "bg-slate-200"
                            : i < r.lead.stageIndex
                            ? "bg-emerald-500"
                            : i === r.lead.stageIndex
                            ? "bg-brand-500"
                            : "bg-slate-200"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 flex justify-between gap-1 text-[11px] font-semibold uppercase tracking-tight text-slate-500" aria-hidden="true">
                    {STAGE_ORDER.map((st, i) => (
                      <span key={st} className={i === r.lead.stageIndex && !r.lead.isLost ? "text-brand-600" : ""}>
                        {STAGE_LABELS[st]}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Tag a referral modal */}
      {tagOpen && (
        <div
          className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
          onClick={() => setTagOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tag-dialog-title"
            onKeyDown={onDialogKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div id="tag-dialog-title" className="text-sm font-bold text-slate-950">Tag a lead as referred</div>
              <button
                type="button"
                onClick={() => setTagOpen(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-3 border-b border-slate-100 p-4">
              {isAdmin && (
                <div>
                  <label htmlFor="tag-referrer" className="mb-1 block text-[13px] font-semibold uppercase tracking-wide text-slate-500">Referred by</label>
                  <select
                    id="tag-referrer"
                    value={referrerId}
                    onChange={(e) => setReferrerId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-brand-400 focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <option value="">Me ({currentUser?.name || "self"})</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="tag-lead-search" className="sr-only">Search leads by name, phone or email</label>
                <div className="relative">
                  <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="tag-lead-search"
                    ref={searchRef}
                    value={leadQuery}
                    onChange={(e) => { setLeadQuery(e.target.value); searchLeads(e.target.value); }}
                    placeholder="Search leads by name, phone or email"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] outline-none focus:border-brand-400 focus:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500"
                  />
                </div>
              </div>
              <span role="status" aria-live="polite" className="sr-only">
                {leadLoading ? "Searching leads" : `${leadResults.length} leads found`}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {leadLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                  <Loader2 size={14} aria-hidden="true" className="animate-spin" /> Searching…
                </div>
              ) : leadResults.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-slate-500">No untagged leads found.</div>
              ) : (
                leadResults.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => tagLead(l.id)}
                    disabled={tagging === l.id}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[13px] font-semibold text-slate-700">
                      {initialsOf(l.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-900">{l.name}</div>
                      <div className="truncate text-[13px] text-slate-500">{l.phone}{l.course ? ` · ${l.course}` : ""}</div>
                    </div>
                    {tagging === l.id ? <Loader2 size={14} aria-hidden="true" className="animate-spin text-brand-600" /> : <Plus size={15} aria-hidden="true" className="text-brand-600" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
