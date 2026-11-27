import { useEffect, useId, useRef, useState } from "react";
import {
  X,
  Loader2,
  Plus,
  CheckCircle2,
  Video,
  Phone,
  CalendarDays,
  Clock,
  MessageCircle,
  IndianRupee,
  Users,
  Flag,
  ChevronDown,
  ArrowLeft,
  CheckSquare,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import { useOverlayDismiss } from "../lib/useOverlayDismiss";
import RichTextEditor from "./RichTextEditor";
import GuestPicker from "./GuestPicker";

/* Quick-create right-side drawer launched from the header "+".
   Two panels (Task / Meeting) switched with aria-pressed buttons.

   Each panel is "quick" by default — a title plus one-tap chips (due /
   assignee / priority for a task; when / Google Meet for a meeting). The
   "Additional details" button swaps to the full form inline (every field
   preserved); "Show fewer details" swaps back. Tasks post to
   /api/client/tasks; meetings create a CalendarEvent (type MEETING) so they
   land on the calendar.

   A11y (reviewed): quick↔detailed view switch moves focus to the counterpart
   button and announces via a polite live region; the view-switch buttons are
   plain actions (no dangling disclosure ARIA); the assignee <select> is always
   rendered and toggled with `hidden` so the chip's aria-controls resolves; the
   priority chip is a cycle (aria-label names the value + live region, not
   aria-pressed); the hero title has a persistent visible label. */

const TASK_TYPES = [
  { value: "CALL", label: "Call", icon: Phone },
  { value: "MEETING", label: "Meeting", icon: CalendarDays },
  { value: "FOLLOWUP", label: "Follow-up", icon: Clock },
  { value: "COUNSELLING", label: "Counselling", icon: MessageCircle },
  { value: "PAYMENT", label: "Payment", icon: IndianRupee },
  { value: "GENERAL", label: "General", icon: CheckCircle2 },
];
const TASK_PRIORITIES = [
  { value: "LOW", label: "Low" },
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
];
const DUE_PRESETS = [
  { key: "today", label: "Today", days: 0 },
  { key: "tomorrow", label: "Tomorrow", days: 1 },
  { key: "nextweek", label: "Next week", days: 7 },
];
// Priority cycle order for the quick chip (skips nothing; starts after current).
const PRIORITY_CYCLE = ["NORMAL", "HIGH", "LOW"];

function pad(n) {
  return String(n).padStart(2, "0");
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dateStr(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toISO(dateStrv, timeStr) {
  if (!dateStrv) return null;
  const dt = new Date(`${dateStrv}T${timeStr || "00:00"}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

const emptyTask = () => ({
  title: "",
  type: "GENERAL",
  priority: "NORMAL",
  leadId: "",
  date: "",
  time: "",
  assignedToUserId: "",
  notes: "",
  pinned: false,
});

const emptyMeeting = () => ({
  title: "",
  description: "",
  date: "",
  startTime: "09:00",
  endTime: "10:00",
  guests: [],
  location: "",
  addGoogleMeet: false,
  meetingLink: "",
});

export default function QuickCreateDrawer({ open, onClose, onCreated, initial }) {
  const uid = useId();
  const panelRef = useRef(null);
  const headingRef = useRef(null);
  const titleRef = useRef(null);
  const moreRef = useRef(null);
  const fewerRef = useRef(null);
  const assignSelectRef = useRef(null);
  // Set by the view-switch handlers so focus only moves on a real user toggle,
  // never on open (where the overlay's initialFocusRef owns focus).
  const pendingFocus = useRef(null); // "fewer" | "more" | null

  const [tab, setTab] = useState("task"); // "task" | "meeting"
  const [detailed, setDetailed] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [task, setTask] = useState(emptyTask);
  const [meeting, setMeeting] = useState(emptyMeeting);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState("");
  const [done, setDone] = useState("");
  const [liveMsg, setLiveMsg] = useState("");

  useOverlayDismiss(open, onClose, {
    containerRef: panelRef,
    initialFocusRef: titleRef,
  });

  // Reset + load users whenever the drawer opens.
  useEffect(() => {
    if (!open) return;
    // Seed from the quick-add popover's "Additional details" hand-off: which
    // panel, any typed title, and opening straight into the full form.
    const seedTab = initial?.tab === "meeting" ? "meeting" : "task";
    const seedTitle = initial?.title || "";
    setTab(seedTab);
    setDetailed(Boolean(initial?.detailed));
    pendingFocus.current = null;
    setAssignOpen(false);
    setTask({ ...emptyTask(), title: seedTab === "task" ? seedTitle : "" });
    setMeeting({ ...emptyMeeting(), title: seedTab === "meeting" ? seedTitle : "" });
    setError("");
    setInvalid("");
    setDone("");
    setLiveMsg("");
    (async () => {
      try {
        const data = await apiRequest("/api/client/calendar/users");
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch {
        setUsers([]);
      }
    })();
  }, [open]);

  // Move focus to the counterpart button ONLY on a real user-initiated view
  // switch (pendingFocus is set by the toggle handlers). On open — including
  // opening straight into detailed view — pendingFocus is null, so the
  // overlay's initialFocusRef (the title field) keeps focus and nothing is
  // announced.
  useEffect(() => {
    if (pendingFocus.current === "fewer") {
      fewerRef.current?.focus();
      pendingFocus.current = null;
    } else if (pendingFocus.current === "more") {
      moreRef.current?.focus();
      pendingFocus.current = null;
    }
  }, [detailed]);

  if (!open) return null;

  const focusField = (id) => {
    const el = document.getElementById(id);
    if (el) el.focus();
  };

  function setDuePreset(preset) {
    setTask((c) => ({
      ...c,
      date: dateStr(preset.days),
      time: c.time || "09:00",
    }));
  }
  const dueActive = (key) => {
    const p = DUE_PRESETS.find((d) => d.key === key);
    return p ? task.date === dateStr(p.days) : false;
  };

  function cyclePriority() {
    const idx = PRIORITY_CYCLE.indexOf(task.priority);
    const nextVal = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    const label =
      TASK_PRIORITIES.find((p) => p.value === nextVal)?.label || "Normal";
    setTask((c) => ({ ...c, priority: nextVal }));
    setLiveMsg(`Priority ${label.toLowerCase()}`);
  }

  function openAssign() {
    setAssignOpen(true);
    setTimeout(() => assignSelectRef.current?.focus(), 0);
  }

  function setMeetingDay(days) {
    setMeeting((c) => ({ ...c, date: dateStr(days) }));
  }
  const meetingDayActive = (days) => meeting.date === dateStr(days);

  async function submitTask(e) {
    e.preventDefault();
    setError("");
    if (!task.title.trim()) {
      setInvalid("title");
      setError("Task title is required.");
      focusField(`${uid}-task-title`);
      return;
    }
    setInvalid("");
    setSaving(true);
    setLiveMsg("Saving…");
    try {
      let dueAt = null;
      if (task.date) {
        const dt = new Date(`${task.date}T${task.time || "09:00"}`);
        if (!Number.isNaN(dt.getTime())) dueAt = dt.toISOString();
      }
      await apiRequest("/api/client/tasks", {
        method: "POST",
        body: JSON.stringify({
          title: task.title.trim(),
          type: task.type,
          priority: task.priority,
          dueAt,
          assignedToUserId: task.assignedToUserId || null,
          notes: task.notes ? task.notes.trim() : null,
          pinned: task.pinned,
        }),
      });
      finish("Task created.");
    } catch (err) {
      setError(err?.data?.message || "Unable to create task.");
      setSaving(false);
      setLiveMsg("");
    }
  }

  async function submitMeeting(e) {
    e.preventDefault();
    setError("");
    if (!meeting.title.trim()) {
      setInvalid("title");
      setError("Meeting title is required.");
      focusField(`${uid}-mtg-title`);
      return;
    }
    if (!meeting.date) {
      setInvalid("date");
      setError("Date is required.");
      setDetailed(true);
      focusField(`${uid}-mtg-date`);
      return;
    }
    const startAt = toISO(meeting.date, meeting.startTime);
    const endAt = toISO(meeting.date, meeting.endTime);
    if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
      setInvalid("endTime");
      setError("End time cannot be before the start time.");
      setDetailed(true);
      focusField(`${uid}-mtg-end`);
      return;
    }
    setInvalid("");
    setSaving(true);
    setLiveMsg("Saving…");
    try {
      const res = await apiRequest("/api/client/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: meeting.title.trim(),
          description: meeting.description.trim() || null,
          location: meeting.location.trim() || null,
          type: "MEETING",
          status: "SCHEDULED",
          allDay: false,
          startAt,
          endAt,
          assignedToUserId: null,
          guests: meeting.guests,
          addGoogleMeet: meeting.addGoogleMeet,
          meetingRoom: meeting.addGoogleMeet
            ? null
            : meeting.meetingLink.trim() || null,
        }),
      });
      finish(inviteMessage("Meeting created.", res?.invite));
    } catch (err) {
      setError(err?.data?.message || "Unable to create meeting.");
      setSaving(false);
      setLiveMsg("");
    }
  }

  function inviteMessage(base, invite) {
    if (!invite) return base;
    if (invite.pending) return `${base} Generating the Meet link…`;
    if (invite.notified > 0) {
      const n = invite.notified;
      return `${base} ${n} ${n === 1 ? "guest was" : "guests were"} invited.`;
    }
    return base;
  }

  function finish(msg) {
    setSaving(false);
    setDone(msg);
    onCreated?.();
    setTimeout(() => {
      onClose?.();
    }, 1100);
  }

  const field =
    "w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500";
  const labelCls = "mb-1 block text-[13px] font-bold text-slate-600";
  const capCls =
    "mb-2 mt-4 block text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400";
  const tabBtn = (active) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
      active ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
    }`;
  const borderFor = (name) =>
    invalid === name ? "border-rose-400" : "border-slate-300";

  // Clean single-tone chip — no two-colour border.
  const chip = (on) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
      on ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;
  const heroInput =
    "w-full border-0 border-b-2 border-slate-200 bg-transparent px-1 pb-2.5 pt-1 text-[19px] font-bold tracking-[-0.01em] text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-brand-500";

  const priorityLabel =
    TASK_PRIORITIES.find((p) => p.value === task.priority)?.label || "Normal";
  const assigneeName = task.assignedToUserId
    ? users.find((u) => u.id === task.assignedToUserId)?.name ||
      users.find((u) => u.id === task.assignedToUserId)?.email ||
      "Assigned"
    : "";

  const moreBtn = (
    <button
      ref={moreRef}
      type="button"
      onClick={() => {
        pendingFocus.current = "fewer";
        setLiveMsg("Showing all fields");
        setDetailed(true);
      }}
      className="mt-5 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[13px] font-bold text-brand-700 transition hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <ChevronDown size={15} aria-hidden="true" />
      Additional details
    </button>
  );
  const fewerBtn = (
    <button
      ref={fewerRef}
      type="button"
      onClick={() => {
        pendingFocus.current = "more";
        setLiveMsg("Showing quick options");
        setDetailed(false);
      }}
      className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[13px] font-bold text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <ArrowLeft size={14} aria-hidden="true" />
      Show fewer details
    </button>
  );

  return (
    <div className="fixed inset-0 z-[140] flex justify-end bg-slate-950/50">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-heading`}
        className="flex h-full w-full max-w-md flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2
            id={`${uid}-heading`}
            ref={headingRef}
            tabIndex={-1}
            className="text-[18px] font-extrabold tracking-[-0.02em] text-slate-950 outline-none"
          >
            Quick add
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Tab switch */}
        <div
          role="group"
          aria-label="What to create"
          className="mx-5 mt-4 flex gap-1 rounded-xl bg-slate-100 p-1"
        >
          <button type="button" aria-pressed={tab === "task"} onClick={() => setTab("task")} className={tabBtn(tab === "task")}>
            <CheckSquare size={15} aria-hidden="true" /> Task
          </button>
          <button type="button" aria-pressed={tab === "meeting"} onClick={() => setTab("meeting")} className={tabBtn(tab === "meeting")}>
            <CalendarDays size={15} aria-hidden="true" /> Meeting
          </button>
        </div>

        {/* Polite live region: priority value + saving + view switch */}
        <span className="sr-only" aria-live="polite">
          {liveMsg}
        </span>

        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <CheckCircle2 size={44} className="text-emerald-500" aria-hidden="true" />
            <p role="status" className="text-[15px] font-bold text-slate-800">
              {done}
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {error && (
              <p id={`${uid}-err`} role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">
                {error}
              </p>
            )}

            {/* ---------------- TASK ---------------- */}
            {tab === "task" && (
              <form noValidate onSubmit={submitTask} className="space-y-1" aria-label="Create task">
                <div>
                  <label htmlFor={`${uid}-task-title`} className={capCls} style={{ marginTop: 0 }}>
                    Task title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`${uid}-task-title`}
                    ref={titleRef}
                    value={task.title}
                    onChange={(e) => setTask((c) => ({ ...c, title: e.target.value }))}
                    required
                    aria-invalid={invalid === "title" ? "true" : undefined}
                    aria-describedby={invalid === "title" ? `${uid}-err` : undefined}
                    placeholder="What needs doing?"
                    className={heroInput}
                  />
                </div>

                {!detailed && (
                  <>
                    <div role="group" aria-labelledby={`${uid}-due-l`}>
                      <span id={`${uid}-due-l`} className={capCls}>Due</span>
                      <div className="flex flex-wrap gap-1.5">
                        {DUE_PRESETS.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            aria-pressed={dueActive(p.key)}
                            onClick={() => setDuePreset(p)}
                            className={chip(dueActive(p.key))}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className={capCls}>Quick set</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        aria-label={task.assignedToUserId ? `Assigned to ${assigneeName}` : "Assign to"}
                        aria-expanded={assignOpen}
                        aria-controls={`${uid}-assignee`}
                        onClick={() => (assignOpen ? setAssignOpen(false) : openAssign())}
                        className={chip(Boolean(task.assignedToUserId))}
                      >
                        <Users size={14} aria-hidden="true" />
                        {task.assignedToUserId ? assigneeName : "Assign to"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Priority: ${priorityLabel}. Activate to change.`}
                        onClick={cyclePriority}
                        className={chip(task.priority !== "NORMAL")}
                      >
                        <Flag size={14} aria-hidden="true" />
                        {priorityLabel}
                      </button>
                    </div>

                    {/* Always rendered so aria-controls resolves; hidden until opened. */}
                    <div className="mt-2" hidden={!assignOpen}>
                      <label htmlFor={`${uid}-assignee`} className="sr-only">Assign to</label>
                      <select
                        id={`${uid}-assignee`}
                        ref={assignSelectRef}
                        value={task.assignedToUserId}
                        onChange={(e) => {
                          setTask((c) => ({ ...c, assignedToUserId: e.target.value }));
                          setAssignOpen(false);
                        }}
                        className={`${field} border-slate-300`}
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email || "User"}
                          </option>
                        ))}
                      </select>
                    </div>

                    {moreBtn}
                  </>
                )}

                {detailed && (
                  <div id={`${uid}-details`} className="space-y-3.5 pt-1">
                    {fewerBtn}

                    <div role="group" aria-labelledby={`${uid}-task-type-label`}>
                      <span id={`${uid}-task-type-label`} className={labelCls}>Type</span>
                      <div className="grid grid-cols-3 gap-2">
                        {TASK_TYPES.map((t) => {
                          const TIcon = t.icon;
                          const active = task.type === t.value;
                          return (
                            <button
                              key={t.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setTask((c) => ({ ...c, type: t.value }))}
                              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                                active
                                  ? "border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <TIcon size={16} aria-hidden="true" />
                              {t.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`${uid}-task-lead`} className={labelCls}>
                        Linked lead <span className="font-semibold text-slate-400">(optional)</span>
                      </label>
                      <input
                        id={`${uid}-task-lead`}
                        value={task.leadId}
                        onChange={(e) => setTask((c) => ({ ...c, leadId: e.target.value }))}
                        placeholder="Lead name or id (optional)"
                        className={`${field} border-slate-300`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`${uid}-task-date`} className={labelCls}>Due date</label>
                        <input
                          id={`${uid}-task-date`}
                          type="date"
                          value={task.date}
                          onChange={(e) => setTask((c) => ({ ...c, date: e.target.value }))}
                          className={`${field} border-slate-300`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${uid}-task-time`} className={labelCls}>Time</label>
                        <input
                          id={`${uid}-task-time`}
                          type="time"
                          value={task.time}
                          onChange={(e) => setTask((c) => ({ ...c, time: e.target.value }))}
                          className={`${field} border-slate-300`}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`${uid}-task-assignee`} className={labelCls}>Assign to</label>
                      <select
                        id={`${uid}-task-assignee`}
                        value={task.assignedToUserId}
                        onChange={(e) => setTask((c) => ({ ...c, assignedToUserId: e.target.value }))}
                        className={`${field} border-slate-300`}
                      >
                        <option value="">Unassigned</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name || u.email || "User"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div role="group" aria-labelledby={`${uid}-task-priority-label`}>
                      <span id={`${uid}-task-priority-label`} className={labelCls}>Priority</span>
                      <div className="grid grid-cols-3 gap-2">
                        {TASK_PRIORITIES.map((p) => {
                          const active = task.priority === p.value;
                          return (
                            <button
                              key={p.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setTask((c) => ({ ...c, priority: p.value }))}
                              className={`rounded-lg border px-2 py-2 text-[12.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                                active
                                  ? "border-slate-900 bg-slate-50 text-slate-900 ring-1 ring-slate-900"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`${uid}-task-notes`} className={labelCls}>Notes</label>
                      <textarea
                        id={`${uid}-task-notes`}
                        rows={3}
                        value={task.notes}
                        onChange={(e) => setTask((c) => ({ ...c, notes: e.target.value }))}
                        placeholder="Context, next step, anything to remember"
                        className={`${field} border-slate-300`}
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
                        aria-checked={task.pinned}
                        aria-label="Pin to top"
                        onClick={() => setTask((c) => ({ ...c, pinned: !c.pinned }))}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                          task.pinned ? "bg-brand-600" : "bg-slate-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            task.pinned ? "left-[22px]" : "left-0.5"
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                )}

                <SubmitBar saving={saving} label="Add task" />
              </form>
            )}

            {/* ---------------- MEETING ---------------- */}
            {tab === "meeting" && (
              <form noValidate onSubmit={submitMeeting} className="space-y-1" aria-label="Create meeting">
                <div>
                  <label htmlFor={`${uid}-mtg-title`} className={capCls} style={{ marginTop: 0 }}>
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`${uid}-mtg-title`}
                    ref={tab === "meeting" ? titleRef : undefined}
                    value={meeting.title}
                    onChange={(e) => setMeeting((c) => ({ ...c, title: e.target.value }))}
                    required
                    aria-invalid={invalid === "title" ? "true" : undefined}
                    aria-describedby={invalid === "title" ? `${uid}-err` : undefined}
                    placeholder="Meeting title"
                    className={heroInput}
                  />
                </div>

                {!detailed && (
                  <>
                    <div role="group" aria-labelledby={`${uid}-when-l`}>
                      <span id={`${uid}-when-l`} className={capCls}>When</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" aria-pressed={meetingDayActive(0)} onClick={() => setMeetingDay(0)} className={chip(meetingDayActive(0))}>Today</button>
                        <button type="button" aria-pressed={meetingDayActive(1)} onClick={() => setMeetingDay(1)} className={chip(meetingDayActive(1))}>Tomorrow</button>
                        <button type="button" aria-pressed={meetingDayActive(7)} onClick={() => setMeetingDay(7)} className={chip(meetingDayActive(7))}>Next week</button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {meeting.startTime}–{meeting.endTime} · change the time under Additional details
                      </p>
                    </div>

                    <span className={capCls}>Video</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        aria-pressed={meeting.addGoogleMeet}
                        onClick={() => setMeeting((c) => ({ ...c, addGoogleMeet: !c.addGoogleMeet, meetingLink: !c.addGoogleMeet ? "" : c.meetingLink }))}
                        className={chip(meeting.addGoogleMeet)}
                      >
                        <Video size={14} aria-hidden="true" />
                        Add Google Meet
                      </button>
                    </div>

                    {moreBtn}
                  </>
                )}

                {detailed && (
                  <div id={`${uid}-details`} className="space-y-3.5 pt-1">
                    {fewerBtn}

                    <div>
                      <span id={`${uid}-mtg-desc-label`} className={labelCls}>Description</span>
                      <RichTextEditor
                        value={meeting.description}
                        onChange={(html) => setMeeting((c) => ({ ...c, description: html }))}
                        ariaLabelledby={`${uid}-mtg-desc-label`}
                        placeholder="Optional agenda"
                      />
                    </div>

                    <div>
                      <label htmlFor={`${uid}-mtg-date`} className={labelCls}>
                        Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id={`${uid}-mtg-date`}
                        type="date"
                        value={meeting.date}
                        onChange={(e) => setMeeting((c) => ({ ...c, date: e.target.value }))}
                        aria-required="true"
                        aria-invalid={invalid === "date" ? "true" : undefined}
                        className={`${field} ${borderFor("date")}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor={`${uid}-mtg-start`} className={labelCls}>Start time</label>
                        <input
                          id={`${uid}-mtg-start`}
                          type="time"
                          value={meeting.startTime}
                          onChange={(e) => setMeeting((c) => ({ ...c, startTime: e.target.value }))}
                          className={`${field} border-slate-300`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${uid}-mtg-end`} className={labelCls}>End time</label>
                        <input
                          id={`${uid}-mtg-end`}
                          type="time"
                          value={meeting.endTime}
                          onChange={(e) => setMeeting((c) => ({ ...c, endTime: e.target.value }))}
                          aria-invalid={invalid === "endTime" ? "true" : undefined}
                          className={`${field} ${borderFor("endTime")}`}
                        />
                      </div>
                    </div>

                    <div>
                      <span id={`${uid}-mtg-guests-label`} className={labelCls}>Add guest</span>
                      <GuestPicker
                        value={meeting.guests}
                        onChange={(guests) => setMeeting((c) => ({ ...c, guests }))}
                        users={users}
                        ariaLabelledby={`${uid}-mtg-guests-label`}
                      />
                    </div>

                    <div>
                      <label htmlFor={`${uid}-mtg-location`} className={labelCls}>Location</label>
                      <input
                        id={`${uid}-mtg-location`}
                        value={meeting.location}
                        onChange={(e) => setMeeting((c) => ({ ...c, location: e.target.value }))}
                        placeholder="Office / address / online"
                        className={`${field} border-slate-300`}
                      />
                    </div>

                    <fieldset className="rounded-xl border border-slate-200 p-3">
                      <legend className="flex items-center gap-1.5 px-1 text-[13px] font-bold text-slate-600">
                        <Video size={14} aria-hidden="true" /> Video meeting
                      </legend>

                      <label htmlFor={`${uid}-mtg-automeet`} className="flex cursor-pointer items-center gap-2.5">
                        <input
                          id={`${uid}-mtg-automeet`}
                          type="checkbox"
                          checked={meeting.addGoogleMeet}
                          onChange={(e) =>
                            setMeeting((c) => ({
                              ...c,
                              addGoogleMeet: e.target.checked,
                              meetingLink: e.target.checked ? "" : c.meetingLink,
                            }))
                          }
                          className="h-4 w-4 accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        />
                        <span className="text-sm font-semibold text-slate-800">Add Google Meet link</span>
                      </label>
                      <p className="mt-1 pl-[26px] text-[12px] text-slate-500">
                        Creates a Google Meet link and emails each guest a calendar invite.
                      </p>

                      <div className="mt-3">
                        <label htmlFor={`${uid}-mtg-link`} className={labelCls}>Or paste a link (Zoom/Teams/Meet)</label>
                        <input
                          id={`${uid}-mtg-link`}
                          type="url"
                          inputMode="url"
                          autoComplete="off"
                          value={meeting.meetingLink}
                          disabled={meeting.addGoogleMeet}
                          onChange={(e) => setMeeting((c) => ({ ...c, meetingLink: e.target.value }))}
                          aria-describedby={`${uid}-mtg-link-hint`}
                          placeholder="https://…"
                          className={`${field} border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}
                        />
                        <p id={`${uid}-mtg-link-hint`} className="mt-1 text-[12px] text-slate-500">
                          Turn off “Add Google Meet link” to paste your own.
                        </p>
                      </div>
                    </fieldset>
                  </div>
                )}

                <SubmitBar saving={saving} label="Add meeting" />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitBar({ saving, label }) {
  return (
    <div className="pt-3">
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-bold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
        {label}
      </button>
    </div>
  );
}
