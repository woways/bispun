import { useEffect, useId, useRef, useState } from "react";
import { X, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useOverlayDismiss } from "../lib/useOverlayDismiss";
import RichTextEditor from "./RichTextEditor";

/* Quick-create drawer launched from the header "+" button. Two panels
   (Task / Meeting) switched with aria-pressed buttons — NOT tab roles, so
   no arrow-key contract is implied (accessibility-lead option B). Both
   create a CalendarEvent: meetings as type MEETING, tasks as type OTHER
   (no Task table yet — see product decision). */

const STATUSES = [
  ["SCHEDULED", "Scheduled"],
  ["COMPLETED", "Completed"],
  ["CANCELLED", "Cancelled"],
];

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function toISO(dateStr, timeStr) {
  if (!dateStr) return null;
  const dt = new Date(`${dateStr}T${timeStr || "00:00"}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

const emptyTask = () => ({
  title: "",
  description: "",
  date: todayStr(),
  time: "09:00",
  assignedToUserId: "",
  status: "SCHEDULED",
});

const emptyMeeting = () => ({
  title: "",
  description: "",
  date: todayStr(),
  startTime: "09:00",
  endTime: "10:00",
  assignedToUserId: "",
  location: "",
});

export default function QuickCreateDrawer({ open, onClose, onCreated }) {
  const uid = useId();
  const panelRef = useRef(null);
  const headingRef = useRef(null);
  const titleRef = useRef(null);

  const [tab, setTab] = useState("task"); // "task" | "meeting"
  const [users, setUsers] = useState([]);
  const [task, setTask] = useState(emptyTask);
  const [meeting, setMeeting] = useState(emptyMeeting);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState("");
  const [done, setDone] = useState("");

  useOverlayDismiss(open, onClose, {
    containerRef: panelRef,
    initialFocusRef: headingRef,
  });

  // Reset + load users whenever the drawer opens.
  useEffect(() => {
    if (!open) return;
    setTask(emptyTask());
    setMeeting(emptyMeeting());
    setError("");
    setInvalid("");
    setDone("");
    (async () => {
      try {
        const data = await apiRequest("/api/client/calendar/users");
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch {
        setUsers([]);
      }
    })();
  }, [open]);

  if (!open) return null;

  const focusField = (id) => {
    const el = document.getElementById(id);
    if (el) el.focus();
  };

  async function submitTask(e) {
    e.preventDefault();
    setError("");
    if (!task.title.trim()) {
      setInvalid("title");
      setError("Task name is required.");
      focusField(`${uid}-task-title`);
      return;
    }
    if (!task.date) {
      setInvalid("date");
      setError("Due date is required.");
      focusField(`${uid}-task-date`);
      return;
    }
    setInvalid("");
    setSaving(true);
    try {
      await apiRequest("/api/client/calendar", {
        method: "POST",
        body: JSON.stringify({
          title: task.title.trim(),
          description: task.description.trim() || null,
          type: "OTHER",
          status: task.status,
          allDay: false,
          startAt: toISO(task.date, task.time),
          endAt: null,
          assignedToUserId: task.assignedToUserId || null,
        }),
      });
      finish("Task created.");
    } catch (err) {
      setError(err?.data?.message || "Unable to create task.");
      setSaving(false);
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
      focusField(`${uid}-mtg-date`);
      return;
    }
    const startAt = toISO(meeting.date, meeting.startTime);
    const endAt = toISO(meeting.date, meeting.endTime);
    if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
      setInvalid("endTime");
      setError("End time cannot be before the start time.");
      focusField(`${uid}-mtg-end`);
      return;
    }
    setInvalid("");
    setSaving(true);
    try {
      await apiRequest("/api/client/calendar", {
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
          assignedToUserId: meeting.assignedToUserId || null,
        }),
      });
      finish("Meeting created.");
    } catch (err) {
      setError(err?.data?.message || "Unable to create meeting.");
      setSaving(false);
    }
  }

  function finish(msg) {
    setSaving(false);
    setDone(msg);
    onCreated?.();
    // Brief success confirmation, then close (focus returns to the trigger).
    setTimeout(() => {
      onClose?.();
    }, 900);
  }

  const field =
    "w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500";
  const labelCls = "mb-1 block text-[13px] font-bold text-slate-600";
  const tabBtn = (active) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
      active ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
    }`;

  const borderFor = (name) =>
    invalid === name ? "border-rose-400" : "border-slate-300";

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
            Quick create
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

        {/* Tab switch (aria-pressed buttons — not tab roles) */}
        <div
          role="group"
          aria-label="What to create"
          className="mx-5 mt-4 flex gap-1 rounded-xl bg-slate-100 p-1"
        >
          <button type="button" aria-pressed={tab === "task"} onClick={() => setTab("task")} className={tabBtn(tab === "task")}>
            Task
          </button>
          <button type="button" aria-pressed={tab === "meeting"} onClick={() => setTab("meeting")} className={tabBtn(tab === "meeting")}>
            Meeting
          </button>
        </div>

        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <CheckCircle2 size={44} className="text-emerald-500" aria-hidden="true" />
            <p role="status" className="text-[15px] font-bold text-slate-800">
              {done}
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-3 text-[12px] font-medium text-slate-500">
              <span className="text-rose-500">*</span> indicates a required field
            </p>

            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">
                {error}
              </p>
            )}

            {/* ---------------- TASK ---------------- */}
            {tab === "task" && (
              <form noValidate onSubmit={submitTask} className="space-y-3.5" aria-label="Create task">
                <div>
                  <label htmlFor={`${uid}-task-title`} className={labelCls}>
                    Task name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`${uid}-task-title`}
                    ref={titleRef}
                    value={task.title}
                    onChange={(e) => setTask((c) => ({ ...c, title: e.target.value }))}
                    aria-required="true"
                    aria-invalid={invalid === "title" ? "true" : undefined}
                    placeholder="e.g. Follow up with lead"
                    className={`${field} ${borderFor("title")}`}
                  />
                </div>

                <div>
                  <span id={`${uid}-task-desc-label`} className={labelCls}>
                    Description
                  </span>
                  <RichTextEditor
                    value={task.description}
                    onChange={(html) => setTask((c) => ({ ...c, description: html }))}
                    ariaLabelledby={`${uid}-task-desc-label`}
                    placeholder="Optional details"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`${uid}-task-date`} className={labelCls}>
                      Due date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id={`${uid}-task-date`}
                      type="date"
                      value={task.date}
                      onChange={(e) => setTask((c) => ({ ...c, date: e.target.value }))}
                      aria-required="true"
                      aria-invalid={invalid === "date" ? "true" : undefined}
                      className={`${field} ${borderFor("date")}`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-task-time`} className={labelCls}>
                      Due time
                    </label>
                    <input
                      id={`${uid}-task-time`}
                      type="time"
                      value={task.time}
                      onChange={(e) => setTask((c) => ({ ...c, time: e.target.value }))}
                      className={`${field} border-slate-300`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={`${uid}-task-assignee`} className={labelCls}>
                      Assigned to
                    </label>
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
                  <div>
                    <label htmlFor={`${uid}-task-status`} className={labelCls}>
                      Status
                    </label>
                    <select
                      id={`${uid}-task-status`}
                      value={task.status}
                      onChange={(e) => setTask((c) => ({ ...c, status: e.target.value }))}
                      className={`${field} border-slate-300`}
                    >
                      {STATUSES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <SubmitBar saving={saving} label="Add task" />
              </form>
            )}

            {/* ---------------- MEETING ---------------- */}
            {tab === "meeting" && (
              <form noValidate onSubmit={submitMeeting} className="space-y-3.5" aria-label="Create meeting">
                <div>
                  <label htmlFor={`${uid}-mtg-title`} className={labelCls}>
                    Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id={`${uid}-mtg-title`}
                    value={meeting.title}
                    onChange={(e) => setMeeting((c) => ({ ...c, title: e.target.value }))}
                    aria-required="true"
                    aria-invalid={invalid === "title" ? "true" : undefined}
                    placeholder="e.g. Demo call"
                    className={`${field} ${borderFor("title")}`}
                  />
                </div>

                <div>
                  <span id={`${uid}-mtg-desc-label`} className={labelCls}>
                    Description
                  </span>
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
                    <label htmlFor={`${uid}-mtg-start`} className={labelCls}>
                      Start time
                    </label>
                    <input
                      id={`${uid}-mtg-start`}
                      type="time"
                      value={meeting.startTime}
                      onChange={(e) => setMeeting((c) => ({ ...c, startTime: e.target.value }))}
                      className={`${field} border-slate-300`}
                    />
                  </div>
                  <div>
                    <label htmlFor={`${uid}-mtg-end`} className={labelCls}>
                      End time
                    </label>
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
                  <label htmlFor={`${uid}-mtg-assignee`} className={labelCls}>
                    Assigned to
                  </label>
                  <select
                    id={`${uid}-mtg-assignee`}
                    value={meeting.assignedToUserId}
                    onChange={(e) => setMeeting((c) => ({ ...c, assignedToUserId: e.target.value }))}
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

                <div>
                  <label htmlFor={`${uid}-mtg-location`} className={labelCls}>
                    Location
                  </label>
                  <input
                    id={`${uid}-mtg-location`}
                    value={meeting.location}
                    onChange={(e) => setMeeting((c) => ({ ...c, location: e.target.value }))}
                    placeholder="Office / address / online"
                    className={`${field} border-slate-300`}
                  />
                </div>

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
    <div className="pt-1">
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
