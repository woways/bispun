import {
  useEffect,
  useState,
} from "react";

import {
  Plus,
  Calendar,
  Video,
  TrendingUp,
  Clock,
  Copy,
  ExternalLink,
  Search,
  SlidersHorizontal,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
} from "lucide-react";

import {
  Badge,
  statusTone,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";
import { formatUiDateTime } from "../../lib/uiPreferences";
import CallCenterModal from "../../components/lead/CallCenterModal";

const OTHER_OPTION = "__OTHER__";

const CAME_WITH_OPTIONS = [
  "Alone",
  "Parent",
  "Both Parents",
  "Brother",
  "Sister",
  "Guardian",
  "Parent + Sibling",
  "Family / Relative",
  "Friend(s)",
];

const EMPTY_FORM = {
  studentName: "",
  studentPhone: "",
  alternatePhone: "",
  studentEmail: "",
  course: "",
  courseOther: "",
  counsellorName: "",
  mode: "IN_PERSON",
  meetingLink: "",
  accompaniedBy: "",
  accompaniedByOther: "",
  scheduledAt: "",
  status: "SCHEDULED",
  notes: "",
  followUpAt: "",
  converted: false,
};

const STATUS_OPTIONS = [
  ["SCHEDULED", "Scheduled"],
  ["FOLLOW_UP", "Follow Up"],
  ["COMPLETED", "Completed"],
  ["NO_SHOW", "No Show"],
  ["CANCELLED", "Cancelled"],
];

const MODE_OPTIONS = [
  ["IN_PERSON", "In Person"],
  ["VIDEO_CALL", "Video Call"],
  ["PHONE_CALL", "Phone Call"],
];

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1000
  );
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "—";
  return formatUiDateTime(value);
}

