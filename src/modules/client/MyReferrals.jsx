import { useEffect, useMemo, useState } from "react";

import {
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Share2,
  Users,
  TrendingUp,
  Gift,
  QrCode,
  Plus,
  Search,
  X,
} from "lucide-react";

import { apiRequest } from "../../lib/api";

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
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-700 to-brand-900 px-6 py-5 text-white">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-100">
            How referral works
          </div>
          <div className="text-[20px] font-semibold tracking-tight">
            From share to reward in 4 steps
          </div>
        </div>
        <div className="hidden rounded-full bg-white/10 px-4 py-2 text-[12px] font-semibold text-brand-100 sm:block">
          Tap a step to learn more
        </div>
      </div>
      <div className="px-6 py-9 sm:px-10">
        <div className="relative">
          {/* connector segments between nodes */}
          <div className="pointer-events-none absolute top-[23px] hidden h-1 sm:block" style={{ left: "19%", width: "12%" }}>
            <div className="h-1 w-full rounded-full bg-brand-500" />
          </div>
          <div className="pointer-events-none absolute top-[23px] hidden h-1 sm:block" style={{ left: "44%", width: "12%" }}>
            <div className="h-1 w-full rounded-full bg-brand-500" />
          </div>
          <div className="pointer-events-none absolute top-[23px] hidden h-1 sm:block" style={{ left: "69%", width: "12%" }}>
            <div className="h-1 w-full rounded-full bg-brand-500" />
          </div>

          <div className="relative z-10 grid grid-cols-4 gap-2">
            {HOW_STEPS.map((s, i) => {
              const Icon = s.icon;
              const on = i === active;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActive(i)}
                  className="group flex flex-col items-center gap-4 text-center"
                >
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm transition ${
                      on ? "scale-110 opacity-100 shadow-[0_12px_30px_rgba(79,70,229,.35)]" : "opacity-60 group-hover:scale-105 group-hover:opacity-90"
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className={`text-[13px] font-semibold ${on ? "text-brand-700" : "text-slate-900"}`}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
            <div className="text-[15px] font-semibold text-brand-800">{Step.title}</div>
            <div className="mt-1 text-[13px] text-slate-600">{Step.body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                          */
/* ------------------------------------------------------------------ */

export default function MyReferrals({ currentUser }) {
  const [code, setCode] = useState("");
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState({ total: 0, admitted: 0, inProgress: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState([]);
  const [leadLoading, setLeadLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [referrerId, setReferrerId] = useState("");
  const [tagging, setTagging] = useState("");

  const isAdmin =
    currentUser?.role === "CLIENT_ADMIN" ||
    currentUser?.permissions?.canViewTeamTargets === true;

  const link = code ? `https://www.bispun.com/?ref=${encodeURIComponent(code)}` : "";

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

  function copy(text, which) {
    try {
      navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 1400);
    } catch (e) {
      // ignore
    }
  }

  const convRate = stats.total > 0 ? Math.round((stats.admitted / stats.total) * 100) : 0;

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openTag}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          <Plus size={15} />
          Tag a referral
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* SHARE STRIP */}
      <div className="grid gap-5 lg:grid-cols-[1.5fr_auto]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
          <div className="text-[20px] font-semibold tracking-[-0.015em] text-slate-950">Share &amp; earn</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Referral code</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[16px] font-bold tracking-wide text-slate-900">{code || "…"}</span>
                <button
                  type="button"
                  onClick={() => copy(code, "code")}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1 text-[13px] font-semibold text-white hover:bg-brand-700"
                >
                  {copied === "code" ? <Check size={12} /> : <Copy size={12} />}
                  {copied === "code" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Referral link</div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-slate-700">{link || "…"}</span>
                <button
                  type="button"
                  onClick={() => copy(link, "link")}
                  className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {copied === "link" ? <Check size={12} /> : <Copy size={12} />}
                  {copied === "link" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Check this out: ${link}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 rounded-xl bg-brand-600 py-2.5 text-center text-[12px] font-semibold text-white hover:bg-brand-700"
            >
              Share on WhatsApp
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent("My referral link")}&body=${encodeURIComponent(link)}`}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Share via Email
            </a>
          </div>
        </div>

        {/* QR card */}
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Scan to refer</div>
          <div className="mt-3 rounded-xl border border-slate-200 p-2">
            {link ? (
              <img src={qrUrl(link)} alt="Referral QR" width="132" height="132" className="rounded" />
            ) : (
              <div className="flex h-[132px] w-[132px] items-center justify-center text-slate-300">
                <QrCode size={40} />
              </div>
            )}
          </div>
          <a
            href={link ? qrUrl(link) : "#"}
            target="_blank"
            rel="noreferrer"
            className="mt-3 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
          >
            Open QR
          </a>
        </div>
      </div>

      {/* STATS */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Referrals</div>
              <div className="mt-2 space-y-1 text-[13px]">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-brand-500" />Total <b className="ml-auto text-slate-900">{stats.total}</b></div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" />Admitted <b className="ml-auto text-slate-900">{stats.admitted}</b></div>
              </div>
            </div>
            <div className="relative h-20 w-20">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#eef2ff" strokeWidth="4" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" strokeDasharray="100" strokeDashoffset={100 - convRate} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-slate-900">{convRate}%</div>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">In progress</div>
          <div className="mt-2 text-[34px] font-bold leading-none text-brand-600">{stats.inProgress}</div>
          <div className="mt-1 text-[14px] text-slate-400">Moving through stages</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
          <div className="text-[13px] font-semibold uppercase tracking-wide text-slate-400">Admitted</div>
          <div className="mt-2 text-[34px] font-bold leading-none text-emerald-600">{stats.admitted}</div>
          <div className="mt-1 text-[14px] text-slate-400">Reached final stage</div>
        </div>
      </div>

      {/* HOW IT WORKS */}
      <HowItWorks />

      {/* REFERRAL LIST with live stages */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_8px_22px_rgba(79,70,229,0.08)]">
        <div className="text-[15px] font-semibold text-slate-900">Your referrals</div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : referrals.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
            <div className="text-[13px] font-semibold text-slate-700">No referrals yet</div>
            <div className="mt-1 text-[12px] text-slate-500">Share your link to see your referrals appear here.</div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {referrals.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-indigo-400 hover:ring-2 hover:ring-indigo-100 hover:shadow-[0_6px_18px_rgba(79,70,229,0.08)]">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[12px] font-semibold text-white">
                    {initialsOf(r.lead.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-bold text-slate-900">{r.lead.name}</div>
                    <div className="text-[13px] text-slate-400">{r.lead.phone}{r.lead.course ? ` · ${r.lead.course}` : ""}</div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      r.lead.stage === "ADMITTED"
                        ? "bg-emerald-50 text-emerald-600"
                        : r.lead.isLost
                        ? "bg-rose-50 text-rose-600"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {STAGE_LABELS[r.lead.stage] || r.lead.stage}
                  </span>
                </div>
                {/* stage rail */}
                <div className="mt-4 flex items-center gap-1.5">
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
                <div className="mt-1.5 flex justify-between gap-1 text-[11px] font-semibold uppercase tracking-tight text-slate-400">
                  {STAGE_ORDER.map((st, i) => (
                    <span key={st} className={i === r.lead.stageIndex && !r.lead.isLost ? "text-brand-600" : ""}>
                      {STAGE_LABELS[st]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tag a referral modal */}
      {tagOpen && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div className="text-sm font-bold text-slate-950">Tag a lead as referred</div>
              <button type="button" onClick={() => setTagOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 border-b border-slate-100 p-4">
              {isAdmin && (
                <div>
                  <label className="mb-1 block text-[13px] font-semibold uppercase tracking-wide text-slate-400">Referred by</label>
                  <select
                    value={referrerId}
                    onChange={(e) => setReferrerId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-brand-400"
                  >
                    <option value="">Me ({currentUser?.name || "self"})</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={leadQuery}
                  onChange={(e) => { setLeadQuery(e.target.value); searchLeads(e.target.value); }}
                  placeholder="Search leads by name, phone or email"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] outline-none focus:border-brand-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {leadLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin" /> Searching...
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
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50 disabled:opacity-50"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[13px] font-semibold text-slate-700">
                      {initialsOf(l.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-slate-900">{l.name}</div>
                      <div className="truncate text-[13px] text-slate-400">{l.phone}{l.course ? ` · ${l.course}` : ""}</div>
                    </div>
                    {tagging === l.id ? <Loader2 size={14} className="animate-spin text-brand-600" /> : <Plus size={15} className="text-brand-600" />}
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
