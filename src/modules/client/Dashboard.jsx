import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import {
  UserCheck,
  DollarSign,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Target,
  CircleDollarSign,
  Wallet,
  Users,
  Activity,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Pencil,
  MapPin,
  UserRound,
  CheckCircle2,
  MessageCircle,
  Download,
  ArrowUpRight,
  Phone,
  Video,
  Pin,
} from "lucide-react";

// Charts are code-split so the ~556KB recharts library is NOT loaded on the
// initial authenticated paint (Dashboard is the landing route). Each chart body
// lives in ./DashboardCharts and is lazy-loaded behind a <Suspense> with a
// height-reserving ChartSkeleton fallback, so the dashboard shell paints first
// and recharts streams in afterwards.
const RevenueTrendChart = lazy(() =>
  import("./DashboardCharts").then((m) => ({ default: m.RevenueTrendChart }))
);
const LeadsBySourceChart = lazy(() =>
  import("./DashboardCharts").then((m) => ({ default: m.LeadsBySourceChart }))
);
const AdmissionsByMonthChart = lazy(() =>
  import("./DashboardCharts").then((m) => ({ default: m.AdmissionsByMonthChart }))
);

import { apiRequest } from "../../lib/api";
import { brandColor } from "../../lib/brandTheme";
import { formatUiDate, formatUiTime, formatUiDateTime } from "../../lib/uiPreferences";
import { donutCenterTotal } from "../../lib/donutCenterTotal";
import { MobileRecordCard } from "../../components/mobileUi";
import ChartSkeleton from "../../components/ChartSkeleton";
import { Badge, statusTone } from "../../components/ui";
import GuestPicker from "../../components/GuestPicker";

const PIE_COLORS = [
  "#1d4ed8",
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#334155",
  "#94a3b8",
];

const EVENT_TYPES = [
  { value: "MEETING", label: "Meeting" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "COUNSELLING", label: "Counselling" },
  { value: "ADMISSION", label: "Admission" },
  { value: "PAYMENT", label: "Payment" },
  { value: "REMINDER", label: "Reminder" },
  { value: "OTHER", label: "Other" },
];

const EVENT_TYPE_STYLES = {
  MEETING:
    "bg-indigo-50 text-indigo-700 border-indigo-100",
  FOLLOW_UP:
    "bg-amber-50 text-amber-700 border-amber-100",
  COUNSELLING:
    "bg-violet-50 text-violet-700 border-violet-100",
  ADMISSION:
    "bg-indigo-50 text-indigo-700 border-indigo-100",
  PAYMENT:
    "bg-cyan-50 text-cyan-700 border-cyan-100",
  REMINDER:
    "bg-rose-50 text-rose-700 border-rose-100",
  OTHER:
    "bg-slate-100 text-slate-700 border-slate-200",
};

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

// Screen-reader money: spells the unit instead of the ₹ glyph, whose SR
// announcement is inconsistent (NVDA/JAWS may say "rupee sign", "rupees", or
// nothing at default symbol levels). Used ONLY in the sr-only chart data tables;
// the visible money() with ₹ is unchanged. (accessibility-lead requirement.)
function srMoney(value) {
  return `${new Intl.NumberFormat("en-IN").format(Number(value || 0))} rupees`;
}

