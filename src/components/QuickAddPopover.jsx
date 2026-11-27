import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Loader2,
  CheckCircle2,
  CalendarDays,
  Users,
  Flag,
  Video,
  Link2,
  CheckSquare,
  SlidersHorizontal,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import { useOverlayDismiss } from "../lib/useOverlayDismiss";

/* Compact quick-add popover launched from the header "+". Title-first, with
   labelled one-tap chip rows: Due / Quick set (task) or When / Video (meeting).
   "Additional details" hands off to the full right-side drawer
   (QuickCreateDrawer), opened straight into its detailed form and seeded with
   the typed title. Tasks POST to /api/client/tasks; meetings POST to
   /api/client/calendar (type MEETING) so they land on the calendar.

   A11y (reviewed): non-modal role="dialog" (focus trap + Escape via
   useOverlayDismiss restoring focus to the "+" trigger on close); Due/When are
   single-select button groups (role=group, aria-labelledby the caption,
   aria-pressed on every option); the meeting time is tied to the When group via
   aria-describedby and re-announced through a polite live region on each change;
   Priority is a cycling chip (aria-label names the value + live region); the
   Assign chip is a disclosure (aria-expanded + aria-controls to an always-
   rendered select); "Add link" / "Additional details" are dialog actions
   (aria-haspopup="dialog"), styled as outline actions, not toggles; Enter
   submits (IME-guarded) with a visible hint; the title field has a visible
   label and exposes required/invalid/described-by. Single brand (blue) accent. */

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "nextweek", label: "Next week" },
];

const PRIORITIES = [
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "LOW", label: "Low" },
];

function dueFromPreset(key) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  if (key === "tomorrow") d.setDate(d.getDate() + 1);
  else if (key === "nextweek") d.setDate(d.getDate() + 7);
  return d.toISOString();
}

