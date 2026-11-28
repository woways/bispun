"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { pushBackInterceptor } from "../../lib/backStack";

import { useModalA11y } from "../../lib/useModalA11y";

import {
  Plus,
  UserCheck,
  CalendarDays,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Search,
  WalletCards,
  Pencil,
  Trash2,
  Building2,
  Globe2,
  Upload,
  Paperclip,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderPlus,
  Lock,
  GraduationCap,
  Download,
  ArrowUpDown,
  BookOpen,
  Stethoscope,
  BriefcaseBusiness,
  Cpu,
  Scale,
  FlaskConical,
} from "lucide-react";

import {
  Table,
  Badge,
  statusTone,
} from "../../components/ui";
import DetailModal from "../../components/DetailModal";
import SearchableSelect from "../../components/SearchableSelect";

import {
  apiRequest,
} from "../../lib/api";
import { formatUiDate } from "../../lib/uiPreferences";

const BASIC_STREAM_OPTIONS = [
  "Engineering",
  "Medical",
  "Dental",
  "Management",
  "Commerce",
  "Arts & Humanities",
  "Science",
  "Law",
  "Pharmacy",
  "Nursing",
  "Agriculture",
];
const OTHER_STREAM_OPTION = "__OTHER_STREAM__";

const STATUS_OPTIONS = [
  {
    value: "PENDING",
    label: "Pending",
  },
  {
    value: "ONGOING",
    label: "Ongoing",
  },
  {
    value: "COMPLETED",
    label: "Completed",
  },
  {
    value: "CANCELLED",
    label: "Cancelled",
  },
];

const REVENUE_STATUS_OPTIONS = [
  {
    value: "BUFFER_ZONE",
    label: "Buffer Zone",
  },
  {
    value: "IN_BUCKET",
    label: "In Bucket",
  },
];

const AMOUNT_STATUS_OPTIONS = [
  {
    value: "PENDING",
    label: "Pending",
  },
  {
    value: "RECEIVED",
    label: "Received",
  },
];

const FAMILY = {
  blue: {
    strong:
      "bg-blue-600 border-blue-600 text-white",
    soft:
      "bg-blue-50 border-blue-200 text-blue-800",
    mid:
      "bg-blue-100 border-blue-300 text-blue-800",
    line:
      "border-blue-300 hover:border-blue-500",
    text:
      "text-blue-700",
    button:
      "bg-blue-600 hover:bg-blue-700 text-white",
  },
  rose: {
    strong:
      "bg-rose-600 border-rose-600 text-white",
    soft:
      "bg-rose-50 border-rose-200 text-rose-800",
    mid:
      "bg-rose-100 border-rose-300 text-rose-800",
    line:
      "border-rose-300 hover:border-rose-500",
    text:
      "text-rose-700",
    button:
      "bg-rose-600 hover:bg-rose-700 text-white",
  },
  amber: {
    strong:
      "bg-amber-500 border-amber-500 text-slate-950",
    soft:
      "bg-amber-50 border-amber-200 text-amber-900",
    mid:
      "bg-amber-100 border-amber-300 text-amber-900",
    line:
      "border-amber-300 hover:border-amber-500",
    text:
      "text-amber-700",
    button:
      "bg-amber-500 hover:bg-amber-600 text-slate-950",
  },
  purple: {
    strong:
      "bg-violet-600 border-violet-600 text-white",
    soft:
      "bg-violet-50 border-violet-200 text-violet-800",
    mid:
      "bg-violet-100 border-violet-300 text-violet-800",
    line:
      "border-violet-300 hover:border-violet-500",
    text:
      "text-violet-700",
    button:
      "bg-violet-600 hover:bg-violet-700 text-white",
  },
  emerald: {
    strong:
      "bg-emerald-600 border-emerald-600 text-white",
    soft:
      "bg-emerald-50 border-emerald-200 text-emerald-800",
    mid:
      "bg-emerald-100 border-emerald-300 text-emerald-800",
    line:
      "border-emerald-300 hover:border-emerald-500",
    text:
      "text-emerald-700",
    button:
      "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  cyan: {
    strong:
      "bg-cyan-600 border-cyan-600 text-white",
    soft:
      "bg-cyan-50 border-cyan-200 text-cyan-900",
    mid:
      "bg-cyan-100 border-cyan-300 text-cyan-900",
    line:
      "border-cyan-300 hover:border-cyan-500",
    text:
      "text-cyan-700",
    button:
      "bg-cyan-600 hover:bg-cyan-700 text-white",
  },
  slate: {
    strong:
      "bg-slate-800 border-slate-800 text-white",
    soft:
      "bg-slate-50 border-slate-200 text-slate-800",
    mid:
      "bg-slate-100 border-slate-300 text-slate-800",
    line:
      "border-slate-300 hover:border-slate-500",
    text:
      "text-slate-700",
    button:
      "bg-slate-900 hover:bg-slate-800 text-white",
  },
};

function family(color) {
  return (
    FAMILY[color] ||
    FAMILY.blue
  );
}

function recommendedStreamColor(name) {
  const value = String(name || "")
    .trim()
    .toLowerCase();

  if (
    value.includes("medical") ||
    value.includes("mbbs") ||
    value.includes("health")
  ) return "cyan";

  if (
    value.includes("engineering") ||
    value.includes("technology") ||
    value.includes("btech") ||
    value.includes("tech")
  ) return "blue";

  if (
    value.includes("management") ||
    value.includes("mba") ||
    value.includes("business")
  ) return "amber";

  if (
    value.includes("pharmacy") ||
    value.includes("pharma")
  ) return "cyan";

  if (
    value.includes("law") ||
    value.includes("legal")
  ) return "emerald";

  if (
    value.includes("degree") ||
    value.includes("arts") ||
    value.includes("science")
  ) return "purple";

  return "blue";
}

function recommendedBranchColor(name, index = 0) {
  const value = String(name || "")
    .trim()
    .toLowerCase();

  if (value.includes("mbbs") || value.includes("medical")) return "rose";
  if (value.includes("bds") || value.includes("dental")) return "purple";
  if (value.includes("pharma") || value.includes("pharmacy")) return "emerald";
  if (value.includes("nursing") || value.includes("health")) return "cyan";
  if (value.includes("cse") || value.includes("computer")) return "blue";
  if (value.includes("ece") || value.includes("electronics")) return "indigo";
  if (value.includes("mechanical")) return "orange";
  if (value.includes("civil")) return "slate";
  if (value.includes("mba") || value.includes("management")) return "amber";

  const fallback = [
    "blue",
    "purple",
    "emerald",
    "amber",
    "cyan",
    "rose",
    "indigo",
    "slate",
  ];

  return fallback[index % fallback.length];
}

function streamIcon(name) {
  const value =
    String(name || "")
      .toLowerCase();

  if (
    value.includes("medical") ||
    value.includes("health")
  ) {
    return Stethoscope;
  }

  if (
    value.includes("management") ||
    value.includes("business")
  ) {
    return BriefcaseBusiness;
  }

  if (
    value.includes("law")
  ) {
    return Scale;
  }

  if (
    value.includes("pharma")
  ) {
    return FlaskConical;
  }

  if (
    value.includes("engineering") ||
    value.includes("tech")
  ) {
    return Cpu;
  }

  return GraduationCap;
}

function formatLeadDisplayId(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^LD\d+$/i.test(text)) return text.toUpperCase();
  const numeric = Number(text.replace(/^Lead ID\s*/i, ""));
  return Number.isInteger(numeric) && numeric > 0
    ? `LD${String(numeric).padStart(3, "0")}`
    : text;
}

