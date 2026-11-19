import { useEffect, useRef, useState } from "react";

import {
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Users,
  QrCode,
  Plus,
  Search,
  X,
  Clock3,
  CheckCircle2,
  XCircle,
  UserPlus,
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

function qrUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(text)}`;
}

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
  const [filter, setFilter] = useState("all");

  const copyTimer = useRef(0);
  const tagBtnRef = useRef(null);
  const searchRef = useRef(null);
  const dialogRef = useRef(null);
  const wasOpenRef = useRef(false);

  const isAdmin =
    currentUser?.role === "CLIENT_ADMIN" ||
    currentUser?.permissions?.canViewTeamTargets === true;

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

  const catOf = (r) => (r.lead.isLost ? "lost" : r.lead.stage === "ADMITTED" ? "admitted" : "progress");
  const counts = {
    all: referrals.length,
    progress: referrals.filter((r) => catOf(r) === "progress").length,
    admitted: referrals.filter((r) => catOf(r) === "admitted").length,
    lost: referrals.filter((r) => catOf(r) === "lost").length,
  };
  const shownReferrals = referrals.filter((r) => filter === "all" || catOf(r) === filter);

  // ── FUTURE: per-referral "Send reminder" action ────────────────────────────
  // Intentionally NOT shipped. There is no backend endpoint to send a referral
  // reminder yet, so the earlier button only showed a fake confirmation (no
  // message was ever sent). The complete front-end scaffold is preserved here so
  // it can be re-enabled once a real endpoint exists. To restore:
  //   1. Re-add `Bell` to the lucide-react import above.
  //   2. Re-add state:  const [sentReminders, setSentReminders] = useState({});
  //   3. Call the real API inside sendReminder() (see TODO below).
  //   4. Re-render the button in the referral row footer (snippet at the bottom).
  //
  // function sendReminder(r) {
  //   const id = r.id;
  //   setSentReminders((s) => ({ ...s, [id]: true }));
  //   // TODO: await apiRequest(`/api/client/referrals/${id}/remind`, { method: "POST" });
  //   setCopiedMsg(`Reminder sent to ${r.lead.name}`);
  //   window.clearTimeout(copyTimer.current);
  //   copyTimer.current = window.setTimeout(() => {
  //     setSentReminders((s) => { const n = { ...s }; delete n[id]; return n; });
  //     setCopiedMsg("");
  //   }, 2200);
  // }
  //
  // Row-footer button snippet (replaces the %-progress span for in-progress rows):
  //   {inProgress ? (
  //     <button type="button" onClick={() => sendReminder(r)} disabled={!!sentReminders[r.id]}
  //       className="inline-flex flex-shrink-0 items-center gap-1 rounded py-1 text-[11.5px] font-semibold text-brand-700 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:text-slate-400 disabled:no-underline">
  //       <Bell size={13} aria-hidden="true" /> {sentReminders[r.id] ? "Reminder sent" : "Send reminder"}
  //     </button>
  //   ) : (
  //     <span className="flex-shrink-0 text-[11.5px] tabular-nums text-slate-600">{isAdmitted ? "100%" : `${pct}%`}</span>
  //   )}
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Always-mounted live region for clipboard feedback. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copiedMsg}
      </span>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle size={14} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* HERO */}
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <UserPlus size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-bold tracking-[-0.01em] text-slate-900">Tag a referral</h2>
            <p className="mt-0.5 text-[13px] text-slate-500">Add people you referred and track how far each one has progressed.</p>
          </div>
        </div>
        <button
          ref={tagBtnRef}
          type="button"
          onClick={openTag}
          className="inline-flex h-11 flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
        >
          <Plus size={15} aria-hidden="true" />
          Tag a referral
        </button>
      </div>

      {/* SUMMARY TILES */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 native:grid-cols-3 native:gap-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm native:p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[12px] font-medium text-slate-500 native:text-[11px] native:leading-tight">Total referrals</span>
              <div className="mt-2 text-[26px] font-bold leading-none tabular-nums text-brand-700 native:text-[20px]">{stats.total}</div>
              <div className="mt-1 text-[12px] text-slate-500 native:mt-0.5 native:text-[10px] native:leading-tight">{convRate}% reached Admitted</div>
            </div>
            <div className="relative h-14 w-14 flex-shrink-0 native:hidden" aria-hidden="true">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" className="text-slate-200" stroke="currentColor" strokeWidth="4" />
                <circle cx="18" cy="18" r="15.9" fill="none" className="text-brand-600" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - convRate} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[11.5px] font-bold tabular-nums text-brand-700">{convRate}%</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm native:p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-slate-500 native:text-[11px] native:leading-tight">In progress</span>
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 native:hidden" aria-hidden="true">
              <Clock3 size={18} />
            </span>
          </div>
          <div className="mt-2 text-[26px] font-bold leading-none tabular-nums text-slate-900 native:text-[20px]">{stats.inProgress}</div>
          <div className="mt-1 text-[12px] text-slate-500 native:mt-0.5 native:text-[10px] native:leading-tight">Still moving through stages</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm native:p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-slate-500 native:text-[11px] native:leading-tight">Admitted</span>
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 native:hidden" aria-hidden="true">
              <CheckCircle2 size={18} />
            </span>
          </div>
          <div className="mt-2 text-[26px] font-bold leading-none tabular-nums text-slate-900 native:text-[20px]">{stats.admitted}</div>
          <div className="mt-1 text-[12px] text-slate-500 native:mt-0.5 native:text-[10px] native:leading-tight">Reached the final stage</div>
        </div>
      </div>

      {/* SHARE + QR */}
      <div className={CARD}>
        <h2 className="text-[17px] font-semibold text-slate-950">Share &amp; earn</h2>
        <p className="mt-1 text-[13px] text-slate-500">Copy your code or link and share it anywhere.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_auto]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
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
                    {copied === "code" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    {copied === "code" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Referral link</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-semibold text-slate-700">{link || "…"}</span>
                  <button
                    type="button"
                    onClick={() => copy(link, "link", "Referral link")}
                    disabled={!link}
                    aria-label="Copy referral link"
                    className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:border-brand-400 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {copied === "link" ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                    {copied === "link" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={link ? `https://wa.me/?text=${encodeURIComponent(`Join Bispun CRM: ${link}`)}` : undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={link ? undefined : "true"}
                className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  link ? "bg-brand-600 hover:bg-brand-700" : "pointer-events-none bg-slate-300"
                }`}
              >
                <Share2 size={15} aria-hidden="true" /> Share on WhatsApp
                <span className="sr-only"> (opens in new tab)</span>
              </a>
              <a
                href={link ? `mailto:?subject=${encodeURIComponent("My referral link")}&body=${encodeURIComponent(link)}` : undefined}
                aria-disabled={link ? undefined : "true"}
                className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                  link ? "border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:text-brand-700" : "pointer-events-none border-slate-200 bg-slate-50 text-slate-400"
                }`}
              >
                <Mail size={15} aria-hidden="true" /> Share via Email
              </a>
            </div>
          </div>

          {/* QR — centered on web; QR-left / text-right on the native app */}
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-center native:flex-row native:items-center native:justify-start native:gap-3 native:text-left">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 native:order-2 native:flex-1">Scan to refer<span className="hidden native:mt-0.5 native:block native:text-[11px] native:font-normal native:normal-case native:tracking-normal native:text-slate-500">Point a phone camera at this code to open your signup link.</span></div>
            <div className="rounded-xl border border-slate-200 bg-white p-2 native:order-1 native:shrink-0">
              {link ? (
                <img src={qrUrl(link)} alt="QR code linking to your referral signup page" width="120" height="120" className="rounded" />
              ) : (
                <div className="grid h-[120px] w-[120px] place-items-center text-slate-300">
                  <QrCode size={40} aria-hidden="true" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* YOUR REFERRALS */}
      <div className={CARD}>
        <h2 className="text-[17px] font-semibold text-slate-950">Your referrals</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Each person moves through 5 stages. The bar fills as they progress — the fuller the bar, the closer to Admitted.
        </p>

        {/* numbered pipeline legend */}
        <ol className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3">
          {STAGE_ORDER.map((st, i) => (
            <li key={st} className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
                <span className="grid h-[19px] w-[19px] place-items-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">{i + 1}</span>
                {STAGE_LABELS[st]}
              </span>
              {i < STAGE_ORDER.length - 1 && <span className="px-0.5 text-slate-300" aria-hidden="true">→</span>}
            </li>
          ))}
        </ol>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> Loading…
          </div>
        ) : referrals.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Users size={22} aria-hidden="true" />
            </span>
            <div className="mt-3 text-[14px] font-semibold text-slate-800">No referrals tagged yet</div>
            <p className="mt-1 max-w-xs text-[12.5px] text-slate-500">Tag a lead you referred and watch it move through the stages here.</p>
            <button
              type="button"
              onClick={openTag}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-[13px] font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <Plus size={15} aria-hidden="true" /> Tag a referral
            </button>
          </div>
        ) : (
          <>
            {/* filter chips */}
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter referrals by stage">
              {[
                ["all", "All"],
                ["progress", "In progress"],
                ["admitted", "Admitted"],
                ["lost", "Lost"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    filter === key
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
                  }`}
                >
                  {label} <span className="tabular-nums opacity-80">{counts[key]}</span>
                </button>
              ))}
            </div>

            {shownReferrals.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-[13px] text-slate-500">
                No referrals match this filter.
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {shownReferrals.map((r) => {
                  const idx = Number.isInteger(r.lead.stageIndex) ? r.lead.stageIndex : STAGE_ORDER.indexOf(r.lead.stage);
                  const safeIdx = idx < 0 ? 0 : idx;
                  const isLost = r.lead.isLost;
                  const isAdmitted = !isLost && r.lead.stage === "ADMITTED";
                  const stageName = STAGE_LABELS[r.lead.stage] || r.lead.stage;
                  const pct = Math.max(6, Math.round((safeIdx / (STAGE_ORDER.length - 1)) * 100));
                  const caption = isLost
                    ? `Marked lost at ${stageName}`
                    : isAdmitted
                    ? "Completed — reached Admitted"
                    : `Stage ${safeIdx + 1} of 5 · ${stageName}`;
                  return (
                    <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-[12px] font-semibold text-brand-700">
                          {initialsOf(r.lead.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14.5px] font-semibold text-slate-900">{r.lead.name}</div>
                          <div className="truncate text-[12.5px] text-slate-500">
                            {r.lead.phone}
                            {r.lead.course ? ` · ${r.lead.course}` : ""}
                          </div>
                        </div>
                        {isLost ? (
                          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11.5px] font-bold text-slate-600">
                            <XCircle size={12} aria-hidden="true" /> Lost
                          </span>
                        ) : isAdmitted ? (
                          <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1 text-[11.5px] font-bold text-white">
                            <CheckCircle2 size={12} aria-hidden="true" /> Admitted
                          </span>
                        ) : (
                          <span className="inline-flex flex-shrink-0 items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11.5px] font-bold text-brand-700">
                            {stageName}
                          </span>
                        )}
                      </div>
                      {/* decorative progress bar; meaning is carried by the caption text below */}
                      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                        <div
                          className={`h-full rounded-full transition-all motion-reduce:transition-none ${isLost ? "bg-slate-300" : "bg-brand-600"}`}
                          style={{ width: `${isLost ? pct : isAdmitted ? 100 : pct}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className={`text-[12px] ${isLost ? "text-slate-500" : "text-slate-600"}`}>{caption}</div>
                        <span className="flex-shrink-0 text-[11.5px] tabular-nums text-slate-600">{isAdmitted ? "100%" : `${pct}%`}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
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
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
                    className="h-11 w-full rounded-lg border border-slate-300 px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500"
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
                    className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 pl-9 pr-3 text-[13px] outline-none focus:border-brand-400 focus:bg-white focus-visible:ring-2 focus-visible:ring-brand-500"
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
                  <Loader2 size={14} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> Searching…
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[13px] font-semibold text-slate-700">
                      {initialsOf(l.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-900">{l.name}</div>
                      <div className="truncate text-[13px] text-slate-500">{l.phone}{l.course ? ` · ${l.course}` : ""}</div>
                    </div>
                    {tagging === l.id ? <Loader2 size={14} aria-hidden="true" className="animate-spin text-brand-600 motion-reduce:animate-none" /> : <Plus size={15} aria-hidden="true" className="text-brand-600" />}
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
