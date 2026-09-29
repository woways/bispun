import {

  useEffect,

  useMemo,

  useRef,

  useState,

} from "react";



import {

  X,

  ChevronLeft,

  ChevronRight,

  Plus,

  Loader2,

  Trash2,

  Clock,

  MapPin,

  UserRound,

  AlertCircle,

  CalendarDays,

  Video,

} from "lucide-react";





import { apiRequest } from "../../lib/api";



/* ------------------------------------------------------------------ */

/* Constants                                                           */

/* ------------------------------------------------------------------ */



const EVENT_TYPES = [

  "MEETING",

  "FOLLOW_UP",

  "COUNSELLING",

  "ADMISSION",

  "PAYMENT",

  "REMINDER",

  "OTHER",

];



const TYPE_LABELS = {

  MEETING: "Meeting",

  FOLLOW_UP: "Follow-up",

  COUNSELLING: "Counselling",

  ADMISSION: "Admission",

  PAYMENT: "Payment",

  REMINDER: "Reminder",

  OTHER: "Other",

};



// Colour per type — soft background + strong text, consistent with the portal.

const TYPE_STYLES = {

  MEETING: "bg-sky-100 text-sky-700 border-sky-200",

  FOLLOW_UP: "bg-violet-100 text-violet-700 border-violet-200",

  COUNSELLING: "bg-pink-100 text-pink-700 border-pink-200",

  ADMISSION: "bg-cyan-100 text-cyan-700 border-cyan-200",

  PAYMENT: "bg-yellow-100 text-yellow-700 border-yellow-200",

  REMINDER: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",

  OTHER: "bg-slate-100 text-slate-600 border-slate-200",

};





const STATUS_OPTIONS = ["SCHEDULED", "COMPLETED", "CANCELLED"];



// Status overrides colour: cancelled = red, completed = green,

// scheduled keeps the per-type colour.

const STATUS_STYLES = {

  CANCELLED: "bg-rose-100 text-rose-800 border-rose-300 line-through",

  COMPLETED: "bg-emerald-100 text-emerald-800 border-emerald-300",

};



function eventStyle(event) {

  if (event.status && STATUS_STYLES[event.status]) {

    return STATUS_STYLES[event.status];

  }

  return TYPE_STYLES[event.type] || TYPE_STYLES.OTHER;

}



const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const WEEKDAYS_MINI = ["M", "T", "W", "T", "F", "S", "S"];

const HOURS = Array.from({ length: 24 }, (_, i) => i);



const MIN_EVENT_YEAR = 2000;
const MAX_EVENT_YEAR = 2100;

function isValidCalendarDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) {
    return false;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  if (year < MIN_EVENT_YEAR || year > MAX_EVENT_YEAR) {
    return false;
  }

  const check = new Date(0);
  check.setUTCHours(0, 0, 0, 0);
  check.setUTCFullYear(year, month - 1, day);

  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

function isValidTime(timeStr) {
  if (!/^\d{2}:\d{2}$/.test(String(timeStr || ""))) {
    return false;
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/* ------------------------------------------------------------------ */

/* Date helpers (local time, Monday-first weeks)                       */

/* ------------------------------------------------------------------ */



function startOfDay(date) {

  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;

}



function startOfWeek(date) {

  const d = startOfDay(date);

  const day = (d.getDay() + 6) % 7; // Monday = 0

  d.setDate(d.getDate() - day);

  return d;

}



function addDays(date, n) {

  const d = new Date(date);

  d.setDate(d.getDate() + n);

  return d;

}



function addMonths(date, n) {

  const d = new Date(date);

  d.setMonth(d.getMonth() + n);

  return d;

}



function sameDay(a, b) {

  return (

    a.getFullYear() === b.getFullYear() &&

    a.getMonth() === b.getMonth() &&

    a.getDate() === b.getDate()

  );

}



function toDateInput(date) {

  const d = new Date(date);

  const m = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${d.getFullYear()}-${m}-${day}`;

}



function toTimeInput(date) {

  const d = new Date(date);

  const h = String(d.getHours()).padStart(2, "0");

  const m = String(d.getMinutes()).padStart(2, "0");

  return `${h}:${m}`;

}



function combineDateTime(dateStr, timeStr) {
  // Build the local date explicitly so years 00-99 are never remapped to 1900-1999.
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = (timeStr || "00:00").split(":").map(Number);
  const value = new Date(0);
  value.setFullYear(y, mo - 1, d);
  value.setHours(h, mi, 0, 0);
  return value.toISOString();
}



function formatMonthYear(date) {

  return date.toLocaleDateString("en-IN", {

    month: "long",

    year: "numeric",

  });

}



function formatTimeLabel(date) {

  return new Date(date).toLocaleTimeString("en-IN", {

    hour: "numeric",

    minute: "2-digit",

    hour12: true,

  });

}



/* ------------------------------------------------------------------ */

/* Component                                                           */

/* ------------------------------------------------------------------ */



export default function CalendarModal({ open, onClose, currentUser }) {

  const [anchorDate, setAnchorDate] = useState(() => new Date());

  const [viewMode, setViewMode] = useState("week"); // "day" | "workweek" | "week"

  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));

  const [events, setEvents] = useState([]);

  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");



  const [editorOpen, setEditorOpen] = useState(false);

  const [editingEvent, setEditingEvent] = useState(null);

  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState(false);



  const [now, setNow] = useState(() => new Date());



  useEffect(() => {

    const timer = window.setInterval(() => {

      setNow(new Date());

    }, 60 * 1000);



    return () => window.clearInterval(timer);

  }, []);



  // Where the visible range begins, based on the selected view.

  const rangeStart = useMemo(() => {

    if (viewMode === "day") return startOfDay(anchorDate);

    return startOfWeek(anchorDate); // week + workweek both start Monday

  }, [anchorDate, viewMode]);



  const dayCount = viewMode === "day" ? 1 : viewMode === "workweek" ? 5 : 7;



  const weekDays = useMemo(

    () => Array.from({ length: dayCount }, (_, i) => addDays(rangeStart, i)),

    [rangeStart, dayCount]

  );



  /* ---- Data loading ---------------------------------------------- */



  async function loadEvents() {

    setLoading(true);

    setError("");

    try {

      const from = startOfDay(rangeStart).toISOString();

      const to = addDays(rangeStart, dayCount).toISOString();

      const data = await apiRequest(

        `/api/client/calendar?from=${encodeURIComponent(

          from

        )}&to=${encodeURIComponent(to)}`

      );

      setEvents(Array.isArray(data.events) ? data.events : []);

    } catch (err) {

      setError(err?.data?.message || "Unable to load calendar events");

    } finally {

      setLoading(false);

    }

  }



  async function loadUsers() {

    try {

      const data = await apiRequest("/api/client/calendar/users");

      setUsers(Array.isArray(data.users) ? data.users : []);

    } catch (err) {

      // Non-fatal — assignee dropdown just stays empty.

      console.error("Unable to load calendar users:", err);

    }

  }



  useEffect(() => {

    if (open) {

      loadEvents();

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [open, rangeStart, dayCount]);



  useEffect(() => {

    if (open) {

      loadUsers();

    }

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [open]);



  // Lock body scroll while the modal is open.

  useEffect(() => {

    if (!open) return undefined;

    const previous = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {

      document.body.style.overflow = previous;

    };

  }, [open]);



  /* ---- Editor open helpers --------------------------------------- */



  function openCreate(dayDate, hour) {

    const base = dayDate ? new Date(dayDate) : new Date(selectedDate);

    if (typeof hour === "number") base.setHours(hour, 0, 0, 0);

    const end = new Date(base);

    end.setHours(base.getHours() + 1);



    setEditingEvent({

      id: null,

      title: "",

      description: "",

      location: "",

      type: "MEETING",

      status: "SCHEDULED",

      allDay: false,

      dateStr: toDateInput(base),

      startTime: toTimeInput(base),

      endTime: toTimeInput(end),

      assignedToUserId: "",

      hasMeeting: false,

      meetingRoom: "",

    });

    setEditorOpen(true);

  }



  function openEdit(event) {

    const start = new Date(event.startAt);

    const end = event.endAt ? new Date(event.endAt) : new Date(start);

    setEditingEvent({

      id: event.id,

      title: event.title || "",

      description: event.description || "",

      location: event.location || "",

      type: event.type || "MEETING",

      status: event.status || "SCHEDULED",

      allDay: Boolean(event.allDay),

      dateStr: toDateInput(start),

      startTime: toTimeInput(start),

      endTime: toTimeInput(end),

      assignedToUserId: event.assignedToUserId || "",

      hasMeeting: Boolean(event.meetingRoom),

      meetingRoom: event.meetingRoom || "",

    });

    setEditorOpen(true);

  }



  /* ---- Save / delete --------------------------------------------- */



  async function saveEvent() {

    if (!editingEvent) return;

    if (!editingEvent.title.trim()) {
    setError("Event title is required");
    return;
  }

  if (!isValidCalendarDate(editingEvent.dateStr)) {
    setError(
      `Choose a valid event date between ${MIN_EVENT_YEAR} and ${MAX_EVENT_YEAR}.`
    );
    return;
  }

  if (!editingEvent.allDay && !isValidTime(editingEvent.startTime)) {
    setError("Choose a valid start time.");
    return;
  }

  if (!editingEvent.allDay && !isValidTime(editingEvent.endTime)) {
    setError("Choose a valid end time.");
    return;
  }

  const validatedStartAt = combineDateTime(
    editingEvent.dateStr,
    editingEvent.allDay ? "00:00" : editingEvent.startTime
  );

  const validatedEndAt = editingEvent.allDay
    ? null
    : combineDateTime(editingEvent.dateStr, editingEvent.endTime);

  if (
    validatedEndAt &&
    new Date(validatedEndAt).getTime() < new Date(validatedStartAt).getTime()
  ) {
    setError("Event end time cannot be before the start time.");
    return;
  }

  setSaving(true);
  setError("");



    // If a video meeting is requested and we don't already have a Google Meet

    // link, create one on the organiser's Google Calendar.

    let meetingRoomValue = editingEvent.hasMeeting

      ? String(editingEvent.meetingRoom || "").trim()

      : "";

    if (editingEvent.hasMeeting && !/^https?:\/\//i.test(meetingRoomValue)) {

      try {

        const startForMeet = editingEvent.allDay
        ? combineDateTime(editingEvent.dateStr, "09:00")
        : validatedStartAt;
      const endForMeet = editingEvent.allDay
        ? combineDateTime(editingEvent.dateStr, "10:00")
        : validatedEndAt;

        const meet = await apiRequest("/api/client/google/meet", {

          method: "POST",

          body: JSON.stringify({

            summary: editingEvent.title.trim() || "Meeting",

            startISO: new Date(startForMeet).toISOString(),

            endISO: new Date(endForMeet).toISOString(),

          }),

        });

        meetingRoomValue = meet?.meetLink || "";

        if (!meetingRoomValue) {

          setError("Couldn't create a Google Meet link. Try again.");

          setSaving(false);

          return;

        }

      } catch (error) {

        setError(

          error?.data?.message ||

            "Couldn't create a Google Meet link. Connect Google in Settings → Integrations."

        );

        setSaving(false);

        return;

      }

    }



    const payload = {

      title: editingEvent.title.trim(),

      description: editingEvent.description.trim() || null,

      location: editingEvent.location.trim() || null,

      type: editingEvent.type,

      status: editingEvent.status,

      allDay: editingEvent.allDay,

      startAt: validatedStartAt,
    endAt: validatedEndAt,

      assignedToUserId: editingEvent.assignedToUserId || null,

      meetingRoom: editingEvent.hasMeeting ? meetingRoomValue || null : null,

    };



    try {

      if (editingEvent.id) {

        await apiRequest(`/api/client/calendar/${editingEvent.id}`, {

          method: "PATCH",

          body: JSON.stringify(payload),

        });

      } else {

        await apiRequest("/api/client/calendar", {

          method: "POST",

          body: JSON.stringify(payload),

        });

      }

      setEditorOpen(false);

      setEditingEvent(null);

      await loadEvents();

    } catch (err) {

      setError(err?.data?.message || "Unable to save event");

    } finally {

      setSaving(false);

    }

  }



  async function deleteEvent() {

    if (!editingEvent?.id) return;

    const ok = window.confirm("Delete this event? This cannot be undone.");

    if (!ok) return;



    setDeleting(true);

    setError("");

    try {

      await apiRequest(`/api/client/calendar/${editingEvent.id}`, {

        method: "DELETE",

      });

      setEditorOpen(false);

      setEditingEvent(null);

      await loadEvents();

    } catch (err) {

      setError(err?.data?.message || "Unable to delete event");

    } finally {

      setDeleting(false);

    }

  }



  /* ---- Derived data ---------------------------------------------- */



  const today = startOfDay(new Date());



  const visibleEvents = events;



  const eventsByDay = useMemo(() => {

    const map = new Map();

    visibleEvents.forEach((event) => {

      const key = toDateInput(new Date(event.startAt));

      if (!map.has(key)) map.set(key, []);

      map.get(key).push(event);

    });

    return map;

  }, [visibleEvents]);



  function eventsForDay(day) {

    return (eventsByDay.get(toDateInput(day)) || []).slice().sort(

      (a, b) => new Date(a.startAt) - new Date(b.startAt)

    );

  }



  // Mini-month grid (6 weeks) around anchorDate.

  const miniMonthDays = useMemo(() => {

    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);

    const gridStart = startOfWeek(first);

    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  }, [anchorDate]);



  const selectedDayEvents = eventsForDay(selectedDate);



  /* ---- Render ---------------------------------------------------- */



  if (!open) return null;



  return (

    <div className="fixed inset-0 z-[130] flex items-stretch justify-center bg-slate-950/35 p-0 backdrop-blur-[1px] sm:items-center sm:p-3">

      <div className="flex h-full w-full max-w-[1500px] flex-col overflow-hidden border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,.22)] sm:h-[94vh] sm:rounded-[22px]">

        {/* HEADER */}

        <div className="flex min-h-[62px] items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5 sm:px-5">

          <div className="flex items-center gap-2.5">

            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-indigo-600 text-white shadow-sm">

              <CalendarDays size={17} />

            </span>

            <div>

              <div className="text-[17px] font-extrabold tracking-[-0.02em] text-slate-950">Calendar</div>

              <div className="mt-0.5 text-[12px] font-medium text-slate-500">

                Plan meetings, follow-ups and reminders.

              </div>

            </div>

          </div>



          <div className="flex items-center gap-2">

            <button

              type="button"

              onClick={() => openCreate(selectedDate, 9)}

              className="inline-flex h-9 items-center gap-2 rounded-[11px] bg-brand-600 px-3.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-brand-700"

            >

              <Plus size={14} />

              New event

            </button>

            <button

              type="button"

              onClick={onClose}

              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"

              aria-label="Close calendar"

            >

              <X size={17} />

            </button>

          </div>

        </div>



        {error && (

          <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">

            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />

            {error}

          </div>

        )}



        {/* BODY: left mini-month + agenda, right week grid */}

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">

          {/* LEFT PANEL */}

          <div className="flex w-full flex-shrink-0 flex-col overflow-y-auto border-b border-slate-200 bg-white lg:w-[300px] lg:border-b-0 lg:border-r">

            {/* Mini-month */}

            <div className="p-4">

              <div className="mb-2 flex items-center justify-between">

                <div className="text-[14px] font-extrabold tracking-[-0.01em] text-slate-900">

                  {formatMonthYear(anchorDate)}

                </div>

                <div className="flex items-center gap-1">

                  <button

                    type="button"

                    onClick={() => setAnchorDate((d) => addMonths(d, -1))}

                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"

                    aria-label="Previous month"

                  >

                    <ChevronLeft size={15} />

                  </button>

                  <button

                    type="button"

                    onClick={() => setAnchorDate((d) => addMonths(d, 1))}

                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"

                    aria-label="Next month"

                  >

                    <ChevronRight size={15} />

                  </button>

                </div>

              </div>



              <div className="grid grid-cols-7 gap-0.5 text-center">

                {WEEKDAYS_MINI.map((d, i) => (

                  <div

                    key={i}

                    className="py-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-slate-400"

                  >

                    {d}

                  </div>

                ))}



                {miniMonthDays.map((day) => {

                  const inMonth = day.getMonth() === anchorDate.getMonth();

                  const isToday = sameDay(day, today);

                  const isSelected = sameDay(day, selectedDate);

                  const hasEvents = eventsForDay(day).length > 0;



                  return (

                    <button

                      key={day.toISOString()}

                      type="button"

                      onClick={() => {

                        setSelectedDate(startOfDay(day));

                        setAnchorDate(new Date(day));

                      }}

                      className={`relative flex h-10 items-center justify-center rounded-xl text-[12px] font-bold transition-colors ${

                        isSelected

                          ? "bg-brand-600 text-white"

                          : isToday

                          ? "bg-brand-50 text-brand-700"

                          : inMonth

                          ? "text-slate-700 hover:bg-slate-100"

                          : "text-slate-300 hover:bg-slate-50"

                      }`}

                    >

                      {day.getDate()}

                      {hasEvents && !isSelected && (

                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand-500" />

                      )}

                    </button>

                  );

                })}

              </div>



              <button

                type="button"

                onClick={() => {

                  const now = new Date();

                  setAnchorDate(now);

                  setSelectedDate(startOfDay(now));

                }}

                className="mt-4 w-full rounded-xl border border-slate-200 bg-white py-2.5 text-[12px] font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"

              >

                Today

              </button>

            </div>



            {/* AGENDA FOR SELECTED DAY */}

            <div className="border-t border-slate-200 px-4 py-3.5">

              <div className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.08em] text-slate-400">

                {selectedDate.toLocaleDateString("en-IN", {

                  weekday: "long",

                  day: "numeric",

                  month: "short",

                })}

              </div>



              {selectedDayEvents.length === 0 ? (

                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-7 text-center text-[13px] font-medium leading-5 text-slate-500">

                  No events. Click a time slot to add one.

                </div>

              ) : (

                <div className="space-y-2.5">

                  {selectedDayEvents.map((event) => (

                    <button

                      key={event.id}

                      type="button"

                      onClick={() => openEdit(event)}

                      className={`block w-full rounded-2xl border px-3.5 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${

                        eventStyle(event)

                      }`}

                    >

                      <div className="text-[12px] font-extrabold leading-snug">

                        {event.title}

                      </div>

                      <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold opacity-80">

                        <Clock size={11} />

                        {event.allDay ? "All day" : formatTimeLabel(event.startAt)}

                      </div>

                      {event.meetingRoom && (

                        <button

                          type="button"

                          onClick={(e) => {

                            e.stopPropagation();

                            window.open(event.meetingRoom, "_blank", "noopener");

                          }}

                          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-700"

                        >

                          <Video size={11} />

                          Join Google Meet

                        </button>

                      )}

                    </button>

                  ))}

                </div>

              )}

            </div>

          </div>



          {/* RIGHT: WEEK GRID */}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">

            {/* View toolbar */}

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">

              <div className="text-[16px] font-extrabold tracking-[-0.015em] text-slate-900">

                {weekDays[0].toLocaleDateString("en-IN", {

                  day: "numeric",

                  month: "short",

                })}

                {dayCount > 1 && (

                  <>

                    {" "}–{" "}

                    {weekDays[weekDays.length - 1].toLocaleDateString("en-IN", {

                      day: "numeric",

                      month: "short",

                    })}

                  </>

                )}

              </div>



              <div className="flex items-center gap-1">

                {loading && (

                  <Loader2 size={14} className="mr-1 animate-spin text-slate-400" />

                )}

                <button

                  type="button"

                  onClick={() => setAnchorDate((d) => addDays(d, -dayCount))}

                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"

                  aria-label="Previous"

                >

                  <ChevronLeft size={15} />

                </button>

                <button

                  type="button"

                  onClick={() => setAnchorDate((d) => addDays(d, dayCount))}

                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"

                  aria-label="Next"

                >

                  <ChevronRight size={15} />

                </button>



                <div className="ml-1.5 flex items-center rounded-[11px] bg-slate-100 p-1">

                  {[

                    ["day", "Day"],

                    ["workweek", "Work week"],

                    ["week", "Week"],

                  ].map(([value, label]) => (

                    <button

                      key={value}

                      type="button"

                      onClick={() => setViewMode(value)}

                      className={`rounded-[8px] px-3 py-1.5 text-[12px] font-bold transition ${

                        viewMode === value

                          ? "bg-white text-slate-950 shadow-sm"

                          : "text-slate-500 hover:text-slate-800"

                      }`}

                    >

                      {label}

                    </button>

                  ))}

                </div>

              </div>

            </div>



            {/* Day headers */}

            <div

              className="grid flex-shrink-0 border-b border-slate-200 bg-white"

              style={{ gridTemplateColumns: `48px repeat(${dayCount}, 1fr)` }}

            >

              <div />

              {weekDays.map((day) => {

                const isToday = sameDay(day, today);

                const isSelected = sameDay(day, selectedDate);

                return (

                  <button

                    key={day.toISOString()}

                    type="button"

                    onClick={() => setSelectedDate(startOfDay(day))}

                    className={`flex min-h-[58px] flex-col items-center justify-center gap-0.5 py-1.5 text-center transition-colors ${

                      isSelected ? "bg-brand-50" : "hover:bg-slate-50"

                    }`}

                  >

                    <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">

                      {WEEKDAYS[(day.getDay() + 6) % 7]}

                    </span>

                    <span

                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] font-extrabold ${

                        isToday

                          ? "bg-brand-600 text-white"

                          : "text-slate-800"

                      }`}

                    >

                      {day.getDate()}

                    </span>

                  </button>

                );

              })}

            </div>



            {/* Time grid */}

            <div className="min-h-0 flex-1 overflow-y-auto">

              <div

                className="grid"

                style={{ gridTemplateColumns: `48px repeat(${dayCount}, 1fr)` }}

              >

                {/* Hour labels + slots, row by row */}

                {HOURS.map((hour) => (

                  <FragmentRow

                    key={hour}

                    hour={hour}

                    weekDays={weekDays}

                    eventsForDay={eventsForDay}

                    onSlotClick={openCreate}

                    onEventClick={openEdit}

                    now={now}

                    showCurrentTimeLine={weekDays.some((day) => sameDay(day, now))}

                  />

                ))}

              </div>

            </div>

          </div>

        </div>

      </div>



      {/* EVENT EDITOR */}

      {editorOpen && editingEvent && (

        <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">

          <div className="w-full max-w-md overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">

              <div className="text-[22px] font-extrabold tracking-[-0.025em] text-slate-950">

                {editingEvent.id ? "Edit event" : "New event"}

              </div>

              <button

                type="button"

                onClick={() => {

                  setEditorOpen(false);

                  setEditingEvent(null);

                }}

                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"

              >

                <X size={16} />

              </button>

            </div>



            <div className="max-h-[70vh] space-y-3.5 overflow-y-auto p-5">

              {/* Title */}

              <label className="block">

                <span className="mb-1 block text-[13px] font-bold text-slate-600">

                  Title

                </span>

                <input

                  value={editingEvent.title}

                  onChange={(e) =>

                    setEditingEvent((c) => ({ ...c, title: e.target.value }))

                  }

                  placeholder="Add a title"

                  autoFocus

                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-brand-400"

                />

              </label>



              {/* Type + status */}

              <div className="grid grid-cols-2 gap-3">

                <label className="block">

                  <span className="mb-1 block text-[13px] font-bold text-slate-600">

                    Type

                  </span>

                  <select

                    value={editingEvent.type}

                    onChange={(e) =>

                      setEditingEvent((c) => ({ ...c, type: e.target.value }))

                    }

                    className="h-10 w-full rounded-xl border border-slate-200 px-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"

                  >

                    {EVENT_TYPES.map((t) => (

                      <option key={t} value={t}>

                        {TYPE_LABELS[t]}

                      </option>

                    ))}

                  </select>

                </label>



                <label className="block">

                  <span className="mb-1 block text-[13px] font-bold text-slate-600">

                    Status

                  </span>

                  <select

                    value={editingEvent.status}

                    onChange={(e) =>

                      setEditingEvent((c) => ({ ...c, status: e.target.value }))

                    }

                    className="h-10 w-full rounded-xl border border-slate-200 px-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"

                  >

                    {STATUS_OPTIONS.map((s) => (

                      <option key={s} value={s}>

                        {s.charAt(0) + s.slice(1).toLowerCase()}

                      </option>

                    ))}

                  </select>

                </label>

              </div>



              {/* Date */}

              <label className="block">

                <span className="mb-1 block text-[13px] font-bold text-slate-600">

                  Date

                </span>

                <input

                  type="date"

                  min={`${MIN_EVENT_YEAR}-01-01`}
                max={`${MAX_EVENT_YEAR}-12-31`}
                value={editingEvent.dateStr}

                  onClick={(e) => {

                    // Open the native date picker when the user clicks anywhere

                    // inside the date field, not only the calendar icon.

                    e.currentTarget.showPicker?.();

                  }}

                  onChange={(e) =>

                    setEditingEvent((c) => ({ ...c, dateStr: e.target.value }))

                  }

                  className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"

                />

              </label>



              {/* All-day toggle */}

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">

                <input

                  type="checkbox"

                  checked={editingEvent.allDay}

                  onChange={(e) =>

                    setEditingEvent((c) => ({ ...c, allDay: e.target.checked }))

                  }

                  className="h-4 w-4 rounded border-slate-300"

                />

                All day

              </label>



              {/* Video meeting toggle */}

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">

                <input

                  type="checkbox"

                  checked={editingEvent.hasMeeting}

                  onChange={(e) =>

                    setEditingEvent((c) => ({

                      ...c,

                      hasMeeting: e.target.checked,

                    }))

                  }

                  className="h-4 w-4 rounded border-slate-300"

                />

                <Video size={13} className="text-emerald-600" />

                Add video meeting

              </label>



              {/* Start / end times */}

              {!editingEvent.allDay && (

                <div className="grid grid-cols-2 gap-3">

                  <label className="block">

                    <span className="mb-1 block text-[13px] font-bold text-slate-600">

                      Start

                    </span>

                    <input

                      type="time"

                      value={editingEvent.startTime}

                      onChange={(e) =>

                        setEditingEvent((c) => ({

                          ...c,

                          startTime: e.target.value,

                        }))

                      }

                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"

                    />

                  </label>



                  <label className="block">

                    <span className="mb-1 block text-[13px] font-bold text-slate-600">

                      End

                    </span>

                    <input

                      type="time"

                      value={editingEvent.endTime}

                      onChange={(e) =>

                        setEditingEvent((c) => ({

                          ...c,

                          endTime: e.target.value,

                        }))

                      }

                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"

                    />

                  </label>

                </div>

              )}



              {/* Assignee */}

              <label className="block">

                <span className="mb-1 block text-[13px] font-bold text-slate-600">

                  <UserRound size={11} className="mr-1 inline" />

                  Assign to

                </span>

                <select

                  value={editingEvent.assignedToUserId}

                  onChange={(e) =>

                    setEditingEvent((c) => ({

                      ...c,

                      assignedToUserId: e.target.value,

                    }))

                  }

                  className="h-10 w-full rounded-xl border border-slate-200 px-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"

                >

                  <option value="">Unassigned</option>

                  {users.map((u) => (

                    <option key={u.id} value={u.id}>

                      {u.name}

                    </option>

                  ))}

                </select>

              </label>



              {/* Location */}

              <label className="block">

                <span className="mb-1 block text-[13px] font-bold text-slate-600">

                  <MapPin size={11} className="mr-1 inline" />

                  Location

                </span>

                <input

                  value={editingEvent.location}

                  onChange={(e) =>

                    setEditingEvent((c) => ({ ...c, location: e.target.value }))

                  }

                  placeholder="Optional"

                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-brand-400"

                />

              </label>



              {/* Description */}

              <label className="block">

                <span className="mb-1 block text-[13px] font-bold text-slate-600">

                  Description

                </span>

                <textarea

                  value={editingEvent.description}

                  onChange={(e) =>

                    setEditingEvent((c) => ({

                      ...c,

                      description: e.target.value,

                    }))

                  }

                  rows={3}

                  placeholder="Optional notes"

                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-brand-400"

                />

              </label>

            </div>



            {/* Editor footer */}

            <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5">

              {editingEvent.id ? (

                <button

                  type="button"

                  onClick={deleteEvent}

                  disabled={deleting || saving}

                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"

                >

                  {deleting ? (

                    <Loader2 size={14} className="animate-spin" />

                  ) : (

                    <Trash2 size={14} />

                  )}

                  Delete

                </button>

              ) : (

                <span />

              )}



              <div className="flex items-center gap-2">

                <button

                  type="button"

                  onClick={() => {

                    setEditorOpen(false);

                    setEditingEvent(null);

                  }}

                  disabled={saving || deleting}

                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"

                >

                  Cancel

                </button>

                <button

                  type="button"

                  onClick={saveEvent}

                  disabled={saving || deleting}

                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"

                >

                  {saving && <Loader2 size={14} className="animate-spin" />}

                  {editingEvent.id ? "Save changes" : "Create event"}

                </button>

              </div>

            </div>

          </div>

        </div>

      )}



    </div>

  );

}



