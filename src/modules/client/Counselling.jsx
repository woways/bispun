import {
  useEffect,
  useRef,
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
  PhoneCall,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

import {
  Table,
  Badge,
  statusTone,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";
import { formatUiDateTime } from "../../lib/uiPreferences";
import CallCenterModal from "../../components/lead/CallCenterModal";
import DetailModal from "../../components/DetailModal";
import A11yDialog from "../../components/A11yDialog";
import SearchableSelect from "../../components/SearchableSelect";

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
  ["VIDEO_CALL", "Online Meet"],
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
  if (String(value || "").toUpperCase() === "VIDEO_CALL") return "Online Meet";
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

function CounsellingMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "indigo",
  onClick,
  active = false,
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full bg-white border rounded-xl p-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition ${active ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"} ${onClick ? "hover:border-indigo-200 hover:bg-indigo-50/30" : ""}`}
    >
      <div className="flex flex-row-reverse items-start justify-end gap-2.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">
            {label}
          </div>
          <div className="mt-1.5 text-[18px] leading-none font-bold tracking-tight text-slate-950">
            {value}
          </div>
        </div>
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${tones[tone] || tones.indigo}`}>
          <Icon size={15} aria-hidden="true" />
        </div>
      </div>
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 text-[12px] leading-5 text-slate-500">
        {detail}
      </div>
    </Component>
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

// Separated Date + Time inputs keep the combined "YYYY-MM-DDTHH:mm"
// datetime-local string in form state as the single source of truth, so submit
// logic stays unchanged.
function datePart(value) {
  return value && value.includes("T") ? value.split("T")[0] : value || "";
}
function timePart(value) {
  return value && value.includes("T") ? value.split("T")[1] : "";
}
function combineDateTime(date, time) {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
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

  // Drill-down: clicking a KPI card opens a dedicated full page (see DetailPage)
  // showing ONLY that card's records, instead of an in-page list filter.
  // `detailTriggerRef` captures the clicked card so focus returns to it on Back.
  const [detailView, setDetailView] = useState(null);
  const detailTriggerRef = useRef(null);
  function openDetail(key) {
    detailTriggerRef.current =
      typeof document !== "undefined" ? document.activeElement : null;
    setDetailView(key);
  }

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

  // Same filtering the KPI cards used, reused by the dedicated drill-down pages.
  function metricSessions(key) {
    return sessions.filter((session) => {
      const scheduled = new Date(session.scheduledAt);
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const nextDay = new Date(dayStart); nextDay.setDate(nextDay.getDate() + 1);
      const weekStart = new Date(dayStart);
      const day = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() + (day === 0 ? -6 : 1 - day));
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
      if (key === "today") return scheduled >= dayStart && scheduled < nextDay;
      if (key === "week") return scheduled >= weekStart && scheduled < weekEnd;
      if (key === "converted") return session.converted === true;
      if (key === "followups") return session.statusKey === "FOLLOW_UP" || Boolean(session.followUpAt && !["COMPLETED", "CANCELLED"].includes(session.statusKey));
      return true;
    });
  }

  const visibleSessions = sessions;

  const detailData = detailView
    ? (() => {
    const detailColumns = [
      "When",
      "Student",
      "Course",
      "Counsellor",
      "Mode",
      "Came With",
      "Status",
    ];

    const sessionRow = (session) => (
      <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
        <td className="px-4 py-3 text-[13px] text-slate-500 whitespace-nowrap">
          {formatDateTime(session.scheduledAt)}
        </td>
        <td className="px-4 py-3">
          <div className="text-[15px] font-semibold text-slate-800">
            {session.student}
          </div>
          {session.leadDisplayId ? (
            <div className="text-[12px] text-slate-500 mt-0.5">
              {session.leadDisplayId}
            </div>
          ) : null}
        </td>
        <td className="px-4 py-3 text-[15px] text-slate-600">{session.course}</td>
        <td className="px-4 py-3 text-[15px] font-medium text-slate-700">
          {session.counsellor}
        </td>
        <td className="px-4 py-3 text-[15px] text-slate-600 whitespace-nowrap">
          {prettyMode(session.mode)}
        </td>
        <td className="px-4 py-3 text-[15px] text-slate-600">
          {session.accompaniedBy}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Badge tone={statusTone(session.status)}>{session.status}</Badge>
            {session.converted ? <Badge tone="emerald">Converted</Badge> : null}
          </div>
        </td>
      </tr>
    );

    const detail = (() => {
      if (detailView === "week") {
        return {
          title: "This Week",
          subtitle: "Counselling sessions scheduled in the current week.",
          empty: "No sessions scheduled this week.",
          rows: metricSessions("week").map(sessionRow),
        };
      }
      if (detailView === "converted") {
        return {
          title: "Converted Sessions",
          subtitle: "Counselling sessions marked as converted.",
          empty: "No converted sessions yet.",
          rows: metricSessions("converted").map(sessionRow),
        };
      }
      if (detailView === "followups") {
        return {
          title: "Pending Follow-ups",
          subtitle: "Sessions requiring another interaction.",
          empty: "No pending follow-ups.",
          rows: metricSessions("followups").map(sessionRow),
        };
      }
      return {
        title: "Sessions Today",
        subtitle: "Counselling sessions scheduled today.",
        empty: "No sessions scheduled today.",
        rows: metricSessions("today").map(sessionRow),
      };
    })();

    return { ...detail, columns: detailColumns };
      })()
    : null;

  return (
    <div className="space-y-4">
      <DetailModal
        open={!!detailData}
        title={detailData?.title}
        subtitle={detailData?.subtitle}
        columns={detailData?.columns}
        rows={detailData?.rows}
        empty={detailData?.empty}
        caption={detailData?.title}
        onClose={() => setDetailView(null)}
      />
      <style>{`
        .counselling-select { appearance:none; padding-right:2.5rem !important; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364758b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right .75rem center; background-size:16px 16px; }
      `}</style>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 native:grid-cols-2 native:gap-2.5">
        <CounsellingMetric
          label="Sessions Today"
          value={summary.sessionsToday}
          icon={Calendar}
          detail="Counselling sessions scheduled today"
          tone="indigo"
          onClick={() => openDetail("today")}
          active={detailView === "today"}
        />
        <CounsellingMetric
          label="This Week"
          value={summary.thisWeek}
          icon={Video}
          detail="Total sessions in the current week"
          tone="slate"
          onClick={() => openDetail("week")}
          active={detailView === "week"}
        />
        <CounsellingMetric
          label="Conversion Rate"
          value={`${summary.conversionRate}%`}
          icon={TrendingUp}
          detail="Sessions marked as converted"
          tone="emerald"
          onClick={() => openDetail("converted")}
          active={detailView === "converted"}
        />
        <CounsellingMetric
          label="Pending Follow-ups"
          value={summary.pendingFollowUps}
          icon={Clock}
          detail="Sessions requiring another interaction"
          tone="amber"
          onClick={() => openDetail("followups")}
          active={detailView === "followups"}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2 native:flex-row native:flex-nowrap native:items-center native:max-w-full native:relative native:overflow-x-auto native:[-webkit-overflow-scrolling:touch]">
        <div className="relative flex-1 min-w-0 max-w-lg native:w-[220px] native:flex-none native:shrink-0">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search sessions"
            placeholder="Search student, course, counsellor or mode..."
            className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>

        <div className="sm:ml-auto inline-flex items-center gap-2 native:shrink-0">
          <SlidersHorizontal size={13} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="counselling-select h-9 px-3 border border-slate-200 bg-white rounded-lg text-[13px] font-semibold text-slate-700"
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
        ) : visibleSessions.length === 0 ? (
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
          <div className="w-full overflow-x-auto native:[-webkit-overflow-scrolling:touch] native:overscroll-x-contain">
          <Table
            caption="Counselling sessions — student, course, counsellor, mode, status, follow-up, notes and meeting link"
            columns={[
              "When",
              "Lead ID",
              "Student",
              "Course",
              "Counsellor",
              "Mode",
              "Came With",
              "Status",
              "Follow-up",
              "Notes",
              "Meeting",
              "Actions",
            ]}
            rows={visibleSessions.map((session) => (
              <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3 text-[13px] text-slate-500 whitespace-nowrap">
                  {formatDateTime(session.scheduledAt)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {session.leadDisplayId ? (
                    <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                      {session.leadDisplayId}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-[13px] font-semibold text-slate-900">
                    {session.student}
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">
                  {session.course}
                </td>
                <td className="px-4 py-3 text-[13px] font-medium text-slate-700 whitespace-nowrap">
                  {session.counsellor}
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">
                  {prettyMode(session.mode)}
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">
                  {session.accompaniedBy}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <Badge tone={statusTone(session.status)}>{session.status}</Badge>
                    {session.converted ? <Badge tone="emerald">Converted</Badge> : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600 whitespace-nowrap">
                  {session.followUpAt ? (
                    formatDateTime(session.followUpAt)
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600">
                  {(session.notes || session.remarks) !== "—" ? (
                    <span
                      className="block max-w-[220px] truncate"
                      title={session.notes || session.remarks}
                    >
                      {session.notes || session.remarks}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {session.meetingLink ? (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={session.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="h-8 px-2.5 text-[13px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 rounded-lg inline-flex items-center gap-1.5"
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                        Join
                      </a>
                      <button
                        type="button"
                        onClick={() => copyLink(session)}
                        aria-label={`Copy meeting link for ${session.student}`}
                        className="w-8 h-8 text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg inline-flex items-center justify-center"
                      >
                        {copiedId === session.id ? (
                          <CheckCircle2 size={12} className="text-emerald-600" aria-hidden="true" />
                        ) : (
                          <Copy size={12} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      title="Call student"
                      aria-label={`Call ${session.student}`}
                      onClick={() => setCallLead({ id: session.leadId || null, name: session.student, phone: session.phone })}
                      disabled={!session.phone}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-50 disabled:text-slate-300 disabled:hover:bg-transparent"
                    >
                      <PhoneCall size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="Edit"
                      aria-label={`Edit ${session.student}`}
                      onClick={() => openEdit(session)}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      aria-label={`Delete ${session.student}`}
                      onClick={() => remove(session)}
                      disabled={actionId === session.id}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                    >
                      {actionId === session.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
          </div>
        )}
      </div>

      <CallCenterModal
        open={Boolean(callLead)}
        onClose={() => setCallLead(null)}
        lead={callLead}
      />

      {modalOpen ? (
        <A11yDialog
          onClose={() => setModalOpen(false)}
          backdropClassName="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4"
          panelClassName="w-full max-w-3xl max-h-[92vh] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
        >
          {(headingId) => (
            <>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div id={headingId} className="text-[17px] font-bold text-slate-950">
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
                    <SearchableSelect
                      ariaLabel="Course / Interest stream"
                      loading={optionsLoading}
                      placeholder={optionsLoading ? "Loading streams..." : "Select stream"}
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
                      onChange={(value) => {
                        setForm((current) => ({
                          ...current,
                          course: value,
                          courseOther:
                            value === OTHER_OPTION ? current.courseOther : "",
                        }));
                      }}
                      options={[
                        ...streamOptions.map((stream) => ({
                          value: stream.name,
                          label: stream.name,
                        })),
                        { value: OTHER_OPTION, label: "Other" },
                      ]}
                    />

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
                    className="counselling-select w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
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
                    className="counselling-select w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                  >
                    {MODE_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Date & Time" required>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      required
                      aria-label="Scheduled date"
                      value={datePart(form.scheduledAt)}
                      onChange={(event) =>
                        updateForm(
                          "scheduledAt",
                          combineDateTime(event.target.value, timePart(form.scheduledAt))
                        )
                      }
                      onClick={(event) => event.currentTarget.showPicker?.()}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] cursor-pointer"
                    />
                    <input
                      type="time"
                      required
                      aria-label="Scheduled time"
                      value={timePart(form.scheduledAt)}
                      onChange={(event) =>
                        updateForm(
                          "scheduledAt",
                          combineDateTime(datePart(form.scheduledAt), event.target.value)
                        )
                      }
                      onClick={(event) => event.currentTarget.showPicker?.()}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] cursor-pointer"
                    />
                  </div>
                </Field>
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value)}
                    className="counselling-select w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
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
                      className="counselling-select w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
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
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      aria-label="Follow-up date"
                      value={datePart(form.followUpAt)}
                      onChange={(event) =>
                        updateForm(
                          "followUpAt",
                          combineDateTime(event.target.value, timePart(form.followUpAt))
                        )
                      }
                      onClick={(event) => event.currentTarget.showPicker?.()}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] cursor-pointer"
                    />
                    <input
                      type="time"
                      aria-label="Follow-up time"
                      value={timePart(form.followUpAt)}
                      onChange={(event) =>
                        updateForm(
                          "followUpAt",
                          combineDateTime(datePart(form.followUpAt), event.target.value)
                        )
                      }
                      onClick={(event) => event.currentTarget.showPicker?.()}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] cursor-pointer"
                    />
                  </div>
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
            </>
          )}
        </A11yDialog>
      ) : null}
    </div>
  );
}
