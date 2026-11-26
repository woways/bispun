import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Plus,
  Link2,
  Globe,
  Copy,
  Search,
  X,
  Loader2,
  AlertCircle,
  Users,
  Download,
  Pencil,
  Trash2,
  ExternalLink,
  BarChart3,
  MousePointerClick,
  UserPlus,
  UserCheck,
  IndianRupee,
  Check,
  ChevronDown,
  PhoneCall,
} from "lucide-react";

import {
  Table,
  Badge,
  stageTone,
} from "../../components/ui";

import DetailModal from "../../components/DetailModal";

import { createPortal } from "react-dom";

import { apiRequest } from "../../lib/api";
import { formatUiDateTime } from "../../lib/uiPreferences";
import { telHref } from "../../lib/nativeActions";
import { useModalA11y } from "../../lib/useModalA11y";

// Drawers are portaled to <body>, so the client-portal shell becomes a sibling
// that sits BEFORE the dialog in DOM/reading order. aria-modal + the focus trap
// only constrain keyboard focus, not a screen reader's virtual cursor, so we make
// the shell `inert` while any drawer is open. Reference-counted so stacked drawers
// don't un-inert the background early. (accessibility-lead requirement.)
let shellInertCount = 0;

function setShellInert(on) {
  if (typeof document === "undefined") return;
  const shell = document.querySelector(".cb-client-portal");
  if (!shell) return;

  if (on) {
    shellInertCount += 1;
    shell.inert = true;
    shell.setAttribute("aria-hidden", "true");
  } else {
    shellInertCount = Math.max(0, shellInertCount - 1);
    if (shellInertCount === 0) {
      shell.inert = false;
      shell.removeAttribute("aria-hidden");
    }
  }
}

// Must be declared BEFORE useModalA11y in each drawer so its cleanup (clear
// inert) runs before useModalA11y restores focus to the opener inside the shell.
function useInertShell() {
  useEffect(() => {
    setShellInert(true);
    return () => setShellInert(false);
  }, []);
}

const UTM_MEDIUM_OPTIONS = [
  "Social",
  "Paid Social",
  "CPC/PPC",
  "Organic",
  "Referral",
  "Influencer",
  "WhatsApp",
  "SMS",
  "Offline/QR",
  "Other",
];

function resolveUtmMedium(form) {
  if (form.medium === "Other") {
    return String(form.mediumOther || "").trim();
  }

  return String(form.medium || "").trim();
}

function getMediumFormValues(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return {
      medium: "",
      mediumOther: "",
    };
  }

  const preset = UTM_MEDIUM_OPTIONS.find(
    (item) =>
      item !== "Other" &&
      item.toLowerCase() === raw.toLowerCase()
  );

  if (preset) {
    return {
      medium: preset,
      mediumOther: "",
    };
  }

  return {
    medium: "Other",
    mediumOther: raw,
  };
}

const STAGES = [
  {
    value: "NEW",
    label: "New",
  },
  {
    value: "CONTACTED",
    label: "Contacted",
  },
  {
    value: "QUALIFIED",
    label: "Qualified",
  },
  {
    value: "COUNSELLING",
    label: "Counselling",
  },
  {
    value: "ADMITTED",
    label: "Admitted",
  },
  {
    value: "LOST",
    label: "Lost",
  },
];

const LEAD_TEMPERATURES = [
  { value: "HOT", label: "Hot" },
  { value: "WARM", label: "Warm" },
  { value: "COLD", label: "Cold" },
];

function temperatureClass(value) {
  if (value === "HOT") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "COLD") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  const parsed = new Date(date);

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return "—";
  }

  return formatUiDateTime(parsed);
}