// Lead ID cell. When the parent provides onOpenLead and the row has a real
// leadId, render it as a button that opens that lead's full details (Lead
// Store, focused on the record); otherwise a plain badge.
function LeadIdBadge({ admission, onOpenLead }) {
  const text = admission.leadDisplayId
    ? formatLeadDisplayId(admission.leadDisplayId)
    : "—";
  const base =
    "rounded-lg bg-indigo-50 px-2 py-1 text-[12px] font-bold text-indigo-700";
  if (onOpenLead && admission.leadId) {
    return (
      <button
        type="button"
        onClick={() => onOpenLead(admission.leadId)}
        aria-label={`View lead details for ${admission.leadDisplayId ? text : admission.leadId}`}
        className={`${base} hover:bg-indigo-100 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
      >
        {text}
      </button>
    );
  }
  return <span className={base}>{text}</span>;
}

function money(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString(
    "en-IN"
  )}`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
  }

  return formatUiDate(date);
}

function dateInput(value) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date
    .toISOString()
    .slice(0, 10);
}

function Field({
  label,
  required,
  children,
  full = false,
}) {
  return (
    <label
      className={
        full
          ? "md:col-span-2"
          : ""
      }
    >
      <div className="mb-1.5 text-[13px] font-semibold text-slate-600">
        {label}
        {required ? (
          <span className="text-rose-500">
            {" "}
            *
          </span>
        ) : null}
      </div>

      {children}
    </label>
  );
}

function Stat({
  label,
  value,
  detail,
  onClick,
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={detail || undefined}
      className={`w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${onClick ? "cursor-pointer transition hover:border-indigo-200 hover:bg-indigo-50/30 focus:outline-none focus:ring-2 focus:ring-indigo-100" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
          {label}
        </span>
        <span className="shrink-0 text-[18px] font-bold tracking-[-0.02em] text-slate-950 [font-variant-numeric:tabular-nums]">
          {value}
        </span>
      </div>

      {detail ? (
        <div className="mt-0.5 truncate text-[11px] leading-4 text-slate-400">
          {detail}
        </div>
      ) : null}
    </Component>
  );
}

function Breadcrumbs({
  items,
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-1 text-[13px] font-medium text-slate-500"
    >
      {items.map(
        (
          item,
          index
        ) => (
          <div
            key={`${item.label}-${index}`}
            className="flex items-center gap-1"
          >
            {index > 0 ? (
              <ChevronRight
                size={12}
                className="text-slate-300"
                aria-hidden="true"
              />
            ) : null}

            {item.onClick ? (
              <button
                type="button"
                onClick={
                  item.onClick
                }
                className="hover:text-slate-900"
              >
                {
                  item.label
                }
              </button>
            ) : (
              <span
                className="font-semibold text-slate-700"
                aria-current="page"
              >
                {
                  item.label
                }
              </span>
            )}
          </div>
        )
      )}
    </nav>
  );
}

const MODAL_FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  max = "max-w-md",
  placement = "drawer",
}) {
  const isCenter = placement === "center";
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const headingId = useId();
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    const first = panel?.querySelector(MODAL_FOCUSABLE);
    (first || panel)?.focus?.();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Register a back-interceptor so this form (the innermost overlay) closes
    // first on Android back / Escape — never the drill-down popup behind it.
    const unregister = pushBackInterceptor(() => onCloseRef.current?.());
    return () => {
      document.body.style.overflow = previousOverflow;
      unregister();
      restoreRef.current?.focus?.();
    };
  }, []);

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onCloseRef.current?.();
      return;
    }
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = panel.querySelectorAll(MODAL_FOCUSABLE);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    if (event.shiftKey && document.activeElement === firstEl) {
      event.preventDefault();
      lastEl.focus();
    } else if (!event.shiftKey && document.activeElement === lastEl) {
      event.preventDefault();
      firstEl.focus();
    }
  };

  // Portal to <body> so this form escapes any drill-down modal's DOM subtree —
  // keeps its Escape/Back/focus independent of the popup it was opened from.
  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex bg-slate-950/45 backdrop-blur-sm ${
        isCenter ? "items-end justify-center p-0 sm:items-center sm:p-4" : "justify-end"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex w-full ${max} flex-col overflow-hidden bg-white shadow-2xl outline-none ${
          isCenter
            ? "max-h-[92vh] rounded-t-2xl border border-slate-200 sm:rounded-2xl"
            : "h-full border-l border-slate-200 animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
        }`}
      >
        <style>{"@keyframes drawerSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}"}</style>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div id={headingId} className="text-[17px] font-bold text-slate-950">
              {title}
            </div>

            {subtitle ? (
              <div className="mt-1 text-[13px] text-slate-500">
                {subtitle}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function StreamModal({
  editing,
  market = "DOMESTIC",
  onClose,
  onSaved,
}) {
  const [
    name,
    setName,
  ] = useState(
    editing?.name || ""
  );

  const [streamPreset, setStreamPreset] = useState(() =>
    BASIC_STREAM_OPTIONS.includes(editing?.name || "")
      ? editing.name
      : editing?.name
        ? OTHER_STREAM_OPTION
        : ""
  );

  const [
    description,
    setDescription,
  ] = useState(
    editing?.description ||
      ""
  );

  const [
    color,
    setColor,
  ] = useState(
    editing?.color ||
      recommendedStreamColor(
        editing?.name || ""
      )
  );

  const [
    colorTouched,
    setColorTouched,
  ] = useState(
    Boolean(editing?.color)
  );

  useEffect(() => {
    if (!colorTouched) {
      setColor(
        recommendedStreamColor(
          name
        )
      );
    }
  }, [name, colorTouched]);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function submit(
    event
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Please select or enter a stream name.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        editing
          ? `/api/client/admissions/streams/${editing.id}`
          : "/api/client/admissions/streams",
        {
          method:
            editing
              ? "PATCH"
              : "POST",
          body:
            JSON.stringify({
              name,
              description,
              color,
              market,
            }),
        }
      );

      onSaved();
    } catch (error) {
      setError(
        error?.data
          ?.message ||
          "Unable to save stream"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={
        editing
          ? "Edit Stream"
          : "Add Stream"
      }
      subtitle="Example: Engineering, Medical, Management."
      onClose={onClose}
      placement="center"
    >
      <form
        onSubmit={submit}
        className="space-y-4 p-5"
      >
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
            {error}
          </div>
        ) : null}

        <Field
          label="Stream Name"
          required
        >
          <div className="space-y-2">
            <SearchableSelect
              ariaLabel="Stream Name"
              required
              value={streamPreset}
              placeholder="Select stream"
              onChange={(value) => {
                setStreamPreset(value);
                if (value === OTHER_STREAM_OPTION) {
                  if (BASIC_STREAM_OPTIONS.includes(name)) setName("");
                } else {
                  setName(value);
                }
              }}
              options={[
                ...BASIC_STREAM_OPTIONS.map((option) => ({
                  value: option,
                  label: option,
                })),
                { value: OTHER_STREAM_OPTION, label: "Other" },
              ]}
            />
            {streamPreset === OTHER_STREAM_OPTION ? (
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter stream name"
                className="sm-input"
              />
            ) : null}
          </div>
        </Field>

        <Field label="Stream Colour">
          <div className="space-y-2">
            <select
              value={color}
              onChange={(event) => {
                setColor(
                  event.target.value
                );
                setColorTouched(true);
              }}
              className="sm-input"
            >
              <option value="blue">Blue</option>
              <option value="orange">Orange</option>
              <option value="purple">Purple</option>
              <option value="green">Green</option>
              <option value="rose">Rose</option>
              <option value="slate">Slate</option>
              <option value="sky">Sky</option>
              <option value="cyan">Cyan</option>
              <option value="teal">Teal</option>
              <option value="lime">Lime</option>
              <option value="yellow">Yellow</option>
              <option value="amber">Amber</option>
              <option value="red">Red</option>
              <option value="pink">Pink</option>
              <option value="fuchsia">Fuchsia</option>
              <option value="indigo">Indigo</option>
              <option value="navy">Navy</option>
              <option value="black">Black</option>
            </select>

            
          </div>
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            value={
              description
            }
            onChange={(
              event
            ) =>
              setDescription(
                event.target
                  .value
              )
            }
            className="sm-input min-h-[86px] py-2.5"
            placeholder="Optional description"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? (
              <Loader2
                size={13}
                className="animate-spin"
              />
            ) : null}

            {editing
              ? "Save"
              : "Add Stream"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CollegeModal({
  stream,
  streams,
  editing,
  onClose,
  onSaved,
}) {
  const [
    streamId,
    setStreamId,
  ] = useState(
    editing?.streamId ||
      stream?.id ||
      ""
  );

  const [
    name,
    setName,
  ] = useState(
    editing?.name || ""
  );

  const [
    description,
    setDescription,
  ] = useState(
    editing?.description ||
      ""
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function submit(
    event
  ) {
    event.preventDefault();

    if (!streamId) {
      setError("Please select a stream.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        editing
          ? `/api/client/admissions/partners/${editing.id}`
          : "/api/client/admissions/partners",
        {
          method:
            editing
              ? "PATCH"
              : "POST",
          body:
            JSON.stringify({
              streamId,
              name,
              description,
            }),
        }
      );

      onSaved();
    } catch (error) {
      setError(
        error?.data
          ?.message ||
          "Unable to save college"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={
        editing
          ? "Edit College"
          : "Add College"
      }
      subtitle="Keep each college inside one stream."
      onClose={onClose}
    >
      <form
        onSubmit={submit}
        className="space-y-4 p-5"
      >
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
            {error}
          </div>
        ) : null}

        <Field
          label="Stream"
          required
        >
          <SearchableSelect
            ariaLabel="Stream"
            required
            value={streamId}
            placeholder="Select stream"
            onChange={(value) => setStreamId(value)}
            options={streams.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
        </Field>

        <Field
          label="College Name"
          required
        >
          <input
            required
            value={name}
            onChange={(
              event
            ) =>
              setName(
                event.target
                  .value
              )
            }
            placeholder="College / Partner name"
            className="sm-input"
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            value={
              description
            }
            onChange={(
              event
            ) =>
              setDescription(
                event.target
                  .value
              )
            }
            className="sm-input min-h-[86px] py-2.5"
          />
        </Field>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {editing
              ? "Save"
              : "Add College"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function BranchModal({
  partner,
  editing,
  onClose,
  onSaved,
}) {
  const [
    name,
    setName,
  ] = useState(
    editing?.name || ""
  );

  const [
    description,
    setDescription,
  ] = useState(
    editing?.description ||
      ""
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function submit(
    event
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        editing
          ? `/api/client/admissions/branches/${editing.id}`
          : "/api/client/admissions/branches",
        {
          method:
            editing
              ? "PATCH"
              : "POST",
          body:
            JSON.stringify({
              partnerId:
                partner.id,
              name,
              description,
            }),
        }
      );

      onSaved();
    } catch (error) {
      setError(
        error?.data
          ?.message ||
          "Unable to save branch"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={
        editing
          ? "Edit Branch"
          : "Add Branch"
      }
      subtitle={`Add branches/programs inside ${partner.name}. Example: MBBS, BDS, Pharmacy.`}
      onClose={onClose}
    >
      <form
        onSubmit={submit}
        className="space-y-4 p-5"
      >
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
            {error}
          </div>
        ) : null}

        <Field
          label="Branch / Program"
          required
        >
          <input
            required
            value={name}
            onChange={(
              event
            ) =>
              setName(
                event.target
                  .value
              )
            }
            placeholder="MBBS"
            className="sm-input"
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            value={
              description
            }
            onChange={(
              event
            ) =>
              setDescription(
                event.target
                  .value
              )
            }
            className="sm-input min-h-[86px] py-2.5"
          />
        </Field>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="h-9 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {editing
              ? "Save"
              : "Add Branch"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function CollegeAttachmentsModal({ partner, onClose, onChanged }) {
  const { panelRef, onKeyDown } = useModalA11y(onClose);
  const headingId = useId();
  const [attachments, setAttachments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  // null = "All files", "__root" = files not in any folder, otherwise a folder id.
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [search, setSearch] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  const base = `/api/client/admissions/partners/${partner.id}`;

  async function loadAttachments() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(`${base}/attachments`);
      setAttachments(data.attachments || []);
      setFolders(data.folders || []);
    } catch (loadError) {
      setError(loadError?.data?.message || "Unable to load attachments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner.id]);

  // Open a file. Normal files have a public proxy URL. Confidential (locked)
  // files have none — we ask the admin-gated endpoint for a short-lived signed
  // link (sending auth) and open that.
  async function openAttachment(attachment) {
    if (!attachment.locked && attachment.url) {
      window.open(attachment.url, "_blank", "noopener");
      return;
    }
    try {
      const res = await apiRequest(
        `${base}/attachments/${attachment.id}/download`
      );
      if (res?.url) window.open(res.url, "_blank", "noopener");
    } catch (openError) {
      setError(openError?.data?.message || "Unable to open this file");
    }
  }

  async function uploadFile(file) {
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);
      // Upload into the folder the user is currently viewing (if any).
      if (activeFolderId && activeFolderId !== "__root") {
        body.append("folderId", activeFolderId);
      }

      const data = await apiRequest(`${base}/attachments`, { method: "POST", body });

      setAttachments((current) => [data.attachment, ...current]);
      if (onChanged) await onChanged();
    } catch (uploadError) {
      setError(uploadError?.data?.message || "Unable to upload attachment");
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(attachment) {
    if (!window.confirm(`Remove ${attachment.fileName}?`)) return;

    setError("");
    try {
      await apiRequest(`${base}/attachments/${attachment.id}`, { method: "DELETE" });
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      if (onChanged) await onChanged();
    } catch (deleteError) {
      setError(deleteError?.data?.message || "Unable to remove attachment");
    }
  }

  async function moveAttachment(attachment, folderId) {
    const target = folderId || null;
    if ((attachment.folderId || null) === target) return;

    setError("");
    try {
      await apiRequest(`${base}/attachments/${attachment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ folderId: target }),
      });
      setAttachments((current) =>
        current.map((item) => (item.id === attachment.id ? { ...item, folderId: target } : item))
      );
    } catch (moveError) {
      setError(moveError?.data?.message || "Unable to move attachment");
    }
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;

    setSavingFolder(true);
    setError("");
    try {
      const data = await apiRequest(`${base}/folders`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setFolders((current) => [...current, data.folder]);
      setNewFolderName("");
      setCreatingFolder(false);
      setActiveFolderId(data.folder.id);
    } catch (createError) {
      setError(createError?.data?.message || "Unable to create folder");
    } finally {
      setSavingFolder(false);
    }
  }

  async function renameFolder(folder) {
    const name = window.prompt("Rename folder", folder.name);
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === folder.name) return;

    setError("");
    try {
      await apiRequest(`${base}/folders/${folder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });
      setFolders((current) =>
        current.map((item) => (item.id === folder.id ? { ...item, name: trimmed } : item))
      );
    } catch (renameError) {
      setError(renameError?.data?.message || "Unable to rename folder");
    }
  }

  async function deleteFolder(folder) {
    if (!window.confirm(`Delete the folder "${folder.name}"? Files inside it stay and move back to All files.`)) {
      return;
    }

    setError("");
    try {
      await apiRequest(`${base}/folders/${folder.id}`, { method: "DELETE" });
      setFolders((current) => current.filter((item) => item.id !== folder.id));
      setAttachments((current) =>
        current.map((item) => (item.folderId === folder.id ? { ...item, folderId: null } : item))
      );
      if (activeFolderId === folder.id) setActiveFolderId(null);
    } catch (deleteError) {
      setError(deleteError?.data?.message || "Unable to delete folder");
    }
  }

  function fileSize(bytes) {
    const value = Number(bytes || 0);
    if (!value) return "—";
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  const query = search.trim().toLowerCase();
  const searching = query.length > 0;

  // Keep folder counts live as files move around.
  const countFor = (id) => attachments.filter((a) => (a.folderId || null) === id).length;

  // Which files to show: when searching, match across every folder; otherwise
  // show the files in the selected folder (or all / unfiled).
  const visibleAttachments = attachments.filter((a) => {
    if (searching) return a.fileName.toLowerCase().includes(query);
    if (activeFolderId === null) return true;
    if (activeFolderId === "__root") return !a.folderId;
    return a.folderId === activeFolderId;
  });

  const visibleFolders = searching
    ? folders.filter((f) => f.name.toLowerCase().includes(query))
    : folders;

  const folderName = (id) => folders.find((f) => f.id === id)?.name || "";

  // Rendered through a portal to <body> so the fixed overlay escapes the
  // dashboard content wrapper (which uses transform: scale) — otherwise the
  // modal is trapped in that box and sits half-behind the expanded sidebar.
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Paperclip size={16} className="text-indigo-600" />
              <h2 id={headingId} className="text-[17px] font-bold text-slate-950">College Attachments</h2>
            </div>
            <p className="mt-1 text-[13px] text-slate-500">
              {partner.name} · organise brochures, fee structures, approvals and other files into folders.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={17} />
          </button>
        </div>

        {/* Search bar */}
        <div className="border-b border-slate-200 px-5 py-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              aria-label="Search files and folders"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files and folders…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-[13px] text-slate-800 outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
                title="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Folder rail */}
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/60 p-3 sm:w-56 sm:border-b-0 sm:border-r">
            <div className="flex flex-wrap gap-1.5 sm:flex-col">
              <button
                type="button"
                onClick={() => setActiveFolderId(null)}
                disabled={searching}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                  activeFolderId === null && !searching ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
                } ${searching ? "opacity-50" : ""}`}
              >
                <span className="flex items-center gap-2"><Paperclip size={14} /> All files</span>
                <span className="text-[11px] opacity-80">{attachments.length}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFolderId("__root")}
                disabled={searching}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${
                  activeFolderId === "__root" && !searching ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"
                } ${searching ? "opacity-50" : ""}`}
              >
                <span className="flex items-center gap-2"><Folder size={14} /> Unfiled</span>
                <span className="text-[11px] opacity-80">{countFor(null)}</span>
              </button>

              {folders.map((folder) =>
                folder.locked ? (
                  // Confidential folder: admin-only, permanent (no rename/delete).
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setActiveFolderId(folder.id)}
                    disabled={searching}
                    title="Confidential — visible only to you (Admin)"
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[13px] font-semibold transition ${
                      activeFolderId === folder.id && !searching
                        ? "border-amber-500 bg-amber-500 text-white"
                        : "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    } ${searching ? "opacity-50" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Lock size={14} className="shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] opacity-80">{countFor(folder.id)}</span>
                  </button>
                ) : (
                <div
                  key={folder.id}
                  className={`group flex items-center gap-1 rounded-lg px-1.5 ${
                    activeFolderId === folder.id && !searching ? "bg-indigo-600" : "hover:bg-slate-100"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveFolderId(folder.id)}
                    disabled={searching}
                    className={`flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pl-1.5 text-[13px] font-semibold transition ${
                      activeFolderId === folder.id && !searching ? "text-white" : "text-slate-700"
                    } ${searching ? "opacity-50" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Folder size={14} className="shrink-0" />
                      <span className="truncate">{folder.name}</span>
                    </span>
                    <span className="shrink-0 text-[11px] opacity-80">{countFor(folder.id)}</span>
                  </button>
                  <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => renameFolder(folder)}
                      className={`flex h-6 w-6 items-center justify-center rounded ${
                        activeFolderId === folder.id && !searching ? "text-white/90 hover:bg-white/20" : "text-slate-400 hover:bg-slate-200"
                      }`}
                      title="Rename folder"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFolder(folder)}
                      className={`flex h-6 w-6 items-center justify-center rounded ${
                        activeFolderId === folder.id && !searching ? "text-white/90 hover:bg-white/20" : "text-rose-500 hover:bg-rose-100"
                      }`}
                      title="Delete folder"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                )
              )}
            </div>

            {creatingFolder ? (
              <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-2">
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  maxLength={80}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") createFolder();
                    if (event.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                  }}
                  placeholder="Folder name"
                  className="h-8 w-full rounded-md border border-slate-200 px-2 text-[13px] outline-none focus:border-indigo-300"
                />
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={createFolder}
                    disabled={savingFolder || !newFolderName.trim()}
                    className="h-7 flex-1 rounded-md bg-indigo-600 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {savingFolder ? "Saving…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}
                    className="h-7 rounded-md border border-slate-200 px-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-[13px] font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
              >
                <FolderPlus size={14} /> New folder
              </button>
            )}
          </div>

          {/* Files pane */}
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            {error ? (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-[13px] font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <label className={`flex min-h-[96px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed px-5 text-center transition ${uploading ? "cursor-wait border-slate-200 bg-slate-50" : "border-indigo-200 bg-indigo-50/40 hover:border-indigo-300 hover:bg-indigo-50"}`}>
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.zip"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  event.target.value = "";
                  uploadFile(file);
                }}
              />
              <div>
                {uploading ? <Loader2 size={22} className="mx-auto animate-spin text-indigo-600" /> : <Upload size={22} className="mx-auto text-indigo-600" />}
                <div className="mt-2 text-[14px] font-bold text-slate-800">
                  {uploading
                    ? "Uploading..."
                    : activeFolderId && activeFolderId !== "__root"
                    ? `Upload to “${folderName(activeFolderId)}”`
                    : "Upload college attachment"}
                </div>
                <div className="mt-1 text-[12px] text-slate-500">
                  PDF, images, Word, Excel, CSV, PowerPoint, TXT or ZIP · max 15 MB
                </div>
              </div>
            </label>

            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">
                  {searching
                    ? "Search results"
                    : activeFolderId === null
                    ? "All files"
                    : activeFolderId === "__root"
                    ? "Unfiled"
                    : folderName(activeFolderId)}
                </div>
                <div className="text-[12px] font-semibold text-slate-500">
                  {visibleAttachments.length} file{visibleAttachments.length === 1 ? "" : "s"}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-slate-500">
                  <Loader2 size={15} className="animate-spin" /> Loading attachments...
                </div>
              ) : (
                <>
                  {/* When searching, surface matching folders too. */}
                  {searching && visibleFolders.length ? (
                    <div className="divide-y divide-slate-100 border-b border-slate-100 bg-slate-50/40">
                      {visibleFolders.map((folder) => (
                        <button
                          key={folder.id}
                          type="button"
                          onClick={() => { setSearch(""); setActiveFolderId(folder.id); }}
                          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-slate-100"
                        >
                          <span className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                            <Folder size={14} className="text-indigo-500" /> {folder.name}
                          </span>
                          <span className="text-[11px] text-slate-500">{countFor(folder.id)} file{countFor(folder.id) === 1 ? "" : "s"}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {visibleAttachments.length ? (
                    <div className="divide-y divide-slate-100">
                      {visibleAttachments.map((attachment) => (
                        <div key={attachment.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-slate-900">{attachment.fileName}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {fileSize(attachment.sizeBytes)} · {formatDate(attachment.createdAt)}
                              {attachment.uploadedByName ? ` · ${attachment.uploadedByName}` : ""}
                              {(searching || activeFolderId === null) && attachment.folderId
                                ? ` · in ${folderName(attachment.folderId)}`
                                : ""}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <select
                              value={attachment.folderId || ""}
                              onChange={(event) => moveAttachment(attachment, event.target.value)}
                              title="Move to folder"
                              className="h-8 max-w-[140px] rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-700 outline-none hover:bg-slate-50 focus:border-indigo-300"
                            >
                              <option value="">Unfiled</option>
                              {folders
                                .filter((folder) => !folder.locked)
                                .map((folder) => (
                                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                                ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => openAttachment(attachment)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <ExternalLink size={12} /> Open
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAttachment(attachment)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                              title="Remove attachment"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-[13px] text-slate-500">
                      {searching
                        ? "No files or folders match your search."
                        : activeFolderId && activeFolderId !== "__root"
                        ? "This folder is empty. Upload a file or move one here."
                        : "No attachments added for this college yet."}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AdmissionModal({
  partner,
  market = "DOMESTIC",
  branch,
  admission,
  onClose,
  onSaved,
}) {
  const editing =
    Boolean(admission);

  const [
    leads,
    setLeads,
  ] = useState([]);

  const [
    loadingLeads,
    setLoadingLeads,
  ] = useState(
    !editing
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState({
    leadId:
      admission?.leadId ||
      "",
    studentName:
      admission?.name ||
      "",
    studentPhone:
      admission?.phone ||
      "",
    studentEmail:
      admission?.email ||
      "",
    universityName:
      admission?.universityName ||
      "",
    studentLocation:
      admission?.studentLocation ||
      "",
    studentInterCollege:
      admission?.studentInterCollege ||
      "",
    counsellorName:
      admission
        ?.counsellorName ||
      (
        admission?.counsellor ===
        "Unassigned"
          ? ""
          : admission?.counsellor
      ) ||
      "",
    totalFee:
      admission?.total ??
      "",
    paidAmount:
      admission?.receivedAmount ??
      admission?.paid ??
      "",
    revenueStatus:
      admission?.revenueStatus ||
      "BUFFER_ZONE",
    amountStatus:
      admission?.amountStatusKey ||
      "",
    status:
      admission?.statusKey ||
      "ONGOING",
    admissionDate:
      dateInput(
        admission?.admissionDate
      ) ||
      new Date()
        .toISOString()
        .slice(0, 10),
    notes:
      admission?.notes ||
      "",
  });

  useEffect(() => {
    if (editing) {
      return;
    }

    let active = true;

    async function load() {
      try {
        const data =
          await apiRequest(
            "/api/client/admissions/eligible-leads"
          );

        if (active) {
          setLeads(
            data.leads ||
              []
          );
        }
      } catch (error) {
        if (active) {
          setError(
            error?.data
              ?.message ||
              "Unable to load leads"
          );
        }
      } finally {
        if (active) {
          setLoadingLeads(
            false
          );
        }
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [editing]);

  function update(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function selectLead(
    leadId
  ) {
    const selected =
      leads.find(
        (lead) =>
          lead.id === leadId
      );

    if (!selected) {
      update(
        "leadId",
        ""
      );
      return;
    }

    setForm(
      (current) => ({
        ...current,
        leadId:
          selected.id,
        studentName:
          selected.name ||
          "",
        studentPhone:
          selected.phone ||
          "",
        studentEmail:
          selected.email ||
          "",
        counsellorName:
          selected.assignedToName ||
          "",
      })
    );
  }

  async function submit(
    event
  ) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        editing
          ? `/api/client/admissions/${admission.id}`
          : "/api/client/admissions",
        {
          method:
            editing
              ? "PATCH"
              : "POST",
          body:
            JSON.stringify({
              ...form,
              market,
              partnerId:
                partner.id,
              branchId:
                branch.id,
              course:
                branch.name,
              totalFee:
                Number(
                  form.totalFee ||
                    0
                ),
              paidAmount:
                Number(
                  form.paidAmount ||
                    0
                ),
            }),
        }
      );

      onSaved();
    } catch (error) {
      setError(
        error?.data
          ?.message ||
          "Unable to save admission"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={
        editing
          ? "Edit Admission"
          : "New Admission"
      }
      subtitle={`${partner.name} · ${branch.name}`}
      onClose={onClose}
      max="max-w-3xl"
    >
      <form
        onSubmit={submit}
        className="max-h-[82vh] overflow-y-auto"
      >
        <div className="space-y-5 p-6">
          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-[13px] text-rose-700">
              <AlertCircle
                size={14}
                className="mt-0.5"
              />

              {error}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Admission Path
            </div>

            <div className="mt-1 text-[15px] font-bold text-slate-900">
              {partner.stream?.name ||
                ""}{" "}
              → {partner.name} →{" "}
              {branch.name}
            </div>
          </div>

          {!editing ? (
            <Field
              label="Existing CRM Lead"
              full
            >
              <select
                value={
                  form.leadId
                }
                disabled={
                  loadingLeads
                }
                onChange={(
                  event
                ) =>
                  selectLead(
                    event.target
                      .value
                  )
                }
                className="sm-input"
              >
                <option value="">
                  Direct admission / create Lead Store record
                </option>

                {leads.map(
                  (lead) => (
                    <option
                      key={
                        lead.id
                      }
                      value={
                        lead.id
                      }
                    >
                      {lead.leadDisplayId
                        ? `${formatLeadDisplayId(lead.leadDisplayId)} · `
                        : ""}
                      {lead.name} · {lead.phone}
                    </option>
                  )
                )}
              </select>
            </Field>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Student Name"
              required
            >
              <input
                required
                value={
                  form.studentName
                }
                onChange={(
                  event
                ) =>
                  update(
                    "studentName",
                    event.target
                      .value
                  )
                }
                className="sm-input"
              />
            </Field>

            <Field label="Phone" required>
              <input
                required
                value={
                  form.studentPhone
                }
                onChange={(
                  event
                ) =>
                  update(
                    "studentPhone",
                    event.target
                      .value
                  )
                }
                className="sm-input"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={
                  form.studentEmail
                }
                onChange={(
                  event
                ) =>
                  update(
                    "studentEmail",
                    event.target
                      .value
                  )
                }
                className="sm-input"
              />
            </Field>

            <Field
              label="University Name / Affiliation Name"
              required
            >
              <input
                required
                value={
                  form.universityName
                }
                onChange={(
                  event
                ) =>
                  update(
                    "universityName",
                    event.target
                      .value
                  )
                }
                className="sm-input"
                placeholder="Degree-granting university"
              />
            </Field>

            <Field label="Student Location">
              <input
                value={
                  form.studentLocation
                }
                onChange={(
                  event
                ) =>
                  update(
                    "studentLocation",
                    event.target
                      .value
                  )
                }
                className="sm-input"
                placeholder="City / District / State"
              />
            </Field>

            <Field label="Student Inter College">
              <input
                value={
                  form.studentInterCollege
                }
                onChange={(
                  event
                ) =>
                  update(
                    "studentInterCollege",
                    event.target
                      .value
                  )
                }
                className="sm-input"
                placeholder="Intermediate / previous college"
              />
            </Field>

            <Field label="Counsellor">
              <input
                value={
                  form.counsellorName
                }
                onChange={(
                  event
                ) =>
                  update(
                    "counsellorName",
                    event.target
                      .value
                  )
                }
                className="sm-input"
              />
            </Field>

            <Field
              label="Admission Date"
              required
            >
              <input
                type="date"
                required
                value={
                  form.admissionDate
                }
                onChange={(
                  event
                ) =>
                  update(
                    "admissionDate",
                    event.target
                      .value
                  )
                }
                className="sm-input"
              />
            </Field>

            <Field label="Status">
              <select
                value={
                  form.status
                }
                onChange={(
                  event
                ) =>
                  update(
                    "status",
                    event.target
                      .value
                  )
                }
                className="sm-input"
              >
                {STATUS_OPTIONS.map(
                  (item) => (
                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {
                        item.label
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field
              label="Incentive Amount"
              required
            >
              <input
                type="number"
                min="0"
                required
                value={
                  form.totalFee
                }
                onChange={(
                  event
                ) =>
                  update(
                    "totalFee",
                    event.target
                      .value
                  )
                }
                className="sm-input"
              />
            </Field>

            <Field
              label="Received Amount"
              required
            >
              <input
                type="number"
                min="0"
                required
                value={
                  form.paidAmount
                }
                onChange={(
                  event
                ) =>
                  update(
                    "paidAmount",
                    event.target
                      .value
                  )
                }
                className="sm-input"
              />
            </Field>

            <Field label="Buffer Status">
              <select
                value={form.revenueStatus}
                onChange={(event) => {
                  const value = event.target.value;

                  setForm((current) => ({
                    ...current,
                    revenueStatus: value,
                    amountStatus:
                      value === "BUFFER_ZONE"
                        ? ""
                        : current.amountStatus || "PENDING",
                  }));
                }}
                className="sm-input"
              >
                {REVENUE_STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Amount Status">
              <select
                value={form.amountStatus}
                disabled={form.revenueStatus === "BUFFER_ZONE"}
                onChange={(event) =>
                  update(
                    "amountStatus",
                    event.target.value
                  )
                }
                className="sm-input disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {form.revenueStatus === "BUFFER_ZONE"
                    ? "Not applicable in Buffer Zone"
                    : "Select amount status"}
                </option>

                {AMOUNT_STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Pending Amount">
              <input
                readOnly
                value={Math.max(
                  Number(form.totalFee || 0) -
                    Number(form.paidAmount || 0),
                  0
                )}
                className="sm-input bg-slate-50 text-slate-500"
              />
            </Field>

            <Field
              label="Notes"
              full
            >
              <textarea
                rows={3}
                value={
                  form.notes
                }
                onChange={(
                  event
                ) =>
                  update(
                    "notes",
                    event.target
                      .value
                  )
                }
                className="sm-input min-h-[86px] py-2.5"
              />
            </Field>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2
                size={13}
                className="animate-spin"
              />
            ) : null}

            {editing
              ? "Save Changes"
              : "Create Admission"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ImportModal({
  branch,
  market = "DOMESTIC",
  onClose,
  onImported,
}) {
  const [
    file,
    setFile,
  ] = useState(null);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  async function submit(
    event
  ) {
    event.preventDefault();

    if (!file) {
      setError(
        "Choose a CSV or XLSX file"
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body =
        new FormData();

      body.append(
        "file",
        file
      );

      const data =
        await apiRequest(
          `/api/client/admissions/branches/${branch.id}/import`,
          {
            method:
              "POST",
            body,
          }
        );

      onImported(data);
    } catch (error) {
      setError(
        error?.data
          ?.message ||
          "Unable to import admissions"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title="Import Admissions"
      subtitle={`Import directly into ${branch.name}.`}
      onClose={onClose}
      max="max-w-lg"
    >
      <form
        onSubmit={submit}
        className="space-y-4 p-5"
      >
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <div>
            <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500">Admission Type</div>
            <div className="mt-0.5 text-[13px] font-semibold text-slate-900">
              {market === "INTERNATIONAL" ? "International" : "Domestic"}
            </div>
          </div>
          <div className="text-[13px] text-slate-500">Selected from Admissions sidebar</div>
        </div>

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
            {error}
          </div>
        ) : null}

        <label className="flex min-h-[150px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 hover:border-slate-400">
          <input
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={(
              event
            ) =>
              setFile(
                event.target
                  .files?.[0] ||
                  null
              )
            }
          />

          <div className="text-center">
            <Upload
              size={24}
              className="mx-auto text-slate-500"
            />

            <div className="mt-2 text-[15px] font-bold text-slate-800">
              {file
                ? file.name
                : "Choose CSV or XLSX"}
            </div>

            <div className="mt-1 text-[13px] leading-5 text-slate-500">
              Name is required. You can also import University Name, Student Location,
              Student Inter College, Incentive Amount, Received Amount, Buffer Status
              and Amount Status. The selected branch is used automatically.
            </div>
          </div>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-4 text-[13px] font-semibold text-slate-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              !file
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2
                size={13}
                className="animate-spin"
              />
            ) : (
              <Upload
                size={13}
              />
            )}

            {saving
              ? "Importing..."
              : "Import"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}


function AdmissionsManager({
  selectedYear = "all",
  market = "ALL",
  currentUser = null,
  initialDetail = null,
  onInitialDetailApplied,
  onOpenLead,
}) {
  // Admissions Done is always opened in a concrete market from the sidebar.
  // Keeping the market tied directly to the route avoids Domestic/International
  // data carrying over when the user switches between the two sections.
  const activeMarket = market === "INTERNATIONAL" ? "INTERNATIONAL" : "DOMESTIC";
  const canViewAttachments =
    currentUser?.role === "CLIENT_ADMIN" ||
    currentUser?.pageAccess?.admissions?.attachments === true;
  const [streams, setStreams] = useState([]);
  const [partners, setPartners] = useState([]);
  const [branches, setBranches] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [allAdmissions, setAllAdmissions] = useState([]);

  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showAllAdmissions, setShowAllAdmissions] = useState(false);

  // Holds the card/button that opened the current drill-down so DetailPage can
  // return focus to it on Back (accessibility: focus is never dropped to body).
  const detailTriggerRef = useRef(null);

  const [summary, setSummary] = useState({
    totalAdmissions: 0,
    thisMonth: 0,
    totalFees: 0,
    received: 0,
    pending: 0,
  });

  const [allSummary, setAllSummary] = useState({
    totalAdmissions: 0,
    thisMonth: 0,
    totalFees: 0,
    received: 0,
    pending: 0,
  });

  const [loading, setLoading] = useState(true);
  const [allLoading, setAllLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [allSearch, setAllSearch] = useState("");
  const [streamSearch, setStreamSearch] = useState("");
  const [collegeSearch, setCollegeSearch] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [streamModal, setStreamModal] = useState(null);
  const [collegeModal, setCollegeModal] = useState(null);
  const [attachmentsPartner, setAttachmentsPartner] = useState(null);
  const [branchModal, setBranchModal] = useState(null);
  const [admissionModal, setAdmissionModal] = useState(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    // When moving between Domestic and International Admissions Done, always
    // start from the full Stream -> College -> Branch overview for that market.
    setSelectedStream(null);
    setSelectedPartner(null);
    setSelectedBranch(null);
    setShowAllAdmissions(false);
    setSearch("");
    setAllSearch("");
    setStreamSearch("");
    setCollegeSearch("");
    setDateFilter("all");

    // Do not carry success/error feedback from one admissions market to another.
    setSuccess("");
    setError("");
  }, [activeMarket]);

  useEffect(() => {
    if (!success) return undefined;

    const timer = window.setTimeout(() => {
      setSuccess("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [success]);

  const STREAM_GRADIENTS = {
    
  blue: {
    primary: "bg-gradient-to-br from-blue-600 to-indigo-700",
    secondary: "bg-gradient-to-br from-blue-600 to-indigo-700",
  },

  orange: {
    primary: "bg-gradient-to-br from-orange-500 to-amber-600",
    secondary: "bg-gradient-to-br from-orange-500 to-amber-600",
  },

  purple: {
    primary: "bg-gradient-to-br from-violet-600 to-purple-700",
    secondary: "bg-gradient-to-br from-violet-600 to-purple-700",
  },

  green: {
    primary: "bg-gradient-to-br from-emerald-600 to-teal-700",
    secondary: "bg-gradient-to-br from-emerald-600 to-teal-700",
  },

  rose: {
    primary: "bg-gradient-to-br from-rose-600 to-pink-700",
    secondary: "bg-gradient-to-br from-rose-600 to-pink-700",
  },
    slate: {
      primary: "bg-gradient-to-br from-[#334155] to-[#0f172a]",
      secondary: "bg-gradient-to-br from-[#334155] to-[#0f172a]",
    },
    sky: {
      primary: "bg-gradient-to-br from-[#0ea5e9] to-[#1d4ed8]",
      secondary: "bg-gradient-to-br from-[#0ea5e9] to-[#1d4ed8]",
    },
    cyan: {
      primary: "bg-gradient-to-br from-[#06b6d4] to-[#0f766e]",
      secondary: "bg-gradient-to-br from-[#06b6d4] to-[#0f766e]",
    },
    teal: {
      primary: "bg-gradient-to-br from-[#14b8a6] to-[#047857]",
      secondary: "bg-gradient-to-br from-[#14b8a6] to-[#047857]",
    },
    lime: {
      primary: "bg-gradient-to-br from-[#84cc16] to-[#15803d]",
      secondary: "bg-gradient-to-br from-[#84cc16] to-[#15803d]",
    },
    yellow: {
      primary: "bg-gradient-to-br from-[#facc15] to-[#ea580c]",
      secondary: "bg-gradient-to-br from-[#facc15] to-[#ea580c]",
    },
    amber: {
      primary: "bg-gradient-to-br from-[#f59e0b] to-[#a16207]",
      secondary: "bg-gradient-to-br from-[#f59e0b] to-[#a16207]",
    },
    red: {
      primary: "bg-gradient-to-br from-[#ef4444] to-[#be123c]",
      secondary: "bg-gradient-to-br from-[#ef4444] to-[#be123c]",
    },
    pink: {
      primary: "bg-gradient-to-br from-[#ec4899] to-[#be123c]",
      secondary: "bg-gradient-to-br from-[#ec4899] to-[#be123c]",
    },
    fuchsia: {
      primary: "bg-gradient-to-br from-[#c026d3] to-[#be185d]",
      secondary: "bg-gradient-to-br from-[#c026d3] to-[#be185d]",
    },
    indigo: {
      primary: "bg-gradient-to-br from-[#4f46e5] to-[#1e40af]",
      secondary: "bg-gradient-to-br from-[#4f46e5] to-[#1e40af]",
    },
    navy: {
      primary: "bg-gradient-to-br from-[#1e3a8a] to-[#020617]",
      secondary: "bg-gradient-to-br from-[#1e3a8a] to-[#020617]",
    },
    black: {
      primary: "bg-gradient-to-br from-[#27272a] to-[#000000]",
      secondary: "bg-gradient-to-br from-[#27272a] to-[#000000]",
    },
    emerald: {
      primary: "bg-gradient-to-br from-[#10b981] to-[#047857]",
      secondary: "bg-gradient-to-br from-[#10b981] to-[#047857]",
    },
  };

  // Clean-card accents (light theme): a bright shade for the DECORATIVE dot only,
  // and a -700 shade wherever the colour is used as TEXT or as a hover fill behind
  // white text, so every stream colour clears WCAG AA 4.5:1 (per a11y review).
  // Literal class strings so Tailwind JIT picks them up.
  const STREAM_ACCENTS = {
    blue:    { tile: "border-[#dbeafe] bg-[#eff6ff] text-[#1d4ed8]", text: "text-[#1d4ed8]", dot: "bg-[#2563eb]", open: "border-[#dbeafe] bg-[#eff6ff] text-[#1d4ed8] hover:bg-[#1d4ed8] hover:text-white hover:border-[#1d4ed8]" },
    orange:  { tile: "border-[#ffedd5] bg-[#fff7ed] text-[#c2410c]", text: "text-[#c2410c]", dot: "bg-[#ea580c]", open: "border-[#ffedd5] bg-[#fff7ed] text-[#c2410c] hover:bg-[#c2410c] hover:text-white hover:border-[#c2410c]" },
    purple:  { tile: "border-[#ede9fe] bg-[#f5f3ff] text-[#6d28d9]", text: "text-[#6d28d9]", dot: "bg-[#7c3aed]", open: "border-[#ede9fe] bg-[#f5f3ff] text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white hover:border-[#6d28d9]" },
    green:   { tile: "border-[#d1fae5] bg-[#ecfdf5] text-[#047857]", text: "text-[#047857]", dot: "bg-[#059669]", open: "border-[#d1fae5] bg-[#ecfdf5] text-[#047857] hover:bg-[#047857] hover:text-white hover:border-[#047857]" },
    rose:    { tile: "border-[#ffe4e6] bg-[#fff1f2] text-[#be123c]", text: "text-[#be123c]", dot: "bg-[#e11d48]", open: "border-[#ffe4e6] bg-[#fff1f2] text-[#be123c] hover:bg-[#be123c] hover:text-white hover:border-[#be123c]" },
    slate:   { tile: "border-[#e2e8f0] bg-[#f8fafc] text-[#334155]", text: "text-[#334155]", dot: "bg-[#475569]", open: "border-[#e2e8f0] bg-[#f8fafc] text-[#334155] hover:bg-[#334155] hover:text-white hover:border-[#334155]" },
    sky:     { tile: "border-[#e0f2fe] bg-[#f0f9ff] text-[#0369a1]", text: "text-[#0369a1]", dot: "bg-[#0284c7]", open: "border-[#e0f2fe] bg-[#f0f9ff] text-[#0369a1] hover:bg-[#0369a1] hover:text-white hover:border-[#0369a1]" },
    cyan:    { tile: "border-[#cffafe] bg-[#ecfeff] text-[#0e7490]", text: "text-[#0e7490]", dot: "bg-[#0891b2]", open: "border-[#cffafe] bg-[#ecfeff] text-[#0e7490] hover:bg-[#0e7490] hover:text-white hover:border-[#0e7490]" },
    teal:    { tile: "border-[#ccfbf1] bg-[#f0fdfa] text-[#0f766e]", text: "text-[#0f766e]", dot: "bg-[#0d9488]", open: "border-[#ccfbf1] bg-[#f0fdfa] text-[#0f766e] hover:bg-[#0f766e] hover:text-white hover:border-[#0f766e]" },
    lime:    { tile: "border-[#ecfccb] bg-[#f7fee7] text-[#4d7c0f]", text: "text-[#4d7c0f]", dot: "bg-[#65a30d]", open: "border-[#ecfccb] bg-[#f7fee7] text-[#4d7c0f] hover:bg-[#4d7c0f] hover:text-white hover:border-[#4d7c0f]" },
    yellow:  { tile: "border-[#fef9c3] bg-[#fefce8] text-[#a16207]", text: "text-[#a16207]", dot: "bg-[#ca8a04]", open: "border-[#fef9c3] bg-[#fefce8] text-[#a16207] hover:bg-[#a16207] hover:text-white hover:border-[#a16207]" },
    amber:   { tile: "border-[#fef3c7] bg-[#fffbeb] text-[#b45309]", text: "text-[#b45309]", dot: "bg-[#d97706]", open: "border-[#fef3c7] bg-[#fffbeb] text-[#b45309] hover:bg-[#b45309] hover:text-white hover:border-[#b45309]" },
    red:     { tile: "border-[#fee2e2] bg-[#fef2f2] text-[#b91c1c]", text: "text-[#b91c1c]", dot: "bg-[#dc2626]", open: "border-[#fee2e2] bg-[#fef2f2] text-[#b91c1c] hover:bg-[#b91c1c] hover:text-white hover:border-[#b91c1c]" },
    pink:    { tile: "border-[#fce7f3] bg-[#fdf2f8] text-[#be185d]", text: "text-[#be185d]", dot: "bg-[#db2777]", open: "border-[#fce7f3] bg-[#fdf2f8] text-[#be185d] hover:bg-[#be185d] hover:text-white hover:border-[#be185d]" },
    fuchsia: { tile: "border-[#fae8ff] bg-[#fdf4ff] text-[#a21caf]", text: "text-[#a21caf]", dot: "bg-[#c026d3]", open: "border-[#fae8ff] bg-[#fdf4ff] text-[#a21caf] hover:bg-[#a21caf] hover:text-white hover:border-[#a21caf]" },
    indigo:  { tile: "border-[#e0e7ff] bg-[#eef2ff] text-[#4338ca]", text: "text-[#4338ca]", dot: "bg-[#4f46e5]", open: "border-[#e0e7ff] bg-[#eef2ff] text-[#4338ca] hover:bg-[#4338ca] hover:text-white hover:border-[#4338ca]" },
    navy:    { tile: "border-[#dbeafe] bg-[#eff6ff] text-[#1e3a8a]", text: "text-[#1e3a8a]", dot: "bg-[#1e3a8a]", open: "border-[#dbeafe] bg-[#eff6ff] text-[#1e3a8a] hover:bg-[#1e3a8a] hover:text-white hover:border-[#1e3a8a]" },
    black:   { tile: "border-[#e4e4e7] bg-[#fafafa] text-[#27272a]", text: "text-[#27272a]", dot: "bg-[#27272a]", open: "border-[#e4e4e7] bg-[#fafafa] text-[#27272a] hover:bg-[#27272a] hover:text-white hover:border-[#27272a]" },
    emerald: { tile: "border-[#d1fae5] bg-[#ecfdf5] text-[#047857]", text: "text-[#047857]", dot: "bg-[#059669]", open: "border-[#d1fae5] bg-[#ecfdf5] text-[#047857] hover:bg-[#047857] hover:text-white hover:border-[#047857]" },
  };

  function accentForColor(color) {
    return STREAM_ACCENTS[color] || STREAM_ACCENTS.blue;
  }

  function gradientForColor(
    color = "blue",
    variant = 0
  ) {
    const group =
      STREAM_GRADIENTS[color] ||
      STREAM_GRADIENTS.blue;

    return {
      bg:
        variant % 2 === 0
          ? group.primary
          : group.secondary,
      soft: "bg-white/20",
      button:
        "bg-white/20 hover:bg-white/30 text-white",
    };
  }

  async function loadStreams() {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/admissions/streams?year=${encodeURIComponent(selectedYear)}${activeMarket !== "ALL" ? `&market=${activeMarket}` : ""}`
      );

      const rows = data.streams || [];
      setStreams(rows);

      if (selectedStream) {
        const refreshed = rows.find(
          (item) => item.id === selectedStream.id
        );
        if (refreshed) {
          setSelectedStream(refreshed);
        }
      }
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load admission streams"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadPartners(streamId = selectedStream?.id) {
    if (!streamId) return;

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/admissions/partners?streamId=${encodeURIComponent(
          streamId
        )}&year=${encodeURIComponent(selectedYear)}${activeMarket !== "ALL" ? `&market=${activeMarket}` : ""}`
      );

      const rows = data.partners || [];
      setPartners(rows);

      if (selectedPartner) {
        const refreshed = rows.find(
          (item) => item.id === selectedPartner.id
        );
        if (refreshed) {
          setSelectedPartner(refreshed);
        }
      }
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load colleges"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadBranches(partnerId = selectedPartner?.id) {
    if (!partnerId) return;

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/admissions/branches?partnerId=${encodeURIComponent(
          partnerId
        )}&year=${encodeURIComponent(selectedYear)}${activeMarket !== "ALL" ? `&market=${activeMarket}` : ""}`
      );

      const rows = data.branches || [];
      setBranches(rows);

      if (selectedBranch) {
        const refreshed = rows.find(
          (item) => item.id === selectedBranch.id
        );
        if (refreshed) {
          setSelectedBranch(refreshed);
        }
      }
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load branches"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAdmissions(branchId = selectedBranch?.id) {
    if (!branchId) return;

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/admissions?branchId=${encodeURIComponent(
          branchId
        )}&year=${encodeURIComponent(selectedYear)}${activeMarket !== "ALL" ? `&market=${activeMarket}` : ""}`
      );

      setAdmissions(data.admissions || []);
      setSummary(
        data.summary || {
          totalAdmissions: 0,
          thisMonth: 0,
          totalFees: 0,
          received: 0,
          pending: 0,
        }
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load admissions"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadAllAdmissions() {
    setAllLoading(true);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/admissions?year=${encodeURIComponent(
          selectedYear
        )}${activeMarket !== "ALL" ? `&market=${activeMarket}` : ""}`
      );

      setAllAdmissions(data.admissions || []);
      setAllSummary(
        data.summary || {
          totalAdmissions: 0,
          thisMonth: 0,
          totalFees: 0,
          received: 0,
          pending: 0,
        }
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load all admissions"
      );
    } finally {
      setAllLoading(false);
    }
  }

  useEffect(() => {
    loadStreams();
  }, [selectedYear, activeMarket]);

  useEffect(() => {
    setCollegeSearch("");
    if (selectedStream?.id) {
      loadPartners(selectedStream.id);
    }
  }, [selectedStream?.id, selectedYear]);

  useEffect(() => {
    if (selectedPartner?.id) {
      loadBranches(selectedPartner.id);
    }
  }, [selectedPartner?.id, selectedYear]);

  useEffect(() => {
    if (selectedBranch?.id) {
      loadAdmissions(selectedBranch.id);
    }
  }, [selectedBranch?.id, selectedYear]);

  useEffect(() => {
    if (showAllAdmissions) {
      loadAllAdmissions();
    }
  }, [showAllAdmissions, selectedYear, activeMarket]);

  // Cross-module entry: the Dashboard "Admissions" KPI opens the All Admissions
  // page directly by passing initialDetail="all".
  useEffect(() => {
    if (initialDetail === "all") {
      setShowAllAdmissions(true);
      onInitialDetailApplied?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDetail]);

  const overall = useMemo(() => {
    return streams.reduce(
      (acc, stream) => ({
        streams: acc.streams + 1,
        colleges:
          acc.colleges + Number(stream.totalColleges || 0),
        branches:
          acc.branches + Number(stream.totalBranches || 0),
        admissions:
          acc.admissions + Number(stream.totalAdmissions || 0),
      }),
      {
        streams: 0,
        colleges: 0,
        branches: 0,
        admissions: 0,
      }
    );
  }, [streams]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const base = !query
      ? [...admissions]
      : admissions.filter((admission) =>
          [
            admission.name,
            admission.phone,
            admission.email,
            admission.universityName,
            admission.studentLocation,
            admission.studentInterCollege,
            admission.counsellor,
            admission.bufferStatus,
            admission.amountStatus,
            admission.status,
            admission.branch?.name,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query)
            )
        );

    return base.sort((a, b) => {
      if (sortBy === "name-asc") {
        return String(a.name || "").localeCompare(
          String(b.name || "")
        );
      }

      if (sortBy === "received-desc") {
        return Number(b.paid || 0) - Number(a.paid || 0);
      }

      if (sortBy === "pending-desc") {
        return Number(b.pending || 0) - Number(a.pending || 0);
      }

      return (
        new Date(b.admissionDate || 0) -
        new Date(a.admissionDate || 0)
      );
    });
  }, [admissions, search, sortBy]);

  const filteredAllAdmissions = useMemo(() => {
    const query = allSearch.trim().toLowerCase();
    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(
      startOfToday.getDate() -
        ((startOfToday.getDay() + 6) % 7)
    );

    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const startOfYear = new Date(
      now.getFullYear(),
      0,
      1
    );

    return allAdmissions
      .filter((item) => {
        if (!query) return true;

        return [
          item.name,
          item.phone,
          item.email,
          item.universityName,
          item.studentLocation,
          item.studentInterCollege,
          item.bufferStatus,
          item.amountStatus,
          item.partner?.stream?.name,
          item.college,
          item.branch?.name,
          item.course,
          item.counsellor,
          item.status,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );
      })
      .filter((item) => {
        if (dateFilter === "all") return true;

        const date = new Date(item.admissionDate);
        if (Number.isNaN(date.getTime())) return false;

        if (dateFilter === "today") {
          return date >= startOfToday;
        }

        if (dateFilter === "week") {
          return date >= startOfWeek;
        }

        if (dateFilter === "month") {
          return date >= startOfMonth;
        }

        if (dateFilter === "year") {
          return date >= startOfYear;
        }

        if (dateFilter === "custom") {
          const start =
            customStartDate
              ? new Date(
                  `${customStartDate}T00:00:00`
                )
              : null;

          const end =
            customEndDate
              ? new Date(
                  `${customEndDate}T23:59:59`
                )
              : null;

          if (
            start &&
            date < start
          ) {
            return false;
          }

          if (
            end &&
            date > end
          ) {
            return false;
          }

          return true;
        }

        return true;
      });
  }, [
    allAdmissions,
    allSearch,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  const filteredAllSummary =
    useMemo(() => {
      const now = new Date();
      const monthStart =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1
        );

      const active =
        filteredAllAdmissions.filter(
          (item) =>
            item.statusKey !==
            "CANCELLED"
        );

      return {
        totalAdmissions:
          filteredAllAdmissions.length,
        thisMonth:
          filteredAllAdmissions.filter(
            (item) =>
              new Date(
                item.admissionDate
              ) >= monthStart
          ).length,
        received:
          active.reduce(
            (sum, item) =>
              sum +
              Number(
                item.paid || 0
              ),
            0
          ),
        pending:
          active.reduce(
            (sum, item) =>
              sum +
              Number(
                item.pending || 0
              ),
            0
          ),
      };
    }, [
      filteredAllAdmissions,
    ]);

  async function deleteStream(stream) {
    if (!window.confirm(`Remove ${stream.name}?`)) return;

    try {
      await apiRequest(
        `/api/client/admissions/streams/${stream.id}`,
        { method: "DELETE" }
      );

      setSuccess("Stream removed");
      await loadStreams();
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to remove stream"
      );
    }
  }

  async function deletePartner(partner) {
    if (!window.confirm(`Remove ${partner.name}?`)) return;

    try {
      await apiRequest(
        `/api/client/admissions/partners/${partner.id}`,
        { method: "DELETE" }
      );

      setSuccess("College removed");

      await Promise.all([
        loadPartners(selectedStream.id),
        loadStreams(),
      ]);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to remove college"
      );
    }
  }

  async function deleteBranch(branch) {
    if (!window.confirm(`Remove ${branch.name}?`)) return;

    try {
      await apiRequest(
        `/api/client/admissions/branches/${branch.id}`,
        { method: "DELETE" }
      );

      setSuccess("Branch removed");

      await Promise.all([
        loadBranches(selectedPartner.id),
        loadPartners(selectedStream.id),
        loadStreams(),
      ]);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to remove branch"
      );
    }
  }

  async function deleteAdmission(admission) {
    if (
      !window.confirm(
        `Delete admission for ${admission.name}?`
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/api/client/admissions/${admission.id}`,
        { method: "DELETE" }
      );

      setSuccess("Admission deleted");

      await Promise.all([
        loadAdmissions(selectedBranch?.id),
        loadAllAdmissions(),
        loadBranches(selectedPartner?.id),
        loadPartners(selectedStream?.id),
        loadStreams(),
      ]);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to delete admission"
      );
    }
  }

  function exportAdmissions(rows, filename) {
    const headers = [
      "Student Name",
      "Contact Number",
      "Email",
      "University Name",
      "Student Location",
      "Student Inter College",
      "Stream",
      "College",
      "Branch",
      "Incentive Amount",
      "Received Amount",
      "Pending Amount",
      "Date of Admission",
      "Counsellor",
      "Buffer Status",
      "Amount Status",
      "Admission Status",
    ];

    const escape = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const lines = [
      headers.map(escape).join(","),
      ...rows.map((admission) =>
        [
          admission.name,
          admission.phone,
          admission.email,
          admission.universityName,
          admission.studentLocation,
          admission.studentInterCollege,
          admission.partner?.stream?.name ||
            selectedStream?.name,
          admission.college ||
            admission.partner?.name ||
            selectedPartner?.name,
          admission.branch?.name ||
            admission.course ||
            selectedBranch?.name,
          admission.incentiveAmount ?? admission.total,
          admission.receivedAmount ?? admission.paid,
          admission.pendingAmount ?? admission.pending,
          admission.admissionDate,
          admission.counsellor,
          admission.bufferStatus,
          admission.amountStatus,
          admission.status,
        ]
          .map(escape)
          .join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
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

  const sharedStyle = (
    <style>{`
      .sm-input{
        width:100%;
        height:40px;
        padding:0 12px;
        border:1px solid rgb(226 232 240);
        border-radius:10px;
        font-size:14px;
        background:white;
        color:rgb(15 23 42);
        outline:none;
      }
      .sm-input:focus{
        border-color:rgb(148 163 184);
        box-shadow:0 0 0 3px rgb(241 245 249);
      }
    `}</style>
  );

  function PageMessage() {
    return (
      <>
        {success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[15px] font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[15px] font-medium text-rose-700">
            {error}
          </div>
        ) : null}
      </>
    );
  }

  function OverviewStrip() {
    const visibleStreams = streams;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div
          className="flex gap-2.5 overflow-x-auto scroll-pl-[160px]"
          role="group"
          aria-label="Admissions by stream"
        >
          <button
            type="button"
            onClick={() => {
              detailTriggerRef.current = document.activeElement;
              setShowAllAdmissions(true);
            }}
            className="sticky left-0 z-10 flex w-[150px] flex-shrink-0 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[6px_0_10px_-6px_rgba(15,23,42,0.18)] transition hover:border-slate-300 hover:shadow-[6px_0_12px_-6px_rgba(15,23,42,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-600" aria-hidden="true" />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-500">
                Total Admissions
              </span>
            </span>

            <span className="text-[22px] font-bold leading-none tracking-[-0.02em] text-slate-950 [font-variant-numeric:tabular-nums]">
              {overall.admissions}
            </span>

            <span className="text-[11px] text-slate-500">Across all streams</span>
          </button>

          {visibleStreams.map((stream) => {
            const acc = accentForColor(
              stream.color || recommendedStreamColor(stream.name)
            );

            return (
              <button
                type="button"
                key={stream.id}
                onClick={() => {
                  detailTriggerRef.current = document.activeElement;
                  setSelectedStream(stream);
                }}
                className="flex w-[150px] flex-shrink-0 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
              >
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${acc.dot}`} aria-hidden="true" />
                  <span className="truncate text-[10.5px] font-bold uppercase tracking-[0.05em] text-slate-500">
                    {stream.name}
                  </span>
                </span>

                <span className="text-[22px] font-bold leading-none tracking-[-0.02em] text-slate-950 [font-variant-numeric:tabular-nums]">
                  {stream.totalAdmissions || 0}
                </span>

                <span className="text-[11px] text-slate-500">
                  {stream.totalColleges || 0} colleges
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function GradientCard({
    title,
    subtitle,
    description,
    icon: Icon,
    index,
    color = "blue",
    onOpen,
    openLabel,
    onEdit,
    onDelete,
    onAttachments,
    attachmentCount = 0,
    extra,
  }) {
    const gradient =
      gradientForColor(
        color,
        index
      );

    return (
      <div
        className={`group relative rounded-3xl p-6 text-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl ${gradient.bg}`}
      >
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gradient.soft}`}>
              <Icon size={20} />
            </div>

            <div className="flex gap-2">
              {onAttachments ? (
                <button
                  type="button"
                  onClick={onAttachments}
                  title={`Attachments${attachmentCount ? ` (${attachmentCount})` : ""}`}
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
                >
                  <Paperclip size={13} />
                  {attachmentCount > 0 ? (
                    <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-white px-1 text-center text-[9px] font-black leading-4 text-slate-800">
                      {attachmentCount > 99 ? "99+" : attachmentCount}
                    </span>
                  ) : null}
                </button>
              ) : null}

              {onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
                >
                  <Pencil size={13} />
                </button>
              ) : null}

              {onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white hover:bg-white/30"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-2xl font-bold">
              {title}
            </div>

            <div className="mt-1 text-[13px] font-semibold text-white/90">
              {subtitle}
            </div>

            {description ? (
              <div className="mt-1.5 min-h-[30px] text-[12px] leading-5 text-white/72">
                {description}
              </div>
            ) : (
              <div className="min-h-[30px]" />
            )}
          </div>

          {extra ? (
            <div className="mt-3">
              {extra}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onOpen}
            className={`mt-4 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-bold ${gradient.button}`}
          >
            {openLabel}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  function AllAdmissionsView() {
    return (
      <DetailModal
        open={showAllAdmissions}
        title="All Admissions"
        subtitle="View every admission across streams, colleges and branches."
        onClose={() => setShowAllAdmissions(false)}
      >
      <div className="space-y-5">
        {sharedStyle}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
          <button
            type="button"
            onClick={() =>
              exportAdmissions(
                filteredAllAdmissions,
                "all-admissions.csv"
              )
            }
            disabled={!filteredAllAdmissions.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-[13px] font-bold text-white disabled:opacity-50"
          >
            <Download size={14} />
            Export Admissions
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 native:grid-cols-2">
          <Stat
            label="Total Admissions"
            value={filteredAllSummary.totalAdmissions}
            detail="Selected period"
          />

          <Stat
            label="This Month"
            value={filteredAllSummary.thisMonth}
            detail="New admissions"
          />

          <Stat
            label="Received Amount"
            value={money(filteredAllSummary.received)}
            detail="Amount received"
          />

          <Stat
            label="Pending Amount"
            value={money(filteredAllSummary.pending)}
            detail="Pending amount"
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                aria-label="Search students"
                value={allSearch}
                onChange={(event) =>
                  setAllSearch(event.target.value)
                }
                placeholder="Search student, stream, college, branch, counsellor..."
                className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[14px] outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex flex-wrap gap-2 native:flex-nowrap native:overflow-x-auto native:pb-1">
              {[
                ["all", "All"],
                ["today", "Today"],
                ["week", "This Week"],
                ["month", "This Month"],
                ["year", "This Year"],
                ["custom", "Custom Range"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={dateFilter === key}
                  onClick={() => setDateFilter(key)}
                  className={`h-9 rounded-xl px-3 text-[13px] font-bold native:shrink-0 native:whitespace-nowrap native:focus-visible:outline-none native:focus-visible:ring-2 native:focus-visible:ring-indigo-500 native:focus-visible:ring-offset-1 ${
                    dateFilter === key
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {dateFilter === "custom" ? (
            <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:max-w-xl">
              <label>
                <div className="mb-1.5 text-xs font-semibold text-slate-500">
                  From Date
                </div>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(event) =>
                    setCustomStartDate(
                      event.target.value
                    )
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[15px] text-slate-700 outline-none focus:border-slate-400"
                />
              </label>

              <label>
                <div className="mb-1.5 text-xs font-semibold text-slate-500">
                  To Date
                </div>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(event) =>
                    setCustomEndDate(
                      event.target.value
                    )
                  }
                  min={customStartDate || undefined}
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[15px] text-slate-700 outline-none focus:border-slate-400"
                />
              </label>
            </div>
          ) : null}
        </div>

        <PageMessage />

        {allLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-[15px] text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading all admissions...
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Table
              columns={[
                "S.No",
                "Lead ID",
                "Student Name",
                "Contact Number",
                "University Name",
                "Branch",
                "Incentive Amount",
                "Received Amount",
                "Pending Amount",
                "Date of Admission",
                "Counsellor",
                "Buffer Status",
                "Amount Status",
                "Actions",
              ]}
              empty="No admissions found"
              rows={filteredAllAdmissions.map((admission, index) => (
                <tr
                  key={admission.id}
                  className="hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3 text-[13px] font-semibold text-slate-500">
                    {index + 1}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <LeadIdBadge admission={admission} onOpenLead={onOpenLead} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="whitespace-nowrap text-[13px] font-semibold text-slate-900">
                      {admission.name}
                    </div>
                    {(admission.studentLocation ||
                      admission.studentInterCollege) ? (
                      <div
                        className="mt-0.5 max-w-[220px] truncate text-[12px] text-slate-400"
                        title={[
                          admission.studentLocation,
                          admission.studentInterCollege,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      >
                        {[
                          admission.studentLocation,
                          admission.studentInterCollege,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    ) : null}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-700">
                    {admission.phone || "—"}
                  </td>

                  <td
                    className="max-w-[220px] truncate whitespace-nowrap px-4 py-3 text-[13px] text-slate-700"
                    title={admission.universityName || ""}
                  >
                    {admission.universityName || "—"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-slate-700">
                    {admission.branch?.name ||
                      admission.course ||
                      "—"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-slate-800">
                    {money(
                      admission.incentiveAmount ??
                        admission.total
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-emerald-700">
                    {money(
                      admission.receivedAmount ??
                        admission.paid
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-amber-700">
                    {money(
                      admission.pendingAmount ??
                        admission.pending
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-500">
                    {formatDate(admission.admissionDate)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-700">
                    {admission.counsellor}
                  </td>

                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        admission.revenueStatus === "IN_BUCKET"
                          ? "emerald"
                          : "amber"
                      }
                    >
                      {admission.bufferStatus || "Buffer Zone"}
                    </Badge>
                  </td>

                  <td className="px-4 py-3">
                    {admission.revenueStatus === "BUFFER_ZONE" ? (
                      <span className="text-[13px] text-slate-400">
                        —
                      </span>
                    ) : (
                      <Badge
                        tone={
                          admission.amountStatusKey === "RECEIVED"
                            ? "emerald"
                            : "amber"
                        }
                      >
                        {admission.amountStatus || "Pending"}
                      </Badge>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {admission.partner && admission.branch ? (
                        <button
                          type="button"
                          onClick={() =>
                            setAdmissionModal({
                              mode: "edit",
                              admission,
                            })
                          }
                          title="Edit admission"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600"
                        >
                          <Pencil size={13} />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => deleteAdmission(admission)}
                        title="Delete admission"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            />
          </div>
        )}

        {admissionModal?.mode === "edit" &&
        admissionModal.admission?.partner &&
        admissionModal.admission?.branch ? (
          <AdmissionModal
            market={
              admissionModal.admission.market ||
              (activeMarket === "ALL" ? "DOMESTIC" : activeMarket)
            }
            partner={admissionModal.admission.partner}
            branch={admissionModal.admission.branch}
            admission={admissionModal.admission}
            onClose={() => setAdmissionModal(null)}
            onSaved={async () => {
              setAdmissionModal(null);
              setSuccess("Admission saved successfully");

              await Promise.all([
                loadAllAdmissions(),
                loadStreams(),
              ]);
            }}
          />
        ) : null}
      </div>
      </DetailModal>
    );
  }

  return (
      <div className={`space-y-5 ${selectedStream ? "admissions-drilldown-active" : ""}`}>
        <style>{`
          .admissions-drilldown-active > :not(.admissions-drilldown-page) {
            display: none !important;
          }
        `}</style>
        {sharedStyle}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-900">
                Admissions Overview
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Overall admissions and stream-level counts.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  detailTriggerRef.current = document.activeElement;
                  setShowAllAdmissions(true);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <UserCheck size={14} aria-hidden="true" />
                View All Admissions
              </button>

              <button
                type="button"
                onClick={() =>
                  setStreamModal({ mode: "create" })
                }
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus size={14} aria-hidden="true" />
                Add Stream
              </button>
            </div>
          </div>
          <OverviewStrip />
        </section>

        <PageMessage />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-900">
              Stream-wise Breakdown
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Open a stream to view its colleges, branches and admissions.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={streamSearch}
              onChange={(event) => setStreamSearch(event.target.value)}
              aria-label="Search streams"
              placeholder="Search streams…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-20 text-[15px] text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading streams...
          </div>
        ) : (
          <div className="w-full overflow-x-auto native:[-webkit-overflow-scrolling:touch] native:overscroll-x-contain">
          <Table
            caption="Streams — admissions, colleges and branches; open a stream to drill in"
            empty="No streams yet. Add a stream to begin."
            columns={[
              "Stream",
              "Admissions",
              "Colleges",
              "Branches",
              "Description",
              "Actions",
            ]}
            rows={streams
              .filter(
                (s) =>
                  !streamSearch.trim() ||
                  String(s.name || "")
                    .toLowerCase()
                    .includes(streamSearch.trim().toLowerCase())
              )
              .map((stream) => {
              const Icon = streamIcon(stream.name);
              const acc = accentForColor(
                stream.color || recommendedStreamColor(stream.name)
              );

              const openStream = () => {
                detailTriggerRef.current = document.activeElement;
                setSelectedStream(stream);
                setSelectedPartner(null);
                setSelectedBranch(null);
              };

              return (
                <tr
                  key={stream.id}
                  onClick={() => {
                    // Mouse convenience: clicking anywhere on the row opens the
                    // stream. Ignore it when the user was selecting text.
                    if (window.getSelection && String(window.getSelection())) return;
                    openStream();
                  }}
                  className="cursor-pointer hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${acc.tile}`}>
                        <Icon size={15} aria-hidden="true" focusable="false" />
                      </span>
                      <span className="text-[13px] font-semibold text-slate-900">
                        {stream.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-slate-900">
                    {stream.totalAdmissions || 0}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-slate-700">
                    {stream.totalColleges || 0}
                  </td>
                  <td className="px-4 py-3 text-[13px] tabular-nums text-slate-700">
                    {stream.totalBranches || 0}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-slate-500">
                    <span
                      className="block max-w-[280px] truncate"
                      title={stream.description || undefined}
                    >
                      {stream.description || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        aria-label={`Open ${stream.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openStream();
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 text-[13px] font-bold text-indigo-700 transition hover:border-indigo-600 hover:bg-indigo-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
                      >
                        Open
                        <ChevronRight size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${stream.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setStreamModal({ mode: "edit", stream });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${stream.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteStream(stream);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          />
          </div>
        )}

        {streamModal ? (
          <StreamModal
            market={activeMarket === "ALL" ? "DOMESTIC" : activeMarket}
            editing={
              streamModal.mode === "edit"
                ? streamModal.stream
                : null
            }
            onClose={() => setStreamModal(null)}
            onSaved={async () => {
              setStreamModal(null);
              setSuccess("Stream saved");
              await loadStreams();
            }}
          />
        ) : null}

        {/* Drill-down popups rendered OVER the overview (mutually exclusive) */}
        {showAllAdmissions && !selectedStream && !selectedPartner && !selectedBranch && AllAdmissionsView()}

        {!!selectedStream && !selectedPartner && (
          <DetailModal
            open={!!selectedStream && !selectedPartner}
            title={selectedStream.name}
            subtitle="Choose a college inside this stream."
            onClose={() => setSelectedStream(null)}
            displayMode="page"
          >
      <div className="space-y-5">
        {sharedStyle}

        <Breadcrumbs
          items={[
            {
              label: "Admissions Done",
              onClick: () => setSelectedStream(null),
            },
            { label: selectedStream.name },
          ]}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-72">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={collegeSearch}
              onChange={(event) => setCollegeSearch(event.target.value)}
              aria-label="Search colleges"
              placeholder="Search colleges…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              setCollegeModal({ mode: "create" })
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-[13px] font-bold text-white"
          >
            <Plus size={14} />
            Add College
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 native:grid-cols-2">
          <Stat
            label="Colleges"
            value={selectedStream.totalColleges || 0}
            detail={selectedStream.name}
          />

          <Stat
            label="Branches"
            value={selectedStream.totalBranches || 0}
            detail="Across colleges"
          />

          <Stat
            label="Admissions"
            value={selectedStream.totalAdmissions || 0}
            detail="Selected stream"
          />

          <Stat
            label="Received Amount"
            value={money(selectedStream.received)}
            detail="Received amount"
          />
        </div>

        <PageMessage />

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-[15px] text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading colleges...
          </div>
        ) : (
          <div className="w-full overflow-x-auto native:[-webkit-overflow-scrolling:touch] native:overscroll-x-contain">
          <Table
            caption={`Colleges in ${selectedStream.name} — admissions, branches and received amount`}
            empty={`No colleges yet. Add the first college inside ${selectedStream.name}.`}
            columns={[
              "College",
              "Admissions",
              "Branches",
              "Received Amount",
              "Description",
              "Actions",
            ]}
            rows={partners
              .filter(
                (partner) =>
                  !collegeSearch.trim() ||
                  String(partner.name || "")
                    .toLowerCase()
                    .includes(collegeSearch.trim().toLowerCase())
              )
              .map((partner) => (
              <tr key={partner.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600">
                      <Building2 size={15} aria-hidden="true" />
                    </span>
                    <span className="text-[13px] font-semibold text-slate-900">{partner.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-slate-900">
                  {partner.totalAdmissions || 0}
                </td>
                <td className="px-4 py-3 text-[13px] tabular-nums text-slate-700">
                  {partner.totalBranches || 0}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-slate-900">
                  {money(partner.received)}
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-500">
                  <span className="block max-w-[260px] truncate" title={partner.description || undefined}>
                    {partner.description || "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      aria-label={`Open ${partner.name}`}
                      onClick={() => {
                        detailTriggerRef.current = document.activeElement;
                        setSelectedPartner(partner);
                        setSelectedBranch(null);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[13px] font-bold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      Open
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                    {canViewAttachments ? (
                      <button
                        type="button"
                        aria-label={`Attachments for ${partner.name}${partner.attachmentCount ? ` (${partner.attachmentCount})` : ""}`}
                        onClick={() => setAttachmentsPartner(partner)}
                        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      >
                        <Paperclip size={14} aria-hidden="true" />
                        {partner.attachmentCount > 0 ? (
                          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-indigo-600 px-1 text-center text-[9px] font-black leading-4 text-white">
                            {partner.attachmentCount > 99 ? "99+" : partner.attachmentCount}
                          </span>
                        ) : null}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Edit ${partner.name}`}
                      onClick={() => setCollegeModal({ mode: "edit", partner })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${partner.name}`}
                      onClick={() => deletePartner(partner)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
          </div>
        )}

        {attachmentsPartner ? (
          <CollegeAttachmentsModal
            partner={attachmentsPartner}
            onClose={() => setAttachmentsPartner(null)}
            onChanged={async () => {
              await loadPartners(selectedStream?.id);
            }}
          />
        ) : null}

        {collegeModal ? (
          <CollegeModal
            stream={selectedStream}
            streams={streams}
            editing={
              collegeModal.mode === "edit"
                ? collegeModal.partner
                : null
            }
            onClose={() => setCollegeModal(null)}
            onSaved={async () => {
              setCollegeModal(null);
              setSuccess("College saved");

              await Promise.all([
                loadPartners(selectedStream.id),
                loadStreams(),
              ]);
            }}
          />
        ) : null}
      </div>
          </DetailModal>
        )}

        {!!selectedPartner && !selectedBranch && (
          <DetailModal
            open={!!selectedPartner && !selectedBranch}
            title={selectedPartner.name}
            subtitle="Select a branch such as MBBS, BDS, Pharmacy, CSE or MBA."
            onClose={() => setSelectedPartner(null)}
            displayMode="page"
          >
      <div className="space-y-5">
        {sharedStyle}

        <Breadcrumbs
          items={[
            {
              label: "Admissions Done",
              onClick: () => {
                setSelectedStream(null);
                setSelectedPartner(null);
              },
            },
            {
              label: selectedStream.name,
              onClick: () => setSelectedPartner(null),
            },
            { label: selectedPartner.name },
          ]}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
          <button
            type="button"
            onClick={() =>
              setBranchModal({ mode: "create" })
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-[13px] font-bold text-white"
          >
            <Plus size={14} />
            Add Branch
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 native:grid-cols-2">
          <Stat
            label="Branches"
            value={selectedPartner.totalBranches || branches.length}
            detail={selectedPartner.name}
          />

          <Stat
            label="Admissions"
            value={selectedPartner.totalAdmissions || 0}
            detail="Across branches"
          />

          <Stat
            label="Received Amount"
            value={money(selectedPartner.received)}
            detail="Amount received"
          />

          <Stat
            label="Pending Amount"
            value={money(selectedPartner.pending)}
            detail="Pending amount"
          />
        </div>

        <PageMessage />

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-[15px] text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading branches...
          </div>
        ) : (
          <div className="w-full overflow-x-auto native:[-webkit-overflow-scrolling:touch] native:overscroll-x-contain">
          <Table
            caption={`Branches in ${selectedPartner.name} — admissions, received and pending amount`}
            empty="No branches yet. For Medical, add MBBS, BDS, Pharmacy and Nursing separately."
            columns={[
              "Branch",
              "Admissions",
              "Received Amount",
              "Pending Amount",
              "Description",
              "Actions",
            ]}
            rows={branches.map((branch) => (
              <tr key={branch.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-brand-100 bg-brand-50 text-brand-600">
                      <BookOpen size={15} aria-hidden="true" />
                    </span>
                    <span className="text-[13px] font-semibold text-slate-900">{branch.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-slate-900">
                  {branch.totalAdmissions || 0}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-slate-900">
                  {money(branch.received)}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold tabular-nums text-amber-700">
                  {money(branch.pending)}
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-500">
                  <span
                    className="block max-w-[260px] truncate"
                    title={branch.description || `${selectedPartner.name} · ${selectedStream.name}`}
                  >
                    {branch.description || `${selectedPartner.name} · ${selectedStream.name}`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      aria-label={`Open ${branch.name}`}
                      onClick={() => {
                        detailTriggerRef.current = document.activeElement;
                        setSelectedBranch(branch);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[13px] font-bold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      Open
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Edit ${branch.name}`}
                      onClick={() => setBranchModal({ mode: "edit", branch })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${branch.name}`}
                      onClick={() => deleteBranch(branch)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
          </div>
        )}

        {branchModal ? (
          <BranchModal
            partner={selectedPartner}
            editing={
              branchModal.mode === "edit"
                ? branchModal.branch
                : null
            }
            onClose={() => setBranchModal(null)}
            onSaved={async () => {
              setBranchModal(null);
              setSuccess("Branch saved");

              await Promise.all([
                loadBranches(selectedPartner.id),
                loadPartners(selectedStream.id),
                loadStreams(),
              ]);
            }}
          />
        ) : null}
      </div>
          </DetailModal>
        )}

        {!!selectedBranch && (
          <DetailModal
            open={!!selectedBranch}
            title={selectedBranch.name}
            subtitle={`${selectedStream.name} → ${selectedPartner.name} → ${selectedBranch.name}`}
            onClose={() => setSelectedBranch(null)}
            displayMode="page"
          >
    <div className="space-y-5">
      {sharedStyle}

      <Breadcrumbs
        items={[
          {
            label: "Admissions Done",
            onClick: () => {
              setSelectedStream(null);
              setSelectedPartner(null);
              setSelectedBranch(null);
            },
          },
          {
            label: selectedStream.name,
            onClick: () => {
              setSelectedPartner(null);
              setSelectedBranch(null);
            },
          },
          {
            label: selectedPartner.name,
            onClick: () => setSelectedBranch(null),
          },
          { label: selectedBranch.name },
        ]}
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-end">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50"
          >
            <Upload size={14} />
            Import
          </button>

          <button
            type="button"
            onClick={() =>
              setAdmissionModal({ mode: "create" })
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 text-[13px] font-bold text-white"
          >
            <Plus size={14} />
            New Admission
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Admissions"
          value={summary.totalAdmissions}
          detail={selectedBranch.name}
        />

        <Stat
          label="This Month"
          value={summary.thisMonth}
          detail="New admissions"
        />

        <Stat
          label="Received Amount"
          value={money(summary.received)}
          detail="Amount received"
        />

        <Stat
          label="Pending Amount"
          value={money(summary.pending)}
          detail="Pending amount"
        />
      </div>

      <PageMessage />

      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center">
        <div className="relative max-w-lg flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            aria-label="Search admissions"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={`Search ${selectedBranch.name} admissions...`}
            className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[14px] outline-none focus:border-slate-400"
          />
        </div>

        <div className="flex flex-wrap gap-2 lg:ml-auto">
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value)
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
          >
            <option value="date-desc">Latest first</option>
            <option value="name-asc">Student A-Z</option>
            <option value="received-desc">Highest received</option>
            <option value="pending-desc">Highest pending</option>
          </select>

          <button
            type="button"
            onClick={() =>
              exportAdmissions(
                filtered,
                `${selectedBranch?.slug || "admissions"}-admissions.csv`
              )
            }
            disabled={!filtered.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 disabled:opacity-50"
          >
            <Download size={13} />
            Export
          </button>

          <button
            type="button"
            onClick={() =>
              loadAdmissions(selectedBranch.id)
            }
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700"
          >
            <RefreshCw
              size={13}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-[15px] text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading admissions...
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table
            columns={[
              "S.No",
              "Lead ID",
              "Student Name",
              "Contact Number",
              "University Name",
              "Branch",
              "Incentive Amount",
              "Received Amount",
              "Pending Amount",
              "Date of Admission",
              "Counsellor",
              "Buffer Status",
              "Amount Status",
              "Actions",
            ]}
            empty="No admissions in this branch"
            rows={filtered.map((admission, index) => (
              <tr
                key={admission.id}
                className="hover:bg-slate-50/70"
              >
                <td className="px-4 py-3 text-[13px] font-semibold text-slate-500">
                  {index + 1}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <LeadIdBadge admission={admission} onOpenLead={onOpenLead} />
                </td>

                <td className="px-4 py-3">
                  <div className="whitespace-nowrap text-[13px] font-semibold text-slate-900">
                    {admission.name}
                  </div>
                  {(admission.studentLocation ||
                    admission.studentInterCollege) ? (
                    <div
                      className="mt-0.5 max-w-[220px] truncate text-[12px] text-slate-400"
                      title={[
                        admission.studentLocation,
                        admission.studentInterCollege,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    >
                      {[
                        admission.studentLocation,
                        admission.studentInterCollege,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  ) : null}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-700">
                  {admission.phone || "—"}
                </td>

                <td
                  className="max-w-[220px] truncate whitespace-nowrap px-4 py-3 text-[13px] text-slate-700"
                  title={admission.universityName || ""}
                >
                  {admission.universityName || "—"}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-slate-700">
                  {admission.branch?.name ||
                    admission.course}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-slate-800">
                  {money(
                    admission.incentiveAmount ??
                      admission.total
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-emerald-700">
                  {money(
                    admission.receivedAmount ??
                      admission.paid
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold text-amber-700">
                  {money(
                    admission.pendingAmount ??
                      admission.pending
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-500">
                  {formatDate(admission.admissionDate)}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-700">
                  {admission.counsellor}
                </td>

                <td className="px-4 py-3">
                  <Badge
                    tone={
                      admission.revenueStatus === "IN_BUCKET"
                        ? "emerald"
                        : "amber"
                    }
                  >
                    {admission.bufferStatus || "Buffer Zone"}
                  </Badge>
                </td>

                <td className="px-4 py-3">
                  {admission.revenueStatus === "BUFFER_ZONE" ? (
                    <span className="text-[13px] text-slate-400">
                      —
                    </span>
                  ) : (
                    <Badge
                      tone={
                        admission.amountStatusKey === "RECEIVED"
                          ? "emerald"
                          : "amber"
                      }
                    >
                      {admission.amountStatus || "Pending"}
                    </Badge>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        setAdmissionModal({
                          mode: "edit",
                          admission,
                        })
                      }
                      title="Edit admission"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-indigo-600"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteAdmission(admission)}
                      title="Delete admission"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
        </div>
      )}

      {admissionModal ? (
        <AdmissionModal
          market={activeMarket === "ALL" ? "DOMESTIC" : activeMarket}
          partner={{
            ...selectedPartner,
            stream: selectedStream,
          }}
          branch={selectedBranch}
          admission={
            admissionModal.mode === "edit"
              ? admissionModal.admission
              : null
          }
          onClose={() => setAdmissionModal(null)}
          onSaved={async () => {
            setAdmissionModal(null);
            setSuccess("Admission saved successfully");

            await Promise.all([
              loadAdmissions(selectedBranch.id),
              loadBranches(selectedPartner.id),
              loadPartners(selectedStream.id),
              loadStreams(),
            ]);
          }}
        />
      ) : null}

      {showImport ? (
        <ImportModal
          branch={selectedBranch}
          market={activeMarket === "ALL" ? "DOMESTIC" : activeMarket}
          onClose={() => setShowImport(false)}
          onImported={async (data) => {
            setShowImport(false);

            setSuccess(
              `${data.importSummary.imported} imported · ${data.importSummary.duplicates} duplicates · ${data.importSummary.invalid} invalid skipped`
            );

            await Promise.all([
              loadAdmissions(selectedBranch.id),
              loadBranches(selectedPartner.id),
              loadPartners(selectedStream.id),
              loadStreams(),
            ]);
          }}
        />
      ) : null}
    </div>
          </DetailModal>
        )}
      </div>
  );
}


const ADM_MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Monthly admissions trend — collapsible area/line chart matching the Goals &
// Targets "Monthly attainment" chart (gridlines, Y ticks, gradient fill, hover,
// full Jan–Dec axis). role="img" + aria-label summary; the All Admissions table
// above remains the accessible source of the underlying numbers.
function AdmissionsTrendChart({ rows }) {
  const [open, setOpen] = useState(true);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const uid = useId().replace(/:/g, "");
  const regionId = `adm-trend-${uid}`;
  const gradId = `adm-trend-grad-${uid}`;

  const monthly = useMemo(() => {
    const counts = Array(12).fill(0);
    (rows || []).forEach((admission) => {
      const date = new Date(admission.admissionDate);
      if (!Number.isNaN(date.getTime())) counts[date.getMonth()] += 1;
    });
    return counts.map((value, i) => ({ i, value, label: ADM_MONTH_ABBR[i] }));
  }, [rows]);

  const total = (rows || []).length;
  const W = 760, H = 200, pad = { l: 36, r: 16, t: 14, b: 26 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const peak = Math.max(...monthly.map((m) => m.value), 0);
  const maxY = Math.max(4, Math.ceil(peak / 4) * 4);
  const X = (i) => pad.l + pw * (i / 11);
  const Y = (v) => pad.t + ph * (1 - v / maxY);
  const C = monthly.map((d) => ({ ...d, cx: +X(d.i).toFixed(1), cy: +Y(d.value).toFixed(1) }));
  const ticks = [];
  for (let v = 0; v <= maxY; v += maxY / 4) ticks.push(Math.round(v));
  const baseY = Y(0).toFixed(1);
  const line = "M " + C.map((p) => `${p.cx} ${p.cy}`).join(" L ");
  const area = `M ${C[0].cx} ${baseY} L ` + C.map((p) => `${p.cx} ${p.cy}`).join(" L ") + ` L ${C[C.length - 1].cx} ${baseY} Z`;
  const summary = `Admissions by month for the selected period: ${monthly.map((m) => `${m.label} ${m.value}`).join(", ")}. Total ${total}.`;

  function move(e) {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    let nearest = C[0];
    for (const p of C) if (Math.abs(p.cx - mx) < Math.abs(nearest.cx - mx)) nearest = p;
    setHover({ ...nearest, px: (nearest.cx / W) * r.width, py: (nearest.cy / H) * r.height });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={regionId}
        className="flex w-full items-start justify-between gap-3 px-[18px] py-[15px] text-left"
      >
        <span>
          <span className="block text-[15px] font-semibold tracking-[-0.01em] text-slate-900">Admissions trend</span>
          <span className="mt-0.5 block text-[12px] font-medium text-slate-500">Monthly admissions for the selected period · {total} total</span>
        </span>
        <span className="flex items-center gap-4">
          <span className="hidden gap-4 text-[11.5px] font-semibold text-slate-500 sm:flex">
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-[15px] rounded bg-brand-500" aria-hidden="true" />Admissions</span>
          </span>
          <ChevronDown size={18} aria-hidden="true" className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div id={regionId} className="px-[18px] pb-[18px] pt-0.5">
          <div className="relative">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className="block h-auto w-full overflow-visible"
              role="img"
              aria-label={summary}
              onPointerMove={move}
              onPointerLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="rgb(var(--brand-500))" stopOpacity="0.3" />
                  <stop offset="1" stopColor="rgb(var(--brand-500))" stopOpacity="0" />
                </linearGradient>
              </defs>
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={pad.l} y1={Y(v)} x2={W - pad.r} y2={Y(v)} className="stroke-slate-100" strokeWidth="1" />
                  <text x={pad.l - 8} y={Y(v) + 3} textAnchor="end" className="fill-slate-400" fontSize="8.5" fontWeight="600">{v}</text>
                </g>
              ))}
              <path d={area} fill={`url(#${gradId})`} />
              <path d={line} fill="none" stroke="rgb(var(--brand-600))" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
              {C.map((p) => (
                <circle key={p.i} cx={p.cx} cy={p.cy} r="3.4" fill="#ffffff" stroke="rgb(var(--brand-600))" strokeWidth="2.2" />
              ))}
              {hover && (
                <>
                  <line x1={hover.cx} y1={pad.t} x2={hover.cx} y2={pad.t + ph} className="stroke-slate-300" strokeWidth="1.5" />
                  <circle cx={hover.cx} cy={hover.cy} r="5" fill="rgb(var(--brand-600))" stroke="#ffffff" strokeWidth="2" />
                </>
              )}
              {monthly.map((m, i) => (
                <text key={i} x={X(i)} y={H - 8} textAnchor="middle" className="fill-slate-400" fontSize="8.5" fontWeight="600">{ADM_MONTH_ABBR[i]}</text>
              ))}
            </svg>
            {hover && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[128%] rounded-lg bg-slate-900 px-2.5 py-1.5 text-[12px] font-bold text-white shadow-md"
                style={{ left: hover.px, top: hover.py }}
              >
                {hover.label} · {hover.value}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdmissionsOverall({ selectedYear = "all", onOpenLead }) {
  const [filter, setFilter] = useState("ALL");
  const [data, setData] = useState({ all: [], domestic: [], international: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const year = encodeURIComponent(selectedYear);
        const [allResult, domesticResult, internationalResult] = await Promise.all([
          apiRequest(`/api/client/admissions?year=${year}`),
          apiRequest(`/api/client/admissions?year=${year}&market=DOMESTIC`),
          apiRequest(`/api/client/admissions?year=${year}&market=INTERNATIONAL`),
        ]);
        if (!cancelled) {
          setData({
            all: allResult.admissions || [],
            domestic: domesticResult.admissions || [],
            international: internationalResult.admissions || [],
          });
        }
      } catch (e) {
        if (!cancelled) setError(e?.data?.message || "Unable to load admissions overview");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedYear]);

  const rows = filter === "DOMESTIC" ? data.domestic : filter === "INTERNATIONAL" ? data.international : data.all;

  // Show the loading skeleton only on the initial fetch (loading and no data yet).
  // Subsequent refetches keep the existing inline spinner, and the empty/error
  // states below stay distinct from this.
  const showSkeleton = loading && data.all.length === 0 && !error;

  const filterValue = {
    stream: (admission) => admission.partner?.stream?.id || admission.partner?.stream?.name || "",
    college: (admission) => admission.partner?.id || admission.college || admission.partner?.name || "",
    branch: (admission) => admission.branch?.id || admission.branch?.name || admission.course || "",
  };

  const filterOptions = useMemo(() => {
    const optionsFor = (kind, labelFor) => Array.from(
      data.all.reduce((items, admission) => {
        const value = filterValue[kind](admission);
        if (value && !items.has(value)) items.set(value, labelFor(admission));
        return items;
      }, new Map()).entries()
    )
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      streams: optionsFor("stream", (admission) => admission.partner?.stream?.name || ""),
      colleges: optionsFor("college", (admission) => admission.college || admission.partner?.name || ""),
      branches: optionsFor("branch", (admission) => admission.branch?.name || admission.course || ""),
    };
  }, [data.all]);

  const filteredRows = useMemo(() => {
    const search = studentSearch.trim().toLowerCase();
    const localDate = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${date.getFullYear()}-${month}-${day}`;
    };

    return rows.filter((admission) => {
      const admissionDate = localDate(admission.admissionDate);

      return (
        (!search || String(admission.name || "").toLowerCase().includes(search)) &&
        (!startDate || admissionDate >= startDate) &&
        (!endDate || admissionDate <= endDate) &&
        (!streamFilter || filterValue.stream(admission) === streamFilter) &&
        (!collegeFilter || filterValue.college(admission) === collegeFilter) &&
        (!branchFilter || filterValue.branch(admission) === branchFilter)
      );
    });
  }, [rows, studentSearch, startDate, endDate, streamFilter, collegeFilter, branchFilter]);

  const exportAdmissions = () => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Student", "Type", "Stream", "College", "Branch", "Admission Date"],
      ...filteredRows.map((admission) => [
        admission.name,
        admission.market === "INTERNATIONAL" ? "International" : "Domestic",
        admission.partner?.stream?.name,
        admission.college || admission.partner?.name,
        admission.branch?.name || admission.course,
        formatDate(admission.admissionDate),
      ]),
    ].map((row) => row.map(escape).join(",")).join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "overall-admissions.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setStudentSearch("");
    setStartDate("");
    setEndDate("");
    setStreamFilter("");
    setCollegeFilter("");
    setBranchFilter("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Admissions</div>
          <h1 className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-slate-950">Overall Admissions</h1>
          <p className="mt-0.5 text-[13px] text-slate-500">View all admissions across Domestic and International.</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm native:max-w-full native:overflow-x-auto">
          {[['ALL','All',data.all.length],['DOMESTIC','Domestic',data.domestic.length],['INTERNATIONAL','International',data.international.length]].map(([value,label,count]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`h-9 rounded-lg px-4 text-[13px] font-semibold transition native:shrink-0 native:whitespace-nowrap native:focus-visible:outline-none native:focus-visible:ring-2 native:focus-visible:ring-indigo-500 native:focus-visible:ring-offset-1 ${filter === value ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>{label} <span className={`tabular-nums ${filter === value ? 'text-white/80' : 'text-slate-400'}`}>({count})</span></button>
          ))}
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <div id="admissions-records" className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-[13px] font-bold text-slate-900">
            All Admissions
            <span className="ml-2 text-[12px] font-semibold text-slate-400">{filteredRows.length} shown</span>
          </h2>
          <button
            type="button"
            onClick={exportAdmissions}
            disabled={!filteredRows.length}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} />
            Export
          </button>
        </div>
        <div className="grid grid-cols-1 items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_140px_140px_130px_130px_130px_auto] native:relative native:flex native:flex-nowrap native:items-center native:gap-2 native:max-w-full native:overflow-x-auto">
          <label className="relative min-w-0 native:w-[210px] native:shrink-0">
            <span className="sr-only">Search by student name</span>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Search student name"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="min-w-0 native:w-[140px] native:shrink-0">
            <input type="date" aria-label="From date" title="From date" value={startDate} onChange={(event) => setStartDate(event.target.value)} min="2000-01-01" max={endDate || new Date().toISOString().slice(0, 10)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="min-w-0 native:w-[140px] native:shrink-0">
            <input type="date" aria-label="To date" title="To date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate || "2000-01-01"} max={new Date().toISOString().slice(0, 10)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
          <label className="native:w-[150px] native:shrink-0">
            <span className="sr-only">Stream</span>
            <select aria-label="Stream" value={streamFilter} onChange={(event) => setStreamFilter(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">All streams</option>
              {filterOptions.streams.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="native:w-[150px] native:shrink-0">
            <span className="sr-only">College</span>
            <select aria-label="College" value={collegeFilter} onChange={(event) => setCollegeFilter(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">All colleges</option>
              {filterOptions.colleges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="native:w-[150px] native:shrink-0">
            <span className="sr-only">Branch</span>
            <select aria-label="Branch" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">All branches</option>
              {filterOptions.branches.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={clearFilters} className="h-9 px-2 text-[13px] font-semibold text-indigo-700 transition hover:text-indigo-900 native:shrink-0 native:self-center native:whitespace-nowrap">Clear</button>
        </div>
        {showSkeleton ? (
          <>
            <span role="status" className="sr-only">Loading admissions…</span>
            <div aria-hidden="true" className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-6 w-16 animate-pulse rounded-lg bg-slate-100" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3.5 w-40 max-w-full animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="hidden h-6 w-20 animate-pulse rounded-full bg-slate-100 sm:block" />
                  <div className="hidden h-3.5 w-24 animate-pulse rounded bg-slate-100 md:block" />
                </div>
              ))}
            </div>
          </>
        ) : loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading admissions...</div>
        ) : filteredRows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <GraduationCap size={26} className="mx-auto text-slate-300" aria-hidden="true" />
            <div className="mt-3 text-[14px] font-bold text-slate-800">No admissions yet</div>
            <div className="mx-auto mt-1 max-w-sm text-[13px] text-slate-500">
              Admissions appear here once a lead is marked “Admission Done” for this period. Try the All tab or a different year.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                <tr><th className="px-5 py-3">Lead ID</th><th className="px-5 py-3">Student</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Stream</th><th className="px-5 py-3">College</th><th className="px-5 py-3">Branch</th><th className="px-5 py-3">Admission Date</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((admission) => (
                  <tr key={admission.id} className="text-[13px] text-slate-700 hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-3"><LeadIdBadge admission={admission} onOpenLead={onOpenLead} /></td>
                    <td className="px-5 py-3"><div className="font-semibold text-slate-900">{admission.name || '—'}</div><div className="mt-0.5 text-xs text-slate-500">{admission.phone || '—'}</div></td>
                    <td className="px-5 py-3"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[13px] font-semibold text-slate-700">{admission.market === 'INTERNATIONAL' ? 'International' : 'Domestic'}</span></td>
                    <td className="px-5 py-3">{admission.partner?.stream?.name || '—'}</td>
                    <td className="px-5 py-3">{admission.college || admission.partner?.name || '—'}</td>
                    <td className="px-5 py-3">{admission.branch?.name || admission.course || '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(admission.admissionDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSkeleton ? (
        <div aria-hidden="true" className="h-[240px] animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
      ) : (
        <AdmissionsTrendChart rows={filteredRows} />
      )}
    </div>
  );
}

export default function Admissions(props) {
  if (props.overviewOnly) return <AdmissionsOverall selectedYear={props.selectedYear} onOpenLead={props.onOpenLead} />;
  return <AdmissionsManager {...props} />;
}