function axisMoney(value) {
  const amount = Number(value || 0);

  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }

  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }

  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}k`;
  }

  return `₹${amount}`;
}

function LayoutDashboardIcon() {
  return <Activity size={13} />;
}

const DASH_TASK_TYPES = [
  { value: "CALL", label: "Call", icon: Phone, tone: "border-indigo-100 bg-indigo-50 text-indigo-600" },
  { value: "MEETING", label: "Meeting", icon: CalendarDays, tone: "border-cyan-100 bg-cyan-50 text-cyan-600" },
  { value: "FOLLOWUP", label: "Follow-up", icon: Clock, tone: "border-amber-100 bg-amber-50 text-amber-600" },
  { value: "COUNSELLING", label: "Counselling", icon: MessageCircle, tone: "border-violet-100 bg-violet-50 text-violet-600" },
  { value: "PAYMENT", label: "Payment", icon: DollarSign, tone: "border-emerald-100 bg-emerald-50 text-emerald-600" },
  { value: "GENERAL", label: "General", icon: CheckCircle2, tone: "border-slate-200 bg-slate-50 text-slate-600" },
];
const DASH_TASK_TYPE_MAP = Object.fromEntries(
  DASH_TASK_TYPES.map((t) => [t.value, t])
);
const DASH_TASK_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];

// Event descriptions may contain rich-text HTML; show a plain-text snippet.
function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
  accent = "indigo",
  onClick,
}) {
  const tones = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    slate: "bg-slate-500",
  };
  const bar = tones[accent] || tones.indigo;

  const content = (
    <>
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div
          className={`flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl text-white ${bar}`}
        >
          <Icon size={18} className="sm:hidden" />
          <Icon size={20} className="hidden sm:block" />
        </div>

        <div className="min-w-0 text-[14px] sm:text-[16px] font-bold text-slate-800 break-words">
          {label}
        </div>
      </div>

      <div className="mt-2.5 sm:mt-3 text-[18px] sm:text-[22px] leading-none font-extrabold tracking-tight tabular-nums text-slate-900 break-words">
        {value}
      </div>

      {detail ? (
        <div className="mt-2 text-[12px] text-slate-500 break-words">
          {detail}
        </div>
      ) : null}
      {onClick ? (
        <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600">
          View details
          <ArrowUpRight size={12} />
        </div>
      ) : null}
    </>
  );

  const className =
    "cb-fade-in group relative min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white p-3 sm:p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-slate-200 hover:shadow-[0_14px_32px_rgba(15,23,42,0.12)]";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
        aria-label={`Open ${label} details`}
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function localDateTimeValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  const hour = String(
    date.getHours()
  ).padStart(2, "0");

  const minute = String(
    date.getMinutes()
  ).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function eventDateKey(event) {
  return dateKey(
    new Date(event.startAt)
  );
}

function eventTime(event) {
  if (event.allDay) {
    return "All day";
  }

  return formatUiTime(event.startAt);
}

function typeLabel(value) {
  return (
    EVENT_TYPES.find(
      (item) => item.value === value
    )?.label || value
  );
}

function emptyEventForm() {
  return {
    title: "",
    startAt: "",
    endAt: "",
    type: "MEETING",
    status: "SCHEDULED",
    assignedToUserId: "",
    location: "",
    description: "",
    allDay: false,
    guests: [],
  };
}

export default function Dashboard({
  tenant,
  user,
  selectedYear = "all",
  uiPreferences,
  calendarRefreshToken = 0,
  onOpenLead,
  onOpenKpi,
  onOpenModule,
}) {
  const accentColor = brandColor(600);
  const pieColors = [
    brandColor(600),
    brandColor(500),
    brandColor(400),
    brandColor(300),
    "#334155",
    "#94a3b8",
  ];

  const [data, setData] = useState({
    summary: {},
    dashboardAccess: [],
    actionCenter: { items: [], totalPrioritySignals: 0 },
    revenueTrend: [],
    leadsBySource: [],
    teamPerformance: [],
    myPerformance: null,
    recentAdmissions: [],
    admissionsByMonth: [],
    recentActivity: [],
  });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [actionDetailOpen, setActionDetailOpen] = useState(false);
  const [actionDetailItem, setActionDetailItem] = useState(null);
  const [actionDetailData, setActionDetailData] = useState(null);
  const [actionDetailLoading, setActionDetailLoading] = useState(false);
  const [actionDetailError, setActionDetailError] = useState("");

  const [kpiDetailOpen, setKpiDetailOpen] = useState(false);
  const [kpiDetailMetric, setKpiDetailMetric] = useState(null);
  const [kpiDetailData, setKpiDetailData] = useState(null);
  const [kpiDetailLoading, setKpiDetailLoading] = useState(false);
  const [kpiDetailError, setKpiDetailError] = useState("");

  // Dashboard Tasks board + New Task drawer
  const [dashTasks, setDashTasks] = useState([]);
  const [dashTasksLoading, setDashTasksLoading] = useState(true);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    type: "GENERAL",
    priority: "NORMAL",
    dueDate: "",
    dueTime: "",
    assignedToUserId: "",
    notes: "",
    pinned: false,
  });
  const newTaskBtnRef = useRef(null);
  const taskTriggerRef = useRef(null);
  const taskTitleRef = useRef(null);
  const taskDrawerRef = useRef(null);


  const [
    calendarMonth,
    setCalendarMonth,
  ] = useState(() => {
    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
  });

  const [
    agendaDate,
    setAgendaDate,
  ] = useState(() => new Date());

  const [
    fullCalendarOpen,
    setFullCalendarOpen,
  ] = useState(false);

  const [
    calendarEvents,
    setCalendarEvents,
  ] = useState([]);

  const [
    calendarUsers,
    setCalendarUsers,
  ] = useState([]);

  const [
    calendarLoading,
    setCalendarLoading,
  ] = useState(true);

  const [
    calendarError,
    setCalendarError,
  ] = useState("");

  const [
    eventModalOpen,
    setEventModalOpen,
  ] = useState(false);

  const [
    editingEvent,
    setEditingEvent,
  ] = useState(null);

  const [
    eventForm,
    setEventForm,
  ] = useState(emptyEventForm);

  const [
    savingEvent,
    setSavingEvent,
  ] = useState(false);

  const [
    deletingEventId,
    setDeletingEventId,
  ] = useState("");

  async function loadDashboard(
    year = selectedYear
  ) {
    setLoading(true);
    setError("");

    try {
      const result =
        await apiRequest(
          `/api/client/analytics/dashboard?year=${encodeURIComponent(
            year
          )}`
        );

      setData({
        summary:
          result.summary || {},
        dashboardAccess:
          Array.isArray(result.dashboardAccess) ? result.dashboardAccess : [],
        actionCenter:
          result.actionCenter || { items: [], totalPrioritySignals: 0 },
        revenueTrend:
          result.revenueTrend || [],
        leadsBySource:
          result.leadsBySource || [],
        teamPerformance:
          result.teamPerformance || [],
        myPerformance:
          result.myPerformance || null,
        recentAdmissions:
          result.recentAdmissions || [],
        admissionsByMonth:
          result.admissionsByMonth || [],
        recentActivity:
          result.recentActivity || [],
      });

    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load dashboard"
      );
    } finally {
      setLoading(false);
    }
  }

  async function openActionDetail(item) {
    if (!item?.key) return;

    setActionDetailItem(item);
    setActionDetailOpen(true);
    setActionDetailLoading(true);
    setActionDetailError("");
    setActionDetailData(null);

    try {
      const result = await apiRequest(
        `/api/client/analytics/action-center/${encodeURIComponent(item.key)}`
      );

      setActionDetailData(result);
    } catch (error) {
      setActionDetailError(
        error?.data?.message || "Unable to load Action Center details"
      );
    } finally {
      setActionDetailLoading(false);
    }
  }

  async function openKpiDetail(metric) {
    if (!metric?.key) return;

    if (typeof onOpenKpi === "function") {
      onOpenKpi(metric.key);
    }
  }

  function closeKpiDetail() {
    setKpiDetailOpen(false);
    setKpiDetailMetric(null);
    setKpiDetailData(null);
    setKpiDetailError("");
  }

  function csvCell(value) {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }

  function downloadCsv(filename, rows) {
    if (!Array.isArray(rows) || !rows.length) return;

    const headers = [
      "Lead ID",
      "Name",
      "Phone",
      "Email",
      "Owner",
      "Status",
      "Amount",
      "Date",
      "Notes",
    ];

    const lines = [headers.map(csvCell).join(",")];
    rows.forEach((record) => {
      lines.push(
        [
          record.leadDisplayId || "",
          record.primary || "",
          record.phone || "",
          record.email || "",
          record.owner || "",
          record.status || "",
          record.amount ?? "",
          record.occurredAt ? formatUiDateTime(record.occurredAt, uiPreferences) : "",
          record.note || "",
        ]
          .map(csvCell)
          .join(",")
      );
    });

    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportActionDetail() {
    const rows = Array.isArray(actionDetailData?.items) ? actionDetailData.items : [];
    const key = actionDetailData?.key || actionDetailItem?.key || "action-center";
    downloadCsv(`bispun-${key}.csv`, rows);
  }

  function openLead(record) {
    if (!record?.leadId || typeof onOpenLead !== "function") return;
    setActionDetailOpen(false);
    closeKpiDetail();
    onOpenLead(record.leadId);
  }

  async function loadCalendarUsers() {
    try {
      const result =
        await apiRequest(
          "/api/client/calendar/users"
        );

      setCalendarUsers(
        result.users || []
      );
    } catch (error) {
      console.error(
        "Unable to load calendar users:",
        error
      );
    }
  }

  async function loadCalendar() {
    setCalendarLoading(true);
    setCalendarError("");

    try {
      const year =
        calendarMonth.getFullYear();

      const month =
        calendarMonth.getMonth();

      const from = new Date(
        year,
        month,
        1,
        0,
        0,
        0
      );

      const to = new Date(
        year,
        month + 1,
        7,
        23,
        59,
        59
      );

      const result =
        await apiRequest(
          `/api/client/calendar?from=${encodeURIComponent(
            from.toISOString()
          )}&to=${encodeURIComponent(
            to.toISOString()
          )}`
        );

      setCalendarEvents(
        result.events || []
      );
    } catch (error) {
      setCalendarError(
        error?.data?.message ||
          "Unable to load calendar"
      );
    } finally {
      setCalendarLoading(false);
    }
  }

  useEffect(() => {
    loadCalendarUsers();
  }, []);

  async function loadDashTasks() {
    setDashTasksLoading(true);
    try {
      const result = await apiRequest("/api/client/tasks?scope=all");
      setDashTasks(Array.isArray(result?.tasks) ? result.tasks : []);
    } catch (error) {
      setDashTasks([]);
    } finally {
      setDashTasksLoading(false);
    }
  }

  useEffect(() => {
    loadDashTasks();
  }, []);

  function setTaskField(field, value) {
    setTaskForm((prev) => ({ ...prev, [field]: value }));
  }

  function openTaskDrawer() {
    taskTriggerRef.current =
      typeof document !== "undefined" ? document.activeElement : null;
    setTaskForm({
      title: "",
      type: "GENERAL",
      priority: "NORMAL",
      dueDate: "",
      dueTime: "",
      assignedToUserId: "",
      notes: "",
      pinned: false,
    });
    setTaskFormError("");
    setTaskDrawerOpen(true);
  }

  function closeTaskDrawer() {
    setTaskDrawerOpen(false);
    const trigger = taskTriggerRef.current || newTaskBtnRef.current;
    if (trigger && typeof trigger.focus === "function") {
      setTimeout(() => {
        try {
          trigger.focus();
        } catch (_) {}
      }, 0);
    }
  }

  async function submitTask(event) {
    event.preventDefault();
    const title = taskForm.title.trim();
    if (!title) {
      setTaskFormError("Task title is required.");
      if (taskTitleRef.current) taskTitleRef.current.focus();
      return;
    }
    setTaskSaving(true);
    setTaskFormError("");
    try {
      let dueAt = null;
      if (taskForm.dueDate) {
        const dt = new Date(
          `${taskForm.dueDate}T${taskForm.dueTime || "09:00"}`
        );
        if (!Number.isNaN(dt.getTime())) dueAt = dt.toISOString();
      }
      const result = await apiRequest("/api/client/tasks", {
        method: "POST",
        body: JSON.stringify({
          title,
          type: taskForm.type,
          priority: taskForm.priority,
          dueAt,
          assignedToUserId: taskForm.assignedToUserId || null,
          notes: taskForm.notes ? taskForm.notes.trim() : null,
          pinned: taskForm.pinned,
        }),
      });
      if (result?.task) {
        setDashTasks((prev) => [result.task, ...prev]);
      } else {
        loadDashTasks();
      }
      closeTaskDrawer();
    } catch (error) {
      setTaskFormError(
        error?.data?.message || "Couldn't create task. Please try again."
      );
    } finally {
      setTaskSaving(false);
    }
  }

  async function toggleTaskDone(task) {
    const next = !task.done;
    setDashTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              done: next,
              completedAt: next ? new Date().toISOString() : null,
            }
          : t
      )
    );
    try {
      await apiRequest(`/api/client/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ done: next }),
      });
    } catch (error) {
      setDashTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, done: !next } : t))
      );
    }
  }

  async function toggleTaskPin(task) {
    const next = !task.pinned;
    setDashTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, pinned: next } : t))
    );
    try {
      await apiRequest(`/api/client/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ pinned: next }),
      });
    } catch (error) {
      setDashTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, pinned: !next } : t))
      );
    }
  }

  // Drawer: scroll-lock, focus-in on open, Esc to close, restore on close.
  useEffect(() => {
    if (!taskDrawerOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => {
      if (taskTitleRef.current) taskTitleRef.current.focus();
    }, 30);
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeTaskDrawer();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(focusTimer);
    };
  }, [taskDrawerOpen]);

  function handleDrawerKeyDown(e) {
    if (e.key !== "Tab" || !taskDrawerRef.current) return;
    const focusable = taskDrawerRef.current.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    loadDashboard(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    loadCalendar();
  }, [calendarMonth, calendarRefreshToken]);

  // Event drawer: scroll-lock + Esc to close (matches the New Task drawer).
  useEffect(() => {
    if (!eventModalOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setEventModalOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [eventModalOpen]);

  function openCreateEvent(
    date = new Date()
  ) {
    const selected =
      new Date(date);

    selected.setHours(
      9,
      0,
      0,
      0
    );

    const end =
      new Date(selected);

    end.setHours(
      10,
      0,
      0,
      0
    );

    setEditingEvent(null);

    setEventForm({
      ...emptyEventForm(),
      startAt:
        localDateTimeValue(
          selected
        ),
      endAt:
        localDateTimeValue(end),
      assignedToUserId:
        user?.id || "",
    });

    setEventModalOpen(true);
  }

  function openEditEvent(event) {
    setEditingEvent(event);

    setEventForm({
      title:
        event.title || "",
      startAt:
        localDateTimeValue(
          event.startAt
        ),
      endAt:
        localDateTimeValue(
          event.endAt
        ),
      type:
        event.type ||
        "MEETING",
      status:
        event.status ||
        "SCHEDULED",
      assignedToUserId:
        event.assignedToUserId ||
        "",
      location:
        event.location || "",
      description:
        event.description || "",
      allDay:
        event.allDay === true,
      guests: Array.isArray(event.guests)
        ? event.guests
        : [],
    });

    setEventModalOpen(true);
  }

  async function saveEvent(event) {
    event.preventDefault();

    if (
      !eventForm.title.trim() ||
      !eventForm.startAt
    ) {
      return;
    }

    setSavingEvent(true);
    setCalendarError("");

    try {
      const payload = {
        title:
          eventForm.title.trim(),
        type:
          eventForm.type,
        status:
          eventForm.status,

        startAt:
          new Date(
            eventForm.startAt
          ).toISOString(),

        endAt:
          eventForm.endAt
            ? new Date(
                eventForm.endAt
              ).toISOString()
            : null,

        assignedToUserId:
          eventForm.assignedToUserId ||
          null,

        location:
          eventForm.location.trim() ||
          null,

        description:
          eventForm.description.trim() ||
          null,

        allDay:
          eventForm.allDay,

        guests: Array.isArray(eventForm.guests)
          ? eventForm.guests
          : [],
      };

      if (editingEvent) {
        await apiRequest(
          `/api/client/calendar/${editingEvent.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiRequest(
          "/api/client/calendar",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );
      }

      setEventModalOpen(false);
      setEditingEvent(null);

      setEventForm(
        emptyEventForm()
      );

      await loadCalendar();
    } catch (error) {
      setCalendarError(
        error?.data?.message ||
          "Unable to save calendar event"
      );
    } finally {
      setSavingEvent(false);
    }
  }

  async function deleteEvent(id) {
    if (
      !window.confirm(
        "Delete this calendar event?"
      )
    ) {
      return;
    }

    setDeletingEventId(id);

    try {
      await apiRequest(
        `/api/client/calendar/${id}`,
        {
          method: "DELETE",
        }
      );

      if (
        editingEvent?.id === id
      ) {
        setEventModalOpen(false);
        setEditingEvent(null);
      }

      await loadCalendar();
    } catch (error) {
      setCalendarError(
        error?.data?.message ||
          "Unable to delete event"
      );
    } finally {
      setDeletingEventId("");
    }
  }

  const summary =
    data.summary || {};

  const todayKey =
    dateKey(new Date());

  const todayEvents =
    useMemo(() => {
      return calendarEvents
        .filter(
          (event) =>
            eventDateKey(event) ===
              todayKey &&
            event.status !==
              "CANCELLED"
        )
        .sort(
          (a, b) =>
            new Date(a.startAt) -
            new Date(b.startAt)
        );
    }, [
      calendarEvents,
      todayKey,
    ]);

  const upcomingEvents =
    useMemo(() => {
      const now = new Date();

      return calendarEvents
        .filter(
          (event) =>
            new Date(
              event.startAt
            ) > now &&
            event.status !==
              "CANCELLED" &&
            eventDateKey(event) !==
              todayKey
        )
        .sort(
          (a, b) =>
            new Date(a.startAt) -
            new Date(b.startAt)
        )
        .slice(0, 6);
    }, [
      calendarEvents,
      todayKey,
    ]);

  const agendaEvents =
    useMemo(() => {
      const key =
        dateKey(agendaDate);

      return calendarEvents
        .filter(
          (event) =>
            eventDateKey(event) ===
              key &&
            event.status !==
              "CANCELLED"
        )
        .sort(
          (a, b) =>
            new Date(a.startAt) -
            new Date(b.startAt)
        );
    }, [
      calendarEvents,
      agendaDate,
    ]);


  const calendarMonthCells =
    useMemo(() => {
      const year =
        calendarMonth.getFullYear();
      const month =
        calendarMonth.getMonth();

      const firstDay =
        new Date(year, month, 1);

      const offset =
        (firstDay.getDay() + 6) %
        7;

      const gridStart =
        new Date(
          year,
          month,
          1 - offset
        );

      return Array.from(
        { length: 42 },
        (_, index) => {
          const date =
            new Date(
              gridStart
            );

          date.setDate(
            gridStart.getDate() +
              index
          );

          const key =
            dateKey(date);

          const eventCount =
            calendarEvents.filter(
              (event) =>
                eventDateKey(
                  event
                ) === key &&
                event.status !==
                  "CANCELLED"
            ).length;

          return {
            date,
            key,
            inCurrentMonth:
              date.getMonth() ===
              month,
            isToday:
              key ===
              dateKey(new Date()),
            isSelected:
              key ===
              dateKey(agendaDate),
            eventCount,
          };
        }
      );
    }, [
      calendarMonth,
      calendarEvents,
      agendaDate,
    ]);

  function moveCalendarMonth(offset) {
    setCalendarMonth(
      new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() +
          offset,
        1
      )
    );
  }

  function moveAgendaDay(offset) {
    const next =
      new Date(agendaDate);

    next.setDate(
      next.getDate() + offset
    );

    setAgendaDate(next);

    if (
      next.getFullYear() !==
        calendarMonth.getFullYear() ||
      next.getMonth() !==
        calendarMonth.getMonth()
    ) {
      setCalendarMonth(
        new Date(
          next.getFullYear(),
          next.getMonth(),
          1
        )
      );
    }
  }



  const admissionsByMonthData =
    Array.isArray(data.admissionsByMonth)
      ? data.admissionsByMonth
      : Array.isArray(data.monthlyAdmissions)
      ? data.monthlyAdmissions
      : [];

  const recentAdmissionsData =
    Array.isArray(data.recentAdmissions)
      ? data.recentAdmissions
      : [];

  const recentActivityData =
    Array.isArray(data.recentActivity)
      ? data.recentActivity
      : [];

  const roleDefaultDashboardView =
    user?.role === "MANAGER"
      ? "team"
      : user?.role === "EMPLOYEE"
        ? "my-work"
        : "business";

  const dashboardView =
    uiPreferences?.dashboardView ||
    roleDefaultDashboardView;

  const isBusinessView =
    dashboardView === "business";
  const isTeamView =
    dashboardView === "team";
  const isMyWorkView =
    dashboardView === "my-work";

  const showCalendarRail =
    !isBusinessView &&
    uiPreferences?.showCalendar !== false;

  const normalizedUserName =
    String(user?.name || "")
      .trim()
      .toLowerCase();

  const myPerformance =
    data.myPerformance ||
    data.teamPerformance.find(
      (member) =>
        member?.userId === user?.id
    ) ||
    data.teamPerformance.find(
      (member) =>
        String(member?.name || "")
          .trim()
          .toLowerCase() ===
        normalizedUserName
    ) || null;

  const dashboardAccess = Array.isArray(data.dashboardAccess)
    ? data.dashboardAccess
    : [];

  const canSeeDashboardSection = (section) =>
    user?.role === "CLIENT_ADMIN" || dashboardAccess.includes(section);

  const actionCenter = data.actionCenter || { items: [], totalPrioritySignals: 0 };
  const actionCenterItems = Array.isArray(actionCenter.items)
    ? actionCenter.items
    : [];

  const actionIconByKey = {
    "hot-leads": Users,
    "overdue-followups": Clock,
    "pending-payments": CircleDollarSign,
    "whatsapp-replies": MessageCircle,
    "revenue-risk": AlertCircle,
  };

  const actionToneByName = {
    rose: "border-rose-100 bg-rose-50/60 text-rose-700",
    amber: "border-amber-100 bg-amber-50/60 text-amber-700",
    indigo: "border-indigo-100 bg-indigo-50/60 text-indigo-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  const pulseMetrics = [
    {
      key: "total-leads",
      label: "Total Leads",
      value: summary.totalLeads || 0,
      icon: Users,
      detail:
        selectedYear === "all"
          ? "All CRM leads"
          : `CRM leads in ${selectedYear}`,
      accent: "indigo",
    },
    {
      key: "qualified-leads",
      label: "Qualified Leads",
      value: summary.qualifiedLeads || 0,
      icon: Target,
      detail: "Qualified opportunities",
      accent: "emerald",
    },
    {
      key: "new-leads",
      label: "New Leads",
      value: summary.newLeads || 0,
      icon: Clock,
      detail:
        selectedYear === "all"
          ? "New CRM leads"
          : `New leads in ${selectedYear}`,
      accent: "slate",
    },
    {
      key: "admissions",
      label: "Admissions",
      value: summary.totalAdmissions || 0,
      icon: UserCheck,
      detail:
        selectedYear === "all"
          ? "Recorded admissions"
          : `Admissions in ${selectedYear}`,
      accent: "indigo",
    },
    {
      key: "potential-revenue",
      label: "Potential Revenue",
      value: money(summary.potentialRevenue),
      icon: CircleDollarSign,
      detail: "Total admission revenue value",
      accent: "amber",
    },
    {
      key: "received-revenue",
      label: "Received Revenue",
      value: money(summary.receivedAmount),
      icon: CheckCircle2,
      detail: "Revenue received",
      accent: "emerald",
    },
    {
      key: "pending-revenue",
      label: "Pending Revenue",
      value: money(summary.pendingAmount),
      icon: Clock,
      detail: "Revenue pending collection",
      accent: "amber",
    },
    {
      key: "current-profit",
      label: "Current Profit",
      value: money(summary.currentProfit),
      icon: Wallet,
      detail:
        selectedYear === "all"
          ? "Current profitability"
          : `Profit for ${selectedYear}`,
      accent:
        summary.currentProfit >= 0
          ? "emerald"
          : "rose",
    },
  ];

  const openDashTasks = dashTasks.filter((t) => !t.done);
  const sortedDashTasks = [...dashTasks].sort(
    (a, b) =>
      (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
  );
  const todayMeetings = todayEvents;

  return (
    <div className="cb-dashboard-root space-y-5">
      {/* WORKSPACE HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        {uiPreferences?.showGreeting !== false ? (
          <div>
            <h1 className="text-[28px] sm:text-[40px] font-bold leading-[1.2] tracking-[-0.01em] text-slate-950" style={{ fontFamily: "'Newsreader', Georgia, serif" }}>
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return "Good Morning";
                if (hour < 17) return "Good Afternoon";
                return "Good Evening";
              })()}
              ,{" "}
              <span className="font-bold text-slate-950">
                {user?.name || "there"}
              </span>
            </h1>
            <p className="mt-1.5 text-[15px] font-medium tracking-normal text-slate-500">
              It&apos;s {formatUiDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-[28px] sm:text-[40px] font-normal leading-[1.2] tracking-[-0.01em] text-slate-950" style={{ fontFamily: "'Newsreader', Georgia, serif" }}>Dashboard</h1>
            <p className="mt-1.5 text-[15px] font-medium text-slate-500">{formatUiDate(new Date())}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            loadDashboard(selectedYear);
            loadCalendar();
          }}
          disabled={
            loading ||
            calendarLoading
          }
          className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 lg:self-auto"
        >
          <RefreshCw
            size={13}
            className={
              loading ||
              calendarLoading
                ? "animate-spin"
                : ""
            }
          />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[420px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-500">
          <Loader2
            size={18}
            className="animate-spin"
          />
          Loading dashboard...
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 gap-4 ${showCalendarRail ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
            <div className="min-w-0 space-y-4">
              {isMyWorkView && (
                <section>
                  <div className="mb-2.5 flex items-center gap-2">
                    <UserRound
                      size={13}
                      className="text-indigo-600"
                    />
                    <div className="text-[12px] font-bold uppercase tracking-[0.10em] text-indigo-600">
                      My Workspace Overview
                    </div>
                  </div>

                  {myPerformance ? (
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
                      <MetricCard
                        label="My Leads"
                        value={myPerformance.leads || 0}
                        icon={Users}
                        detail="Leads reflected in your performance"
                        accent="indigo"
                      />
                      <MetricCard
                        label="My Admissions"
                        value={myPerformance.admissions || 0}
                        icon={UserCheck}
                        detail="Admissions reflected in your performance"
                        accent="emerald"
                      />
                      <MetricCard
                        label="My Revenue"
                        value={money(myPerformance.revenue)}
                        icon={Wallet}
                        detail="Revenue reflected in your performance"
                        accent="amber"
                      />
                    </div>
                  ) : (
                    <div className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                      <div className="text-[14px] font-bold text-slate-900">
                        Personal performance will appear here
                      </div>
                      <div className="mt-1 text-[13px] leading-5 text-slate-500">
                        No matching personal performance record is available for the selected period yet.
                      </div>
                    </div>
                  )}
                </section>
              )}

              {canSeeDashboardSection("business-pulse") && (
                <>
              {/* BUSINESS PULSE */}
              <section>
                <div className="mb-2.5 flex items-center gap-2">
                  <Activity
                    size={13}
                    className="text-indigo-600"
                  />
                  <div className="text-[12px] font-bold uppercase tracking-[0.10em] text-indigo-600">
                    Business Pulse
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {(isTeamView ? pulseMetrics.slice(0, 4) : pulseMetrics).map((metric) => {
                    // Exclude the business `key` field from the spread so it is not
                    // forwarded as React's reserved `key` prop (React warns when a
                    // `key` is spread into JSX). Use it as the stable list key, and
                    // still pass the full metric (with key) to openKpiDetail.
                    const { key: metricKey, ...cardProps } = metric;
                    return (
                      <MetricCard
                        key={metricKey}
                        {...cardProps}
                        onClick={() => openKpiDetail(metric)}
                      />
                    );
                  })}
                </div>
              </section>

                </>
              )}

              {/* TODAY'S TASKS + TODAY'S MEETINGS */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <section
                  aria-labelledby="dash-tasks-title"
                  className="flex h-[360px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white" aria-hidden="true">
                      <CheckCircle2 size={17} />
                    </span>
                    <div className="min-w-0">
                      <h2 id="dash-tasks-title" className="text-[15px] font-bold text-slate-950">
                        Today&apos;s Tasks{" "}
                        <span className="font-semibold text-slate-500">({openDashTasks.length})</span>
                      </h2>
                      <p className="text-[12px] text-slate-500">Pinned stay on top</p>
                    </div>
                    <button
                      ref={newTaskBtnRef}
                      type="button"
                      onClick={openTaskDrawer}
                      className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[12.5px] font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    >
                      <Plus size={14} aria-hidden="true" /> New Task
                    </button>
                  </div>

                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Today's tasks list"
                    className="min-h-0 flex-1 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  >
                    {dashTasksLoading ? (
                      <div className="flex h-full items-center justify-center text-[12px] text-slate-500" role="status">
                        <Loader2 size={15} className="mr-2 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        Loading tasks…
                      </div>
                    ) : dashTasks.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <CheckCircle2 size={22} className="text-slate-300" aria-hidden="true" />
                        <p className="mt-2 text-[13px] font-semibold text-slate-700">No tasks yet</p>
                        <p className="mt-1 text-[12px] text-slate-500">Create a task and it shows up here.</p>
                      </div>
                    ) : (
                      <ul role="list" className="divide-y divide-slate-50 p-2">
                        {sortedDashTasks.map((task) => {
                          const meta = DASH_TASK_TYPE_MAP[task.type] || DASH_TASK_TYPE_MAP.GENERAL;
                          const TypeIcon = meta.icon;
                          const due = task.dueAt
                            ? `${formatUiDate(task.dueAt, { day: "numeric", month: "short" })}, ${formatUiTime(task.dueAt)}`
                            : "No due date";
                          return (
                            <li key={task.id} className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${task.done ? "opacity-55" : ""}`}>
                              <button
                                type="button"
                                onClick={() => toggleTaskDone(task)}
                                aria-pressed={task.done}
                                aria-label={`Mark "${task.title}" ${task.done ? "not complete" : "complete"}`}
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${task.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-indigo-500"} focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1`}
                              >
                                <CheckCircle2 size={12} aria-hidden="true" />
                              </button>
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.tone}`} aria-hidden="true">
                                <TypeIcon size={15} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`truncate text-[13px] font-bold text-slate-900 ${task.done ? "line-through" : ""}`}>{task.title}</span>
                                  {task.pinned ? (
                                    <span className="shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-[0.05em] text-indigo-700">Pinned</span>
                                  ) : null}
                                </div>
                                <div className="mt-0.5 truncate text-[11px] text-slate-500">
                                  {meta.label}
                                  {" · "}
                                  {due}
                                  {task.assignedToName ? ` · ${task.assignedToName}` : ""}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleTaskPin(task)}
                                aria-pressed={task.pinned}
                                aria-label={`${task.pinned ? "Unpin" : "Pin"} "${task.title}"`}
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition ${task.pinned ? "border-indigo-100 bg-indigo-50 text-indigo-600" : "border-slate-200 bg-white text-slate-500 hover:text-slate-700"} focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1`}
                              >
                                <Pin size={13} aria-hidden="true" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>

                <section
                  aria-labelledby="dash-meetings-title"
                  className="flex h-[360px] flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
                >
                  <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-600 text-white" aria-hidden="true">
                      <CalendarDays size={17} />
                    </span>
                    <div className="min-w-0">
                      <h2 id="dash-meetings-title" className="text-[15px] font-bold text-slate-950">
                        Today&apos;s Meetings{" "}
                        <span className="font-semibold text-slate-500">({todayMeetings.length})</span>
                      </h2>
                      <p className="text-[12px] text-slate-500">Calls, visits &amp; scheduled time</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateEvent(new Date())}
                      className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[12.5px] font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                    >
                      <Plus size={14} aria-hidden="true" /> Add Event
                    </button>
                  </div>

                  <div
                    tabIndex={0}
                    role="region"
                    aria-label="Today's meetings list"
                    className="min-h-0 flex-1 overflow-y-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  >
                    {todayMeetings.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                        <CalendarDays size={22} className="text-slate-300" aria-hidden="true" />
                        <p className="mt-2 text-[13px] font-semibold text-slate-700">No meetings today</p>
                      </div>
                    ) : (
                      <ul role="list" className="divide-y divide-slate-50 p-2">
                        {todayMeetings.map((event) => {
                          const online = Boolean(event.meetingLink);
                          const where = event.location || event.meetingRoom || stripHtml(event.description) || "";
                          return (
                            <li key={event.id} className="flex items-center gap-3 px-2 py-2.5">
                              <div className="w-14 shrink-0 text-right">
                                <div className="text-[12px] font-extrabold text-slate-900">{eventTime(event)}</div>
                              </div>
                              <div className="h-8 w-0.5 shrink-0 rounded bg-cyan-500/40" aria-hidden="true" />
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-bold text-slate-900">{event.title}</div>
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${online ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600"}`}>
                                    {online ? <Video size={10} aria-hidden="true" /> : <MapPin size={10} aria-hidden="true" />}
                                    {online ? "Online" : "In person"}
                                  </span>
                                  {where ? <span className="truncate text-[11px] text-slate-500">{where}</span> : null}
                                </div>
                              </div>
                              {online ? (
                                <a
                                  href={event.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11.5px] font-bold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                                  aria-label={`Join ${event.title} at ${eventTime(event)} (opens in new tab)`}
                                >
                                  <Video size={13} aria-hidden="true" /> Join
                                </a>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>
              </div>

              {(canSeeDashboardSection("revenue-trend") || canSeeDashboardSection("leads-by-source")) && (
                <>
              {/* ANALYTICS CORE */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)]">
                {canSeeDashboardSection("revenue-trend") && (
                <section className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-[15px] font-bold text-slate-950">
                        Revenue Trend
                      </h2>
                      <p className="mt-1 text-[13px] text-slate-500">
                        Potential vs received revenue
                      </p>
                    </div>

                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[12px] font-semibold text-slate-500">
                      {selectedYear ===
                      "all"
                        ? "All Time"
                        : selectedYear}
                    </span>
                  </div>

                  {!(data.revenueTrend || []).some(
                    (p) =>
                      Number(p.potential) > 0 ||
                      Number(p.received) > 0
                  ) && (
                    <div className="flex h-[280px] items-center justify-center text-[13px] text-slate-400">
                      No revenue data yet.
                    </div>
                  )}
                  {(data.revenueTrend || []).some(
                    (p) =>
                      Number(p.potential) > 0 ||
                      Number(p.received) > 0
                  ) && (
                    <>
                      {/* Accessible data alternative: the chart SVG below is
                          aria-hidden (recharts emits context-free text nodes),
                          so this sr-only table is the screen-reader
                          representation. Must be a SIBLING outside the
                          aria-hidden subtree. */}
                      <div className="sr-only">
                      <table>
                        <caption>
                          Revenue trend by month: potential versus received
                          revenue
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Month</th>
                            <th scope="col">Potential revenue</th>
                            <th scope="col">Received revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.revenueTrend.map((row) => (
                            <tr key={row.m}>
                              <th scope="row">{row.m}</th>
                              <td>{srMoney(row.potential)}</td>
                              <td>{srMoney(row.received)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                      <div aria-hidden="true">
                        <Suspense fallback={<ChartSkeleton height={280} />}>
                          <RevenueTrendChart
                            data={data.revenueTrend}
                            accentColor={accentColor}
                            money={money}
                            axisMoney={axisMoney}
                          />
                        </Suspense>
                      </div>
                    </>
                  )}
                </section>
                )}

                {canSeeDashboardSection("leads-by-source") && (
                <section className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
                  <div className="mb-3">
                    <h2 className="text-[15px] font-bold text-slate-950">
                      Leads by Source
                    </h2>
                    <p className="mt-1 text-[13px] text-slate-500">
                      Where leads came from this period. The total includes direct
                      admissions and leads with no recorded source.
                    </p>
                  </div>

                  {data.leadsBySource
                    .length ? (
                    <>
                      {/* Chart + center total are decorative for AT; the legend
                          below is the accessible data (and reconciles to the
                          total). */}
                      <div className="relative" aria-hidden="true">
                        <Suspense fallback={<ChartSkeleton height={190} />}>
                          <LeadsBySourceChart
                            data={data.leadsBySource}
                            pieColors={pieColors}
                          />
                        </Suspense>

                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-[20px] font-bold tracking-[-0.04em] text-slate-950">
                              {donutCenterTotal(data)}
                            </div>
                            <div className="text-[13px] text-slate-400">
                              Leads
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="sr-only">
                        {`Total ${donutCenterTotal(data)} leads for the period.`}
                      </p>

                      <ul className="mt-2 space-y-2">
                        {data.leadsBySource
                          .slice(0, 5)
                          .map(
                            (
                              source,
                              index
                            ) => (
                              <li
                                key={source.name}
                                aria-label={`${source.name}: ${source.value} leads`}
                                className="flex items-center justify-between gap-3 text-[12px]"
                              >
                                <span className="flex min-w-0 items-center gap-2">
                                  <span
                                    aria-hidden="true"
                                    className="h-2 w-2 flex-shrink-0 rounded-full"
                                    style={{
                                      background:
                                        pieColors[
                                        index %
                                          pieColors.length
                                      ],
                                    }}
                                  />

                                  <span className="truncate text-slate-600">
                                    {source.name}
                                  </span>
                                </span>

                                <span className="font-semibold text-slate-800">
                                  {source.value}
                                </span>
                              </li>
                            )
                          )}
                        {data.leadsBySource.length > 5 && (
                          <li
                            aria-label={`Others: ${data.leadsBySource
                              .slice(5)
                              .reduce((sum, item) => sum + Number(item.value || 0), 0)} leads`}
                            className="flex items-center justify-between gap-3 text-[12px]"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span aria-hidden="true" className="h-2 w-2 flex-shrink-0 rounded-full bg-slate-300" />
                              <span className="truncate text-slate-600">Others</span>
                            </span>
                            <span className="font-semibold text-slate-800">
                              {data.leadsBySource
                                .slice(5)
                                .reduce((sum, item) => sum + Number(item.value || 0), 0)}
                            </span>
                          </li>
                        )}
                      </ul>
                    </>
                  ) : (
                    <div className="flex h-[190px] items-center justify-center text-xs text-slate-400">
                      No lead data yet.
                    </div>
                  )}
                </section>
                )}
              </div>
                </>
              )}

              {(canSeeDashboardSection("action-center") || canSeeDashboardSection("recent-admissions") || canSeeDashboardSection("admissions-by-month")) && (
                <>
              {canSeeDashboardSection("action-center") && (
              <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">
                      Daily Priority
                    </div>
                    <h2 className="mt-0.5 text-[16px] font-bold text-slate-950">Action Center</h2>
                    <p className="mt-0.5 text-[12px] text-slate-500">
                      What needs attention now, based on live CRM activity.
                    </p>
                  </div>
              
                  <div className="self-start rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:self-auto sm:text-right">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Priority signals</div>
                    <div className="mt-0.5 text-[18px] font-extrabold text-slate-900">
                      {Number(actionCenter.totalPrioritySignals || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              
                <ul role="list" className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {actionCenterItems.map((item) => {
                    const Icon = actionIconByKey[item.key] || Activity;
                    const tone = actionToneByName[item.tone] || actionToneByName.slate;
                    const count = Number(item.count || 0);
                    const isClear = count === 0;
              
                    return (
                      <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => openActionDetail(item)}
                        className="group flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_24px_-16px_rgba(15,23,42,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                        aria-label={isClear ? `${item.label}: 0. Clear.` : `${item.label}: ${count}${item.amount !== undefined ? `, ${money(item.amount)}` : ""}. View details.`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${tone}`}>
                            <Icon size={15} aria-hidden="true" />
                          </span>
                          <span className="text-[11.5px] font-bold leading-tight text-slate-600">{item.label}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`text-[24px] font-extrabold leading-none tracking-tight tabular-nums ${isClear ? "text-slate-500" : "text-slate-950"}`}>
                            {count.toLocaleString("en-IN")}
                          </span>
                          {isClear ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                              <CheckCircle2 size={11} aria-hidden="true" /> Clear
                            </span>
                          ) : null}
                        </div>
                        {!isClear && item.amount !== undefined ? (
                          <div className="mt-1.5 text-[12px] font-extrabold text-slate-700">{money(item.amount)}</div>
                        ) : null}
                        <div className="mt-2 flex-1 text-[10.5px] leading-snug text-slate-500">{item.detail}</div>
                        {!isClear ? (
                          <span className="mt-2.5 inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-600">
                            View details <ChevronRight size={12} aria-hidden="true" />
                          </span>
                        ) : null}
                      </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
              )}

              {/* OPERATIONS ROW */}
              {(canSeeDashboardSection("recent-admissions") || canSeeDashboardSection("admissions-by-month")) && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {canSeeDashboardSection("recent-admissions") && (
                <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                    <div>
                      <h2 className="text-[15px] font-bold text-slate-950">
                        Recent Admissions
                      </h2>
                      <p className="mt-0.5 text-[13px] text-slate-500">
                        Latest recorded admissions
                      </p>
                    </div>
                  </div>

                  {recentAdmissionsData.length ? (
                    <>
                    <ul role="list" className="hidden lg:block divide-y divide-slate-100">
                      {recentAdmissionsData.slice(0, 5).map((item, index) => {
                        const student = item.studentName || item.leadName || item.name || "—";
                        const college = item.collegeName || item.universityName || item.college || "—";
                        const counsellor = item.counsellorName || item.admissionDoneBy || item.assignedTo || "";
                        const dateVal = item.dateOfAdmission || item.admissionDate || item.createdAt;
                        const dateStr = dateVal ? formatUiDate(dateVal) : "";
                        const amount = item.amount != null ? money(item.amount) : item.revenue != null ? money(item.revenue) : "—";
                        const status = item.revenueStatus || item.status || "";
                        const sub = [college, dateStr, counsellor || "Unassigned"].filter(Boolean).join(" · ");
                        const inits = String(student).trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
                        return (
                          <li
                            key={item.id || `${student}-${index}`}
                            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-extrabold text-indigo-700" aria-hidden="true">
                              {inits}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13.5px] font-bold text-slate-900">{student}</div>
                              <div className="mt-0.5 truncate text-[12px] text-slate-500">{sub}</div>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <div className="text-[13px] font-extrabold tabular-nums text-slate-900">{amount}</div>
                              {status ? <Badge tone={statusTone(status)}>{status}</Badge> : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    <div
                      className="lg:hidden divide-y divide-slate-100"
                      role="list"
                      aria-label="Recent admissions"
                    >
                      {recentAdmissionsData.slice(0, 5).map((item, index) => {
                        const student =
                          item.studentName || item.leadName || item.name || "—";
                        const status = item.revenueStatus || item.status || "";
                        return (
                          <MobileRecordCard
                            key={item.id || `${student}-${index}`}
                            index={index}
                            title={student}
                            badges={
                              status
                                ? [{ tone: statusTone(status), label: status }]
                                : []
                            }
                            fields={[
                              {
                                label: "College",
                                value:
                                  item.collegeName ||
                                  item.universityName ||
                                  item.college ||
                                  "—",
                              },
                              {
                                label: "Counsellor",
                                value:
                                  item.counsellorName ||
                                  item.admissionDoneBy ||
                                  item.assignedTo ||
                                  "—",
                              },
                              {
                                label: "Date",
                                value:
                                  item.dateOfAdmission ||
                                  item.admissionDate ||
                                  item.createdAt
                                    ? formatUiDate(
                                        item.dateOfAdmission ||
                                          item.admissionDate ||
                                          item.createdAt
                                      )
                                    : "—",
                              },
                              {
                                label: "Amount",
                                value:
                                  item.amount != null
                                    ? money(item.amount)
                                    : item.revenue != null
                                    ? money(item.revenue)
                                    : "—",
                              },
                            ]}
                          />
                        );
                      })}
                    </div>
                    </>
                  ) : (
                    <div className="flex h-[220px] flex-col items-center justify-center text-center">
                      <UserCheck size={20} className="text-slate-300" />
                      <div className="mt-2 text-[12px] font-semibold text-slate-700">
                        No recent admissions available
                      </div>
                      <div className="mt-1 max-w-[260px] text-[12px] text-slate-500">
                        This section will use real admission records returned by the dashboard API.
                      </div>
                    </div>
                  )}
                </section>
                )}

                {canSeeDashboardSection("admissions-by-month") && (
                <section className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="mb-3">
                    <h2 className="text-[15px] font-bold text-slate-950">
                      Admissions by Month
                    </h2>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      Monthly admission performance
                    </p>
                  </div>

                  {admissionsByMonthData.length ? (
                    <>
                      {/* Accessible data alternative (chart SVG below is aria-hidden). */}
                      <div className="sr-only">
                      <table>
                        <caption>Admissions by month</caption>
                        <thead>
                          <tr>
                            <th scope="col">Month</th>
                            <th scope="col">Admissions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {admissionsByMonthData.map((row, i) => {
                            const label =
                              row.m ?? row.month ?? row.name ?? `Row ${i + 1}`;
                            const value =
                              row.value ?? row.count ?? row.admissions ?? 0;
                            return (
                              <tr key={`${label}-${i}`}>
                                <th scope="row">{label}</th>
                                <td>{value}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      </div>
                      <div aria-hidden="true">
                        <Suspense fallback={<ChartSkeleton height={220} />}>
                          <AdmissionsByMonthChart
                            data={admissionsByMonthData}
                            accentColor={accentColor}
                          />
                        </Suspense>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-[220px] flex-col items-center justify-center text-center">
                      <BarChart3 size={20} className="text-slate-300" />
                      <div className="mt-2 text-[12px] font-semibold text-slate-700">
                        No monthly admission data available
                      </div>
                      <div className="mt-1 max-w-[260px] text-[12px] text-slate-500">
                        No mock chart values are being inserted.
                      </div>
                    </div>
                  )}
                </section>
                )}
              </div>
              )}
                </>
              )}
            </div>

            {/* PRODUCTIVITY RAIL */}
            {showCalendarRail && (
            <aside className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[15px] font-bold text-slate-950">
                    Calendar
                  </h2>

                  <button
                    type="button"
                    onClick={() =>
                      setFullCalendarOpen(
                        true
                      )
                    }
                    className="text-[12px] font-semibold text-indigo-600"
                  >
                    View full
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      moveCalendarMonth(
                        -1
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
                  >
                    <ChevronLeft size={15} />
                  </button>

                  <div className="text-[12px] font-bold text-slate-800">
                    {formatUiDate(calendarMonth, {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      moveCalendarMonth(
                        1
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-7 text-center">
                  {[
                    "MO",
                    "TU",
                    "WE",
                    "TH",
                    "FR",
                    "SA",
                    "SU",
                  ].map(
                    (day) => (
                      <div
                        key={day}
                        className="pb-2 text-[12px] font-bold tracking-[0.06em] text-slate-500"
                      >
                        {day}
                      </div>
                    )
                  )}

                  {calendarMonthCells.map(
                    (cell) => (
                      <button
                        key={
                          cell.key
                        }
                        type="button"
                        onClick={() => {
                          setAgendaDate(
                            new Date(
                              cell.date
                            )
                          );

                          if (
                            !cell.inCurrentMonth
                          ) {
                            setCalendarMonth(
                              new Date(
                                cell.date.getFullYear(),
                                cell.date.getMonth(),
                                1
                              )
                            );
                          }
                        }}
                        className={`relative mx-auto my-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold ${
                          cell.isSelected
                            ? "bg-indigo-600 text-white shadow-[0_5px_12px_rgba(79,70,229,.25)]"
                            : cell.isToday
                            ? "bg-indigo-50 text-indigo-700"
                            : cell.inCurrentMonth
                            ? "text-slate-700 hover:bg-slate-50"
                            : "text-slate-300"
                        }`}
                      >
                        {
                          cell.date.getDate()
                        }

                        {cell.eventCount >
                          0 && (
                          <span
                            className={`absolute bottom-[2px] h-1 w-1 rounded-full ${
                              cell.isSelected
                                ? "bg-white"
                                : "bg-indigo-500"
                            }`}
                          />
                        )}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openCreateEvent(
                      agendaDate
                    )
                  }
                  className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-[13px] font-bold text-white hover:bg-indigo-700"
                >
                  <Plus size={13} />
                  Add Event
                </button>
              </div>

              <div className="border-t border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-bold text-slate-950">
                      {dateKey(
                        agendaDate
                      ) ===
                      dateKey(
                        new Date()
                      )
                        ? "Today"
                        : formatUiDate(agendaDate, { weekday: "short" })}
                      {" · "}
                      {formatUiDate(agendaDate, { day: "numeric", month: "short", year: "numeric" })}
                    </div>

                    <div className="mt-1 text-[12px] text-slate-500">
                      {agendaEvents.length}
                      {" "}
                      {agendaEvents.length ===
                      1
                        ? "event"
                        : "events"}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const today =
                        new Date();

                      setAgendaDate(
                        today
                      );

                      setCalendarMonth(
                        new Date(
                          today.getFullYear(),
                          today.getMonth(),
                          1
                        )
                      );
                    }}
                    className="text-[13px] font-semibold text-indigo-600"
                  >
                    Today
                  </button>
                </div>

                {calendarLoading ? (
                  <div className="flex min-h-[220px] items-center justify-center gap-2 text-[12px] text-slate-400">
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                    Loading...
                  </div>
                ) : calendarError ? (
                  <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-[12px] text-rose-700">
                    {calendarError}
                  </div>
                ) : agendaEvents.length ===
                  0 ? (
                  <div className="flex min-h-[210px] flex-col items-center justify-center text-center">
                    <CalendarDays
                      size={19}
                      className="text-slate-300"
                    />
                    <div className="mt-2 text-[12px] font-semibold text-slate-700">
                      No events scheduled
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openCreateEvent(
                          agendaDate
                        )
                      }
                      className="mt-2 text-[12px] font-semibold text-indigo-600"
                    >
                      + Add event
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {agendaEvents.map(
                      (item) => {
                        const style =
                          EVENT_TYPE_STYLES[
                            item.type
                          ] ||
                          EVENT_TYPE_STYLES.OTHER;

                        return (
                          <button
                            key={
                              item.id
                            }
                            type="button"
                            onClick={() =>
                              openEditEvent(
                                item
                              )
                            }
                            className="w-full rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50/50"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-[13px] font-bold ${style}`}
                              >
                                {item.type ===
                                "PAYMENT"
                                  ? "₹"
                                  : item.type
                                      ?.charAt(
                                        0
                                      ) ||
                                    "E"}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="truncate text-[13px] font-bold text-slate-900">
                                    {
                                      item.title
                                    }
                                  </div>
                                  <div className="flex-shrink-0 text-[12px] font-semibold text-slate-500">
                                    {
                                      eventTime(
                                        item
                                      )
                                    }
                                  </div>
                                </div>

                                <div className="mt-1 text-[12px] text-slate-500">
                                  {typeLabel(
                                    item.type
                                  )}
                                  {item.location
                                    ? ` · ${item.location}`
                                    : ""}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setFullCalendarOpen(
                      true
                    )
                  }
                  className="mt-4 inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600"
                >
                  View full agenda
                  <ChevronRight
                    size={12}
                  />
                </button>
              </div>

              <div className="border-t border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-950">
                      Recent Activity
                    </h3>
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      Latest CRM activity
                    </p>
                  </div>
                </div>

                {recentActivityData.length ? (
                  <div className="mt-3 space-y-1">
                    {recentActivityData.slice(0, 5).map((item, index) => (
                      <div
                        key={item.id || `${item.title || item.action || "activity"}-${index}`}
                        className="flex items-start gap-2.5 border-b border-slate-50 py-2.5 last:border-0"
                      >
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[8px] font-bold text-indigo-600">
                          {(item.userName || item.name || item.title || "A")
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-slate-800">
                            {item.title || item.action || item.description || "CRM activity"}
                          </div>
                          <div className="mt-0.5 text-[12px] text-slate-500">
                            {item.createdAt
                              ? formatUiDateTime(item.createdAt)
                              : item.time || ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-7 text-center">
                    <Activity size={17} className="mx-auto text-slate-300" />
                    <div className="mt-2 text-[13px] font-semibold text-slate-600">
                      No recent activity available
                    </div>
                  </div>
                )}
              </div>
            </aside>
            )}
          </div>

          {canSeeDashboardSection("team-performance") && (
            <>
          {/* TEAM PERFORMANCE */}

          <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-[15px] font-bold text-slate-900">
                Team Performance
              </h2>

              <div className="text-[12px] font-semibold text-slate-500">
                {selectedYear ===
                "all"
                  ? "All Time"
                  : selectedYear}
              </div>
            </div>

            {data.teamPerformance
              .length > 0 ? (
              <div role="list" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {data.teamPerformance.map((member) => {
                  const maxRev = Math.max(
                    ...data.teamPerformance.map((m) => Number(m.revenue || 0)),
                    1
                  );
                  const pct = Math.round((Number(member.revenue || 0) / maxRev) * 100);
                  const inits = String(member.name || "—")
                    .trim()
                    .split(/\s+/)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <div
                      key={member.name}
                      role="listitem"
                      className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,0.25)] motion-reduce:transition-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[11px] font-extrabold text-indigo-700"
                          aria-hidden="true"
                        >
                          {inits}
                        </span>
                        <div className="truncate text-[13.5px] font-bold text-slate-900">
                          {member.name}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div>
                          <div className="text-[15px] font-extrabold tabular-nums text-slate-900">
                            {member.leads}
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">
                            Leads
                          </div>
                        </div>
                        <div>
                          <div className="text-[15px] font-extrabold tabular-nums text-slate-900">
                            {member.admissions}
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">
                            Adm
                          </div>
                        </div>
                        <div>
                          <div className="text-[14px] font-extrabold tabular-nums text-slate-900">
                            {money(member.revenue)}
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500">
                            Rev
                          </div>
                        </div>
                      </div>

                      <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                No team activity for
                this period.
              </div>
            )}
          </div>
        </>
      )}

            </>
          )}

      {/* NEW TASK DRAWER */}
      {taskDrawerOpen && (
        <div className="fixed inset-0 z-[135] flex justify-end">
          <div
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeTaskDrawer();
            }}
            aria-hidden="true"
          />
          <div
            ref={taskDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
            onKeyDown={handleDrawerKeyDown}
            className="relative flex h-full w-full max-w-[460px] flex-col bg-white shadow-2xl motion-safe:transition-transform"
          >
            <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600" aria-hidden="true">
                  New Task
                </div>
                <h2 id="new-task-title" className="text-[17px] font-bold text-slate-950">
                  Create a task
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-500">
                  It&apos;s saved to Tasks and shows on the dashboard.
                </p>
              </div>
              <button
                type="button"
                onClick={closeTaskDrawer}
                aria-label="Close New Task"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={submitTask} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {taskFormError ? (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12.5px] font-semibold text-rose-700">
                    <AlertCircle size={15} aria-hidden="true" />
                    {taskFormError}
                  </div>
                ) : null}

                <div>
                  <label htmlFor="task-title" className="text-[12px] font-bold text-slate-700">
                    Task title <span className="text-rose-600">(required)</span>
                  </label>
                  <input
                    id="task-title"
                    ref={taskTitleRef}
                    type="text"
                    required
                    aria-required="true"
                    aria-invalid={taskFormError ? "true" : undefined}
                    aria-describedby={taskFormError ? "task-title-error" : undefined}
                    value={taskForm.title}
                    onChange={(e) => setTaskField("title", e.target.value)}
                    placeholder="e.g. Call Ananya about B.Tech admission"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] text-slate-900 outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                  />
                  {taskFormError ? (
                    <p id="task-title-error" className="mt-1 text-[11.5px] font-semibold text-rose-600">
                      {taskFormError}
                    </p>
                  ) : null}
                </div>

                <div role="group" aria-labelledby="task-type-label">
                  <div id="task-type-label" className="text-[12px] font-bold text-slate-700">Type</div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {DASH_TASK_TYPES.map((t) => {
                      const TIcon = t.icon;
                      const active = taskForm.type === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setTaskField("type", t.value)}
                          className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${active ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                        >
                          <TIcon size={16} aria-hidden="true" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="task-lead" className="text-[12px] font-bold text-slate-700">
                    Linked lead <span className="font-semibold text-slate-500">(optional)</span>
                  </label>
                  <input
                    id="task-lead"
                    type="text"
                    value={taskForm.leadId || ""}
                    onChange={(e) => setTaskField("leadId", e.target.value)}
                    placeholder="Lead name or id (optional)"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] text-slate-900 outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="task-date" className="text-[12px] font-bold text-slate-700">Due date</label>
                    <input
                      id="task-date"
                      type="date"
                      value={taskForm.dueDate}
                      onChange={(e) => setTaskField("dueDate", e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] text-slate-900 outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                    />
                  </div>
                  <div>
                    <label htmlFor="task-time" className="text-[12px] font-bold text-slate-700">Time</label>
                    <input
                      id="task-time"
                      type="time"
                      value={taskForm.dueTime}
                      onChange={(e) => setTaskField("dueTime", e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] text-slate-900 outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="task-assignee" className="text-[12px] font-bold text-slate-700">Assign to</label>
                  <select
                    id="task-assignee"
                    value={taskForm.assignedToUserId}
                    onChange={(e) => setTaskField("assignedToUserId", e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13.5px] text-slate-900 outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                  >
                    <option value="">Unassigned</option>
                    {calendarUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div role="group" aria-labelledby="task-priority-label">
                  <div id="task-priority-label" className="text-[12px] font-bold text-slate-700">Priority</div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {DASH_TASK_PRIORITIES.map((p) => {
                      const active = taskForm.priority === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setTaskField("priority", p.value)}
                          className={`rounded-lg border px-2 py-2 text-[12.5px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${active ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="task-notes" className="text-[12px] font-bold text-slate-700">Notes</label>
                  <textarea
                    id="task-notes"
                    rows={3}
                    value={taskForm.notes}
                    onChange={(e) => setTaskField("notes", e.target.value)}
                    placeholder="Context, next step, anything to remember"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] text-slate-900 outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div>
                    <div className="text-[13px] font-bold text-slate-900">Pin to top</div>
                    <div className="text-[11px] text-slate-500">Keep this task above the list</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={taskForm.pinned}
                    aria-label="Pin to top"
                    onClick={() => setTaskField("pinned", !taskForm.pinned)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${taskForm.pinned ? "bg-indigo-600" : "bg-slate-300"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${taskForm.pinned ? "left-[22px]" : "left-0.5"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={closeTaskDrawer}
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-white text-[13px] font-bold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSaving}
                  aria-busy={taskSaving}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 text-[13px] font-bold text-white hover:bg-indigo-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  {taskSaving ? (
                    <>
                      <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      Creating…
                    </>
                  ) : (
                    "Create task"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVENT MODAL */}

      {actionDetailOpen && (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-3">
          <div className="flex max-h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-t-[18px] border border-slate-200 bg-white shadow-2xl sm:max-h-[86vh] sm:rounded-[18px]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">
                  Action Center
                </div>
                <h3 className="mt-1 text-[18px] font-extrabold text-slate-950">
                  {actionDetailData?.label || actionDetailItem?.label || "Priority details"}
                </h3>
                <p className="mt-1 text-[12px] text-slate-500">
                  See exactly which records need attention now.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {Array.isArray(actionDetailData?.items) && actionDetailData.items.length ? (
                  <button
                    type="button"
                    onClick={exportActionDetail}
                    className="hidden h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex"
                  >
                    <Download size={13} />
                    Export CSV
                  </button>
                ) : null}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Items</div>
                  <div className="text-[17px] font-extrabold text-slate-900">
                    {Number(actionDetailData?.count ?? actionDetailItem?.count ?? 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActionDetailOpen(false);
                    setActionDetailItem(null);
                    setActionDetailData(null);
                    setActionDetailError("");
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close Action Center details"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {actionDetailLoading ? (
                <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Loading details...
                </div>
              ) : actionDetailError ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-rose-100 bg-rose-50/60 px-5 text-center">
                  <AlertCircle size={20} className="text-rose-500" />
                  <div className="mt-2 text-sm font-bold text-rose-700">{actionDetailError}</div>
                  <button
                    type="button"
                    onClick={() => openActionDetail(actionDetailItem)}
                    className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    <RefreshCw size={13} />
                    Retry
                  </button>
                </div>
              ) : Array.isArray(actionDetailData?.items) && actionDetailData.items.length ? (
                <div className="space-y-2.5">
                  <div className="flex justify-end sm:hidden">
                    <button
                      type="button"
                      onClick={exportActionDetail}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Download size={13} />
                      Export CSV
                    </button>
                  </div>
                  {actionDetailData.items.map((record) => (
                    <div
                      key={`${record.kind || "item"}-${record.id}`}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.02)]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-[13px] font-extrabold text-slate-900">
                              {record.primary || "CRM record"}
                            </div>
                            {record.leadDisplayId ? (
                              <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                                Lead ID {record.leadDisplayId}
                              </span>
                            ) : record.kind === "payment" || record.kind === "revenue" || record.kind === "admission" ? (
                              <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold text-slate-600">
                                Admission record
                              </span>
                            ) : null}
                            {record.status ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-slate-600">
                                {String(record.status).replaceAll("_", " ")}
                              </span>
                            ) : null}
                          </div>

                          {(record.phone || record.email) && (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                              {record.phone ? <span>{record.phone}</span> : null}
                              {record.email ? <span>{record.email}</span> : null}
                            </div>
                          )}

                          {record.note ? (
                            <div className="mt-2 text-[12px] leading-5 text-slate-600">
                              {record.note}
                            </div>
                          ) : null}

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                            {record.owner ? (
                              <span className="inline-flex items-center gap-1">
                                <UserRound size={11} />
                                {record.owner}
                              </span>
                            ) : null}
                            {record.occurredAt ? (
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays size={11} />
                                {formatUiDateTime(record.occurredAt, uiPreferences)}
                              </span>
                            ) : null}
                            {Number.isFinite(Number(record.ageDays)) && record.ageDays > 0 ? (
                              <span>{record.ageDays} days old</span>
                            ) : null}
                          </div>
                        </div>

                        {record.amount !== undefined && record.amount !== null ? (
                          <div className="shrink-0 sm:text-right">
                            <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Pending</div>
                            <div className="mt-0.5 text-[16px] font-extrabold text-slate-950">
                              {money(record.amount)}
                            </div>
                            {record.totalFee !== undefined ? (
                              <div className="mt-1 text-[10px] text-slate-400">
                                Total {money(record.totalFee)} · Paid {money(record.paidAmount)}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {(record.leadId && typeof onOpenLead === "function") ||
                      (!record.leadId && typeof onOpenModule === "function") ? (
                        <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                          {record.leadId && typeof onOpenLead === "function" ? (
                            <button
                              type="button"
                              onClick={() => openLead(record)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-bold text-white hover:bg-indigo-700"
                            >
                              Open in Lead Store
                              <ArrowUpRight size={12} />
                            </button>
                          ) : record.kind === "payment" || record.kind === "revenue" || record.kind === "admission" ? (
                            <button
                              type="button"
                              onClick={() => onOpenModule("admissions")}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-bold text-white hover:bg-indigo-700"
                            >
                              Open in Admissions
                              <ArrowUpRight size={12} />
                            </button>
                          ) : record.kind === "followup" ? (
                            <button
                              type="button"
                              onClick={() => onOpenModule("counselling")}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-bold text-white hover:bg-indigo-700"
                            >
                              Open in Counselling
                              <ArrowUpRight size={12} />
                            </button>
                          ) : record.kind === "walkin" ? (
                            <button
                              type="button"
                              onClick={() => onOpenModule("walkins")}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-bold text-white hover:bg-indigo-700"
                            >
                              Open in Walk-ins
                              <ArrowUpRight size={12} />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                  <div className="mt-2 text-sm font-bold text-slate-800">Nothing waiting here</div>
                  <div className="mt-1 text-xs text-slate-500">There are no records requiring attention in this category.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {kpiDetailOpen && (
        <div className="fixed inset-0 z-[131] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-3">
          <div className="flex max-h-[92vh] w-full max-w-[920px] flex-col overflow-hidden rounded-t-[18px] border border-slate-200 bg-white shadow-2xl sm:max-h-[86vh] sm:rounded-[18px]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">
                  Dashboard KPI
                </div>
                <h3 className="mt-1 text-[18px] font-extrabold text-slate-950">
                  {kpiDetailData?.label || kpiDetailMetric?.label || "KPI details"}
                </h3>
                <p className="mt-1 text-[12px] text-slate-500">
                  Records used to calculate this dashboard value.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    {kpiDetailData?.valueLabel || "Items"}
                  </div>
                  <div className="text-[17px] font-extrabold text-slate-900">
                    {kpiDetailData?.displayValue ?? Number(kpiDetailData?.count || 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeKpiDetail}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close KPI details"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              {kpiDetailLoading ? (
                <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  Loading details...
                </div>
              ) : kpiDetailError ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-rose-100 bg-rose-50/60 px-5 text-center">
                  <AlertCircle size={20} className="text-rose-500" />
                  <div className="mt-2 text-sm font-bold text-rose-700">{kpiDetailError}</div>
                  <button
                    type="button"
                    onClick={() => openKpiDetail(kpiDetailMetric)}
                    className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    <RefreshCw size={13} />
                    Retry
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {kpiDetailData?.breakdown ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {kpiDetailData.breakdown.map((item) => (
                        <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">{item.label}</div>
                          <div className="mt-1 text-[16px] font-extrabold text-slate-900">{item.displayValue}</div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {Array.isArray(kpiDetailData?.items) && kpiDetailData.items.length ? (
                    <div className="space-y-2.5">
                      {kpiDetailData.items.map((record) => (
                        <div key={`${record.kind || "item"}-${record.id}`} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-[13px] font-extrabold text-slate-900">{record.primary || "CRM record"}</div>
                                {record.leadDisplayId ? (
                                  <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
                                    Lead ID {record.leadDisplayId}
                                  </span>
                                ) : null}
                                {record.status ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-slate-600">
                                    {String(record.status).replaceAll("_", " ")}
                                  </span>
                                ) : null}
                              </div>
                              {(record.phone || record.email) ? (
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                  {record.phone ? <span>{record.phone}</span> : null}
                                  {record.email ? <span>{record.email}</span> : null}
                                </div>
                              ) : null}
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                                {record.owner ? <span className="inline-flex items-center gap-1"><UserRound size={11} />{record.owner}</span> : null}
                                {record.occurredAt ? <span className="inline-flex items-center gap-1"><CalendarDays size={11} />{formatUiDateTime(record.occurredAt, uiPreferences)}</span> : null}
                              </div>
                            </div>
                            {record.amount !== undefined && record.amount !== null ? (
                              <div className="shrink-0 sm:text-right">
                                <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">Amount</div>
                                <div className="mt-0.5 text-[16px] font-extrabold text-slate-950">{money(record.amount)}</div>
                              </div>
                            ) : null}
                          </div>
                          {record.leadId && record.leadDisplayId && typeof onOpenLead === "function" ? (
                            <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                              <button type="button" onClick={() => openLead(record)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-bold text-white hover:bg-indigo-700">
                                Open in Lead Store
                                <ArrowUpRight size={12} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 text-center">
                      <CheckCircle2 size={22} className="text-emerald-500" />
                      <div className="mt-2 text-sm font-bold text-slate-800">No records for this KPI</div>
                      <div className="mt-1 text-xs text-slate-500">The selected period currently has no matching records.</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fullCalendarOpen && (
        <div className="fixed inset-0 z-[88] bg-slate-950/45 backdrop-blur-[2px] p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-[1380px] mx-auto bg-[#f7f8fb] rounded-2xl shadow-2xl border border-white overflow-hidden">
            <div className="h-16 px-5 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-slate-950">
                  Bispun Calendar
                </div>
                <div className="text-[13px] text-slate-500 mt-0.5">
                  Meetings, follow-ups, counselling, admissions and payment reminders.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFullCalendarOpen(false)}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 flex items-center justify-center"
                aria-label="Close full calendar"
              >
                <X size={17} />
              </button>
            </div>

            <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_340px] gap-4">
            <div className="bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarDays
                      size={17}
                      className="text-indigo-600"
                    />

                    <h3 className="text-sm font-bold text-slate-950">
                      My Calendar
                    </h3>
                  </div>

                  <p className="mt-1 text-[13px] text-slate-500">
                    Meetings, follow-ups,
                    counselling and
                    important CRM events.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          new Date().getFullYear(),
                          new Date().getMonth(),
                          1
                        )
                      )
                    }
                    className="h-8 px-3 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Today
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openCreateEvent(
                        new Date()
                      )
                    }
                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus size={13} />

                    Add event
                  </button>
                </div>
              </div>

              {calendarError && (
                <div className="mx-4 sm:mx-5 mt-4 px-3 py-2 rounded-lg bg-rose-50 border border-rose-100 text-xs text-rose-700">
                  {calendarError}
                </div>
              )}

              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() -
                            1,
                          1
                        )
                      )
                    }
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                  >
                    <ChevronLeft
                      size={15}
                    />
                  </button>

                  <div className="text-[15px] font-bold text-slate-900">
                    {formatUiDate(calendarMonth, {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCalendarMonth(
                        new Date(
                          calendarMonth.getFullYear(),
                          calendarMonth.getMonth() +
                            1,
                          1
                        )
                      )
                    }
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                  >
                    <ChevronRight
                      size={15}
                    />
                  </button>
                </div>

                {calendarLoading ? (
                  <div className="h-[360px] sm:h-[420px] flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />

                    Loading calendar...
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-1 pb-1 native:[-webkit-overflow-scrolling:touch] native:overscroll-x-contain">
                    <div className="min-w-[700px] grid grid-cols-7 border-t border-l border-slate-200 rounded-xl overflow-hidden">
                      {[
                        "Sun",
                        "Mon",
                        "Tue",
                        "Wed",
                        "Thu",
                        "Fri",
                        "Sat",
                      ].map((day) => (
                        <div
                          key={day}
                          className="bg-slate-50 border-r border-b border-slate-200 px-2 py-2.5 text-center text-[12px] font-bold uppercase tracking-wide text-slate-500"
                        >
                          {day}
                        </div>
                      ))}

                      {(() => {
                        const year =
                          calendarMonth.getFullYear();

                        const month =
                          calendarMonth.getMonth();

                        const firstDay =
                          new Date(
                            year,
                            month,
                            1
                          ).getDay();

                        const days =
                          new Date(
                            year,
                            month + 1,
                            0
                          ).getDate();

                        const cells = [];

                        for (
                          let i = 0;
                          i < firstDay;
                          i += 1
                        ) {
                          cells.push(
                            <div
                              key={`blank-${i}`}
                              className="min-h-[96px] bg-slate-50/40 border-r border-b border-slate-200"
                            />
                          );
                        }

                        for (
                          let day = 1;
                          day <= days;
                          day += 1
                        ) {
                          const date =
                            new Date(
                              year,
                              month,
                              day
                            );

                          const key =
                            dateKey(date);

                          const dayEvents =
                            calendarEvents
                              .filter(
                                (event) =>
                                  eventDateKey(
                                    event
                                  ) === key
                              )
                              .sort(
                                (a, b) =>
                                  new Date(
                                    a.startAt
                                  ) -
                                  new Date(
                                    b.startAt
                                  )
                              );

                          const isToday =
                            key ===
                            todayKey;

                          cells.push(
                            <div
                              key={key}
                              onDoubleClick={() =>
                                openCreateEvent(
                                  date
                                )
                              }
                              className="min-h-[96px] p-2 bg-white hover:bg-slate-50/70 border-r border-b border-slate-200 transition-colors overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  openCreateEvent(
                                    date
                                  )
                                }
                                className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-[13px] font-semibold ${
                                  isToday
                                    ? "bg-indigo-600 text-white"
                                    : "text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                {day}
                              </button>

                              <div className="mt-1.5 space-y-1">
                                {dayEvents
                                  .slice(0, 3)
                                  .map(
                                    (item) => (
                                      <button
                                        key={
                                          item.id
                                        }
                                        type="button"
                                        onClick={() =>
                                          openEditEvent(
                                            item
                                          )
                                        }
                                        className={`w-full truncate text-left rounded-md border px-1.5 py-1 text-[13px] font-semibold ${
                                          EVENT_TYPE_STYLES[
                                            item
                                              .type
                                          ] ||
                                          EVENT_TYPE_STYLES.OTHER
                                        }`}
                                      >
                                        {!item.allDay
                                          ? `${formatUiTime(item.startAt)} `
                                          : ""}

                                        {
                                          item.title
                                        }
                                      </button>
                                    )
                                  )}

                                {dayEvents.length >
                                  3 && (
                                  <div className="text-[13px] font-semibold text-slate-400 px-1">
                                    +
                                    {dayEvents.length -
                                      3}{" "}
                                    more
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return cells;
                      })()}
                    </div>
                  </div>
                )}

                <div className="mt-3 text-[12px] text-slate-400">
                  Click a date to create
                  an event. Click an
                  existing event to edit
                  it.
                </div>
              </div>
            </div>

            {/* TODAY + UPCOMING */}

            <div className="bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
              <div className="px-4 py-4 border-b border-slate-100">
                <div className="text-[12px] font-semibold uppercase tracking-[0.10em] text-slate-400">
                  Today
                </div>

                <div className="mt-1 text-sm font-bold text-slate-950">
                  {formatUiDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}
                </div>
              </div>

              <div className="p-4">
                {todayEvents.length ===
                0 ? (
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-5 text-center">
                    <CalendarDays
                      size={20}
                      className="mx-auto text-slate-300"
                    />

                    <div className="mt-2 text-xs font-semibold text-slate-700">
                      No events today
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        openCreateEvent(
                          new Date()
                        )
                      }
                      className="mt-3 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      + Add event
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {todayEvents.map(
                      (item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            openEditEvent(
                              item
                            )
                          }
                          className="w-full text-left rounded-xl border border-slate-200 p-3 hover:border-indigo-200 hover:bg-indigo-50/20 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 text-[12px] font-bold text-indigo-600 pt-0.5">
                              {eventTime(
                                item
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {
                                  item.title
                                }
                              </div>

                              <div className="mt-1 text-[12px] text-slate-500">
                                {typeLabel(
                                  item.type
                                )}
                              </div>

                              {item.assignedTo
                                ?.name && (
                                <div className="mt-1 text-[12px] text-slate-400 truncate">
                                  {
                                    item
                                      .assignedTo
                                      .name
                                  }
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    )}
                  </div>
                )}

                <div className="mt-6 mb-2 text-[12px] font-semibold uppercase tracking-[0.10em] text-slate-400">
                  Upcoming
                </div>

                {upcomingEvents.length ===
                0 ? (
                  <div className="py-5 text-center text-xs text-slate-400">
                    No upcoming events.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingEvents.map(
                      (item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            openEditEvent(
                              item
                            )
                          }
                          className="w-full flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        >
                          <div className="w-10 text-center flex-shrink-0">
                            <div className="text-[13px] font-bold text-indigo-600 uppercase">
                              {formatUiDate(item.startAt, { month: "short" })}
                            </div>

                            <div className="text-base font-bold text-slate-950">
                              {new Date(
                                item.startAt
                              ).getDate()}
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {
                                item.title
                              }
                            </div>

                            <div className="mt-0.5 text-[12px] text-slate-500 truncate">
                              {eventTime(
                                item
                              )}{" "}
                              ·{" "}
                              {typeLabel(
                                item.type
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>


            </div>
          </div>
        </div>
      )}

      {eventModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex justify-end bg-slate-950/45 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setEventModalOpen(false);
            }
          }}
        >
          <form
            onSubmit={saveEvent}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-drawer-title"
            className="relative flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl motion-safe:transition-transform"
          >
            <div className="sticky top-0 bg-white z-10 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 id="event-drawer-title" className="text-sm font-bold text-slate-950">
                  {editingEvent
                    ? "Edit event"
                    : "Add event"}
                </h2>

                <div className="mt-0.5 text-[13px] text-slate-500">
                  Add meetings,
                  follow-ups and
                  important CRM
                  activities.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setEventModalOpen(
                    false
                  )
                }
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <label className="block">
                <span className="text-[13px] font-semibold text-slate-600">
                  Event title *
                </span>

                <input
                  autoFocus
                  value={
                    eventForm.title
                  }
                  onChange={(event) =>
                    setEventForm(
                      (form) => ({
                        ...form,
                        title:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="e.g. Student counselling follow-up"
                  className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold text-slate-600">
                    Starts *
                  </span>

                  <input
                    type="datetime-local"
                    value={
                      eventForm.startAt
                    }
                    onChange={(event) =>
                      setEventForm(
                        (form) => ({
                          ...form,
                          startAt:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400"
                  />
                </label>

                <label className="block">
                  <span className="text-[13px] font-semibold text-slate-600">
                    Ends
                  </span>

                  <input
                    type="datetime-local"
                    value={
                      eventForm.endAt
                    }
                    onChange={(event) =>
                      setEventForm(
                        (form) => ({
                          ...form,
                          endAt:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={
                    eventForm.allDay
                  }
                  onChange={(event) =>
                    setEventForm(
                      (form) => ({
                        ...form,
                        allDay:
                          event.target
                            .checked,
                      })
                    )
                  }
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />

                <span className="text-xs font-medium text-slate-600">
                  All-day event
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[13px] font-semibold text-slate-600">
                    Type
                  </span>

                  <select
                    value={
                      eventForm.type
                    }
                    onChange={(event) =>
                      setEventForm(
                        (form) => ({
                          ...form,
                          type:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white outline-none focus:border-indigo-400"
                  >
                    {EVENT_TYPES.map(
                      (type) => (
                        <option
                          key={
                            type.value
                          }
                          value={
                            type.value
                          }
                        >
                          {
                            type.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[13px] font-semibold text-slate-600">
                    Status
                  </span>

                  <select
                    value={
                      eventForm.status
                    }
                    onChange={(event) =>
                      setEventForm(
                        (form) => ({
                          ...form,
                          status:
                            event.target
                              .value,
                        })
                      )
                    }
                    className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white outline-none focus:border-indigo-400"
                  >
                    <option value="SCHEDULED">
                      Scheduled
                    </option>

                    <option value="COMPLETED">
                      Completed
                    </option>

                    <option value="CANCELLED">
                      Cancelled
                    </option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[13px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <UserRound
                    size={12}
                  />

                  Assign to
                </span>

                <select
                  value={
                    eventForm.assignedToUserId
                  }
                  onChange={(event) =>
                    setEventForm(
                      (form) => ({
                        ...form,
                        assignedToUserId:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white outline-none focus:border-indigo-400"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {calendarUsers.map(
                    (member) => (
                      <option
                        key={
                          member.id
                        }
                        value={
                          member.id
                        }
                      >
                        {member.name} ·{" "}
                        {member.role
                          ?.replaceAll(
                            "_",
                            " "
                          )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <div className="block">
                <span id="event-guests-label" className="text-[13px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <Users size={12} aria-hidden="true" />
                  Guests
                </span>
                <div className="mt-1.5">
                  <GuestPicker
                    value={eventForm.guests || []}
                    onChange={(guests) =>
                      setEventForm((form) => ({ ...form, guests }))
                    }
                    users={calendarUsers}
                    ariaLabelledby="event-guests-label"
                  />
                </div>
              </div>

              <label className="block">
                <span className="text-[13px] font-semibold text-slate-600 flex items-center gap-1.5">
                  <MapPin size={12} />

                  Location
                </span>

                <input
                  value={
                    eventForm.location
                  }
                  onChange={(event) =>
                    setEventForm(
                      (form) => ({
                        ...form,
                        location:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Office, Google Meet, Hyderabad..."
                  className="mt-1.5 w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-400"
                />
              </label>

              <label className="block">
                <span className="text-[13px] font-semibold text-slate-600">
                  Notes
                </span>

                <textarea
                  rows="3"
                  value={
                    eventForm.description
                  }
                  onChange={(event) =>
                    setEventForm(
                      (form) => ({
                        ...form,
                        description:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Add agenda, follow-up details or notes..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none resize-none focus:border-indigo-400"
                />
              </label>

              {editingEvent
                ?.assignedTo && (
                <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 flex items-center gap-2 text-xs text-slate-600">
                  <CheckCircle2
                    size={14}
                    className="text-emerald-500"
                  />

                  Currently assigned
                  to{" "}
                  <span className="font-semibold text-slate-800">
                    {
                      editingEvent
                        .assignedTo
                        .name
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <div>
                {editingEvent && (
                  <button
                    type="button"
                    disabled={
                      deletingEventId ===
                      editingEvent.id
                    }
                    onClick={() =>
                      deleteEvent(
                        editingEvent.id
                      )
                    }
                    className="h-9 px-3 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {deletingEventId ===
                    editingEvent.id ? (
                      <Loader2
                        size={13}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2
                        size={13}
                      />
                    )}

                    Delete
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEventModalOpen(
                      false
                    )
                  }
                  className="h-9 px-4 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    savingEvent ||
                    !eventForm.title.trim() ||
                    !eventForm.startAt
                  }
                  className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {savingEvent ? (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  ) : editingEvent ? (
                    <Pencil size={13} />
                  ) : (
                    <Plus size={13} />
                  )}

                  {editingEvent
                    ? "Save changes"
                    : "Create event"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