// Meeting start/end for a quick day pick: next full hour today, or 10:00 the
// chosen day; 30-minute block.
function meetingTimes(dayKey) {
  const start = new Date();
  if (dayKey === "tomorrow") {
    start.setDate(start.getDate() + 1);
    start.setHours(10, 0, 0, 0);
  } else if (dayKey === "nextweek") {
    start.setDate(start.getDate() + 7);
    start.setHours(10, 0, 0, 0);
  } else {
    start.setHours(start.getHours() + 1, 0, 0, 0);
  }
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function fmtTime(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

export default function QuickAddPopover({
  open,
  anchorRef,
  onClose,
  onOpenFull,
  onCreated,
}) {
  const uid = useId();
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const headingRef = useRef(null);

  const [mode, setMode] = useState("task"); // "task" | "meeting"
  const [title, setTitle] = useState("");
  const [dateKey, setDateKey] = useState("today");
  const [priority, setPriority] = useState("NORMAL");
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [addMeet, setAddMeet] = useState(false);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [liveMsg, setLiveMsg] = useState("");
  const [pos, setPos] = useState(null);

  useOverlayDismiss(open, onClose, {
    containerRef: panelRef,
    initialFocusRef: inputRef,
  });

  useEffect(() => {
    if (!open) return;
    setMode("task");
    setTitle("");
    setDateKey("today");
    setPriority("NORMAL");
    setAssignOpen(false);
    setAssignee("");
    setAddMeet(false);
    setError("");
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

  useEffect(() => {
    if (done) headingRef.current?.focus();
  }, [done]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    function place() {
      const el = anchorRef?.current;
      const width = Math.min(380, window.innerWidth - 24);
      if (!el || typeof el.getBoundingClientRect !== "function") {
        setPos({ top: 64, right: 12, width });
        return;
      }
      const r = el.getBoundingClientRect();
      // Open the board at the right end of the header (a small gap from the
      // edge), independent of where the "+" button sits, so it stays put even
      // though the "+" is mid-header.
      const right = 16;
      const top = Math.min(r.bottom + 8, window.innerHeight - 40);
      setPos({ top, right, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef]);

  if (!open) return null;

  const isTask = mode === "task";
  const { startAt, endAt } = meetingTimes(dateKey);
  const timeRange = `${fmtTime(startAt)} – ${fmtTime(endAt)}`;

  function setDay(key) {
    setDateKey(key);
    const label =
      DATE_PRESETS.find((d) => d.key === key)?.label.toLowerCase() || "today";
    if (!isTask) {
      const t = meetingTimes(key);
      setLiveMsg(`Meeting ${label}, ${fmtTime(t.startAt)} to ${fmtTime(t.endAt)}`);
    } else {
      setLiveMsg(`Due ${label}`);
    }
  }

  function handlePriorityCycle() {
    const idx = PRIORITIES.findIndex((p) => p.value === priority);
    const next = PRIORITIES[(idx + 1) % PRIORITIES.length];
    setPriority(next.value);
    setLiveMsg(`Priority ${next.label.toLowerCase()}`);
  }

  function openFull() {
    onOpenFull?.({ tab: mode, title: title.trim(), detailed: true });
    onClose?.();
  }

  function finish(msg) {
    setSaving(false);
    setDone(msg);
    onCreated?.();
    setTimeout(() => onClose?.(), 1200);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError(isTask ? "Type the task first." : "Type a meeting title first.");
      inputRef.current?.focus();
      return;
    }
    setSaving(true);
    setLiveMsg("Saving…");
    try {
      if (isTask) {
        await apiRequest("/api/client/tasks", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            type: "GENERAL",
            priority,
            dueAt: dueFromPreset(dateKey),
            assignedToUserId: assignee || null,
            notes: null,
            pinned: false,
          }),
        });
        finish("Task added.");
      } else {
        await apiRequest("/api/client/calendar", {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: null,
            location: null,
            type: "MEETING",
            status: "SCHEDULED",
            allDay: false,
            startAt,
            endAt,
            assignedToUserId: null,
            guests: [],
            addGoogleMeet: addMeet,
            meetingRoom: null,
          }),
        });
        finish("Meeting added.");
      }
    } catch (err) {
      setError(err?.data?.message || "Unable to save. Try Additional details.");
      setSaving(false);
      setLiveMsg("");
    }
  }

  function onTitleKeyDown(e) {
    // Don't submit mid-IME-composition (Hindi/Telugu/predictive input commit
    // Enter to accept a candidate). Shift+Enter inserts a newline.
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit(e);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  }

  const priorityLabel =
    PRIORITIES.find((p) => p.value === priority)?.label || "Normal";
  const assigneeName = assignee
    ? users.find((u) => u.id === assignee)?.name ||
      users.find((u) => u.id === assignee)?.email ||
      "Assigned"
    : "";

  // Clean single-tone chip (toggle / single-select).
  const chip = (active) =>
    `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 ${
      active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`;
  // Outline action chip (opens another surface) — distinct from the toggles.
  const chipAction =
    "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1";
  const capCls =
    "block text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-slate-600";

  const describedBy =
    [`${uid}-hint`, error ? `${uid}-err` : null].filter(Boolean).join(" ") ||
    undefined;

  const style = pos
    ? { top: `${pos.top}px`, right: `${pos.right}px`, width: `${pos.width}px` }
    : { top: "64px", right: "12px", width: "360px" };

  return (
    <div className="fixed inset-0 z-[150]">
      {/* transparent catcher for outside clicks (decorative; Escape also closes) */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby={`${uid}-h`}
        style={style}
        className="fixed overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_30px_80px_-12px_rgba(15,23,42,0.34)] animate-[drawerSlideIn_0.18s_ease-out] motion-reduce:animate-none"
      >
        {/* Decorative top accent */}
        <div
          aria-hidden="true"
          className="h-[3px] bg-gradient-to-r from-brand-600 to-indigo-400"
        />

        {/* Polite live region for the meeting time / priority value / saving */}
        <span className="sr-only" aria-live="polite">
          {liveMsg}
        </span>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-600 text-white">
              {isTask ? (
                <CheckSquare size={16} aria-hidden="true" />
              ) : (
                <CalendarDays size={16} aria-hidden="true" />
              )}
            </span>
            <div>
              <h2
                id={`${uid}-h`}
                ref={headingRef}
                tabIndex={-1}
                className="text-[15px] font-extrabold tracking-[-0.01em] text-slate-950 outline-none"
              >
                {isTask ? "Quick add task" : "Quick add meeting"}
              </h2>
              <p className="text-[11.5px] text-slate-500">
                {isTask ? "Shows on your dashboard" : "Lands on your calendar"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Task / Meeting switch */}
        <div
          role="group"
          aria-label="What to create"
          className="mx-4 mt-2 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
        >
          <button
            type="button"
            aria-pressed={isTask}
            onClick={() => setMode("task")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isTask ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
            }`}
          >
            <CheckSquare size={14} aria-hidden="true" /> Task
          </button>
          <button
            type="button"
            aria-pressed={!isTask}
            onClick={() => setMode("meeting")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              !isTask ? "bg-white text-brand-700 shadow-sm" : "text-slate-600"
            }`}
          >
            <CalendarDays size={14} aria-hidden="true" /> Meeting
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <CheckCircle2 size={34} className="text-emerald-500" aria-hidden="true" />
            <p role="status" className="text-[14px] font-bold text-slate-800">
              {done}
            </p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate aria-busy={saving}>
            {/* Title */}
            <div className="px-4 pt-3">
              <label htmlFor={`${uid}-title`} className={`${capCls} mb-1.5`}>
                {isTask ? "Task" : "Meeting title"}
              </label>
              <textarea
                id={`${uid}-title`}
                ref={inputRef}
                rows={2}
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={onTitleKeyDown}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                placeholder={
                  isTask
                    ? "e.g. Follow up with Ananya about B.Tech admission"
                    : "e.g. Demo call with Ananya"
                }
                className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-[14px] font-medium leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500"
              />
              <p id={`${uid}-hint`} className="mt-1 text-[11px] text-slate-400">
                Press Enter to add · Shift + Enter for a new line
              </p>
            </div>

            {/* Due / When */}
            <div className="px-4 pt-3">
              <div className="flex items-baseline justify-between">
                <span id={`${uid}-day-l`} className={capCls}>
                  {isTask ? "Due" : "When"}
                </span>
                {!isTask && (
                  <span
                    id={`${uid}-time`}
                    className="text-[11.5px] font-semibold text-slate-600"
                  >
                    {timeRange}
                  </span>
                )}
              </div>
              <div
                role="group"
                aria-labelledby={`${uid}-day-l`}
                aria-describedby={!isTask ? `${uid}-time` : undefined}
                className="mt-1.5 flex flex-wrap gap-1.5"
              >
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={dateKey === p.key}
                    onClick={() => setDay(p.key)}
                    className={chip(dateKey === p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Task: Quick set */}
            {isTask && (
              <div className="px-4 pt-3">
                <span id={`${uid}-qs-l`} className={capCls}>
                  Quick set
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    aria-label={
                      assignee ? `Assigned to ${assigneeName}` : "Assign to"
                    }
                    aria-expanded={assignOpen}
                    aria-controls={`${uid}-assignee`}
                    onClick={() => setAssignOpen((v) => !v)}
                    className={chip(Boolean(assignee))}
                  >
                    <Users size={13} aria-hidden="true" />
                    {assignee ? assigneeName : "Assign to"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Priority: ${priorityLabel}. Activate to change.`}
                    onClick={handlePriorityCycle}
                    className={chip(priority !== "NORMAL")}
                  >
                    <Flag size={13} aria-hidden="true" />
                    {priorityLabel}
                  </button>
                </div>
                {/* Assignee select — always rendered so aria-controls resolves. */}
                <div className="pt-2" hidden={!assignOpen}>
                  <label htmlFor={`${uid}-assignee`} className="sr-only">
                    Assign to
                  </label>
                  <select
                    id={`${uid}-assignee`}
                    value={assignee}
                    onChange={(e) => {
                      setAssignee(e.target.value);
                      setAssignOpen(false);
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email || "User"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Meeting: Video */}
            {!isTask && (
              <div className="px-4 pt-3">
                <span id={`${uid}-video-l`} className={capCls}>
                  Video
                </span>
                <div
                  role="group"
                  aria-labelledby={`${uid}-video-l`}
                  className="mt-1.5 flex flex-wrap gap-1.5"
                >
                  <button
                    type="button"
                    aria-pressed={addMeet}
                    onClick={() => setAddMeet((v) => !v)}
                    className={chip(addMeet)}
                  >
                    <Video size={13} aria-hidden="true" />
                    Google Meet
                  </button>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label="Add meeting link (opens full form)"
                    onClick={openFull}
                    className={chipAction}
                  >
                    <Link2 size={13} aria-hidden="true" />
                    Add link
                  </button>
                </div>
              </div>
            )}

            {error && (
              <p
                id={`${uid}-err`}
                role="alert"
                className="mx-4 mt-2.5 rounded-lg bg-rose-50 px-3 py-1.5 text-[12.5px] font-semibold text-rose-700"
              >
                {error}
              </p>
            )}

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={openFull}
                className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[13px] font-bold text-brand-700 transition hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                Additional details
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[13.5px] font-bold text-white shadow-[0_8px_18px_rgba(79,70,229,0.3)] transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Plus size={14} aria-hidden="true" />
                )}
                {isTask ? "Add task" : "Add meeting"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
