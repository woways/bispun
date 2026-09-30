import { useEffect, useMemo, useState } from "react";

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
} from "lucide-react";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { apiRequest } from "../../lib/api";
import { brandColor } from "../../lib/brandTheme";
import { formatUiDate, formatUiTime, formatUiDateTime } from "../../lib/uiPreferences";

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

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
  accent = "indigo",
}) {
  const tones = {
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    slate: "bg-slate-500",
  };
  const bar = tones[accent] || tones.indigo;

  return (
    <div className="group relative min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-200 hover:shadow-[0_14px_32px_rgba(15,23,42,0.12)]">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white ${bar}`}
        >
          <Icon size={20} />
        </div>

        <div className="min-w-0 text-[16px] font-bold text-slate-800 break-words">
          {label}
        </div>
      </div>

      <div className="mt-3 text-[22px] leading-none font-extrabold tracking-tight text-slate-900 break-words">
        {value}
      </div>

      {detail ? (
        <div className="mt-2 text-[12px] text-slate-400 break-words">
          {detail}
        </div>
      ) : null}
    </div>
  );
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
  };
}

export default function Dashboard({
  tenant,
  user,
  selectedYear = "all",
  uiPreferences,
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

  useEffect(() => {
    loadDashboard(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    loadCalendar();
  }, [calendarMonth]);

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
      };

      if (editingEvent) {
        await apiRequest(
          `/api/client/calendar/${editingEvent.id}`,
          {
            method: "PATCH",
            body: payload,
          }
        );
      } else {
        await apiRequest(
          "/api/client/calendar",
          {
            method: "POST",
            body: payload,
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

  const pulseMetrics = [
    {
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
      label: "Qualified Leads",
      value: summary.qualifiedLeads || 0,
      icon: Target,
      detail: "Qualified opportunities",
      accent: "emerald",
    },
    {
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
      label: "Potential Revenue",
      value: money(summary.potentialRevenue),
      icon: CircleDollarSign,
      detail: "Total admission revenue value",
      accent: "amber",
    },
    {
      label: "Received Revenue",
      value: money(summary.receivedAmount),
      icon: CheckCircle2,
      detail: "Revenue received",
      accent: "emerald",
    },
    {
      label: "Pending Revenue",
      value: money(summary.pendingAmount),
      icon: Clock,
      detail: "Revenue pending collection",
      accent: "amber",
    },
    {
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

  return (
    <div className="cb-dashboard-root space-y-5">
      {/* WORKSPACE HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        {uiPreferences?.showGreeting !== false ? (
          <div>
            <h1 className="text-[40px] font-bold leading-[1.2] tracking-[-0.01em] text-slate-950" style={{ fontFamily: "'Newsreader', Georgia, serif" }}>
              {(() => {
                const hour = new Date().getHours();
                if (hour < 12) return "Good Morning";
                if (hour < 17) return "Good Afternoon";
                return "Good Evening";
              })()}
              ,{" "}
              <span className="font-bold text-slate-950">
                {tenant?.name || tenant?.brandName || user?.name || tenant?.ownerName || "Company"}
              </span>
            </h1>
            <p className="mt-1.5 text-[15px] font-medium tracking-normal text-slate-500">
              It&apos;s {formatUiDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-[40px] font-normal leading-[1.2] tracking-[-0.01em] text-slate-950" style={{ fontFamily: "'Newsreader', Georgia, serif" }}>Dashboard</h1>
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
                      My Work Overview
                    </div>
                  </div>

                  {myPerformance ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

              {!isMyWorkView && (
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {(isTeamView ? pulseMetrics.slice(0, 4) : pulseMetrics).map((metric) => (
                    <MetricCard
                      key={metric.label}
                      {...metric}
                    />
                  ))}
                </div>
              </section>

                </>
              )}

              {isBusinessView && (
                <>
              {/* ANALYTICS CORE */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,.85fr)]">
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

                  {(data.revenueTrend || []).some(
                    (p) =>
                      Number(p.potential) > 0 ||
                      Number(p.received) > 0
                  ) ? (
                  <ResponsiveContainer
                    width="100%"
                    height={280}
                  >
                    <LineChart
                      data={
                        data.revenueTrend
                      }
                      margin={{
                        left: 4,
                        right: 8,
                        top: 8,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="#eef2f7"
                      />

                      <XAxis
                        dataKey="m"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        stroke="#94a3b8"
                      />

                      <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        stroke="#94a3b8"
                        tickFormatter={
                          axisMoney
                        }
                      />

                      <Tooltip
                        formatter={(
                          value
                        ) =>
                          money(
                            value
                          )
                        }
                        contentStyle={{
                          borderRadius:
                            "10px",
                          border:
                            "1px solid #e2e8f0",
                          boxShadow:
                            "0 10px 30px rgba(15,23,42,.08)",
                        }}
                      />

                      <Line
                        type="monotone"
                        dataKey="potential"
                        name="Potential"
                        stroke="#94a3b8"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                      />

                      <Line
                        type="monotone"
                        dataKey="received"
                        name="Received"
                        stroke={accentColor}
                        strokeWidth={2.75}
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: accentColor,
                          stroke: "#ffffff",
                          strokeWidth: 2,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[280px] items-center justify-center text-[13px] text-slate-400">
                      No revenue data yet.
                    </div>
                  )}
                </section>

                <section className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
                  <div className="mb-3">
                    <h2 className="text-[15px] font-bold text-slate-950">
                      Leads by Source
                    </h2>
                    <p className="mt-1 text-[13px] text-slate-500">
                      Source mix for the selected period
                    </p>
                  </div>

                  {data.leadsBySource
                    .length ? (
                    <>
                      <div className="relative">
                        <ResponsiveContainer
                          width="100%"
                          height={190}
                        >
                          <PieChart>
                            <Pie
                              data={
                                data.leadsBySource
                              }
                              dataKey="value"
                              nameKey="name"
                              innerRadius={52}
                              outerRadius={78}
                              paddingAngle={1}
                            >
                              {data.leadsBySource.map(
                                (
                                  entry,
                                  index
                                ) => (
                                  <Cell
                                    key={
                                      entry.name
                                    }
                                    fill={
                                      pieColors[
                                        index %
                                          pieColors.length
                                      ]
                                    }
                                  />
                                )
                              )}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>

                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-[20px] font-bold tracking-[-0.04em] text-slate-950">
                              {
                                summary.totalLeads ||
                                0
                              }
                            </div>
                            <div className="text-[13px] text-slate-400">
                              Leads
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 space-y-2">
                        {data.leadsBySource
                          .slice(0, 5)
                          .map(
                            (
                              source,
                              index
                            ) => (
                              <div
                                key={
                                  source.name
                                }
                                className="flex items-center justify-between gap-3 text-[12px]"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
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
                                    {
                                      source.name
                                    }
                                  </span>
                                </div>

                                <span className="font-semibold text-slate-800">
                                  {
                                    source.value
                                  }
                                </span>
                              </div>
                            )
                          )}
                      </div>
                    </>
                  ) : (
                    <div className="flex h-[260px] items-center justify-center text-xs text-slate-400">
                      No lead data yet.
                    </div>
                  )}
                </section>
              </div>
                </>
              )}

              {!isMyWorkView && (
                <>
              {/* OPERATIONS ROW */}
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[620px] text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/60 text-[12px] font-bold uppercase tracking-[0.06em] text-slate-500">
                            <th className="px-4 py-2.5">Student</th>
                            <th className="px-3 py-2.5">College</th>
                            <th className="px-3 py-2.5">Counsellor</th>
                            <th className="px-3 py-2.5">Date</th>
                            <th className="px-3 py-2.5">Amount</th>
                            <th className="px-3 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentAdmissionsData.slice(0, 5).map((item, index) => (
                            <tr
                              key={item.id || `${item.studentName || item.leadName || "admission"}-${index}`}
                              className="border-b border-slate-50 text-[13px] text-slate-600 last:border-0"
                            >
                              <td className="px-4 py-3 font-semibold text-slate-900">
                                {item.studentName || item.leadName || item.name || "—"}
                              </td>
                              <td className="px-3 py-3">
                                {item.collegeName || item.universityName || item.college || "—"}
                              </td>
                              <td className="px-3 py-3">
                                {item.counsellorName || item.admissionDoneBy || item.assignedTo || "—"}
                              </td>
                              <td className="px-3 py-3">
                                {item.dateOfAdmission || item.admissionDate || item.createdAt
                                  ? formatUiDate(item.dateOfAdmission || item.admissionDate || item.createdAt)
                                  : "—"}
                              </td>
                              <td className="px-3 py-3 font-semibold text-slate-800">
                                {item.amount != null
                                  ? money(item.amount)
                                  : item.revenue != null
                                  ? money(item.revenue)
                                  : "—"}
                              </td>
                              <td className="px-3 py-3">
                                {item.revenueStatus || item.status || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={admissionsByMonthData}>
                        <CartesianGrid vertical={false} stroke="#eef2f7" />
                        <XAxis
                          dataKey={
                            admissionsByMonthData[0]?.m !== undefined
                              ? "m"
                              : admissionsByMonthData[0]?.month !== undefined
                              ? "month"
                              : "name"
                          }
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          stroke="#94a3b8"
                        />
                        <YAxis
                          fontSize={11}
                          tickLine={false}
                          axisLine={false}
                          stroke="#94a3b8"
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 10px 30px rgba(15,23,42,.08)",
                          }}
                        />
                        <Bar
                          dataKey={
                            admissionsByMonthData[0]?.value !== undefined
                              ? "value"
                              : admissionsByMonthData[0]?.count !== undefined
                              ? "count"
                              : "admissions"
                          }
                          fill={accentColor}
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
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
              </div>
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

          {!isMyWorkView && (
            <>
          {/* TEAM PERFORMANCE */}

          <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[15px] font-bold text-slate-900">
                Team Performance
              </h3>

              <div className="text-[12px] font-semibold text-slate-400">
                {selectedYear ===
                "all"
                  ? "All Time"
                  : selectedYear}
              </div>
            </div>

            {data.teamPerformance
              .length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {data.teamPerformance.map(
                  (member) => (
                    <div
                      key={
                        member.name
                      }
                      className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-slate-200 hover:bg-white"
                    >
                      <div className="text-sm font-medium text-slate-900">
                        {
                          member.name
                        }
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div>
                          <div className="text-slate-500">
                            Leads
                          </div>

                          <div className="font-semibold text-slate-900">
                            {
                              member.leads
                            }
                          </div>
                        </div>

                        <div>
                          <div className="text-slate-500">
                            Adm
                          </div>

                          <div className="font-semibold text-slate-900">
                            {
                              member.admissions
                            }
                          </div>
                        </div>

                        <div>
                          <div className="text-slate-500">
                            Rev
                          </div>

                          <div className="font-semibold text-slate-900">
                            {money(
                              member.revenue
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
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

      {/* EVENT MODAL */}

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
                  <div className="overflow-x-auto -mx-1 pb-1">
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
          className="fixed inset-0 z-[100] bg-slate-950/35 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
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
            className="w-full max-w-xl max-h-[94vh] sm:max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
          >
            <div className="sticky top-0 bg-white z-10 px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-950">
                  {editingEvent
                    ? "Edit event"
                    : "Add event"}
                </div>

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