function prettyMode(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

function intelligenceTone(score) {
  const value = Number(score || 0);
  if (value >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value >= 65) return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (value >= 45) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function CounsellingMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "indigo",
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.09em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-[22px] leading-none font-bold tracking-tight text-slate-950">
            {value}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${tones[tone] || tones.indigo}`}>
          <Icon size={17} />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 text-[13px] leading-5 text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-[13px] uppercase tracking-[0.08em] font-semibold text-slate-400">
        {label}
      </div>
      <div className="text-[15px] font-semibold text-slate-800 mt-1">
        {value || "—"}
      </div>
    </div>
  );
}

function Field({ label, required, full, children }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <div className="text-[13px] font-semibold text-slate-600 mb-1.5">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </div>
      {children}
    </label>
  );
}

export default function Counselling({ selectedYear = "all", market = "DOMESTIC" }) {
  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState({
    sessionsToday: 0,
    thisWeek: 0,
    conversionRate: 0,
    pendingFollowUps: 0,
  });
  const [streamOptions, setStreamOptions] = useState([]);
  const [counsellorOptions, setCounsellorOptions] = useState([]);
  const [walkInStudents, setWalkInStudents] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [matchedWalkInId, setMatchedWalkInId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionId, setActionId] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [callLead, setCallLead] = useState(null);

  async function loadData() {
    setLoading(true);
    setLoadError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (selectedYear !== "all") params.set("year", selectedYear);
      if (market && market !== "ALL") params.set("market", market);
      const query = params.toString();

      const data = await apiRequest(
        `/api/client/counselling${query ? `?${query}` : ""}`
      );

      setSessions(data.sessions || []);
      setSummary(
        data.summary || {
          sessionsToday: 0,
          thisWeek: 0,
          conversionRate: 0,
          pendingFollowUps: 0,
        }
      );
    } catch (error) {
      setLoadError(error?.data?.message || "Unable to load counselling sessions");
    } finally {
      setLoading(false);
    }
  }

  async function loadFormOptions(showError = false) {
    setOptionsLoading(true);

    try {
      const activeMarket =
        market === "INTERNATIONAL" ? "INTERNATIONAL" : "DOMESTIC";
      const data = await apiRequest(
        `/api/client/counselling/options?market=${encodeURIComponent(activeMarket)}`
      );

      setStreamOptions(data.streams || []);
      setCounsellorOptions(data.counsellors || []);
      setWalkInStudents(data.walkInStudents || []);
    } catch (error) {
      setStreamOptions([]);
      setCounsellorOptions([]);
      setWalkInStudents([]);
      if (showError) {
        setFormError(
          error?.data?.message || "Unable to load counselling form options"
        );
      }
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadData, 250);
    return () => window.clearTimeout(timer);
  }, [search, statusFilter, selectedYear, market]);

  useEffect(() => {
    loadFormOptions();
  }, [market]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function applyExactWalkInMatch(studentName) {
    const normalized = String(studentName || "").trim().toLowerCase();

    if (!normalized) {
      setMatchedWalkInId("");
      return;
    }

    const match = walkInStudents.find(
      (item) =>
        String(item.studentName || "").trim().toLowerCase() === normalized
    );

    if (!match) {
      setMatchedWalkInId("");
      return;
    }

    setMatchedWalkInId(match.id);
    setForm((current) => ({
      ...current,
      studentName,
      studentPhone: match.phone || current.studentPhone,
      alternatePhone: match.alternatePhone || current.alternatePhone,
      studentEmail: match.email || current.studentEmail,
      course: match.course || current.course,
      courseOther: match.course || current.courseOther,
      accompaniedBy: match.accompaniedBy || current.accompaniedBy,
      accompaniedByOther: match.accompaniedBy || current.accompaniedByOther,
      counsellorName: match.counsellorName || current.counsellorName,
    }));
  }

  function openCreate() {
    setEditing(null);
    setMatchedWalkInId("");
    setFormError("");
    setForm({
      ...EMPTY_FORM,
      scheduledAt: toLocalInput(new Date()),
    });
    setModalOpen(true);
    loadFormOptions(true);
  }

  function openEdit(session) {
    setEditing(session);
    setFormError("");
    setMatchedWalkInId("");
    const existingCourse = session.course === "—" ? "" : session.course || "";
    const existingCameWith =
      session.accompaniedBy === "—" ? "" : session.accompaniedBy || "";
    setForm({
      studentName: session.studentName || session.student || "",
      studentPhone: session.phone || "",
      alternatePhone: session.alternatePhone || "",
      studentEmail: session.email || "",
      course: existingCourse,
      courseOther: existingCourse,
      counsellorName: session.counsellorName || "",
      mode: session.mode || "IN_PERSON",
      meetingLink: session.meetingLink || "",
      accompaniedBy: existingCameWith,
      accompaniedByOther: existingCameWith,
      scheduledAt: toLocalInput(session.scheduledAt),
      status: session.statusKey || "SCHEDULED",
      notes:
        (session.notes === "—" ? "" : session.notes) ||
        (session.remarks === "—" ? "" : session.remarks) ||
        "",
      followUpAt: toLocalInput(session.followUpAt),
      converted: Boolean(session.converted),
    });
    setModalOpen(true);
    loadFormOptions(true);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const resolvedCourse =
        form.course === OTHER_OPTION
          ? form.courseOther.trim()
          : String(form.course || "").trim();

      const resolvedAccompaniedBy =
        form.accompaniedBy === OTHER_OPTION
          ? form.accompaniedByOther.trim()
          : String(form.accompaniedBy || "").trim();

      const payload = {
        studentName: form.studentName,
        studentPhone: form.studentPhone,
        alternatePhone: form.alternatePhone,
        studentEmail: form.studentEmail,
        course: resolvedCourse,
        counsellorName: form.counsellorName,
        mode: form.mode,
        meetingLink: form.meetingLink,
        accompaniedBy: resolvedAccompaniedBy,
        scheduledAt: form.scheduledAt
          ? new Date(form.scheduledAt).toISOString()
          : null,
        status: form.status,
        notes: form.notes,
        followUpAt: form.followUpAt
          ? new Date(form.followUpAt).toISOString()
          : null,
        converted: form.converted,
        market,
      };

      await apiRequest(
        editing
          ? `/api/client/counselling/${editing.id}`
          : "/api/client/counselling",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setModalOpen(false);
      await loadData();
    } catch (error) {
      setFormError(error?.data?.message || "Unable to save counselling session");
    } finally {
      setSaving(false);
    }
  }

  async function remove(session) {
    if (!window.confirm(`Delete counselling session for ${session.studentName}?`)) return;

    setActionId(session.id);
    try {
      await apiRequest(`/api/client/counselling/${session.id}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (error) {
      window.alert(error?.data?.message || "Unable to delete counselling session");
    } finally {
      setActionId("");
    }
  }

  async function copyLink(session) {
    if (!session.meetingLink) return;
    try {
      await navigator.clipboard.writeText(session.meetingLink);
      setCopiedId(session.id);
      window.setTimeout(() => setCopiedId(""), 1500);
    } catch {
      window.alert("Unable to copy meeting link");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Engagement / Counselling
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {market === "INTERNATIONAL" ? "International Counselling" : "Domestic Counselling"}
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            Manage sessions, meeting links, notes and follow-up activity.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus size={14} />
          Schedule Session
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <CounsellingMetric
          label="Sessions Today"
          value={summary.sessionsToday}
          icon={Calendar}
          detail="Counselling sessions scheduled today"
          tone="indigo"
        />
        <CounsellingMetric
          label="This Week"
          value={summary.thisWeek}
          icon={Video}
          detail="Total sessions in the current week"
          tone="slate"
        />
        <CounsellingMetric
          label="Conversion Rate"
          value={`${summary.conversionRate}%`}
          icon={TrendingUp}
          detail="Sessions marked as converted"
          tone="emerald"
        />
        <CounsellingMetric
          label="Pending Follow-ups"
          value={summary.pendingFollowUps}
          icon={Clock}
          detail="Sessions requiring another interaction"
          tone="amber"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0 max-w-lg">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student, course, counsellor or mode..."
            className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>

        <div className="sm:ml-auto inline-flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 px-3 border border-slate-200 bg-white rounded-lg text-[13px] font-semibold text-slate-700"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {loadError ? (
        <div className="flex items-start gap-2 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={14} className="mt-0.5" />
          {loadError}
        </div>
      ) : null}

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl py-16 flex items-center justify-center gap-2 text-[15px] text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading counselling sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-16 text-center px-5">
            <Calendar size={24} className="mx-auto text-slate-300" />
            <div className="mt-3 text-[15px] font-semibold text-slate-800">
              No counselling sessions found
            </div>
            <div className="mt-1 text-[13px] text-slate-500">
              Schedule the first counselling session to start tracking activity.
            </div>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-base font-bold text-slate-950">
                        {session.student}
                      </div>
                      <Badge tone="slate">{session.course}</Badge>
                      <Badge tone={statusTone(session.status)}>{session.status}</Badge>
                      {session.converted ? <Badge tone="emerald">Converted</Badge> : null}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-6 gap-y-4 mt-5">
                      <Info label="When" value={formatDateTime(session.scheduledAt)} />
                      <Info label="Counsellor" value={session.counsellor} />
                      <Info label="Mode" value={prettyMode(session.mode)} />
                      <Info label="Came With" value={session.accompaniedBy} />
                    </div>

                    {session.intelligence ? (
                      <div className="mt-5 overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/40">
                        <div className="grid grid-cols-1 divide-y divide-indigo-100 sm:grid-cols-[140px_160px_minmax(0,1fr)] sm:divide-x sm:divide-y-0">
                          <div className="p-3.5">
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-400">Lead Score</div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className={`inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-[15px] font-extrabold ${intelligenceTone(session.intelligence.score)}`}>
                                {session.intelligence.score}
                              </span>
                              <span className="text-[11px] text-slate-400">/100</span>
                            </div>
                          </div>

                          <div className="p-3.5">
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-400">Conversion Chance</div>
                            <div className="mt-2 text-[14px] font-bold text-slate-900">{session.intelligence.conversionChance}</div>
                            <div className="mt-0.5 text-[11px] text-slate-500">{session.intelligence.conversionPercent}% signal</div>
                          </div>

                          <div className="p-3.5">
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-400">Next Best Action</div>
                            <div className="mt-2 text-[12px] font-semibold leading-5 text-indigo-950">{session.intelligence.nextBestAction}</div>
                          </div>
                        </div>

                        {Array.isArray(session.intelligence.reasons) && session.intelligence.reasons.length ? (
                          <details className="border-t border-indigo-100 bg-white/70">
                            <summary className="cursor-pointer list-none px-3.5 py-2.5 text-[11px] font-semibold text-indigo-700 [&::-webkit-details-marker]:hidden">
                              Why this score
                            </summary>
                            <div className="space-y-1.5 px-3.5 pb-3">
                              {session.intelligence.reasons.map((reason, index) => (
                                <div key={`${reason}-${index}`} className="flex items-start gap-2 text-[11px] leading-4 text-slate-600">
                                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-500" />
                                  <span>{reason}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ) : null}

                    {session.meetingLink ? (
                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                        <div className="h-8 max-w-full inline-flex items-center gap-2 text-[13px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-700 px-2.5 rounded-lg">
                          <Video size={12} />
                          <span className="truncate max-w-[min(360px,65vw)]">{session.meetingLink}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyLink(session)}
                          className="h-8 px-2.5 text-[13px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5"
                        >
                          {copiedId === session.id ? (
                            <CheckCircle2 size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} />
                          )}
                          {copiedId === session.id ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={session.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="h-8 px-2.5 text-[13px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg inline-flex items-center gap-1.5"
                        >
                          <ExternalLink size={12} />
                          Join
                        </a>
                      </div>
                    ) : null}

                    {(session.notes || session.remarks) !== "—" ? (
                      <div className="mt-4 text-[13px] bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                        <span className="font-semibold text-slate-700">Notes:</span>{" "}
                        <span className="text-slate-600">
                          {session.notes || session.remarks}
                        </span>
                      </div>
                    ) : null}

                    {session.followUpAt ? (
                      <div className="mt-3 text-[13px] font-medium text-slate-500 inline-flex items-center gap-1.5">
                        <Clock size={12} />
                        Follow-up:
                        <span className="text-slate-700">
                          {formatDateTime(session.followUpAt)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      title="Call student"
                      onClick={() => setCallLead({ id: session.leadId || null, name: session.student, phone: session.phone })}
                      disabled={!session.phone}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                    >
                      <PhoneCall size={14} />
                    </button>
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => openEdit(session)}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => remove(session)}
                      disabled={actionId === session.id}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {actionId === session.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <CallCenterModal
        open={Boolean(callLead)}
        onClose={() => setCallLead(null)}
        lead={callLead}
      />

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[92vh] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[17px] font-bold text-slate-950">
                  {editing ? "Edit Counselling Session" : "Schedule Counselling Session"}
                </div>
                <div className="text-[13px] text-slate-500 mt-1">
                  Enter student details or match an existing Walk-in student.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submit} className="p-5 overflow-y-auto max-h-[calc(92vh-74px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Student Name" required>
                  <div className="space-y-1.5">
                    <input
                      required
                      value={form.studentName}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateForm("studentName", value);
                        applyExactWalkInMatch(value);
                      }}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                    />
                    {matchedWalkInId ? (
                      <div className="text-[12px] font-medium text-emerald-600">
                        Exact Walk-in match found — details auto-filled.
                      </div>
                    ) : null}
                  </div>
                </Field>
                <Field label="Phone">
                  <input
                    value={form.studentPhone}
                    onChange={(event) => updateForm("studentPhone", event.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>
                <Field label="Alternate Phone">
                  <input
                    type="tel"
                    value={form.alternatePhone}
                    onChange={(event) =>
                      updateForm("alternatePhone", event.target.value)
                    }
                    placeholder="Optional alternate number"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.studentEmail}
                    onChange={(event) => updateForm("studentEmail", event.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>
                <Field label="Course / Interest">
                  <div className="space-y-2">
                    <select
                      value={
                        form.course === OTHER_OPTION
                          ? OTHER_OPTION
                          : streamOptions.some(
                              (stream) => stream.name === form.course
                            )
                            ? form.course
                            : form.course
                              ? OTHER_OPTION
                              : ""
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((current) => ({
                          ...current,
                          course: value,
                          courseOther:
                            value === OTHER_OPTION ? current.courseOther : "",
                        }));
                      }}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                    >
                      <option value="">
                        {optionsLoading ? "Loading streams..." : "Select stream"}
                      </option>
                      {streamOptions.map((stream) => (
                        <option key={stream.id} value={stream.name}>
                          {stream.name}
                        </option>
                      ))}
                      <option value={OTHER_OPTION}>Other</option>
                    </select>

                    {(form.course === OTHER_OPTION ||
                      (form.course &&
                        !streamOptions.some(
                          (stream) => stream.name === form.course
                        ))) ? (
                      <input
                        value={
                          form.course === OTHER_OPTION
                            ? form.courseOther
                            : form.courseOther || form.course
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            course: OTHER_OPTION,
                            courseOther: event.target.value,
                          }))
                        }
                        placeholder="Type course / interest"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                      />
                    ) : null}
                  </div>
                </Field>
                <Field label="Counsellor">
                  <select
                    value={form.counsellorName}
                    onChange={(event) =>
                      updateForm("counsellorName", event.target.value)
                    }
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                  >
                    <option value="">
                      {optionsLoading ? "Loading employees..." : "Unassigned"}
                    </option>
                    {form.counsellorName &&
                    !counsellorOptions.some(
                      (user) => user.name === form.counsellorName
                    ) ? (
                      <option value={form.counsellorName}>
                        {form.counsellorName} (current)
                      </option>
                    ) : null}
                    {counsellorOptions.map((user) => (
                      <option key={user.id} value={user.name}>
                        {user.name}
                        {user.jobTitle
                          ? ` · ${user.jobTitle}`
                          : user.role
                            ? ` · ${String(user.role).replaceAll("_", " ")}`
                            : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mode">
                  <select
                    value={form.mode}
                    onChange={(event) => updateForm("mode", event.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                  >
                    {MODE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Date & Time" required>
                  <input
                    type="datetime-local"
                    required
                    value={form.scheduledAt}
                    onChange={(event) => updateForm("scheduledAt", event.target.value)}
                    onClick={(event) => event.currentTarget.showPicker?.()}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] cursor-pointer"
                  />
                </Field>
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                  >
                    {STATUS_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Came With">
                  <div className="space-y-2">
                    <select
                      value={
                        form.accompaniedBy === OTHER_OPTION
                          ? OTHER_OPTION
                          : CAME_WITH_OPTIONS.includes(form.accompaniedBy)
                            ? form.accompaniedBy
                            : form.accompaniedBy
                              ? OTHER_OPTION
                              : ""
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((current) => ({
                          ...current,
                          accompaniedBy: value,
                          accompaniedByOther:
                            value === OTHER_OPTION
                              ? current.accompaniedByOther
                              : "",
                        }));
                      }}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                    >
                      <option value="">Select</option>
                      {CAME_WITH_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value={OTHER_OPTION}>Other</option>
                    </select>

                    {(form.accompaniedBy === OTHER_OPTION ||
                      (form.accompaniedBy &&
                        !CAME_WITH_OPTIONS.includes(form.accompaniedBy))) ? (
                      <input
                        value={
                          form.accompaniedBy === OTHER_OPTION
                            ? form.accompaniedByOther
                            : form.accompaniedByOther || form.accompaniedBy
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            accompaniedBy: OTHER_OPTION,
                            accompaniedByOther: event.target.value,
                          }))
                        }
                        placeholder="Specify who came with the student"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                      />
                    ) : null}
                  </div>
                </Field>
                <Field label="Meeting Link">
                  <input
                    type="url"
                    value={form.meetingLink}
                    onChange={(event) => updateForm("meetingLink", event.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>
                <Field label="Follow-up Date & Time">
                  <input
                    type="datetime-local"
                    value={form.followUpAt}
                    onChange={(event) => updateForm("followUpAt", event.target.value)}
                    onClick={(event) => event.currentTarget.showPicker?.()}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] cursor-pointer"
                  />
                </Field>
                <Field label="Notes" full>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>

                <label className="sm:col-span-2 inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.converted}
                    onChange={(event) => updateForm("converted", event.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                  />
                  Mark this counselling as converted
                </label>
              </div>

              {formError ? (
                <div className="mt-4 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  {formError}
                </div>
              ) : null}

              <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-9 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                  {editing ? "Save Changes" : "Schedule Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