function isValidHttpUrl(value) {
  const v = String(value || "").trim();
  if (!/^https?:\/\/.+/i.test(v)) return false;
  try {
    const u = new URL(v);
    return (
      (u.protocol === "http:" ||
        u.protocol === "https:") &&
      !!u.hostname &&
      u.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

// Accept a 10-digit Indian mobile, optionally with a 91/+91 prefix. CA-018.
function buildTrackedUrl({
  url,
  campaign,
  source,
  medium,
}) {
  if (!isValidHttpUrl(url)) {
    return "";
  }
  try {
    const parsed = new URL(url);

    parsed.searchParams.set(
      "utm_campaign",
      String(campaign || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    );

    parsed.searchParams.set(
      "utm_source",
      String(source || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    );

    parsed.searchParams.set(
      "utm_medium",
      String(medium || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
    );

    return parsed.toString();
  } catch {
    return "";
  }
}

function LinkModal({
  editing,
  onClose,
  onSaved,
}) {
  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [mode, setMode] =
    useState(
      editing ? "manual" : "generate"
    );

  const [form, setForm] =
    useState(() => ({
      campaign:
        editing?.campaign || "",
      influencerName:
        editing?.influencerName || "",
      source:
        editing?.source || "",
      ...getMediumFormValues(
        editing?.medium
      ),
      url:
        editing?.url || "",
      cost:
        editing?.cost ?? "",
    }));

  useInertShell();
  const { panelRef, onKeyDown } = useModalA11y(onClose);
  const titleId = useId();

  const effectiveMedium =
    resolveUtmMedium(form);

  const generatedUrl =
    mode === "generate"
      ? buildTrackedUrl({
          ...form,
          medium: effectiveMedium,
        })
      : form.url;

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const payload = {
        mode,
        campaign:
          form.campaign,
        influencerName:
          form.influencerName,
        source:
          form.source,
        medium:
          effectiveMedium,
        url:
          mode === "generate"
            ? generatedUrl
            : form.url,
        cost:
          Number(form.cost || 0),
      };

      const data =
        await apiRequest(
          editing
            ? `/api/client/leads/utm/links/${editing.id}`
            : "/api/client/leads/utm/links",
          {
            method:
              editing
                ? "PATCH"
                : "POST",
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      onSaved(
        data.link
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to save UTM link"
      );
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm cb-backdrop-in"
        onClick={saving ? undefined : onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <div>
            <h2 id={titleId} className="text-[17px] font-bold text-slate-950">
              {editing
                ? "Edit UTM Link"
                : "Create UTM Link"}
            </h2>

            <p className="text-[13px] text-slate-500 mt-1">
              Generate a tracked URL or save an existing UTM URL manually.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {error ? (
              <div
                role="alert"
                className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[15px]"
              >
                {error}
              </div>
            ) : null}

            {!editing ? (
              <div
                role="radiogroup"
                aria-label="Link mode"
                className="inline-flex p-1 bg-slate-100 rounded-xl"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "generate"}
                  onClick={() =>
                    setMode(
                      "generate"
                    )
                  }
                  className={`h-8 px-3 rounded-lg text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    mode ===
                    "generate"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Generate UTM
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={mode === "manual"}
                  onClick={() =>
                    setMode(
                      "manual"
                    )
                  }
                  className={`h-8 px-3 rounded-lg text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                    mode ===
                    "manual"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Manual UTM
                </button>
              </div>
            ) : null}

            <Field
              label="Campaign"
              required
              value={form.campaign}
              onChange={(value) =>
                update(
                  "campaign",
                  value
                )
              }
              placeholder="Admissions-2026"
            />

            <Field
              label="Influencer Name"
              value={form.influencerName}
              onChange={(value) =>
                update(
                  "influencerName",
                  value
                )
              }
              placeholder="Influencer / partner name"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Source"
                required
                value={form.source}
                onChange={(value) =>
                  update(
                    "source",
                    value
                  )
                }
                placeholder="google / instagram / partner"
              />

              <MediumSelect
                value={form.medium}
                otherValue={form.mediumOther}
                onChange={(value) =>
                  update(
                    "medium",
                    value
                  )
                }
                onOtherChange={(value) =>
                  update(
                    "mediumOther",
                    value
                  )
                }
              />
            </div>

            <Field
              label="Campaign Cost"
              type="number"
              value={form.cost}
              onChange={(value) =>
                update(
                  "cost",
                  value
                )
              }
              placeholder="0"
            />

            <Field
              label={
                mode === "generate"
                  ? "Destination URL"
                  : "UTM URL"
              }
              required
              value={form.url}
              onChange={(value) =>
                update(
                  "url",
                  value
                )
              }
              placeholder="https://example.com/admissions"
            />

            {mode ===
              "generate" &&
            generatedUrl ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <div className="text-[13px] font-bold uppercase tracking-[0.1em] text-indigo-600">
                  Generated URL
                </div>

                <div className="mt-2 text-[13px] font-mono text-slate-700 break-all">
                  {generatedUrl}
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200 px-5 py-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-9 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !form.campaign.trim() ||
                !form.source.trim() ||
                !effectiveMedium ||
                !form.url.trim() ||
                (mode ===
                  "generate" &&
                  !generatedUrl)
              }
              className="h-9 px-4 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
            >
              {saving ? (
                <Loader2
                  size={13}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : editing ? (
                <Check size={13} aria-hidden="true" />
              ) : (
                <Link2 size={13} aria-hidden="true" />
              )}

              {editing
                ? "Save Changes"
                : mode ===
                  "generate"
                ? "Generate & Save"
                : "Save Manual UTM"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  hint,
  min,
}) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy =
    [hint && hintId, error && errId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[13px] font-medium text-slate-600 mb-1"
      >
        {label}

        {required && (
          <>
            <span className="text-rose-500 ml-0.5" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>

      {hint ? (
        <p id={hintId} className="mb-1.5 text-[12px] leading-5 text-slate-500">
          {hint}
        </p>
      ) : null}

      <input
        id={id}
        type={type}
        min={min}
        required={required}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-indigo-500"
      />

      {error ? (
        <p
          id={errId}
          className="mt-1 text-[12px] font-semibold text-rose-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}


function PlatformSelect({
  label = "Platform",
  value,
  onChange,
  hint,
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const options = [
    "Instagram",
    "YouTube",
    "Twitter/X",
    "Facebook",
    "WhatsApp",
    "Telegram",
    "LinkedIn",
    "ShareChat",
    "Snapchat",
    "Other",
  ];

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[13px] font-medium text-slate-600"
      >
        {label}
      </label>

      {hint ? (
        <p id={hintId} className="mb-1.5 text-[12px] leading-5 text-slate-500">
          {hint}
        </p>
      ) : null}

      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          aria-describedby={hint ? hintId : undefined}
          className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-[15px] text-slate-800 focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          <option value="">
            Select platform
          </option>

          {options.map((item) => (
            <option
              key={item}
              value={item}
            >
              {item}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
      </div>
    </div>
  );
}

function MediumSelect({
  value,
  otherValue,
  onChange,
  onOtherChange,
  required = true,
  hint,
}) {
  const id = useId();
  const otherId = useId();
  const hintId = `${id}-hint`;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[13px] font-medium text-slate-600"
      >
        Medium
        {required ? (
          <>
            <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="mb-1.5 text-[12px] leading-5 text-slate-500">
          {hint}
        </p>
      ) : null}

      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          required={required}
          aria-describedby={hint ? hintId : undefined}
          className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-[15px] text-slate-800 focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-600"
        >
          <option value="">
            Select medium
          </option>
          {UTM_MEDIUM_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <ChevronDown
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
      </div>

      {value === "Other" ? (
        <>
          <label htmlFor={otherId} className="sr-only">
            Custom medium (required)
          </label>
          <input
            id={otherId}
            type="text"
            required={required}
            value={otherValue}
            onChange={(event) =>
              onOtherChange(event.target.value)
            }
            placeholder="Enter custom medium"
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-[15px] focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-600"
          />
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
  onClick,
  active = false,
}) {
  const className = `w-full bg-white border rounded-xl p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition ${
    onClick
      ? "cursor-pointer hover:border-indigo-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
      : ""
  } ${
    active
      ? "border-indigo-300 ring-2 ring-indigo-50"
      : "border-slate-200"
  }`;

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
          {label}
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon size={15} aria-hidden="true" />
        </div>
      </div>

      <div
        title={typeof value === "string" ? value : undefined}
        className="mt-3 truncate text-[19px] font-bold leading-tight tracking-[-0.02em] text-slate-950"
      >
        {value}
      </div>

      <div className="mt-1.5 text-[12px] leading-5 text-slate-500">
        {detail}
        {onClick ? (
          <span className="ml-1 font-semibold text-indigo-600">
            View details
          </span>
        ) : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2`}
        aria-haspopup="dialog"
      >
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

// Compact single-row KPI card. Opens a drill-down DetailModal, so it is a
// button with aria-haspopup="dialog" (not a toggle). `active` only reflects the
// current visual highlight when its detail view is open.
function KpiStat({
  label,
  value,
  icon: Icon,
  caption,
  active = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={`flex flex-col gap-2 rounded-xl border bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-indigo-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
        active
          ? "border-indigo-300 ring-2 ring-indigo-50"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
          {label}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon size={14} aria-hidden="true" />
        </span>
      </div>

      <div className="text-[22px] font-bold leading-none tracking-[-0.03em] text-slate-950">
        {value}
      </div>

      {caption ? (
        <span className="text-[11px] leading-4 text-slate-500">{caption}</span>
      ) : null}

      <span
        className="text-[11px] font-semibold text-indigo-600"
        aria-hidden="true"
      >
        View details
      </span>
    </button>
  );
}

// Reusable right-side drawer. Mounted only while open so useModalA11y's
// on-mount focus/scroll-lock/restore and Tab-trap fire correctly. Honours
// prefers-reduced-motion by gating the slide-in to motion-safe only.
function Drawer({
  titleText,
  subtitle,
  onClose,
  children,
  footer,
}) {
  useInertShell();
  const { panelRef, onKeyDown } = useModalA11y(onClose);
  const titleId = useId();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm cb-backdrop-in"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="relative ml-auto flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[17px] font-bold text-slate-950">
              {titleText}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-slate-200 px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

function downloadCsv(rows) {
  const headers = [
    "Campaign",
    "Influencer Name",
    "Source",
    "Medium",
    "URL",
    "Clicks",
    "Registrations",
    "Leads",
    "Conversions",
    "Admissions",
    "Revenue",
    "Created",
  ];

  const escape = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [
    headers.map(escape).join(","),
    ...rows.map((link) =>
      [
        link.campaign,
        link.influencerName,
        link.source,
        link.medium,
        link.url,
        link.clicks,
        link.regs,
        link.leads,
        link.conv,
        link.adm,
        link.rev,
        link.createdAt,
      ]
        .map(escape)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob(
    [csv],
    {
      type:
        "text/csv;charset=utf-8;",
    }
  );

  const url =
    URL.createObjectURL(
      blob
    );

  const anchor =
    document.createElement(
      "a"
    );

  anchor.href = url;
  anchor.download =
    "utm-links.csv";

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(
    url
  );
}




function downloadUtmLeadDetails(rows) {
  const headers = [
    "Lead Name",
    "Phone",
    "Email",
    "Course / Interest",
    "Source",
    "Campaign",
    "Medium",
    "Stage",
    "Temperature",
    "Assigned",
    "Created",
  ];

  const escape = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  const csv = [
    headers.map(escape).join(","),
    ...rows.map((lead) =>
      [
        lead.name,
        lead.phone,
        lead.email,
        lead.course,
        lead.source,
        lead.campaign,
        lead.medium,
        lead.stage,
        lead.temperature || "WARM",
        lead.assigned,
        lead.createdAt,
      ]
        .map(escape)
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download =
    "utm-lead-details.csv";

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}


function PhoneAction({ phone, name, onCopied }) {
  const [menu, setMenu] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const firstItemRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;

    function closeOnOutsideClick(event) {
      const target = event.target;

      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;

      setMenu(null);
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") {
        setMenu(null);
      }
    }

    function closeOnViewportChange() {
      setMenu(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);

    // Move focus into the popover so keyboard users land on the first action.
    firstItemRef.current?.focus?.();

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [menu]);

  if (!phone) {
    return <span className="text-slate-500">—</span>;
  }

  function closeMenu() {
    setMenu(null);
    // Restore focus to the trigger on close.
    triggerRef.current?.focus?.();
  }

  function openMenu(event) {
    if (menu) {
      closeMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 178;

    setMenu({
      top: Math.min(rect.bottom + 6, window.innerHeight - 112),
      left: Math.min(
        Math.max(8, rect.left),
        window.innerWidth - menuWidth - 8
      ),
    });
  }

  async function copyNumber() {
    const value = String(phone);

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const input = document.createElement("textarea");
      input.value = value;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    onCopied?.();
    closeMenu();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded"
        title={`Copy or dial ${name || "lead"} number`}
      >
        {phone}
      </button>

      {menu ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Actions for ${name || "lead"} number`}
          className="fixed z-[130] w-[178px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl"
          style={{
            top: menu.top,
            left: menu.left,
          }}
        >
          <button
            ref={firstItemRef}
            type="button"
            role="menuitem"
            onClick={copyNumber}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <Copy size={14} aria-hidden="true" />
            Copy number
          </button>

          <a
            href={telHref(phone)}
            role="menuitem"
            onClick={closeMenu}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <PhoneCall size={14} aria-hidden="true" />
            Dial number
          </a>
        </div>
      ) : null}
    </>
  );
}


export default function UTMLeads({
  selectedYear = "all",
}) {
  const [leads, setLeads] = useState([]);
  const [links, setLinks] = useState([]);
  const [analytics, setAnalytics] = useState({
    summary: {},
    campaignPerformance: [],
    sourcePerformance: [],
    mediumPerformance: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [linkSearch, setLinkSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [mediumFilter, setMediumFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [editingLink, setEditingLink] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  // UI reshape: tabbed workspace + create-in-drawer. Behaviour unchanged.
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [createMode, setCreateMode] = useState("generate");

  // Polite SR announcements for copy / temperature actions that otherwise
  // change the UI silently (accessibility-lead items #9 and #13).
  const [statusMessage, setStatusMessage] = useState("");

  const [temperatureUpdatingId, setTemperatureUpdatingId] =
    useState("");

  const [generateForm, setGenerateForm] = useState({
    url: "",
    source: "",
    medium: "",
    mediumOther: "",
    campaign: "",
    influencerName: "",
    cost: "",
  });

  const [manualForm, setManualForm] = useState({
    url: "",
    source: "",
    medium: "",
    mediumOther: "",
    campaign: "",
    influencerName: "",
    cost: "",
  });

  const [generateSaving, setGenerateSaving] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [manualError, setManualError] = useState("");
  const [copiedGenerated, setCopiedGenerated] = useState(false);
  // Keeps the just-generated link visible in the panel after Generate & Save
  // (the form resets, but the saved link should still be shown + copyable here).
  const [lastSavedLink, setLastSavedLink] = useState(null);

  // Drill-down: clicking an analytics KPI card opens a dedicated full page (see
  // DetailPage) showing ONLY that card's records, instead of an inline panel.
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
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("year", selectedYear);
      params.set("sort", sort);

      const [
        leadsData,
        linksData,
        analyticsData,
      ] = await Promise.all([
        apiRequest(
          `/api/client/leads?year=${encodeURIComponent(
            selectedYear
          )}`
        ),
        apiRequest(
          `/api/client/leads/utm/links?${params.toString()}`
        ),
        apiRequest(
          `/api/client/leads/utm/analytics?year=${encodeURIComponent(
            selectedYear
          )}`
        ),
      ]);

      setLeads(leadsData.leads || []);
      setLinks(linksData.links || []);
      setAnalytics(
        analyticsData || {
          summary: {},
          campaignPerformance: [],
          sourcePerformance: [],
          mediumPerformance: [],
        }
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load UTM leads"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedYear, sort]);

  async function updateLeadTemperature(leadId, temperature) {
    setTemperatureUpdatingId(leadId);
    setError("");

    try {
      const data = await apiRequest(`/api/client/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ temperature }),
      });

      setLeads((current) =>
        current.map((lead) =>
          lead.id === leadId
            ? { ...lead, temperature: data?.lead?.temperature || temperature }
            : lead
        )
      );
      setStatusMessage("Lead temperature updated");
    } catch (error) {
      setError(error?.data?.message || "Unable to update lead temperature");
    } finally {
      setTemperatureUpdatingId("");
    }
  }

  const generateMedium =
    resolveUtmMedium(generateForm);
  const manualMedium =
    resolveUtmMedium(manualForm);

  const generatedUrl = useMemo(
    () =>
      buildTrackedUrl({
        url: generateForm.url,
        campaign: generateForm.campaign,
        source: generateForm.source,
        medium: resolveUtmMedium(generateForm),
      }),
    [generateForm]
  );

  function updateGenerate(field, value) {
    setGenerateForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateManual(field, value) {
    setManualForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveGenerate() {
    if (
      !generateForm.url.trim() ||
      !generateForm.source.trim() ||
      !generateMedium ||
      !generateForm.campaign.trim() ||
      !generatedUrl
    ) {
      setGenerateError(
        "Destination URL, source, medium and campaign are required"
      );
      return;
    }

    setGenerateSaving(true);
    setGenerateError("");

    // Capture the generated URL before the form resets, so it stays on screen.
    const savedUrl = generatedUrl;

    try {
      await apiRequest(
        "/api/client/leads/utm/links",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "generate",
            url: generateForm.url,
            source: generateForm.source,
            medium: generateMedium,
            campaign: generateForm.campaign,
            influencerName: generateForm.influencerName,
            cost: Number(generateForm.cost || 0),
          }),
        }
      );

      setLastSavedLink(savedUrl);

      setGenerateForm({
        url: "",
        source: "",
        medium: "",
        mediumOther: "",
        campaign: "",
        influencerName: "",
        cost: "",
      });

      await loadData();
    } catch (error) {
      setGenerateError(
        error?.data?.message ||
          "Unable to generate UTM link"
      );
    } finally {
      setGenerateSaving(false);
    }
  }

  async function saveManual() {
    if (
      !manualForm.url.trim() ||
      !manualForm.source.trim() ||
      !manualMedium ||
      !manualForm.campaign.trim()
    ) {
      setManualError(
        "UTM URL, source, medium and campaign are required"
      );
      return;
    }

    if (!isValidHttpUrl(manualForm.url)) {
      setManualError(
        "UTM URL must be a full address starting with http:// or https://"
      );
      return;
    }

    setManualSaving(true);
    setManualError("");

    try {
      await apiRequest(
        "/api/client/leads/utm/links",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "manual",
            url: manualForm.url,
            source: manualForm.source,
            medium: manualMedium,
            campaign: manualForm.campaign,
            influencerName: manualForm.influencerName,
            cost: Number(manualForm.cost || 0),
          }),
        }
      );

      setManualForm({
        url: "",
        source: "",
        medium: "",
        mediumOther: "",
        campaign: "",
        influencerName: "",
        cost: "",
      });

      await loadData();
    } catch (error) {
      setManualError(
        error?.data?.message ||
          "Unable to save manual UTM link"
      );
    } finally {
      setManualSaving(false);
    }
  }

  async function copyGeneratedLink() {
    const linkToCopy = generatedUrl || lastSavedLink;
    if (!linkToCopy) return;

    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopiedGenerated(true);
      setStatusMessage("Link copied to clipboard");
      window.setTimeout(
        () => setCopiedGenerated(false),
        1500
      );
    } catch {
      // Clipboard can be unavailable.
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      setStatusMessage("Link copied to clipboard");
    } catch {
      // Clipboard can be unavailable.
    }
  }

  async function deleteLink(link) {
    if (
      !window.confirm(
        `Delete UTM link "${link.campaign}"?`
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/api/client/leads/utm/links/${link.id}`,
        { method: "DELETE" }
      );

      await loadData();
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to delete UTM link"
      );
    }
  }

  const filteredLinks = useMemo(() => {
    const query = linkSearch.trim().toLowerCase();
    const now = new Date();
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return links.filter((link) => {
      if (
        query &&
        ![
          link.campaign,
          link.influencerName,
          link.source,
          link.medium,
          link.url,
          link.latestLead?.name,
          link.latestLead?.phone,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          )
      ) {
        return false;
      }

      if (
        sourceFilter &&
        String(link.source).toLowerCase() !==
          sourceFilter.toLowerCase()
      ) {
        return false;
      }

      if (
        mediumFilter &&
        String(link.medium).toLowerCase() !==
          mediumFilter.toLowerCase()
      ) {
        return false;
      }

      if (dateFilter !== "all") {
        const created = new Date(link.createdAt);

        if (
          dateFilter === "month" &&
          created < monthStart
        ) {
          return false;
        }

        if (
          dateFilter === "year" &&
          created < yearStart
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    links,
    linkSearch,
    sourceFilter,
    mediumFilter,
    dateFilter,
  ]);

  const utmLeads = useMemo(() => {
    const linkIds = new Set(links.map((link) => link.id));
    const query = leadSearch.trim().toLowerCase();

    return leads.filter((lead) => {
      if (!lead.utmLinkId || !linkIds.has(lead.utmLinkId)) {
        return false;
      }

      if (!query) return true;

      return [
        lead.name,
        lead.phone,
        lead.email,
        lead.course,
        lead.campaign,
        lead.medium,
        lead.source,
        lead.stage,
        lead.temperature,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(query)
        );
    });
  }, [leads, links, leadSearch]);

  const sourceOptions = useMemo(() => {
    // CA-016: one entry per platform regardless of case (LinkedIn == linkedin).
    const seen = new Map();
    links.forEach((link) => {
      const raw = String(link.source || "").trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!seen.has(key)) seen.set(key, raw);
    });
    return Array.from(seen.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [links]);

  const mediumOptions = useMemo(
    () =>
      Array.from(
        new Set(
          links
            .map((link) => link.medium)
            .filter(Boolean)
        )
      ).sort(),
    [links]
  );


  const summary = analytics.summary || {};

  function PerformanceCard({
    title,
    rows,
    labelKey,
  }) {
    const visibleRows = rows.slice(0, 6);
    const max = Math.max(
      1,
      ...rows.map((row) => Number(row.leads || 0))
    );
    const total = rows.reduce(
      (sum, row) => sum + Number(row.leads || 0),
      0
    );

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-bold tracking-[-0.01em] text-slate-900">
            {title}
          </h2>
          <span className="text-[12px] font-semibold text-slate-500">
            {total > 0 ? `${total} leads` : "Leads"}
          </span>
        </div>

        <div className="mt-5 space-y-4">
          {visibleRows.map((row, index) => {
            const value = Number(row.leads || 0);
            const width =
              value <= 0 ? 0 : Math.max(4, (value / max) * 100);
            const name = row[labelKey] || "—";

            return (
              <div
                key={`${name}-${index}`}
                className="grid grid-cols-[20px_1fr] items-center gap-x-3"
              >
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold tabular-nums text-slate-500"
                >
                  {index + 1}
                </span>

                <div className="min-w-0">
                  <div
                    title={name}
                    className="mb-1.5 truncate text-[13px] font-semibold text-slate-700"
                  >
                    {name}
                    <span className="sr-only">
                      : {value} {value === 1 ? "lead" : "leads"}
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {!rows.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 py-8 text-center text-[13px] font-medium text-slate-500">
              No campaigns yet.
            </div>
          ) : total === 0 ? (
            <p className="pt-1 text-[12px] leading-5 text-slate-500">
              No leads attributed yet — numbers fill in as leads come through
              these links.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  const detailData = detailView ? (() => {
    const linkById = new Map(links.map((link) => [link.id, link]));

    const contributingLinks =
      detailView === "registrations"
        ? links.filter((link) => Number(link.regs || 0) > 0)
        : detailView === "admissions"
        ? links.filter((link) => Number(link.adm || 0) > 0)
        : detailView === "revenue"
        ? links.filter((link) => Number(link.rev || 0) > 0)
        : links;

    if (detailView === "leads") {
        return {
          eyebrow: "UTM Leads / Analytics",
          title: "UTM Leads",
          subtitle: "Actual leads attributed to saved UTM links.",
          columns: [
            "Lead ID",
            "Lead",
            "Campaign",
            "Influencer",
            "Source / Medium",
            "Stage",
            "Created",
          ],
          empty: "No UTM leads found",
          rows: utmLeads.map((lead) => {
            const link = linkById.get(lead.utmLinkId);

            return (
              <tr key={lead.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                    {lead.leadDisplayId || "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-[14px] font-semibold text-slate-800">
                    {lead.name}
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-500">
                    {lead.phone || lead.email || "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-700">
                  {link?.campaign || lead.campaign || "—"}
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-700">
                  {link?.influencerName || "—"}
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-600">
                  {link
                    ? `${link.source} / ${link.medium}`
                    : `${lead.source || "—"} / ${lead.medium || "—"}`}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={stageTone(lead.stageKey || lead.stage)}>
                    {lead.stage}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-[12px] text-slate-500">
                  {formatDate(lead.createdAt)}
                </td>
              </tr>
            );
          }),
        };
      }

      const titleMap = {
        links: "UTM Links",
        registrations: "Registrations",
        admissions: "Admissions",
        revenue: "Revenue",
      };

      const subtitleMap = {
        links: "Saved UTM campaign links for the selected year.",
        registrations:
          "Campaign links contributing to the registration total.",
        admissions: "Campaign links contributing admissions.",
        revenue: "Campaign links contributing received admission revenue.",
      };

      const columns =
        detailView === "links"
          ? [
              "Campaign",
              "Influencer",
              "Source / Medium",
              "Registrations",
              "Leads",
              "Created",
            ]
          : detailView === "registrations"
          ? [
              "Campaign",
              "Influencer",
              "Source / Medium",
              "Registrations",
              "Leads",
            ]
          : [
              "Campaign",
              "Influencer",
              "Source / Medium",
              "Admissions",
              "Revenue",
            ];

      return {
        eyebrow: "UTM Leads / Analytics",
        title: titleMap[detailView],
        subtitle: subtitleMap[detailView],
        columns,
        empty: `No ${titleMap[detailView].toLowerCase()} found`,
        rows: contributingLinks.map((link) => (
          <tr key={link.id} className="hover:bg-slate-50/80">
            <td className="px-4 py-3 text-[14px] font-semibold text-slate-800">
              {link.campaign}
            </td>
            <td className="px-4 py-3 text-[13px] text-slate-700">
              {link.influencerName || "—"}
            </td>
            <td className="px-4 py-3 text-[13px] text-slate-600">
              {link.source} / {link.medium}
            </td>

            {detailView === "links" ? (
              <>
                <td className="px-4 py-3 text-[13px] font-semibold text-slate-700">
                  {Number(link.regs || 0)}
                </td>
                <td className="px-4 py-3 text-[13px] font-semibold text-slate-700">
                  {Number(link.leads || 0)}
                </td>
                <td className="px-4 py-3 text-[12px] text-slate-500">
                  {formatDate(link.createdAt)}
                </td>
              </>
            ) : detailView === "registrations" ? (
              <>
                <td className="px-4 py-3 text-[13px] font-bold text-slate-900">
                  {Number(link.regs || 0)}
                </td>
                <td className="px-4 py-3 text-[13px] text-slate-700">
                  {Number(link.leads || 0)}
                </td>
              </>
            ) : (
              <>
                <td className="px-4 py-3 text-[13px] font-bold text-emerald-700">
                  {Number(link.adm || 0)}
                </td>
                <td className="px-4 py-3 text-[13px] font-bold text-slate-900">
                  ₹{Number(link.rev || 0).toLocaleString("en-IN")}
                </td>
              </>
            )}
          </tr>
        )),
      };
    })() : null;

  return (
    <div className="space-y-6">
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
      {/* Polite live region for copy / temperature feedback (SR only) */}
      <div aria-live="polite" role="status" className="sr-only">
        {statusMessage}
      </div>

      {/* Header toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Campaign tracking
          </div>

          <h1 className="mt-2 text-[30px] font-bold tracking-[-0.04em] text-slate-950">
            UTM Leads
          </h1>

          <p className="mt-1 text-[15px] text-slate-500">
            Generate links, save influencer links, review UTM leads and analyse performance.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setCreateMode("generate");
            setShowCreateDrawer(true);
          }}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
        >
          <Plus size={16} aria-hidden="true" />
          New UTM Link
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[15px] text-rose-700"
        >
          <AlertCircle size={15} aria-hidden="true" />
          {error}
        </div>
      ) : null}

      {/* KPI strip: five drill-down stats in one row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiStat
          label="UTM Links"
          value={summary.totalUtmLinks ?? links.length}
          icon={Link2}
          caption="Saved campaign links"
          onClick={() => openDetail("links")}
          active={detailView === "links"}
        />

        <KpiStat
          label="Registrations"
          value={summary.totalRegistrations ?? 0}
          icon={UserPlus}
          caption="Sign-ups from these links"
          onClick={() => openDetail("registrations")}
          active={detailView === "registrations"}
        />

        <KpiStat
          label="UTM Leads"
          value={summary.totalLeads ?? utmLeads.length}
          icon={Users}
          caption="Leads attributed to links"
          onClick={() => openDetail("leads")}
          active={detailView === "leads"}
        />

        <KpiStat
          label="Admissions"
          value={summary.totalAdmissions ?? 0}
          icon={UserCheck}
          caption="Admitted from UTM leads"
          onClick={() => openDetail("admissions")}
          active={detailView === "admissions"}
        />

        <KpiStat
          label="Revenue"
          value={`₹${Number(summary.totalRevenue || 0).toLocaleString("en-IN")}`}
          icon={IndianRupee}
          caption="Fees received from them"
          onClick={() => openDetail("revenue")}
          active={detailView === "revenue"}
        />
      </div>

      {/* Tabbed workspace */}
      <div
        role="tablist"
        aria-label="UTM views"
        className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1"
      >
        {[
          { key: "overview", label: "Overview", controls: "utm-panel-overview" },
          {
            key: "links",
            label: `Saved Links (${filteredLinks.length})`,
            controls: "saved-utm-links",
          },
          {
            key: "leads",
            label: `Lead Details (${utmLeads.length})`,
            controls: "utm-lead-details",
          },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`utm-tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={tab.controls}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => setActiveTab(tab.key)}
            onKeyDown={(event) => {
              const order = ["overview", "links", "leads"];
              const idx = order.indexOf(activeTab);
              let next = null;
              if (event.key === "ArrowRight") {
                next = order[(idx + 1) % order.length];
              } else if (event.key === "ArrowLeft") {
                next = order[(idx - 1 + order.length) % order.length];
              } else if (event.key === "Home") {
                next = order[0];
              } else if (event.key === "End") {
                next = order[order.length - 1];
              }
              if (next) {
                event.preventDefault();
                setActiveTab(next);
                document.getElementById(`utm-tab-${next}`)?.focus();
              }
            }}
            className={`h-9 rounded-lg px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview panel: performance + headline metrics */}
      {activeTab === "overview" ? (
        <div
          role="tabpanel"
          id="utm-panel-overview"
          aria-labelledby="utm-tab-overview"
          tabIndex={0}
          className="space-y-4 focus-visible:outline-none"
        >
          <div className="grid gap-4 xl:grid-cols-3">
            <PerformanceCard
              title="Campaign Performance"
              rows={analytics.campaignPerformance || []}
              labelKey="campaign"
            />

            <PerformanceCard
              title="Source Performance"
              rows={analytics.sourcePerformance || []}
              labelKey="source"
            />

            <PerformanceCard
              title="Medium Performance"
              rows={analytics.mediumPerformance || []}
              labelKey="medium"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Top Campaign"
              value={summary.topCampaign || "—"}
              icon={BarChart3}
              detail={`Most leads in ${
                selectedYear === "all" ? "all time" : selectedYear
              }`}
            />

            <MetricCard
              label="Top Source"
              value={summary.topSource || "—"}
              icon={Globe}
              detail="Channel bringing the most leads"
            />

            <MetricCard
              label="UTM Conversion"
              value={`${Number(summary.conversionRate || 0).toFixed(1)}%`}
              icon={MousePointerClick}
              detail="Share of UTM leads that became admissions"
            />
          </div>
        </div>
      ) : null}

      {/* Saved Influencer Links panel */}
      {activeTab === "links" ? (
      <section
        id="saved-utm-links"
        role="tabpanel"
        aria-labelledby="utm-tab-links"
        tabIndex={0}
        className="space-y-3 scroll-mt-28 focus-visible:outline-none"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Saved links
            </div>

            <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-950">
              Saved Influencer Links
            </h2>

            <p className="mt-1 text-[13px] text-slate-500">
              Search, filter, copy, edit and review performance for every saved link.
            </p>
          </div>

          <button
            type="button"
            onClick={() => downloadCsv(filteredLinks)}
            disabled={!filteredLinks.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <Download size={13} aria-hidden="true" />
            Export
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid gap-2 xl:grid-cols-[1fr_180px_180px_150px_150px] native:flex native:flex-nowrap native:max-w-full native:relative native:overflow-x-auto native:[-webkit-overflow-scrolling:touch]">
            <div className="relative native:w-[230px] native:shrink-0">
              <Search
                size={14}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={linkSearch}
                onChange={(event) =>
                  setLinkSearch(event.target.value)
                }
                aria-label="Search saved links"
                placeholder="Search campaign, influencer, source, medium, URL or latest lead..."
                className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-indigo-500"
              />
            </div>

            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 native:w-[150px] native:shrink-0"
            >
              <option value="">All Sources</option>
              {sourceOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={mediumFilter}
              onChange={(event) =>
                setMediumFilter(event.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 native:w-[150px] native:shrink-0"
            >
              <option value="">All Mediums</option>
              {mediumOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={dateFilter}
              onChange={(event) =>
                setDateFilter(event.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 native:w-[150px] native:shrink-0"
            >
              <option value="all">All Dates</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>

            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 native:w-[150px] native:shrink-0"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="leads">Most Leads</option>
              <option value="admissions">Most Admissions</option>
              <option value="revenue">Highest Revenue</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table
            columns={[
              "Campaign",
              "Influencer",
              "Source / Medium",
              "Saved Link",
              "Leads",
              "Cost",
              "Cost / Lead",
              "Latest Lead",
              "Admissions",
              "Revenue",
              "Actions",
            ]}
            empty="No saved UTM links yet"
            rows={filteredLinks.map((link) => (
              <tr
                key={link.id}
                className="hover:bg-slate-50/80"
              >
                <td className="px-4 py-3">
                  <div className="text-[13px] font-semibold text-slate-900">
                    {link.campaign}
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-500">
                    {formatDate(link.createdAt)}
                  </div>
                </td>

                <td className="px-4 py-3 text-[13px] text-slate-600">
                  {link.influencerName || "—"}
                </td>

                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-medium capitalize text-slate-600">
                    <span>{link.source}</span>
                    <span className="text-slate-400" aria-hidden="true">/</span>
                    <span>{link.medium}</span>
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="inline-flex max-w-[230px] items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 py-0.5 pl-2.5 pr-1">
                    <span
                      title={link.url}
                      className="truncate font-mono text-[12px] text-slate-600"
                    >
                      {link.url}
                    </span>

                    <button
                      type="button"
                      onClick={() => copyLink(link.url)}
                      aria-label={`Copy link for ${link.campaign}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    >
                      <Copy size={12} aria-hidden="true" />
                    </button>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${link.campaign} link in new tab`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </div>
                </td>

                <td className="px-4 py-3 text-right text-[14px] font-bold tabular-nums text-slate-900">
                  {link.leads || 0}
                </td>

                <td className="px-4 py-3 text-right text-[13px] tabular-nums text-slate-700">
                  {Number(link.cost || 0)
                    ? `₹${Number(link.cost).toLocaleString("en-IN")}`
                    : "—"}
                </td>

                <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-slate-800">
                  {link.leads
                    ? `₹${Number(link.costPerLead || 0).toLocaleString("en-IN")}`
                    : "—"}
                </td>

                <td className="px-4 py-3">
                  <div className="text-[13px] font-semibold text-slate-900">
                    {link.latestLead?.name || "—"}
                  </div>
                  <div className="mt-0.5 text-[12px] text-slate-500">
                    {link.latestLead?.phone ? (
                      <PhoneAction
                        phone={link.latestLead.phone}
                        name={link.latestLead.name}
                        onCopied={() =>
                          setStatusMessage("Number copied to clipboard")
                        }
                      />
                    ) : link.latestLead?.createdAt ? (
                      formatDate(link.latestLead.createdAt)
                    ) : (
                      "No leads yet"
                    )}
                  </div>
                </td>

                <td className="px-4 py-3 text-right text-[14px] font-bold tabular-nums">
                  <span className={link.adm ? "text-slate-900" : "text-slate-500"}>
                    {link.adm || 0}
                  </span>
                </td>

                <td className="px-4 py-3 text-right text-[14px] font-bold tabular-nums">
                  <span className={link.rev ? "text-slate-900" : "text-slate-500"}>
                    {link.rev
                      ? `₹${Number(link.rev).toLocaleString("en-IN")}`
                      : "—"}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLink(link);
                        setShowLinkModal(true);
                      }}
                      aria-label={`Edit ${link.campaign}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteLink(link)}
                      aria-label={`Delete ${link.campaign}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
        </div>
      </section>
      ) : null}

      {/* UTM Lead Details panel */}
      {activeTab === "leads" ? (
      <section
        id="utm-lead-details"
        role="tabpanel"
        aria-labelledby="utm-tab-leads"
        tabIndex={0}
        className="space-y-3 scroll-mt-28 focus-visible:outline-none"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Lead details
            </div>

            <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-950">
              UTM Lead Details
            </h2>

            <p className="mt-1 text-[13px] text-slate-500">
              Actual leads generated from the saved UTM links.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              downloadUtmLeadDetails(
                utmLeads
              )
            }
            disabled={!utmLeads.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
          >
            <Download size={13} aria-hidden="true" />
            Export UTM Lead Details
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="relative max-w-xl">
            <Search
              size={14}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={leadSearch}
              onChange={(event) =>
                setLeadSearch(
                  event.target.value
                )
              }
              aria-label="Search UTM leads"
              placeholder="Search UTM lead by name, phone, campaign, source or stage..."
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:border-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table
            columns={[
              "Lead ID",
              "Lead",
              "Course / Interest",
              "Source",
              "Campaign",
              "Medium",
              "Stage",
              "Temperature",
              "Assigned",
              "Created",
            ]}
            empty="No UTM leads found"
            rows={utmLeads.map((lead) => (
              <tr
                key={lead.id}
                className="hover:bg-slate-50/80"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">
                    {lead.leadDisplayId || "—"}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="text-[13px] font-semibold text-slate-900">
                    {lead.name}
                  </div>

                  <div className="mt-0.5 text-[12px] text-slate-500">
                    <PhoneAction
                      phone={lead.phone}
                      name={lead.name}
                      onCopied={() =>
                        setStatusMessage("Number copied to clipboard")
                      }
                    />
                  </div>
                </td>

                <td className="px-4 py-3 text-[13px] text-slate-600">
                  {lead.course || "—"}
                </td>

                <td className="px-4 py-3 text-[13px] capitalize text-slate-600">
                  {lead.source || "—"}
                </td>

                <td className="px-4 py-3 text-[13px] font-semibold text-slate-800">
                  {lead.campaign || "—"}
                </td>

                <td className="px-4 py-3 text-[13px] capitalize text-slate-600">
                  {lead.medium || "—"}
                </td>

                <td className="px-4 py-3">
                  <Badge tone={stageTone(lead.stage)}>
                    {lead.stage}
                  </Badge>
                </td>

                <td className="px-4 py-3">
                  <select
                    value={lead.temperature || "WARM"}
                    disabled={temperatureUpdatingId === lead.id}
                    aria-label={`Lead temperature for ${lead.name}`}
                    onChange={(event) => updateLeadTemperature(lead.id, event.target.value)}
                    className={`h-8 rounded-lg border px-2 text-[12px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 disabled:opacity-60 ${temperatureClass(lead.temperature || "WARM")}`}
                  >
                    {LEAD_TEMPERATURES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3 text-[13px]">
                  <span className={lead.assigned ? "text-slate-700" : "text-slate-500"}>
                    {lead.assigned || "Unassigned"}
                  </span>
                </td>

                <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                  {formatDate(
                    lead.createdAt
                  )}
                </td>
              </tr>
            ))}
          />
        </div>
      </section>
      ) : null}

      {/* Create UTM Link drawer (Generate / Manual) */}
      {showCreateDrawer ? (
        <Drawer
          titleText="Create UTM Link"
          subtitle="Generate a tracked URL or save an existing UTM URL manually."
          onClose={() => setShowCreateDrawer(false)}
          footer={
            createMode === "generate" ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={copyGeneratedLink}
                  disabled={!generatedUrl && !lastSavedLink}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                >
                  {copiedGenerated ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} aria-hidden="true" />
                  )}
                  {copiedGenerated ? "Copied" : "Copy Link"}
                </button>

                <button
                  type="button"
                  onClick={saveGenerate}
                  disabled={
                    generateSaving ||
                    !generatedUrl ||
                    !generateMedium ||
                    Number(generateForm.cost) < 0
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  {generateSaving ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Link2 size={13} aria-hidden="true" />
                  )}
                  Generate &amp; Save
                </button>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveManual}
                  disabled={
                    manualSaving ||
                    !isValidHttpUrl(manualForm.url) ||
                    !manualForm.source.trim() ||
                    !manualMedium ||
                    !manualForm.campaign.trim() ||
                    Number(manualForm.cost) < 0
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                >
                  {manualSaving ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus size={13} aria-hidden="true" />
                  )}
                  Save Manual UTM
                </button>
              </div>
            )
          }
        >
          <div className="space-y-4">
            <div
              role="radiogroup"
              aria-label="Link mode"
              className="flex w-full gap-1 rounded-xl bg-slate-100 p-1"
            >
              <button
                type="button"
                role="radio"
                aria-checked={createMode === "generate"}
                onClick={() => setCreateMode("generate")}
                className={`h-9 flex-1 rounded-lg px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  createMode === "generate"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Generate UTM
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={createMode === "manual"}
                onClick={() => setCreateMode("manual")}
                className={`h-9 flex-1 rounded-lg px-3 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                  createMode === "manual"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-600"
                }`}
              >
                Manual UTM
              </button>
            </div>

            {createMode === "generate" ? (
              <>
                {generateError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] text-rose-700"
                  >
                    {generateError}
                  </div>
                ) : null}

                <Field
                  label="Destination URL"
                  required
                  value={generateForm.url}
                  onChange={(value) => updateGenerate("url", value)}
                  placeholder="https://example.com/"
                  hint="The page people land on when they click your link."
                  error={
                    generateForm.url.trim() &&
                    !isValidHttpUrl(generateForm.url)
                      ? "Enter a full URL starting with http:// or https://"
                      : ""
                  }
                />

                <Field
                  label="Campaign"
                  required
                  value={generateForm.campaign}
                  onChange={(value) => updateGenerate("campaign", value)}
                  placeholder="August Admissions 2026"
                  hint="A name for this push, so you can group its leads later."
                />

                <Field
                  label="Influencer Name"
                  value={generateForm.influencerName}
                  onChange={(value) =>
                    updateGenerate("influencerName", value)
                  }
                  placeholder="Influencer / partner name"
                  hint="Optional — the partner or influencer sharing this link."
                />

                <PlatformSelect
                  label="Platform"
                  value={generateForm.source}
                  onChange={(value) => updateGenerate("source", value)}
                  hint="Where the link is shared (utm_source) — e.g. Instagram, YouTube."
                />

                <MediumSelect
                  value={generateForm.medium}
                  otherValue={generateForm.mediumOther}
                  onChange={(value) => {
                    updateGenerate("medium", value);
                    if (value !== "Other") {
                      updateGenerate("mediumOther", "");
                    }
                  }}
                  onOtherChange={(value) =>
                    updateGenerate("mediumOther", value)
                  }
                  hint="The type of channel (utm_medium) — e.g. Influencer, Paid Social."
                />

                <Field
                  label="Campaign Cost"
                  type="number"
                  min="0"
                  value={generateForm.cost}
                  onChange={(value) => updateGenerate("cost", value)}
                  placeholder="0"
                  hint="Optional — what you spent, used to work out cost per lead."
                  error={
                    Number(generateForm.cost) < 0
                      ? "Cost can't be negative."
                      : ""
                  }
                />

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="text-[13px] font-bold uppercase tracking-[0.1em] text-indigo-600">
                    {generatedUrl
                      ? "Generated Link"
                      : lastSavedLink
                        ? "Last Generated Link (saved)"
                        : "Generated Link"}
                  </div>

                  <div className="mt-2 min-h-[22px] break-all font-mono text-[13px] text-slate-700">
                    {generatedUrl ||
                      lastSavedLink ||
                      "Complete the fields to preview the generated UTM URL."}
                  </div>
                </div>
              </>
            ) : (
              <>
                {manualError ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] text-rose-700"
                  >
                    {manualError}
                  </div>
                ) : null}

                <Field
                  label="UTM URL"
                  required
                  value={manualForm.url}
                  onChange={(value) => updateManual("url", value)}
                  placeholder="https://example.com/?utm_source=..."
                  hint="Paste the full link you already built, with its utm_ tags."
                  error={
                    manualForm.url.trim() &&
                    !isValidHttpUrl(manualForm.url)
                      ? "Enter a full URL starting with http:// or https://"
                      : ""
                  }
                />

                <Field
                  label="Campaign"
                  required
                  value={manualForm.campaign}
                  onChange={(value) => updateManual("campaign", value)}
                  placeholder="Influencer August"
                  hint="A name for this push, so you can group its leads later."
                />

                <Field
                  label="Influencer Name"
                  value={manualForm.influencerName}
                  onChange={(value) =>
                    updateManual("influencerName", value)
                  }
                  placeholder="Influencer / partner name"
                  hint="Optional — the partner or influencer sharing this link."
                />

                <PlatformSelect
                  label="Platform / Source"
                  value={manualForm.source}
                  onChange={(value) => updateManual("source", value)}
                  hint="Where the link is shared (utm_source) — e.g. Instagram, YouTube."
                />

                <MediumSelect
                  value={manualForm.medium}
                  otherValue={manualForm.mediumOther}
                  onChange={(value) => {
                    updateManual("medium", value);
                    if (value !== "Other") {
                      updateManual("mediumOther", "");
                    }
                  }}
                  onOtherChange={(value) =>
                    updateManual("mediumOther", value)
                  }
                  hint="The type of channel (utm_medium) — e.g. Influencer, Paid Social."
                />

                <Field
                  label="Campaign Cost"
                  type="number"
                  min="0"
                  value={manualForm.cost}
                  onChange={(value) => updateManual("cost", value)}
                  placeholder="0"
                  hint="Optional — what you spent, used to work out cost per lead."
                  error={
                    Number(manualForm.cost) < 0
                      ? "Cost can't be negative."
                      : ""
                  }
                />
              </>
            )}
          </div>
        </Drawer>
      ) : null}


      {showLinkModal ? (
        <LinkModal
          editing={editingLink}
          onClose={() => {
            setShowLinkModal(false);
            setEditingLink(null);
          }}
          onSaved={async () => {
            setShowLinkModal(false);
            setEditingLink(null);
            await loadData();
          }}
        />
      ) : null}
    </div>
  );
}