/* ------------------------------------------------------------------ */

/* One hour-row across the 7 days                                      */

/* ------------------------------------------------------------------ */



function FragmentRow({

  hour,

  weekDays,

  eventsForDay,

  onSlotClick,

  onEventClick,

  now,

  showCurrentTimeLine,

}) {

  const isCurrentHour =

    showCurrentTimeLine &&

    hour === now.getHours();



  const currentMinuteTop =

    `${(now.getMinutes() / 60) * 100}%`;



  return (

    <>

      {/* Hour label */}

      <div className="relative h-[64px] border-b border-r border-slate-100 pr-2 text-right text-[11px] font-semibold text-slate-400">

        <span className="relative -top-1.5">

          {hour === 0

            ? ""

            : `${((hour + 11) % 12) + 1} ${hour < 12 ? "AM" : "PM"}`}

        </span>

      </div>



      {/* Visible day cells */}

      {weekDays.map((day) => {

        const dayEvents = eventsForDay(day).filter((event) => {

          if (event.allDay) return hour === 0;

          return new Date(event.startAt).getHours() === hour;

        });



        const isTodayCell =

          sameDay(day, now);



        return (

          <div

            key={`${day.toISOString()}-${hour}`}

            onClick={() => onSlotClick(day, hour)}

            className="relative h-[64px] cursor-pointer border-b border-r border-slate-100 px-1.5 py-1 transition hover:bg-slate-50/70"

          >

            {isCurrentHour && (

              <div

                className="pointer-events-none absolute inset-x-0 z-20 border-t border-dashed border-brand-400"

                style={{ top: currentMinuteTop }}

                aria-hidden="true"

              >

                {isTodayCell && (

                  <span className="absolute -left-1 -top-[4px] h-2 w-2 rounded-full bg-brand-600 shadow-[0_0_0_2px_white]" />

                )}

              </div>

            )}



            {dayEvents.map((event) => (

              <button

                key={event.id}

                type="button"

                onClick={(e) => {

                  e.stopPropagation();

                  onEventClick(event);

                }}

                className={`mx-auto mb-1 block min-h-[46px] w-[92%] rounded-[10px] border px-2.5 py-2 text-left text-[12px] font-bold leading-[1.22] shadow-[0_2px_8px_rgba(15,23,42,.05)] ${

                  eventStyle(event)

                }`}

                title={event.title}

              >

                <span className="block line-clamp-2 text-[12px] font-bold">

                  {event.title}

                </span>

                <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold opacity-75">

                  <Clock size={9} />

                  {event.allDay ? "All day" : formatTimeLabel(event.startAt)}

                </span>

              </button>

            ))}

          </div>

        );

      })}

    </>

  );

}
