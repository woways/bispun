import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  Plus,
  AlertCircle,
  Sliders,
  IndianRupee,
  X,
  Loader2,
  RefreshCw,
  History,
  Lock,
  Crown,
  LifeBuoy,
  Ticket,
  Clock3,
  CheckCircle2,
  Search,
  Eye,
  MessageSquareText,
  PhoneCall,
  MoreVertical,
} from "lucide-react";

import {
  Badge,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";
import { formatUiDateTime } from "../../lib/uiPreferences";
import { resolveListView } from "../../lib/listViewState";
import { useOverlayDismiss } from "../../lib/useOverlayDismiss";
import { useModalA11y } from "../../lib/useModalA11y";

const TYPES = [
  {
    key:
      "TECHNICAL_ISSUE",

    label:
      "Technical Issue",

    description:
      "Report something that is not working correctly.",

    color:
      "bg-rose-50 text-rose-600 border-rose-100",

    icon:
      AlertCircle,

    advancedOnly:
      false,
  },

  {
    key:
      "BILLING",

    label:
      "Billing Support",

    description:
      "Subscription, invoice, renewal or payment support.",

    color:
      "bg-slate-50 text-slate-600 border-slate-200",

    icon:
      IndianRupee,

    advancedOnly:
      false,
  },

  {
    key:
      "CUSTOMIZATION",

    label:
      "Customization Request",

    description:
      "Features, fields, workflows, integrations, reports or UI changes.",

    color:
      "bg-amber-50 text-amber-600 border-amber-100",

    icon:
      Sliders,

    advancedOnly:
      true,
  },

  {
    key:
      "CALL_TO_RM",

    label:
      "Call to RM",

    description:
      "Request a discussion with your Relationship Manager for changes, guidance, plans or any business requirement.",

    color:
      "bg-indigo-50 text-indigo-600 border-indigo-100",

    icon:
      PhoneCall,

    advancedOnly:
      false,
  },
];

const RM_DISCUSSION_CATEGORIES = [
  ["GENERAL", "General Discussion"],
  ["PRODUCT_CHANGE", "Product / Workflow Change"],
  ["CUSTOMIZATION", "Customization"],
  ["INTEGRATION", "Integration"],
  ["BILLING_PLAN", "Billing / Plan"],
  ["TRAINING_GUIDANCE", "Training / Guidance"],
  ["OTHER", "Other"],
];

const RM_TIME_SLOTS = [
  ["10:00 AM - 12:00 PM", "10:00 AM - 12:00 PM"],
  ["12:00 PM - 02:00 PM", "12:00 PM - 02:00 PM"],
  ["02:00 PM - 04:00 PM", "02:00 PM - 04:00 PM"],
  ["04:00 PM - 06:00 PM", "04:00 PM - 06:00 PM"],
  ["FLEXIBLE", "Flexible / RM can suggest a time"],
];

function todayInputValue() {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function countLetters(value) {
  return (String(value || "").match(/\p{L}/gu) || []).length;
}

function validateSupportText(value, { minLength, minLetters, label }) {
  const text = String(value || "").trim().replace(/\s+/g, " ");

  if (text.length < minLength || countLetters(text) < minLetters) {
    return `${label} must contain meaningful text, including letters.`;
  }

  return "";
}

const PRIORITIES = [
  {
    value:
      "LOW",
    label:
      "Low",
  },

  {
    value:
      "MEDIUM",
    label:
      "Medium",
  },

  {
    value:
      "HIGH",
    label:
      "High",
  },

  {
    value:
      "URGENT",
    label:
      "Urgent",
  },
];

function priorityTone(
  priority
) {
  if (
    priority ===
      "HIGH" ||
    priority ===
      "URGENT"
  ) {
    return "rose";
  }

  if (
    priority ===
    "MEDIUM"
  ) {
    return "amber";
  }

  return "slate";
}

function ticketStatusTone(
  status
) {
  if (
    status ===
      "COMPLETED" ||
    status ===
      "DISCUSSION_COMPLETED" ||
    status ===
      "CLOSED"
  ) {
    return "emerald";
  }

  if (
    [
      "DEVELOPMENT",
      "IN_PROGRESS",
      "RM_ASSIGNED",
      "CALL_SCHEDULED",
      "FOLLOW_UP_REQUIRED",
    ].includes(status)
  ) {
    return "sky";
  }

  if (
    status ===
    "REJECTED"
  ) {
    return "rose";
  }

  return "amber";
}

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return formatUiDateTime(date);
}

function formatDateOnly(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function SupportMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "indigo",
  onClick,
}) {
  const tones = {
    indigo:
      "bg-indigo-50 text-indigo-600 border-indigo-100",

    emerald:
      "bg-emerald-50 text-emerald-600 border-emerald-100",

    amber:
      "bg-amber-50 text-amber-600 border-amber-100",

    rose:
      "bg-rose-50 text-rose-600 border-rose-100",

    slate:
      "bg-slate-50 text-slate-600 border-slate-200",
  };

  const clickable = typeof onClick === "function";
  const Wrapper = clickable ? "button" : "div";

  return (
    <Wrapper
      type={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
      aria-label={clickable ? `${label} — view tickets` : undefined}
      className={`group block w-full text-left bg-white border border-slate-200 rounded-xl p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all ${
        clickable
          ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
          : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-9 w-9 shrink-0 rounded-lg border flex items-center justify-center ${
            tones[
              tone
            ] ||
            tones.indigo
          }`}
        >
          <Icon
            size={17}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-[18px] sm:text-[22px] leading-tight font-bold tracking-tight text-slate-950 tabular-nums">
              {value}
            </span>
            <span className="truncate text-[12px] sm:text-[13px] font-semibold text-slate-700">
              {label}
            </span>
          </div>

          <div className="mt-1 truncate text-[11px] leading-4 text-slate-400">
            {detail}
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

/* =========================================================
   Ticket drill-down modal (reusable) + column preset
========================================================= */

const TICKET_COLUMNS = [
  { key: "ticketNumber", label: "Ticket #", strong: true, render: (t) => t.ticketNumber || "—" },
  { key: "title", label: "Title", render: (t) => t.title || "—" },
  { key: "typeLabel", label: "Type", render: (t) => t.typeLabel || t.type || "—" },
  { key: "statusLabel", label: "Status", render: (t) => t.statusLabel || t.status || "—" },
  { key: "priorityLabel", label: "Priority", render: (t) => t.priorityLabel || t.priority || "—" },
  { key: "createdAt", label: "Created", render: (t) => formatUiDateTime(t.createdAt) },
];

function TicketDrilldownModal({
  open,
  title,
  subtitle,
  columns = [],
  records = [],
  emptyText = "No tickets found.",
  onClose,
}) {
  // Center within the content area (right of the sidebar), not the whole
  // window; also lock body scroll and close on Escape.
  const [padLeft, setPadLeft] = useState(0);
  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const measure = () => {
      const main =
        typeof document !== "undefined"
          ? document.querySelector("main")
          : null;
      setPadLeft(main ? Math.max(0, main.getBoundingClientRect().left) : 0);
    };
    measure();
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("resize", measure);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const rows = Array.isArray(records) ? records : [];

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/55 backdrop-blur-[3px] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={padLeft ? { paddingLeft: padLeft } : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-slate-900">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-[13px] text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length ? (
            <table className="w-full border-collapse text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={`px-4 py-2.5 ${
                        c.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-slate-50/70">
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-2.5 align-top ${
                          c.align === "right"
                            ? "text-right tabular-nums"
                            : "text-left"
                        } ${
                          c.strong
                            ? "font-semibold text-slate-900"
                            : "text-slate-600"
                        }`}
                      >
                        {c.render ? c.render(r) : r[c.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-5 py-12 text-center text-[13px] text-slate-500">
              {emptyText}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <span className="text-[12px] font-semibold text-slate-500">
            {rows.length.toLocaleString("en-IN")} ticket
            {rows.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg bg-slate-900 px-3.5 text-[12px] font-bold text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function NewTicketModal({
  defaultType,
  plan,
  departments = [],
  tenant,
  user,
  onClose,
  onCreated,
}) {
  const { panelRef, onKeyDown } = useModalA11y(onClose);
  const headingId = useId();
  const [
    saving,
    setSaving,
  ] = useState(
    false
  );

  const [
    error,
    setError,
  ] = useState("");

  const [fieldErrors, setFieldErrors] = useState({});

  const availableTypes =
    useMemo(
      () =>
        TYPES.filter(
          (
            type
          ) =>
            !type.advancedOnly ||
            plan ===
              "advanced"
        ),
      [
        plan,
      ]
    );

  const safeDefault =
    availableTypes.some(
      (
        type
      ) =>
        type.key ===
        defaultType
    )
      ? defaultType
      : "TECHNICAL_ISSUE";

  const [
    form,
    setForm,
  ] = useState({
    title: "",
    description: "",
    type:
      safeDefault ||
      "TECHNICAL_ISSUE",
    priority:
      "MEDIUM",
    department:
      departments[0]?.name || "Admin",
    discussionCategory:
      "GENERAL",
    preferredCallDate:
      "",
    preferredTimeSlot:
      "FLEXIBLE",
    contactName:
      user?.name || tenant?.ownerName || tenant?.owner || "",
    contactPhone:
      user?.phone || tenant?.phone || "",
    contactEmail:
      user?.email || tenant?.email || "",
  });

  function update(
    field,
    value
  ) {
    setForm(
      (
        current
      ) => ({
        ...current,

        [field]:
          value,
      })
    );

    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(
    event
  ) {
    event.preventDefault();

    if (
      saving
    ) {
      return;
    }

    setError("");

    const nextFieldErrors = {};
    const titleError = validateSupportText(form.title, {
      minLength: 4,
      minLetters: 2,
      label: form.type === "CALL_TO_RM" ? "Discussion topic" : "Ticket title",
    });
    const descriptionError = validateSupportText(form.description, {
      minLength: 10,
      minLetters: 3,
      label: "Description",
    });

    if (titleError) nextFieldErrors.title = titleError;
    if (descriptionError) nextFieldErrors.description = descriptionError;

    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length) {
      setError("Please enter a meaningful title and description.");
      return;
    }

    setSaving(
      true
    );

    try {
      await apiRequest(
        "/api/client/support",
        {
          method:
            "POST",

          body:
            JSON.stringify(
              form
            ),
        }
      );

      onCreated();
    } catch (error) {
      setError(
        error
          ?.data
          ?.message ||
          "Unable to create support ticket"
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-[2px] flex justify-end">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        <style>{"@keyframes drawerSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}"}</style>

        {/* HEADER */}

        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id={headingId} className="text-[17px] font-bold text-slate-950">
              {form.type === "CALL_TO_RM"
                ? "Request a Call to RM"
                : "New Support Ticket"}
            </h2>

            <p className="text-[13px] text-slate-500 mt-1">
              {form.type === "CALL_TO_RM"
                ? "Share what you would like to discuss with your Relationship Manager."
                : "Submit a request to Bispun support."}
            </p>
          </div>

          <button
            type="button"
            aria-label="Close"
            onClick={
              onClose
            }
            disabled={
              saving
            }
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X
              size={17}
            />
          </button>
        </div>

        <form
          onSubmit={
            submit
          }
          className="min-h-0 flex flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 p-6 space-y-4 overflow-y-auto">

            {error && (
              <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[15px]">
                {
                  error
                }
              </div>
            )}

            {/* TYPE */}

            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                Ticket Type
              </label>

              <select
                value={
                  form.type
                }
                onChange={(
                  event
                ) =>
                  update(
                    "type",
                    event
                      .target
                      .value
                  )
                }
                className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {availableTypes.map(
                  (
                    type
                  ) => (
                    <option
                      key={
                        type.key
                      }
                      value={
                        type.key
                      }
                    >
                      {
                        type.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {form.type !== "CALL_TO_RM" && (
              <>
            {/* DEPARTMENT */}

            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                Department
                <span className="text-rose-500 ml-0.5">*</span>
              </label>

              <select
                required
                value={form.department}
                onChange={(event) => update("department", event.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {departments.map((department) => (
                  <option key={department.id || department.name} value={department.name}>
                    {department.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[13px] text-slate-400">
                Departments are managed by Client Admin in Settings → Users & Roles.
              </p>
            </div>

              </>
            )}

            {/* TITLE */}

            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                {form.type === "CALL_TO_RM"
                  ? "Discussion Topic"
                  : "Title"}

                <span className="text-rose-500 ml-0.5">
                  *
                </span>
              </label>

              <input
                required
                value={
                  form.title
                }
                onChange={(
                  event
                ) =>
                  update(
                    "title",
                    event
                      .target
                      .value
                  )
                }
                placeholder={form.type === "CALL_TO_RM" ? "What would you like to discuss?" : "Describe your request briefly"}
                aria-invalid={!!fieldErrors.title}
                className={`w-full h-10 px-3 border rounded-lg text-[15px] focus:outline-none focus:ring-2 ${
                  fieldErrors.title
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                }`}
              />
              {fieldErrors.title && (
                <p className="mt-1 text-[12px] font-medium text-rose-600">
                  {fieldErrors.title}
                </p>
              )}
            </div>

            {form.type === "CALL_TO_RM" && (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
                <div>
                  <div className="text-[13px] font-bold text-indigo-900">
                    Relationship Manager Call Details
                  </div>
                  <div className="mt-1 text-[12px] leading-5 text-slate-500">
                    Your company and plan are captured automatically. Add the best contact and preferred time for the discussion.
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                    Discussion Category
                  </label>
                  <select
                    value={form.discussionCategory}
                    onChange={(event) =>
                      update("discussionCategory", event.target.value)
                    }
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  >
                    {RM_DISCUSSION_CATEGORIES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                      Preferred Call Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      type="date"
                      min={todayInputValue()}
                      value={form.preferredCallDate}
                      onChange={(event) =>
                        update("preferredCallDate", event.target.value)
                      }
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                      Preferred Time <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={form.preferredTimeSlot}
                      onChange={(event) =>
                        update("preferredTimeSlot", event.target.value)
                      }
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    >
                      {RM_TIME_SLOTS.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                      Candidate Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      value={form.contactName}
                      onChange={(event) =>
                        update("contactName", event.target.value)
                      }
                      placeholder="Contact person name"
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      value={form.contactPhone}
                      onChange={(event) =>
                        update("contactPhone", event.target.value)
                      }
                      placeholder="Phone number"
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) =>
                      update("contactEmail", event.target.value)
                    }
                    placeholder="Contact email"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>
              </div>
            )}

            {/* PRIORITY */}

            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                Priority
              </label>

              <select
                value={
                  form.priority
                }
                onChange={(
                  event
                ) =>
                  update(
                    "priority",
                    event
                      .target
                      .value
                  )
                }
                className="w-full h-10 px-3 border border-slate-200 rounded-lg bg-white text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              >
                {PRIORITIES.map(
                  (
                    priority
                  ) => (
                    <option
                      key={
                        priority.value
                      }
                      value={
                        priority.value
                      }
                    >
                      {
                        priority.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            {/* DESCRIPTION */}

            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                {form.type === "CALL_TO_RM"
                  ? "What would you like to discuss?"
                  : "Description"}

                <span className="text-rose-500 ml-0.5">
                  *
                </span>
              </label>

              <textarea
                required
                rows={
                  5
                }
                value={
                  form.description
                }
                onChange={(
                  event
                ) =>
                  update(
                    "description",
                    event
                      .target
                      .value
                  )
                }
                placeholder={
                  form.type === "CALL_TO_RM"
                    ? "Explain the change, question, requirement or topic you want to discuss with your Relationship Manager..."
                    : form.type ===
                      "CUSTOMIZATION"
                    ? "Explain the feature, field, workflow, integration, report or UI change you need..."
                    : form.type ===
                      "BILLING"
                    ? "Explain your subscription, invoice, renewal or payment issue..."
                    : "Explain what is not working and what you expected to happen..."
                }
                aria-invalid={!!fieldErrors.description}
                className={`w-full px-3 py-2.5 border rounded-lg text-[15px] resize-none focus:outline-none focus:ring-2 ${
                  fieldErrors.description
                    ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
                    : "border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
                }`}
              />
              {fieldErrors.description && (
                <p className="mt-1 text-[12px] font-medium text-rose-600">
                  {fieldErrors.description}
                </p>
              )}
            </div>
          </div>

          {/* FOOTER */}

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end gap-2">
            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                saving
              }
              className="h-9 px-4 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {saving && (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              )}

              {saving
                ? "Submitting..."
                : form.type === "CALL_TO_RM"
                  ? "Request RM Call"
                  : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}


function TicketDetailsModal({
  ticket,
  onClose,
}) {
  // A11y: treat this as a real modal dialog. useOverlayDismiss moves focus into
  // the dialog on open (including when opened programmatically from a
  // notification deep-link), traps focus, handles Escape / hardware-back, and
  // restores focus to the opener on close. Hooks run before the early return so
  // the Rules of Hooks hold.
  const containerRef = useRef(null);
  useOverlayDismiss(Boolean(ticket), onClose, { containerRef });

  if (!ticket) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-details-title"
        className="w-full max-w-2xl max-h-[92vh] overflow-hidden bg-white border border-white/70 rounded-2xl shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-mono font-semibold text-slate-500">
              {ticket.ticketNumber}
            </div>

            <h2
              id="ticket-details-title"
              className="mt-1 text-xl font-bold text-slate-950 break-words"
            >
              {ticket.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            className="w-8 h-8 flex-shrink-0 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X
              size={17}
            />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(92vh-80px)] space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="slate">
              {ticket.typeLabel}
            </Badge>

            <Badge
              tone={priorityTone(
                ticket.priority
              )}
            >
              {ticket.priorityLabel}
            </Badge>

            <Badge
              tone={ticketStatusTone(
                ticket.status
              )}
            >
              {ticket.statusLabel}
            </Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-[13px]">
            <DetailItem
              label="Submitted By"
              value={
                ticket.submittedByName ||
                "—"
              }
            />

            <DetailItem
              label="Submitted Email"
              value={
                ticket.submittedByEmail ||
                "—"
              }
            />

            <DetailItem
              label="Department"
              value={ticket.department || "—"}
            />

            {ticket.type === "CALL_TO_RM" && (
              <>
                <DetailItem
                  label="Discussion Category"
                  value={ticket.discussionCategoryLabel || "—"}
                />
                <DetailItem
                  label="Preferred Call Date"
                  value={formatDateOnly(ticket.preferredCallDate)}
                />
                <DetailItem
                  label="Preferred Time"
                  value={ticket.preferredTimeSlot || "—"}
                />
                <DetailItem
                  label="Contact Person"
                  value={ticket.contactName || "—"}
                />
                <DetailItem
                  label="Contact Phone"
                  value={ticket.contactPhone || "—"}
                />
                <DetailItem
                  label="Contact Email"
                  value={ticket.contactEmail || "—"}
                />
                <DetailItem
                  label="Relationship Manager"
                  value={ticket.assignedRm?.name || "Not assigned yet"}
                />
                <DetailItem
                  label="Scheduled Call"
                  value={ticket.scheduledCallAt ? formatDate(ticket.scheduledCallAt) : "Not scheduled yet"}
                />
              </>
            )}

            <DetailItem
              label="Created"
              value={
                formatDate(
                  ticket.createdAt
                )
              }
            />

            <DetailItem
              label="Last Updated"
              value={
                formatDate(
                  ticket.updatedAt
                )
              }
            />

            {ticket.resolvedAt && (
              <DetailItem
                label="Resolved"
                value={
                  formatDate(
                    ticket.resolvedAt
                  )
                }
              />
            )}
          </div>

          <div>
            <div className="text-[13px] uppercase tracking-[0.08em] font-semibold text-slate-400">
              Description
            </div>

            <div className="mt-2 text-[15px] leading-6 text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-4">
              {ticket.description}
            </div>
          </div>

          <div>
            <div className="text-[13px] uppercase tracking-[0.08em] font-semibold text-slate-400 inline-flex items-center gap-1.5">
              <MessageSquareText
                size={12}
              />
              Bispun Response
            </div>

            {ticket.adminRemarks ? (
              <div className="mt-2 text-[15px] leading-6 text-slate-700 whitespace-pre-wrap bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
                {ticket.adminRemarks}
              </div>
            ) : (
              <div className="mt-2 text-[15px] text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl p-4">
                No support response has been added yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3">
      <div className="text-[13px] uppercase tracking-[0.08em] font-semibold text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-[13px] font-semibold text-slate-700 break-words">
        {value}
      </div>
    </div>
  );
}

export default function Help({
  plan = "basic",
  tenant,
  user,
  focusTicketId = null,
  onFocusConsumed,
}) {
  const [
    tickets,
    setTickets,
  ] = useState([]);

  const [departments, setDepartments] = useState([
    { id: "admin", name: "Admin", code: "ADM" },
    { id: "sales", name: "Sales", code: "SAL" },
  ]);

  const [
    loading,
    setLoading,
  ] = useState(
    true
  );

  const [
    error,
    setError,
  ] = useState("");

  // Dedicated state for a ticket-LIST load failure, kept separate from the
  // shared `error` so a failed fetch shows a clear error+Retry state instead of
  // a misleading empty "0 records" view (and is not double-reported).
  const [loadError, setLoadError] = useState("");

  const [
    showTicketModal,
    setShowTicketModal,
  ] = useState(
    false
  );

  const [
    selectedType,
    setSelectedType,
  ] = useState(
    null
  );

  const [
    selectedTicket,
    setSelectedTicket,
  ] = useState(
    null
  );

  // Deep-link focus: when a notification targets a ticket that isn't in this
  // user's accessible list, show an assertive, focusable notice (mirrors
  // LeadStore's focusNotice) instead of silently doing nothing.
  const [focusNotice, setFocusNotice] = useState("");
  const focusNoticeRef = useRef(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const isAdvanced =
    plan ===
    "advanced";

  async function loadOrganization() {
    try {
      const data = await apiRequest("/api/client/users/organization");
      if (Array.isArray(data.departments) && data.departments.length) {
        setDepartments(data.departments);
      }
    } catch (error) {
      console.error("Unable to load support departments:", error);
    }
  }

  async function loadTickets() {
    setLoading(
      true
    );

    setError("");
    setLoadError("");

    try {
      const data =
        await apiRequest(
          "/api/client/support"
        );

      setTickets(
        data.tickets ||
          []
      );
      setLoadError("");
    } catch (error) {
      // Single source of truth for a LIST-LOAD failure: set loadError only (not
      // the shared `error`/page banner), so the list renders a dedicated error +
      // Retry state instead of the misleading empty "0 records" view.
      setLoadError(
        error?.data?.message ||
          "Unable to load support tickets"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  useEffect(() => {
    loadTickets();
    loadOrganization();
  }, []);

  // A11y: move focus to the deep-link notice when it appears.
  useEffect(() => {
    if (focusNotice) focusNoticeRef.current?.focus();
  }, [focusNotice]);

  // Consume a notification deep-link that targets a specific ticket. Once the
  // list has loaded, open the exact ticket's detail; if it isn't in the user's
  // accessible list (deleted/unauthorized), show a safe notice. onFocusConsumed
  // clears the token in BOTH branches so list refreshes don't re-fire it.
  useEffect(() => {
    if (!focusTicketId || loading) return;
    const match = tickets.find(
      (t) => String(t.id) === String(focusTicketId)
    );
    if (match) {
      setSelectedTicket(match);
      setFocusNotice("");
    } else {
      setFocusNotice("That support ticket isn't available to you.");
    }
    onFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTicketId, loading, tickets]);

  function createTicket(
    type = null
  ) {
    if (
      type ===
        "CUSTOMIZATION" &&
      !isAdvanced
    ) {
      return;
    }

    setSelectedType(
      type
    );

    setShowTicketModal(
      true
    );
  }

  // Shared predicates so the KPI counts and their drill-down lists always match.
  const isOpenTicket = (ticket) =>
    !["COMPLETED", "CLOSED", "REJECTED"].includes(ticket.status);
  const isActiveTicket = (ticket) =>
    [
      "IN_PROGRESS",
      "DEVELOPMENT",
      "RM_ASSIGNED",
      "CALL_SCHEDULED",
      "FOLLOW_UP_REQUIRED",
    ].includes(ticket.status);
  const isCompletedTicket = (ticket) =>
    ["DISCUSSION_COMPLETED", "COMPLETED", "CLOSED"].includes(ticket.status);

  const openTicketList = tickets.filter(isOpenTicket);
  const activeTicketList = tickets.filter(isActiveTicket);
  const completedTicketList = tickets.filter(isCompletedTicket);

  const totalTickets = tickets.length;
  const openTickets = openTicketList.length;
  const activeTickets = activeTicketList.length;
  const completedTickets = completedTicketList.length;

  // KPI card drill-down (click a card → see the tickets behind the number).
  const [ticketDrill, setTicketDrill] = useState(null);
  const openTicketDrill = (config) => setTicketDrill(config);

  // Row selection for the LeadStore-style tickets grid.
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);
  const selectAllRef = useRef(null);
  const toggleTicketRow = (id) =>
    setSelectedTicketIds((current) =>
      current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
    );

  // Ticket-type picker (⋮ menu beside New Ticket).
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef(null);
  const typeTriggerRef = useRef(null);

  const chooseTicketType = (type) => {
    if (type.advancedOnly && !isAdvanced) return;
    setTypeMenuOpen(false);
    createTicket(type.key);
  };

  useEffect(() => {
    if (!typeMenuOpen) return;

    const firstItem =
      typeMenuRef.current?.querySelector('[role="menuitem"]');
    firstItem?.focus();

    const onPointerDown = (event) => {
      if (
        typeMenuRef.current?.contains(event.target) ||
        typeTriggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setTypeMenuOpen(false);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setTypeMenuOpen(false);
        typeTriggerRef.current?.focus();
        return;
      }
      if (event.key === "Tab") {
        setTypeMenuOpen(false);
        return;
      }
      const items = Array.from(
        typeMenuRef.current?.querySelectorAll('[role="menuitem"]') || []
      );
      if (!items.length) return;
      const index = items.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1 + items.length) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1]?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [typeMenuOpen]);

  const filteredTickets =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return tickets.filter(
          (
            ticket
          ) => {
            const searchMatches =
              !query ||
              [
                ticket.ticketNumber,
                ticket.title,
                ticket.description,
                ticket.typeLabel,
                ticket.statusLabel,
                ticket.submittedByName,
                ticket.submittedByEmail,
                ticket.department,
                ticket.discussionCategoryLabel,
                ticket.preferredTimeSlot,
                ticket.contactName,
                ticket.contactPhone,
                ticket.contactEmail,
                ticket.assignedRm?.name,
                ticket.adminRemarks,
              ]
                .filter(
                  Boolean
                )
                .some(
                  (
                    value
                  ) =>
                    String(
                      value
                    )
                      .toLowerCase()
                      .includes(
                        query
                      )
                );

            const statusMatches =
              !statusFilter ||
              ticket.status ===
                statusFilter;

            const typeMatches =
              !typeFilter ||
              ticket.type ===
                typeFilter;

            const priorityMatches =
              !priorityFilter ||
              ticket.priority ===
                priorityFilter;

            return (
              searchMatches &&
              statusMatches &&
              typeMatches &&
              priorityMatches
            );
          }
        );
      },
      [
        tickets,
        search,
        statusFilter,
        typeFilter,
        priorityFilter,
      ]
    );

  // Select-all operates on the currently visible (filtered) tickets.
  const allVisibleSelected =
    filteredTickets.length > 0 &&
    filteredTickets.every((t) =>
      selectedTicketIds.includes(t.id)
    );

  const toggleSelectAllTickets = () =>
    setSelectedTicketIds(
      allVisibleSelected
        ? []
        : filteredTickets.map((t) => t.id)
    );

  // Mixed-state select-all (LeadStore omits this — a11y requirement).
  useEffect(() => {
    if (!selectAllRef.current) return;
    const selectedVisible = filteredTickets.filter((t) =>
      selectedTicketIds.includes(t.id)
    ).length;
    selectAllRef.current.indeterminate =
      selectedVisible > 0 &&
      selectedVisible < filteredTickets.length;
  }, [selectedTicketIds, filteredTickets]);

  return (
    <div className="space-y-4">

      {/* Deep-link fallback: assertive, focusable notice shown when a
          notification pointed at a ticket that is missing or not visible to
          this user. Mirrors LeadStore's focusNotice pattern. */}
      {focusNotice && (
        <div
          ref={focusNoticeRef}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[13px] font-semibold text-amber-900 outline-none"
        >
          {focusNotice}
        </div>
      )}

      {/* PAGE HEADER */}

      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Support / Service Desk
        </div>

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Help & Support
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={
                loadTickets
              }
              disabled={
                loading
              }
              className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700 inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                openTicketDrill({
                  title: "Ticket History",
                  subtitle: "All support tickets, including resolved and closed",
                  records: tickets,
                  emptyText: "No tickets yet.",
                })
              }
              className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700 inline-flex items-center gap-2 shadow-sm"
            >
              <History size={13} aria-hidden="true" />
              History
            </button>

            <button
              type="button"
              onClick={() =>
                createTicket()
              }
              className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
            >
              <Plus
                size={14}
              />

              New Ticket
            </button>

            <div className="relative" ref={typeMenuRef}>
              <button
                ref={typeTriggerRef}
                type="button"
                onClick={() =>
                  setTypeMenuOpen((open) => !open)
                }
                onKeyDown={(event) => {
                  if (
                    !typeMenuOpen &&
                    (event.key === "ArrowDown" ||
                      event.key === "ArrowUp")
                  ) {
                    event.preventDefault();
                    setTypeMenuOpen(true);
                  }
                }}
                aria-haspopup="menu"
                aria-expanded={typeMenuOpen}
                aria-controls="help-ticket-type-menu"
                aria-label="Choose a support ticket type"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <MoreVertical size={16} aria-hidden="true" />
              </button>

              {typeMenuOpen && (
                <div
                  id="help-ticket-type-menu"
                  role="menu"
                  aria-label="Support ticket types"
                  className="absolute right-0 z-[60] mt-1.5 w-[320px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.18)]"
                >
                  <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    Create a ticket
                  </div>

                  {TYPES.map((type) => {
                    const Icon = type.icon;
                    const locked =
                      type.advancedOnly && !isAdvanced;

                    return (
                      <button
                        key={type.key}
                        type="button"
                        role="menuitem"
                        aria-disabled={locked || undefined}
                        aria-label={
                          locked
                            ? `${type.label} — available on the Advanced plan`
                            : undefined
                        }
                        onClick={() => chooseTicketType(type)}
                        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                          locked
                            ? "cursor-not-allowed opacity-60"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${type.color}`}
                        >
                          <Icon size={16} aria-hidden="true" />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[13px] font-bold text-slate-900">
                              {type.label}
                            </span>

                            {locked && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                <Lock size={9} aria-hidden="true" />
                                Advanced
                              </span>
                            )}
                          </span>

                          <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
                            {type.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-1 text-[15px] text-slate-500">
          Manage technical issues, billing requests, Advanced-plan customization support, or request a direct discussion with your Relationship Manager.
        </p>
      </div>

      {/* METRICS */}

      <TicketDrilldownModal
        open={!!ticketDrill}
        title={ticketDrill?.title}
        subtitle={ticketDrill?.subtitle}
        columns={TICKET_COLUMNS}
        records={ticketDrill?.records || []}
        emptyText={ticketDrill?.emptyText}
        onClose={() => setTicketDrill(null)}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          {
            label: "Total Tickets",
            value: totalTickets,
            Icon: Ticket,
            tone: "bg-indigo-50 text-indigo-600",
            drill: {
              title: "Total Tickets",
              subtitle: "All support requests submitted",
              records: tickets,
              emptyText: "No support tickets yet.",
            },
          },
          {
            label: "Open",
            value: openTickets,
            Icon: LifeBuoy,
            tone: "bg-amber-50 text-amber-600",
            drill: {
              title: "Open Tickets",
              subtitle: "Requests requiring attention",
              records: openTicketList,
              emptyText: "No open tickets.",
            },
          },
          {
            label: "In Progress",
            value: activeTickets,
            Icon: Clock3,
            tone: "bg-indigo-50 text-indigo-600",
            drill: {
              title: "In Progress",
              subtitle: "Tickets currently being worked on",
              records: activeTicketList,
              emptyText: "No tickets in progress.",
            },
          },
          {
            label: "Completed",
            value: completedTickets,
            Icon: CheckCircle2,
            tone: "bg-emerald-50 text-emerald-600",
            drill: {
              title: "Completed",
              subtitle: "Resolved or closed support requests",
              records: completedTicketList,
              emptyText: "No completed tickets.",
            },
          },
        ].map((metric) => (
          <button
            key={metric.label}
            type="button"
            onClick={() => openTicketDrill(metric.drill)}
            aria-label={`${metric.label}, ${metric.value} tickets — view`}
            className="group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${metric.tone}`}>
              <metric.Icon size={17} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[18px] font-bold leading-tight text-slate-900 tabular-nums">
                {metric.value}
              </span>
              <span className="block truncate text-[12px] text-slate-500">
                {metric.label}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* ERROR */}

      {error && (
        <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[15px]">
          {
            error
          }
        </div>
      )}

      {successMessage && (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[15px] inline-flex items-center gap-2">
          <CheckCircle2
            size={15}
          />
          {successMessage}
        </div>
      )}

      {/* SEARCH / FILTERS */}

      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col xl:flex-row xl:items-center gap-2 native:flex-row native:flex-nowrap native:items-center native:max-w-full native:relative native:overflow-x-auto native:[-webkit-overflow-scrolling:touch]">
        <div className="relative flex-1 min-w-0 native:w-[230px] native:flex-none native:shrink-0">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            aria-label="Search tickets"
            value={
              search
            }
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search ticket number, title, description or response..."
            className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>

        <select
          value={
            statusFilter
          }
          onChange={(
            event
          ) =>
            setStatusFilter(
              event.target.value
            )
          }
          className="h-9 px-3 border border-slate-200 bg-white rounded-lg text-[13px] font-semibold text-slate-700 native:w-[150px] native:shrink-0"
        >
          <option value="">
            All Statuses
          </option>
          <option value="NEW">
            New
          </option>
          <option value="UNDER_REVIEW">
            Under Review
          </option>
          <option value="APPROVED">
            Approved
          </option>
          <option value="IN_PROGRESS">
            In Progress
          </option>
          <option value="DEVELOPMENT">
            Development
          </option>
          <option value="RM_ASSIGNED">
            RM Assigned
          </option>
          <option value="CALL_SCHEDULED">
            Call Scheduled
          </option>
          <option value="DISCUSSION_COMPLETED">
            Discussion Completed
          </option>
          <option value="FOLLOW_UP_REQUIRED">
            Follow-up Required
          </option>
          <option value="COMPLETED">
            Completed
          </option>
          <option value="REJECTED">
            Rejected
          </option>
          <option value="CLOSED">
            Closed
          </option>
        </select>

        <select
          value={
            typeFilter
          }
          onChange={(
            event
          ) =>
            setTypeFilter(
              event.target.value
            )
          }
          className="h-9 px-3 border border-slate-200 bg-white rounded-lg text-[13px] font-semibold text-slate-700 native:w-[150px] native:shrink-0"
        >
          <option value="">
            All Types
          </option>
          <option value="TECHNICAL_ISSUE">
            Technical Issue
          </option>
          <option value="BILLING">
            Billing Support
          </option>
          <option value="CUSTOMIZATION">
            Customization Request
          </option>
          <option value="CALL_TO_RM">
            Call to RM
          </option>
        </select>

        <select
          value={
            priorityFilter
          }
          onChange={(
            event
          ) =>
            setPriorityFilter(
              event.target.value
            )
          }
          className="h-9 px-3 border border-slate-200 bg-white rounded-lg text-[13px] font-semibold text-slate-700 native:w-[150px] native:shrink-0"
        >
          <option value="">
            All Priorities
          </option>
          {PRIORITIES.map(
            (
              priority
            ) => (
              <option
                key={
                  priority.value
                }
                value={
                  priority.value
                }
              >
                {
                  priority.label
                }
              </option>
            )
          )}
        </select>
      </div>

      {/* TICKETS */}

      {resolveListView({
        loading,
        loadError,
        itemCount: filteredTickets.length,
      }) === "loading" ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 flex items-center justify-center gap-2 text-[15px] text-slate-500">
          <Loader2
            size={16}
            className="animate-spin"
          />

          Loading tickets...
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="bg-white border border-rose-200 rounded-xl p-10 flex flex-col items-center justify-center gap-3 text-center"
        >
          <AlertCircle size={22} className="text-rose-500" aria-hidden="true" />
          <div className="text-[15px] font-semibold text-slate-900">
            Couldn't load your support tickets
          </div>
          <div className="text-[13px] text-rose-700 max-w-sm">{loadError}</div>
          <button
            type="button"
            onClick={loadTickets}
            aria-label="Retry loading support tickets"
            className="mt-1 h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-semibold rounded-lg inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <RefreshCw size={14} aria-hidden="true" /> Retry
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">

          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-bold text-slate-900 inline-flex items-center gap-2">
              <Ticket
                size={14}
                className="text-indigo-500"
                aria-hidden="true"
              />
              Support Tickets
            </h3>

            <div className="text-[12px] font-semibold text-slate-500 tabular-nums">
              {
                filteredTickets.length
              }{" "}
              records
            </div>
          </div>

          {/* Desktop (sm+): LeadStore-style Excel grid — horizontal scroll,
              sticky select + frozen Ticket column + sticky Actions. Mobile keeps
              the stacked card list below. Same data + states. */}
          <div className="hidden sm:block">
            <div
              tabIndex={0}
              role="region"
              aria-label="Support tickets, scrollable"
              className="relative overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
            >
              <table className="w-max min-w-full text-[13px]">
                <caption className="sr-only">
                  Support tickets
                </caption>

                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-30 w-10 min-w-10 border-r border-slate-200 bg-slate-50 px-2.5 py-2.5 text-center"
                    >
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllTickets}
                        aria-label="Select all tickets on this page"
                        className="h-4 w-4 align-middle rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>

                    <th
                      scope="col"
                      className="sticky left-10 z-[25] min-w-[120px] border-r-2 border-slate-900 bg-slate-50 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-slate-500 shadow-[2px_0_5px_-2px_rgba(15,23,42,0.18)]"
                    >
                      Ticket
                    </th>

                    <th scope="col" className="min-w-[260px] border-r border-slate-100 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-slate-500">
                      Title
                    </th>
                    <th scope="col" className="min-w-[160px] border-r border-slate-100 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-slate-500">
                      Type
                    </th>
                    <th scope="col" className="min-w-[150px] border-r border-slate-100 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-slate-500">
                      Department
                    </th>
                    <th scope="col" className="min-w-[110px] border-r border-slate-100 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-slate-500">
                      Priority
                    </th>
                    <th scope="col" className="min-w-[140px] border-r border-slate-100 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-slate-500">
                      Status
                    </th>
                    <th scope="col" className="min-w-[160px] border-r border-slate-100 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-slate-500">
                      Created
                    </th>

                    <th
                      scope="col"
                      className="sticky right-0 z-20 min-w-[92px] border-l border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-12 text-center text-sm text-slate-500"
                      >
                        No support tickets yet
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => {
                      const selected = selectedTicketIds.includes(
                        ticket.id
                      );
                      const stickyBg = selected
                        ? "bg-indigo-50"
                        : "bg-white group-hover:bg-slate-50";

                      return (
                        <tr
                          key={ticket.id}
                          className={`group ${selected ? "bg-indigo-50/60" : ""}`}
                        >
                          <td className={`sticky left-0 z-20 w-10 min-w-10 border-r border-slate-100 px-2.5 py-2.5 text-center transition-colors ${stickyBg}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleTicketRow(ticket.id)}
                              aria-label={`Select ticket ${ticket.ticketNumber}`}
                              className="h-4 w-4 align-middle rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>

                          <td className={`sticky left-10 z-[15] min-w-[120px] border-r-2 border-slate-900 px-3 py-2.5 font-mono font-medium text-slate-700 whitespace-nowrap transition-colors shadow-[2px_0_5px_-2px_rgba(15,23,42,0.18)] ${stickyBg}`}>
                            {ticket.ticketNumber}
                          </td>

                          <td className="min-w-[260px] border-r border-slate-100 px-3 py-2.5">
                            <div className="font-semibold text-slate-900">
                              {ticket.title}
                            </div>
                            <div className="text-[12px] text-slate-500 mt-0.5 max-w-md truncate">
                              {ticket.description}
                            </div>
                          </td>

                          <td className="min-w-[160px] border-r border-slate-100 px-3 py-2.5">
                            <Badge tone="slate">
                              {ticket.typeLabel}
                            </Badge>
                          </td>

                          <td className="min-w-[150px] border-r border-slate-100 px-3 py-2.5 text-slate-600">
                            {ticket.type === "CALL_TO_RM"
                              ? "Relationship Manager"
                              : ticket.department || "—"}
                          </td>

                          <td className="min-w-[110px] border-r border-slate-100 px-3 py-2.5">
                            <Badge tone={priorityTone(ticket.priority)}>
                              {ticket.priorityLabel}
                            </Badge>
                          </td>

                          <td className="min-w-[140px] border-r border-slate-100 px-3 py-2.5">
                            <Badge tone={ticketStatusTone(ticket.status)}>
                              {ticket.statusLabel}
                            </Badge>
                          </td>

                          <td className="min-w-[160px] border-r border-slate-100 px-3 py-2.5 text-slate-500 whitespace-nowrap tabular-nums">
                            {formatDate(ticket.createdAt)}
                          </td>

                          <td className={`sticky right-0 z-10 min-w-[92px] border-l border-slate-100 px-2 py-2.5 transition-colors ${stickyBg}`}>
                            <button
                              type="button"
                              onClick={() => setSelectedTicket(ticket)}
                              aria-label={`View ticket ${ticket.ticketNumber}`}
                              className="h-8 px-2.5 rounded-lg inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            >
                              <Eye size={12} aria-hidden="true" />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile (below sm): card list. role="list" restores the list
              relationship Tailwind strips, so AT still announces N items. */}
          <div
            className="sm:hidden divide-y divide-slate-100"
            role="list"
            aria-label="Support tickets"
          >
            {filteredTickets.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-slate-500">
                No support tickets yet
              </div>
            ) : (
              filteredTickets.map((ticket) => (
                <div key={ticket.id} role="listitem" className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12px] font-mono font-medium text-slate-500">
                        {ticket.ticketNumber}
                      </div>
                      <div className="text-[15px] font-semibold text-slate-900 break-words mt-0.5">
                        {ticket.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      aria-label={`View ticket ${ticket.ticketNumber}`}
                      className="shrink-0 h-11 min-w-[44px] px-3 rounded-lg inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <Eye size={14} aria-hidden="true" />
                      View
                    </button>
                  </div>

                  {ticket.description ? (
                    <div className="text-[13px] text-slate-500 mt-1.5 line-clamp-2">
                      {ticket.description}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <Badge tone="slate">{ticket.typeLabel}</Badge>
                    <Badge tone={priorityTone(ticket.priority)}>
                      {ticket.priorityLabel}
                    </Badge>
                    <Badge tone={ticketStatusTone(ticket.status)}>
                      {ticket.statusLabel}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-2.5 text-[12px] text-slate-500">
                    <span className="truncate">
                      {ticket.type === "CALL_TO_RM"
                        ? "Relationship Manager"
                        : ticket.department || "—"}
                    </span>
                    <span className="whitespace-nowrap">
                      {formatDate(ticket.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL */}

      {showTicketModal && (
        <NewTicketModal
          defaultType={
            selectedType
          }
          plan={
            plan
          }
          departments={departments}
          tenant={tenant}
          user={user}
          onClose={() => {
            setShowTicketModal(
              false
            );

            setSelectedType(
              null
            );
          }}
          onCreated={async () => {
            setShowTicketModal(
              false
            );

            setSelectedType(
              null
            );

            setSuccessMessage(
              "Request submitted successfully"
            );

            await loadTickets();
          }}
        />
      )}

      {selectedTicket && (
        <TicketDetailsModal
          ticket={
            selectedTicket
          }
          onClose={() =>
            setSelectedTicket(
              null
            )
          }
        />
      )}
    </div>
  );
}