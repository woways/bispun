import {
  Fragment,
  cloneElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import {
  Plus,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Trash2,
  Pencil,
  Database,
  Users,
  UserCheck,
  Layers3,
  Search,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  UserPlus,
  SlidersHorizontal,
  Download,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Mail,
  Send,
  MessageCircle,
  MessageSquare,
  Smartphone,
  History,
  Copy,
  PhoneCall,
  Paperclip,
  Link2,
  FileText,
  Sparkles,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  WrapText,
  Pin,
  MoreVertical,
  Megaphone,
} from "lucide-react";

import {
  Table,
  Badge,
  stageTone,
} from "../../components/ui";
import DetailModal from "../../components/DetailModal";

import {
  apiRequest,
} from "../../lib/api";
import { formatUiDate } from "../../lib/uiPreferences";
import NurtureCenter from "../../components/lead/NurtureCenter";
import CallCenterModal from "../../components/lead/CallCenterModal";
import LeadDetailsView from "../../components/lead/LeadDetailsView";
import { openWhatsApp, openSMS, telHref } from "../../lib/nativeActions";
import { useOverlayDismiss } from "../../lib/useOverlayDismiss";

const TYPES = [
  {
    key: "external",
    api: "EXTERNAL_DATA",
    label: "External Data",
  },
  {
    key: "offline",
    api: "OFFLINE_LEADGEN",
    label: "Offline LeadGen",
  },
  {
    key: "purchased",
    api: "PURCHASED",
    label: "Purchased",
  },
  {
    key: "uploaded",
    api: "UPLOADED",
    label: "Uploaded",
  },
  {
    key: "assigned",
    api: "ASSIGNED",
    label: "Assigned",
  },
  {
    key: "google_form",
    api: "GOOGLE_FORM",
    label: "Google Form",
  },
  {
    key: "website_form",
    api: "WEBSITE_FORM",
    label: "Website Form",
  },
  {
    key: "im",
    api: "IM",
    label: "IM Leads",
  },
  {
    key: "dm",
    api: "DM",
    label: "DM Leads",
  },
  {
    key: "internal",
    api: "INTERNAL",
    label: "Internal Leads",
  },
];

const ALL_LEADS_TYPE = {
  key: "all",
  api: "ALL",
  label: "All Leads",
};

const INDIVIDUAL_LEAD_TYPE = {
  key: "individual",
  api: "INDIVIDUAL",
  label: "Individual Leads",
};

const ALL_LEAD_TYPES = [
  ALL_LEADS_TYPE,
  INDIVIDUAL_LEAD_TYPE,
  ...TYPES,
];

// 3.9: recommended Source values for the Add Lead dropdown. "Other" reveals a
// free-text input and the typed value is saved as the source.
const SOURCE_OPTIONS = [
  "Website",
  "Google Form",
  "Google Ads",
  "Meta/Facebook/Instagram",
  "Referral",
  "Walk-in",
  "College Expo/Event",
  "WhatsApp",
  "Call/Telecalling",
  "Partner/Agent",
  "Organic",
  "Purchased Data",
  "Other",
];

// Common Course / Interest choices. Existing/custom values remain supported via Other.
const COURSE_OPTIONS = [
  "B.Tech",
  "MBA",
  "BBA",
  "B.Com",
  "MBBS",
  "NEET",
  "Law",
  "Pharmacy",
  "Nursing",
  "Other",
];

function leadCategoryApi(lead) {
  return String(
    lead?.type || (lead?.isManual ? "INDIVIDUAL" : "")
  )
    .trim()
    .toUpperCase();
}

function leadCategoryLabel(lead) {
  const api = leadCategoryApi(lead);
  return (
    [INDIVIDUAL_LEAD_TYPE, ...TYPES].find((type) => type.api === api)?.label ||
    api ||
    "Unknown"
  );
}

const LEAD_TEMPERATURES = [
  { value: "HOT", label: "Hot" },
  { value: "WARM", label: "Warm" },
  { value: "COLD", label: "Cold" },
];

const FIXED_LEAD_STATUSES = [
  "Fresh",
  "Call Initiated",
  "Not Answering",
  "Not Reachable",
  "Lead Lost",
  "Application Done",
  "Admission Done",
];

function statusSelectClass(value) {
  if (value === "Admission Done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "Application Done") return "border-violet-200 bg-violet-50 text-violet-700";
  if (value === "Lead Lost") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "Not Answering" || value === "Not Reachable") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "Call Initiated") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (value === "Fresh") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-violet-200 bg-violet-50 text-violet-700";
}

function temperatureSelectClass(value) {
  if (value === "HOT") return "border-rose-200 bg-rose-50 text-rose-700";
  if (value === "COLD") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}


const INDIVIDUAL_COLUMN_OPTIONS = [
  { key: "phone", label: "Phone" },
  { key: "alternatePhone", label: "Alternative Phone" },
  { key: "email", label: "Email" },
  { key: "course", label: "Course" },
  { key: "preferredColleges", label: "Interested College" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "temperature", label: "Lead Type" },
  { key: "status", label: "Status" },
  { key: "dataset", label: "Dataset" },
  { key: "created", label: "Created" },
];

const DEFAULT_INDIVIDUAL_COLUMNS = {
  phone: true,
  alternatePhone: true,
  email: true,
  course: true,
  preferredColleges: true,
  assignedTo: true,
  temperature: true,
  status: true,
  dataset: true,
  created: false,
};

const DEFAULT_INDIVIDUAL_COLUMN_ORDER = [
  "leadId",
  "name",
  "phone",
  "alternatePhone",
  "email",
  "course",
  "preferredColleges",
  "assignedTo",
  "temperature",
  "status",
  "intelligence",
  "dataset",
  "created",
];

const INDIVIDUAL_COLUMN_LABELS = {
  leadId: "Lead ID",
  name: "Name",
  phone: "Phone",
  alternatePhone: "Alternative Phone",
  email: "Email",
  course: "Course",
  preferredColleges: "Interested College",
  assignedTo: "Assigned To",
  temperature: "Lead Type",
  status: "Status",
  intelligence: "Lead Intelligence",
  dataset: "Dataset",
  created: "Created",
};

function normalizeIndividualColumnOrder(value) {
  const requested = Array.isArray(value) ? value : [];
  const valid = requested.filter(
    (key, index) =>
      DEFAULT_INDIVIDUAL_COLUMN_ORDER.includes(key) &&
      requested.indexOf(key) === index
  );

  return [
    ...valid,
    ...DEFAULT_INDIVIDUAL_COLUMN_ORDER.filter((key) => !valid.includes(key)),
  ];
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

  return formatUiDate(date);
}

function normalizeFilterText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function matchesDateRange(value, from, to) {
  if (!from && !to) {
    return true;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (from) {
    const start = new Date(`${from}T00:00:00`);

    if (date < start) {
      return false;
    }
  }

  if (to) {
    const end = new Date(`${to}T23:59:59.999`);

    if (date > end) {
      return false;
    }
  }

  return true;
}

function csvCell(value) {
  const text = String(value ?? "");

  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");

  const blob = new Blob(
    [`\ufeff${csv}`],
    {
      type: "text/csv;charset=utf-8;",
    }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(
    () => URL.revokeObjectURL(url),
    0
  );
}

function normalizeManualLeadPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  return digits;
}

function isValidManualLeadPhone(value) {
  return /^[6-9]\d{9}$/.test(normalizeManualLeadPhone(value));
}

function isValidManualLeadName(value) {
  const name = String(value ?? "").trim();

  return (
    name.length >= 2 &&
    /\p{L}/u.test(name) &&
    /^[\p{L}\s.'’-]+$/u.test(name)
  );
}

function displayLeadId(leadNumber) {
  const value = Number(leadNumber);
  return Number.isInteger(value) && value > 0
    ? `LD${String(value).padStart(3, "0")}`
    : "—";
}


function PhoneAction({ phone, name, onCopied, onDial }) {
  const [menu, setMenu] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menu) return undefined;

    function closeMenu(event) {
      if (event.key === "Escape") setMenu(null);
    }

    function closeOnOutsideClick(event) {
      const target = event.target;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setMenu(null);
    }

    function closeOnViewportChange() {
      setMenu(null);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeMenu);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeMenu);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [menu]);

  if (!phone) return <span className="text-slate-400">—</span>;

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(String(phone));
    } catch {
      const input = document.createElement("textarea");
      input.value = String(phone);
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    setMenu(null);
    onCopied?.(`${name || "Lead"} number copied.`);
  }

  function openMenu(event) {
    if (menu) {
      setMenu(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 178;
    setMenu({
      top: Math.min(rect.bottom + 6, window.innerHeight - 220),
      left: Math.min(Math.max(8, rect.left), window.innerWidth - menuWidth - 8),
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        className="inline-flex min-h-[44px] items-center font-semibold text-indigo-600 hover:text-indigo-800 hover:underline lg:min-h-0"
        title="Copy or dial this number"
      >
        {phone}
      </button>

      {menu ? (
        <div
          ref={menuRef}
          className="fixed z-[130] w-[178px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl"
          style={{ top: menu.top, left: menu.left }}
        >
          <button
            type="button"
            onClick={copyNumber}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Copy size={14} />
            Copy number
          </button>
          <a
            href={telHref(phone)}
            onClick={() => setMenu(null)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            <PhoneCall size={14} />
            Dial number
          </a>
          {onDial ? (
            <button
              type="button"
              onClick={() => {
                setMenu(null);
                triggerRef.current?.focus();
                onDial();
              }}
              aria-label={`Dial and record call with ${name}`}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              <PhoneCall size={14} />
              {"Dial & record"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setMenu(null);
              openWhatsApp(phone);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-50"
          >
            <MessageCircle size={14} />
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => {
              setMenu(null);
              openSMS(phone);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare size={14} />
            Message (SMS)
          </button>
        </div>
      ) : null}
    </>
  );
}


function LeadStatusSelect({
  lead,
  options,
  disabled,
  onChangeStatus,
  onAdmissionDone,
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customStatus, setCustomStatus] = useState("");
  const [savingCustom, setSavingCustom] = useState(false);
  const currentStatus = lead.leadStatus || "Fresh";

  async function handleSelect(event) {
    const value = event.target.value;

    if (value === "__OTHER__") {
      setCustomStatus("");
      setCustomOpen(true);
      return;
    }

    if (value === "Admission Done") {
      onAdmissionDone?.(lead);
      return;
    }

    await onChangeStatus(lead.id, value);
  }

  async function saveCustomStatus() {
    const value = customStatus.trim().replace(/\s+/g, " ");
    if (!value) return;

    setSavingCustom(true);
    try {
      await onChangeStatus(lead.id, value, { custom: true });
      setCustomOpen(false);
      setCustomStatus("");
    } finally {
      setSavingCustom(false);
    }
  }

  if (customOpen) {
    return (
      <div className="flex min-w-[235px] items-center gap-1.5">
        <input
          autoFocus
          value={customStatus}
          maxLength={50}
          onChange={(event) => setCustomStatus(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveCustomStatus();
            }
            if (event.key === "Escape") {
              setCustomOpen(false);
              setCustomStatus("");
            }
          }}
          placeholder="Enter custom status"
          className="h-8 min-w-0 flex-1 rounded-lg border border-violet-200 bg-white px-2 text-[12px] font-medium text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
        <button
          type="button"
          onClick={saveCustomStatus}
          disabled={savingCustom || !customStatus.trim()}
          className="h-8 rounded-lg bg-violet-600 px-2.5 text-[11px] font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {savingCustom ? "..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setCustomOpen(false);
            setCustomStatus("");
          }}
          disabled={savingCustom}
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <select
      value={currentStatus}
      disabled={disabled}
      onChange={handleSelect}
      className={`h-8 min-w-[145px] rounded-lg border px-2 text-[12px] font-bold outline-none transition disabled:opacity-60 ${statusSelectClass(currentStatus)}`}
      aria-label={`Status for ${lead.name}`}
    >
      {options.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
      <option value="__OTHER__">Other</option>
    </select>
  );
}

function AdmissionDoneModal({ lead, onClose, onSaved }) {
  const dialogRef = useRef(null);
  const [streams, setStreams] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [branches, setBranches] = useState([]);
  const [streamId, setStreamId] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useOverlayDismiss(Boolean(lead), onClose, { containerRef: dialogRef });

  useEffect(() => {
    let active = true;
    if (!lead) return undefined;

    setLoading(true);
    setError("");
    apiRequest("/api/client/admissions/streams?market=DOMESTIC")
      .then((data) => {
        if (active) setStreams(Array.isArray(data?.streams) ? data.streams : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.data?.message || "Unable to load streams.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [lead]);

  async function selectStream(value) {
    setStreamId(value);
    setCollegeId("");
    setBranchId("");
    setColleges([]);
    setBranches([]);
    setError("");
    if (!value) return;

    setLoadingOptions(true);
    try {
      const stream = streams.find((item) => item.id === value);
      const market = stream?.market || "DOMESTIC";
      const data = await apiRequest(
        `/api/client/admissions/partners?streamId=${encodeURIComponent(value)}&market=${encodeURIComponent(market)}`
      );
      setColleges(Array.isArray(data?.partners) ? data.partners : []);
    } catch (requestError) {
      setError(requestError?.data?.message || "Unable to load colleges.");
    } finally {
      setLoadingOptions(false);
    }
  }

  async function selectCollege(value) {
    setCollegeId(value);
    setBranchId("");
    setBranches([]);
    setError("");
    if (!value) return;

    setLoadingOptions(true);
    try {
      const stream = streams.find((item) => item.id === streamId);
      const market = stream?.market || "DOMESTIC";
      const data = await apiRequest(
        `/api/client/admissions/branches?partnerId=${encodeURIComponent(value)}&market=${encodeURIComponent(market)}`
      );
      setBranches(Array.isArray(data?.branches) ? data.branches : []);
    } catch (requestError) {
      setError(requestError?.data?.message || "Unable to load branches.");
    } finally {
      setLoadingOptions(false);
    }
  }

  async function saveAdmission() {
    const stream = streams.find((item) => item.id === streamId);
    const college = colleges.find((item) => item.id === collegeId);
    const branch = branches.find((item) => item.id === branchId);
    if (!stream || !college || !branch || saving) return;

    setSaving(true);
    setError("");
    try {
      const data = await apiRequest("/api/client/admissions", {
        method: "POST",
        body: JSON.stringify({
          market: stream.market || "DOMESTIC",
          partnerId: college.id,
          branchId: branch.id,
          leadId: lead.id,
          studentName: lead.name,
          studentPhone: lead.phone,
          studentEmail: lead.email || "",
          universityName: college.name,
          college: college.name,
          course: branch.name,
          counsellorName: lead.assignedToName || "",
          totalFee: 0,
          paidAmount: 0,
          revenueStatus: "BUFFER_ZONE",
          status: "ONGOING",
          admissionDate: new Date().toISOString(),
          notes: "Created from Lead Store Admission Done status",
        }),
      });
      onSaved?.(data);
    } catch (requestError) {
      setError(requestError?.data?.message || "Unable to create admission.");
    } finally {
      setSaving(false);
    }
  }

  if (!lead || typeof document === "undefined") return null;

  const canSave = Boolean(streamId && collegeId && branchId) && !saving;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[1px]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admission-done-title"
        tabIndex={-1}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="admission-done-title" className="text-[17px] font-bold text-slate-950">Complete Admission</h2>
            <p className="mt-1 text-[12px] text-slate-500">Select the destination for {lead.name || "this lead"}.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close admission form">
            <X size={17} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">{error}</div> : null}
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-[13px] text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading admission options...</div>
          ) : (
            <>
              <Field label="Stream" required>
                <select value={streamId} onChange={(event) => selectStream(event.target.value)} disabled={saving} className="form-input">
                  <option value="">Select stream</option>
                  {streams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="College" required>
                <select value={collegeId} onChange={(event) => selectCollege(event.target.value)} disabled={!streamId || loadingOptions || saving} className="form-input">
                  <option value="">Select college</option>
                  {colleges.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              <Field label="Branch" required>
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={!collegeId || loadingOptions || saving} className="form-input">
                  <option value="">Select branch</option>
                  {branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </Field>
              {loadingOptions ? <div className="flex items-center gap-2 text-[11px] text-slate-400"><Loader2 size={12} className="animate-spin" /> Loading options...</div> : null}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} disabled={saving} className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={saveAdmission} disabled={!canSave} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
            Save Admission
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


function Field({
  label,
  required = false,
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
      <div className="block text-[13px] font-medium text-slate-600 mb-1">
        {label}

        {required && (
          <span className="text-rose-500 ml-0.5">
            *
          </span>
        )}
      </div>

      {children}
    </label>
  );
}


function intelligenceTone(score) {
  const value = Number(score || 0);
  if (value >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value >= 65) return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (value >= 45) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function followUpInputParts(value) {
  if (!value) return { date: "", time: "" };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "" };

  const pad = (number) => String(number).padStart(2, "0");

  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function IndividualLeadModal({
  assignees,
  onClose,
  onSaved,
  lead = null,
  defaultType = "INDIVIDUAL",
  courseOptions = [],
}) {
  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState({});

  const [
    customFields,
    setCustomFields,
  ] = useState([]);

  const [
    customFieldsLoading,
    setCustomFieldsLoading,
  ] = useState(true);

  const [
    customFieldValues,
    setCustomFieldValues,
  ] = useState({});

  const initialFollowUp = followUpInputParts(lead?.followUpAt);

  const [
    form,
    setForm,
  ] =
    useState({
      name: lead?.name || "",
      phone: lead?.phone || "",
      alternatePhone: lead?.alternatePhone || "",
      email: lead?.email || "",
      course: lead?.course || "",
      preferredColleges: lead?.preferredColleges || "",
      temperature: lead?.temperature || "WARM",
      type: lead?.type || defaultType || "INDIVIDUAL",
      sourceName: lead?.sourceName || "",
      assignedToUserId: "",
      followUpDate: initialFollowUp.date,
      followUpTime: initialFollowUp.time,
      remark: "",
      notes: lead?.notes || "",
    });

  const mergedCourseOptions = Array.from(
    new Set([
      ...COURSE_OPTIONS.filter((option) => option !== "Other"),
      ...courseOptions.filter(Boolean),
      "Other",
    ])
  );
  const [courseOther, setCourseOther] = useState(
    !!(lead?.course && !mergedCourseOptions.includes(lead.course))
  );
  const [sourceOther, setSourceOther] = useState(
    !!(lead?.sourceName && !SOURCE_OPTIONS.includes(lead.sourceName))
  );
  const [remarks, setRemarks] = useState(lead?.remarks || []);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [editingRemarkId, setEditingRemarkId] = useState("");
  const [editingRemarkText, setEditingRemarkText] = useState("");

  function update(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );

    setFieldErrors(
      (current) => ({
        ...current,
        [field]: "",
      })
    );
  }

  useEffect(() => {
    let active = true;

    async function loadCustomFields() {
      setCustomFieldsLoading(true);

      try {
        const data = await apiRequest(
          "/api/client/leads/meta/custom-fields"
        );

        if (!active) return;

        const fields = data.fields || [];
        setCustomFields(fields);

        setCustomFieldValues((current) => {
          const next = { ...current };

          fields.forEach((field) => {
            const existing = lead?.customFields?.find(
              (item) => item.key === field.key
            );

            if (existing) {
              next[field.key] =
                field.fieldType === "CHECKBOX"
                  ? String(existing.value).toLowerCase() === "true"
                  : existing.value ?? "";
            } else if (!(field.key in next)) {
              next[field.key] =
                field.fieldType === "CHECKBOX"
                  ? false
                  : "";
            }
          });

          return next;
        });
      } catch (error) {
        if (active) {
          setError(
            error?.data?.message ||
              "Unable to load custom fields"
          );
        }
      } finally {
        if (active) {
          setCustomFieldsLoading(false);
        }
      }
    }

    loadCustomFields();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!lead?.assignedToName || !assignees.length) return;
    const match = assignees.find(
      (user) => user.name === lead.assignedToName
    );
    if (match) {
      setForm((current) => ({
        ...current,
        assignedToUserId: match.id,
      }));
    }
  }, [lead, assignees]);

  function updateCustomField(key, value) {
    setCustomFieldValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function addRemark() {
    const text = remarkDraft.trim();
    if (!lead?.id || !text || remarkSaving) return;

    setRemarkSaving(true);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual/${lead.id}/remarks`,
        {
          method: "POST",
          body: JSON.stringify({ text }),
        }
      );

      setRemarks(data.remarks || []);
      setRemarkDraft("");
    } catch (error) {
      setError(error?.data?.message || "Unable to add remark");
    } finally {
      setRemarkSaving(false);
    }
  }

  async function saveRemarkEdit(remarkId) {
    const text = editingRemarkText.trim();
    if (!lead?.id || !remarkId || !text || remarkSaving) return;

    setRemarkSaving(true);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual/${lead.id}/remarks/${remarkId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ text }),
        }
      );

      setRemarks(data.remarks || []);
      setEditingRemarkId("");
      setEditingRemarkText("");
    } catch (error) {
      setError(error?.data?.message || "Unable to update remark");
    } finally {
      setRemarkSaving(false);
    }
  }

  async function deleteRemark(remarkId) {
    if (!lead?.id || !remarkId || remarkSaving) return;
    if (!window.confirm("Delete this remark?")) return;

    setRemarkSaving(true);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual/${lead.id}/remarks/${remarkId}`,
        { method: "DELETE" }
      );

      setRemarks(data.remarks || []);
      if (editingRemarkId === remarkId) {
        setEditingRemarkId("");
        setEditingRemarkText("");
      }
    } catch (error) {
      setError(error?.data?.message || "Unable to delete remark");
    } finally {
      setRemarkSaving(false);
    }
  }

  async function submit(
    event
  ) {
    event.preventDefault();

    const nextFieldErrors = {};

    if (!isValidManualLeadName(form.name)) {
      nextFieldErrors.name =
        "Use letters, spaces, apostrophes, periods or hyphens only.";
    }

    if (!isValidManualLeadPhone(form.phone)) {
      nextFieldErrors.phone =
        "Enter a valid 10-digit Indian mobile number.";
    }

    if (Boolean(form.followUpDate) !== Boolean(form.followUpTime)) {
      nextFieldErrors.followUpAt =
        "Choose both follow-up date and time.";
    }

    if (form.alternatePhone && !isValidManualLeadPhone(form.alternatePhone)) {
      nextFieldErrors.alternatePhone =
        "Enter a valid 10-digit Indian mobile number.";
    }

    if (
      form.alternatePhone &&
      normalizeManualLeadPhone(form.alternatePhone) ===
        normalizeManualLeadPhone(form.phone)
    ) {
      nextFieldErrors.alternatePhone =
        "Alternative phone must be different from the primary phone.";
    }

    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length) {
      setError("Please correct the highlighted fields.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const followUpAt =
        form.followUpDate && form.followUpTime
          ? new Date(`${form.followUpDate}T${form.followUpTime}`).toISOString()
          : null;

      const {
        followUpDate,
        followUpTime,
        remark,
        ...leadForm
      } = form;

      const data =
        await apiRequest(
          lead
            ? `/api/client/lead-store/manual/${lead.id}`
            : "/api/client/lead-store/manual",
          {
            method: lead ? "PATCH" : "POST",
            body:
              JSON.stringify({
                ...leadForm,
                name: form.name.trim(),
                phone: normalizeManualLeadPhone(form.phone),
                alternatePhone: form.alternatePhone
                  ? normalizeManualLeadPhone(form.alternatePhone)
                  : "",
                followUpAt,
                remark: lead ? undefined : remark,
                customFields:
                  customFieldValues,
              }),
          }
        );

      onSaved(
        data
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to add lead"
      );
    } finally {
      setSaving(false);
    }
  }

  const addLeadPanelRef = useRef(null);
  useOverlayDismiss(true, onClose, { containerRef: addLeadPanelRef });

  // P2: portal to <body> so the fixed overlay escapes the dashboard content
  // wrapper's containing block (transform/scale ancestor) — otherwise the modal
  // is trapped in that box and sits half-behind the expanded sidebar at ~1024px.
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex justify-end">
      <div
        ref={addLeadPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="individual-lead-title"
        tabIndex={-1}
        className="flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl outline-none animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        <style>{"@keyframes drawerSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}"}</style>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="individual-lead-title" className="text-[17px] font-semibold">
                {lead ? "Edit Lead" : "Add Lead"}
              </h2>
              {lead && (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-2 text-[12px] font-bold tabular-nums text-slate-600">
                  {displayLeadId(lead.leadNumber)}
                </span>
              )}
            </div>

            <p className="text-[13px] text-slate-500 mt-1">
              {lead
                ? "Update this lead and its custom field values."
                : "Add one lead directly to the selected Lead Store category."}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              saving
            }
            aria-label="Close"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X
              size={17}
              aria-hidden="true"
            />
          </button>
        </div>

        <form
          onSubmit={
            submit
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-4">
            {error && (
              <div className="md:col-span-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[15px] text-rose-700 flex items-start gap-2">
                <AlertCircle
                  size={15}
                  className="mt-0.5 flex-shrink-0"
                />
                {error}
              </div>
            )}

            <Field
              label="Name"
              required
            >
              <input
                required
                value={
                  form.name
                }
                onChange={(
                  event
                ) =>
                  update(
                    "name",
                    event.target.value
                  )
                }
                className={`form-input ${
                  fieldErrors.name
                    ? "border-rose-300 focus:border-rose-400"
                    : ""
                }`}
                placeholder="Student / Lead name"
                aria-invalid={Boolean(fieldErrors.name)}
              />

              {fieldErrors.name && (
                <div className="mt-1 text-xs font-medium text-rose-600">
                  {fieldErrors.name}
                </div>
              )}
            </Field>

            <Field
              label="Phone"
              required
            >
              <input
                required
                value={form.phone}
                onChange={(event) =>
                  update(
                    "phone",
                    event.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
                disabled={Boolean(lead)}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                className={`form-input ${
                  fieldErrors.phone
                    ? "border-rose-300 focus:border-rose-400"
                    : ""
                } ${lead ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
                placeholder="9876543210"
                aria-invalid={Boolean(fieldErrors.phone)}
              />

              {fieldErrors.phone && (
                <div className="mt-1 text-xs font-medium text-rose-600">
                  {fieldErrors.phone}
                </div>
              )}

              {lead && (
                <div className="mt-1 text-[11px] text-slate-400">
                  Primary phone is fixed after the lead is created.
                </div>
              )}
            </Field>

            <Field label="Alternative Phone">
              <input
                value={form.alternatePhone}
                onChange={(event) =>
                  update(
                    "alternatePhone",
                    event.target.value.replace(/\D/g, "").slice(0, 10)
                  )
                }
                disabled={Boolean(lead?.alternatePhone)}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
                pattern="[6-9][0-9]{9}"
                className={`form-input ${
                  fieldErrors.alternatePhone
                    ? "border-rose-300 focus:border-rose-400"
                    : ""
                } ${lead?.alternatePhone ? "cursor-not-allowed bg-slate-50 text-slate-500" : ""}`}
                placeholder="Optional alternate number"
                aria-invalid={Boolean(fieldErrors.alternatePhone)}
              />

              {fieldErrors.alternatePhone && (
                <div className="mt-1 text-xs font-medium text-rose-600">
                  {fieldErrors.alternatePhone}
                </div>
              )}

              {lead?.alternatePhone ? (
                <div className="mt-1 text-[11px] text-slate-400">
                  Alternative phone is fixed after it is saved.
                </div>
              ) : lead ? (
                <div className="mt-1 text-[11px] text-slate-400">
                  You can add an alternative phone once; after saving it becomes fixed.
                </div>
              ) : null}
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={
                  form.email
                }
                onChange={(
                  event
                ) =>
                  update(
                    "email",
                    event.target.value
                  )
                }
                className="form-input"
                placeholder="lead@example.com"
              />
            </Field>

            <Field label="Course / Interest">
              <select
                value={
                  courseOther
                    ? "Other"
                    : mergedCourseOptions.includes(form.course)
                    ? form.course
                    : ""
                }
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "Other") {
                    setCourseOther(true);
                    update("course", "");
                  } else {
                    setCourseOther(false);
                    update("course", value);
                  }
                }}
                className="form-input"
              >
                <option value="">Select course / interest</option>
                {mergedCourseOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {courseOther && (
                <input
                  value={form.course}
                  onChange={(event) => update("course", event.target.value)}
                  className="form-input mt-2"
                  placeholder="Enter course / interest"
                  autoFocus
                />
              )}
            </Field>

            <Field label="Interested College">
              <input
                value={form.preferredColleges}
                onChange={(event) =>
                  update("preferredColleges", event.target.value)
                }
                className="form-input"
                placeholder="e.g. VNR VJIET, CBIT (comma-separated)"
              />
            </Field>

            <Field
              label="Lead Type"
              required
            >
              <select
                value={
                  form.type
                }
                onChange={(
                  event
                ) =>
                  update(
                    "type",
                    event.target.value
                  )
                }
                className="form-input"
              >
                {ALL_LEAD_TYPES.map(
                  (
                    type
                  ) => (
                    <option
                      key={
                        type.api
                      }
                      value={
                        type.api
                      }
                    >
                      {
                        type.label
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Lead Type (Hot / Warm / Cold)" required>
              <select
                value={form.temperature}
                onChange={(event) =>
                  update("temperature", event.target.value)
                }
                className={`form-input font-semibold ${temperatureSelectClass(form.temperature)}`}
              >
                {LEAD_TEMPERATURES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Source">
              <select
                value={
                  sourceOther
                    ? "Other"
                    : SOURCE_OPTIONS.includes(form.sourceName)
                    ? form.sourceName
                    : ""
                }
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "Other") {
                    setSourceOther(true);
                    update("sourceName", "");
                  } else {
                    setSourceOther(false);
                    update("sourceName", value);
                  }
                }}
                className="form-input"
              >
                <option value="">Select source</option>
                {SOURCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {sourceOther && (
                <input
                  value={form.sourceName}
                  onChange={(event) =>
                    update("sourceName", event.target.value)
                  }
                  className="form-input mt-2"
                  placeholder="Enter custom source"
                />
              )}
            </Field>

            <Field label="Follow-up">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(event) =>
                    update("followUpDate", event.target.value)
                  }
                  className={`form-input ${
                    fieldErrors.followUpAt ? "border-rose-300" : ""
                  }`}
                  aria-label="Follow-up date"
                />
                <input
                  type="time"
                  value={form.followUpTime}
                  onChange={(event) =>
                    update("followUpTime", event.target.value)
                  }
                  className={`form-input ${
                    fieldErrors.followUpAt ? "border-rose-300" : ""
                  }`}
                  aria-label="Follow-up time"
                />
              </div>
              {fieldErrors.followUpAt && (
                <div className="mt-1 text-xs font-medium text-rose-600">
                  {fieldErrors.followUpAt}
                </div>
              )}
              {form.followUpDate && form.followUpTime && (
                <div className="mt-1 text-[11px] text-slate-500">
                  Reminder alerts: 2 days, 1 day, same day and 1 hour before.
                </div>
              )}
            </Field>

            <Field
              label="Assign To"
              full
            >
              <select
                value={
                  form.assignedToUserId
                }
                onChange={(
                  event
                ) =>
                  update(
                    "assignedToUserId",
                    event.target.value
                  )
                }
                className="form-input"
              >
                <option value="">
                  Unassigned
                </option>

                {assignees.map(
                  (
                    user
                  ) => (
                    <option
                      key={
                        user.id
                      }
                      value={
                        user.id
                      }
                    >
                      {user.name} · {user.role.replaceAll("_", " ")}
                    </option>
                  )
                )}
              </select>
            </Field>

            {customFieldsLoading ? (
              <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-[13px] text-slate-500 inline-flex items-center gap-2">
                <Loader2
                  size={14}
                  className="animate-spin"
                />
                Loading custom fields...
              </div>
            ) : customFields.length ? (
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-4">
                  <div className="text-[15px] font-bold text-slate-900">
                    Custom Fields
                  </div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    Fields configured in Settings → Custom Fields.
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {customFields.map((field) => {
                    const value =
                      customFieldValues[field.key] ??
                      (field.fieldType === "CHECKBOX"
                        ? false
                        : "");

                    if (field.fieldType === "CHECKBOX") {
                      return (
                        <label
                          key={field.id}
                          className="md:col-span-2 flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(event) =>
                              updateCustomField(
                                field.key,
                                event.target.checked
                              )
                            }
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600"
                          />

                          <span>
                            <span className="block text-[13px] font-semibold text-slate-700">
                              {field.name}
                              {field.required ? (
                                <span className="ml-0.5 text-rose-500">
                                  *
                                </span>
                              ) : null}
                            </span>

                            {field.description ? (
                              <span className="mt-1 block text-xs text-slate-500">
                                {field.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    }

                    return (
                      <Field
                        key={field.id}
                        label={field.name}
                        required={field.required}
                      >
                        {field.fieldType === "DROPDOWN" ? (
                          <select
                            required={field.required}
                            value={value}
                            onChange={(event) =>
                              updateCustomField(
                                field.key,
                                event.target.value
                              )
                            }
                            className="form-input"
                          >
                            <option value="">
                              Select {field.name}
                            </option>

                            {(field.options || []).map(
                              (option) => (
                                <option
                                  key={option}
                                  value={option}
                                >
                                  {option}
                                </option>
                              )
                            )}
                          </select>
                        ) : (
                          <input
                            type={
                              field.fieldType === "NUMBER"
                                ? "number"
                                : field.fieldType === "DATE"
                                ? "date"
                                : field.fieldType === "EMAIL"
                                ? "email"
                                : field.fieldType === "PHONE"
                                ? "tel"
                                : "text"
                            }
                            required={field.required}
                            value={value}
                            onChange={(event) =>
                              updateCustomField(
                                field.key,
                                event.target.value
                              )
                            }
                            className="form-input"
                            placeholder={
                              field.description ||
                              `Enter ${field.name}`
                            }
                          />
                        )}
                      </Field>
                    );
                  })}
                </div>
              </div>
            ) : null}

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
                    event.target.value
                  )
                }
                className="form-input min-h-[86px] py-2"
              />
            </Field>

            {!lead ? (
              <Field label="Remarks" full>
                <textarea
                  rows={3}
                  value={form.remark}
                  onChange={(event) =>
                    update("remark", event.target.value)
                  }
                  className="form-input min-h-[86px] py-2"
                  placeholder="Add the first remark for this lead"
                />
              </Field>
            ) : (
              <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-bold text-slate-900">
                      Remarks
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      Latest 5 remarks are shown. New remarks are saved to this lead's history.
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 ring-1 ring-slate-200">
                    Last 5
                  </span>
                </div>

                <div className="mt-3 flex items-start gap-2">
                  <textarea
                    rows={2}
                    value={remarkDraft}
                    onChange={(event) => setRemarkDraft(event.target.value)}
                    className="form-input min-h-[68px] flex-1 py-2"
                    placeholder="Add a new remark..."
                  />
                  <button
                    type="button"
                    onClick={addRemark}
                    disabled={remarkSaving || !remarkDraft.trim()}
                    className="h-10 shrink-0 rounded-lg bg-indigo-600 px-3 text-[12px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {remarkSaving ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plus size={13} />
                    )}
                    Add
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  {remarks.length ? (
                    remarks.slice(0, 5).map((remark) => (
                      <div
                        key={remark.id}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                      >
                        {editingRemarkId === remark.id ? (
                          <div>
                            <textarea
                              rows={2}
                              value={editingRemarkText}
                              onChange={(event) =>
                                setEditingRemarkText(event.target.value)
                              }
                              className="form-input min-h-[68px] py-2"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRemarkId("");
                                  setEditingRemarkText("");
                                }}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveRemarkEdit(remark.id)}
                                disabled={remarkSaving || !editingRemarkText.trim()}
                                className="h-8 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 whitespace-pre-wrap text-[13px] leading-5 text-slate-700">
                                {remark.text}
                              </div>
                              {!remark.legacy && (
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingRemarkId(remark.id);
                                      setEditingRemarkText(remark.text || "");
                                    }}
                                    className="h-7 w-7 rounded-md text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center"
                                    aria-label="Edit remark"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteRemark(remark.id)}
                                    className="h-7 w-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 inline-flex items-center justify-center"
                                    aria-label="Delete remark"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="mt-1.5 text-[10px] text-slate-400">
                              {remark.createdBy || "CRM user"} · {formatDateTime(remark.updatedAt || remark.createdAt)}
                              {remark.legacy ? " · Existing note" : ""}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-[12px] text-slate-400">
                      No remarks yet. Use + Add to save the first remark.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="md:col-span-2 bg-indigo-50/60 border border-indigo-100 rounded-lg px-3 py-2.5 text-[13px] text-indigo-800 leading-5">
              This lead is stored directly in the main CRM Leads table. We do not create a fake one-row dataset. It will immediately appear in the normal Leads module.
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex shrink-0 justify-end gap-2">
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
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
            >
              {saving ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <UserPlus
                  size={14}
                />
              )}

              {saving
                ? lead ? "Saving..." : "Adding..."
                : lead ? "Save Changes" : "Add Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function UploadDatasetModal({
  assignees,
  onClose,
  onImported,
  defaultType = "EXTERNAL_DATA",
  courseOptions = [],
}) {
  const [
    file,
    setFile,
  ] =
    useState(null);

  const [
    preview,
    setPreview,
  ] =
    useState(null);

  const [
    previewing,
    setPreviewing,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState({
      name: "",
      type:
        defaultType || "EXTERNAL_DATA",
      sourceName:
        "",
      defaultCourse:
        "",
      assignedToUserId:
        "",
      notes:
        "",
    });

  const uploadCourseOptions = Array.from(
    new Set([
      ...COURSE_OPTIONS.filter((option) => option !== "Other"),
      ...courseOptions.filter(Boolean),
      "Other",
    ])
  );
  const [courseOther, setCourseOther] = useState(false);
  const [sourceOther, setSourceOther] = useState(false);

  // Drawer panel ref (referenced by ref={panelRef} on the dialog). Was missing,
  // which crashed the Import Leads modal with "panelRef is not defined".
  const panelRef = useRef(null);

  function update(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
      })
    );
  }

  async function previewFile(
    selectedFile
  ) {
    if (
      !selectedFile
    ) {
      setPreview(
        null
      );
      return;
    }

    setPreviewing(
      true
    );
    setError("");
    setPreview(null);

    try {
      const body =
        new FormData();

      body.append(
        "file",
        selectedFile
      );

      const data =
        await apiRequest(
          "/api/client/lead-store/preview",
          {
            method:
              "POST",
            body,
          }
        );

      setPreview(
        data
      );

      if (
        !form.name
      ) {
        update(
          "name",
          selectedFile.name.replace(
            /\.[^.]+$/,
            ""
          )
        );
      }
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to preview file"
      );
    } finally {
      setPreviewing(
        false
      );
    }
  }

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

    if (
      !preview ||
      preview.summary
        ?.importableCount <
        1
    ) {
      setError(
        "This file has no importable leads"
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

      body.append(
        "name",
        form.name
      );

      body.append(
        "type",
        form.type
      );

      body.append(
        "sourceName",
        form.sourceName
      );

      body.append(
        "defaultCourse",
        form.defaultCourse
      );

      body.append(
        "assignedToUserId",
        form.assignedToUserId
      );

      body.append(
        "notes",
        form.notes
      );

      const data =
        await apiRequest(
          "/api/client/lead-store/import",
          {
            method:
              "POST",
            body,
          }
        );

      onImported(
        data
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to import dataset"
      );
    } finally {
      setSaving(false);
    }
  }

  // P2: portal to <body> so the fixed overlay isn't trapped by the content
  // wrapper's transform containing block (sits behind the sidebar at ~1024px).
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex justify-end">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dataset-title"
        tabIndex={-1}
        className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl outline-none animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        <style>{"@keyframes drawerSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}"}</style>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="import-dataset-title" className="text-[17px] font-semibold">
              Import Lead Dataset
            </h2>

            <p className="text-[13px] text-slate-500 mt-1">
              CSV/XLSX rows become real CRM leads. Name and Phone columns are required.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              saving
            }
            aria-label="Close"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <X
              size={17}
              aria-hidden="true"
            />
          </button>
        </div>

        <form
          onSubmit={
            submit
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[15px] text-rose-700 flex items-start gap-2">
                <AlertCircle
                  size={15}
                  className="mt-0.5 flex-shrink-0"
                />
                {error}
              </div>
            )}

            <div>
              <div className="text-[13px] font-medium text-slate-600 mb-1">
                Lead File
                <span className="text-rose-500 ml-0.5">
                  *
                </span>
              </div>

              <label className="min-h-[112px] border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-xl flex items-center justify-center cursor-pointer transition-colors px-5">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(
                    event
                  ) => {
                    const selected =
                      event.target.files
                        ?.[0] ||
                      null;

                    setFile(
                      selected
                    );

                    previewFile(
                      selected
                    );
                  }}
                />

                <div className="text-center">
                  {previewing ? (
                    <Loader2
                      size={22}
                      className="mx-auto animate-spin text-indigo-600"
                    />
                  ) : (
                    <UploadCloud
                      size={24}
                      className="mx-auto text-indigo-500"
                    />
                  )}

                  <div className="mt-2 text-[15px] font-semibold text-slate-800">
                    {file
                      ? file.name
                      : "Choose CSV or XLSX"}
                  </div>

                  <div className="mt-1 text-[13px] text-slate-500">
                    Maximum 5 MB · Maximum 5,000 lead rows
                  </div>
                </div>
              </label>
            </div>

            {preview && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-bold text-slate-800">
                      Import Preview
                    </div>

                    <div className="text-xs text-slate-500 mt-0.5">
                      Invalid and duplicate records will be skipped.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <MiniPill
                      label="Rows"
                      value={
                        preview.summary
                          ?.totalRows ||
                        0
                      }
                    />

                    <MiniPill
                      label="Importable"
                      value={
                        preview.summary
                          ?.importableCount ||
                        0
                      }
                      tone="emerald"
                    />

                    <MiniPill
                      label="Duplicates"
                      value={
                        preview.summary
                          ?.duplicateCount ||
                        0
                      }
                      tone="amber"
                    />

                    <MiniPill
                      label="Invalid"
                      value={
                        preview.summary
                          ?.invalidCount ||
                        0
                      }
                      tone="rose"
                    />
                  </div>
                </div>

                {preview.sample?.length >
                  0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="bg-white text-slate-400">
                        <tr>
                          <th className="px-3 py-2 text-left">
                            Name
                          </th>
                          <th className="px-3 py-2 text-left">
                            Phone
                          </th>
                          <th className="px-3 py-2 text-left">
                            Alternative Phone
                          </th>
                          <th className="px-3 py-2 text-left">
                            Email
                          </th>
                          <th className="px-3 py-2 text-left">
                            Course
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {preview.sample.map(
                          (
                            row
                          ) => (
                            <tr
                              key={
                                row.rowNumber
                              }
                            >
                              <td className="px-3 py-2 text-slate-800">
                                {
                                  row.name ||
                                  "—"
                                }
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {
                                  row.phone ||
                                  "—"
                                }
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {
                                  row.alternatePhone ||
                                  "—"
                                }
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {
                                  row.email ||
                                  "—"
                                }
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {
                                  row.course ||
                                  "—"
                                }
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <Field
                label="Dataset Name"
                required
              >
                <input
                  required
                  value={
                    form.name
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "name",
                      event.target.value
                    )
                  }
                  className="form-input"
                  placeholder="NEET 2026 Aspirants"
                />
              </Field>

              <Field
                label="Type"
                required
              >
                <select
                  value={
                    form.type
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "type",
                      event.target.value
                    )
                  }
                  className="form-input"
                >
                  {TYPES.map(
                    (
                      type
                    ) => (
                      <option
                        key={
                          type.api
                        }
                        value={
                          type.api
                        }
                      >
                        {
                          type.label
                        }
                      </option>
                    )
                  )}
                </select>
              </Field>

              <Field label="Default Course / Interest">
                <select
                  value={courseOther ? "Other" : form.defaultCourse}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "Other") {
                      setCourseOther(true);
                      update("defaultCourse", "");
                    } else {
                      setCourseOther(false);
                      update("defaultCourse", value);
                    }
                  }}
                  className="form-input"
                >
                  <option value="">Use course from file / leave blank</option>
                  {uploadCourseOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {courseOther && (
                  <input
                    value={form.defaultCourse}
                    onChange={(event) => update("defaultCourse", event.target.value)}
                    className="form-input mt-2"
                    placeholder="Enter course / interest"
                  />
                )}
              </Field>

              <Field label="Source">
                <select
                  value={sourceOther ? "Other" : form.sourceName}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "Other") {
                      setSourceOther(true);
                      update("sourceName", "");
                    } else {
                      setSourceOther(false);
                      update("sourceName", value);
                    }
                  }}
                  className="form-input"
                >
                  <option value="">Select source</option>
                  {SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                {sourceOther && (
                  <input
                    value={form.sourceName}
                    onChange={(event) => update("sourceName", event.target.value)}
                    className="form-input mt-2"
                    placeholder="Enter custom source"
                  />
                )}
              </Field>

              <Field label="Assign Imported Leads To">
                <select
                  value={
                    form.assignedToUserId
                  }
                  onChange={(
                    event
                  ) =>
                    update(
                      "assignedToUserId",
                      event.target.value
                    )
                  }
                  className="form-input"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {assignees.map(
                    (
                      user
                    ) => (
                      <option
                        key={
                          user.id
                        }
                        value={
                          user.id
                        }
                      >
                        {user.name} · {user.role.replaceAll("_", " ")}
                      </option>
                    )
                  )}
                </select>
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
                      event.target.value
                    )
                  }
                  className="form-input min-h-[86px] py-2"
                />
              </Field>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg px-3 py-2.5 text-[13px] text-indigo-800 leading-5">
              Imported leads are added directly to the CRM with source <strong>Lead Store</strong>. Duplicate phone/email rows are skipped.
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex shrink-0 justify-end gap-2">
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
                saving ||
                previewing ||
                !preview
              }
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
            >
              {saving ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <FileSpreadsheet
                  size={14}
                />
              )}

              {saving
                ? "Importing..."
                : "Import Leads"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function EditDatasetModal({
  dataset,
  assignees,
  onClose,
  onSaved,
}) {
  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    form,
    setForm,
  ] =
    useState({
      name:
        dataset.name ||
        "",
      type:
        dataset.type ||
        "EXTERNAL_DATA",
      sourceName:
        dataset.sourceName ||
        "",
      assignedToUserId:
        dataset
          .assignedToUser
          ?.id ||
        "",
      notes:
        dataset.notes ||
        "",
    });

  function update(
    field,
    value
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]:
          value,
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
        `/api/client/lead-store/${dataset.id}`,
        {
          method:
            "PATCH",
          body:
            JSON.stringify(
              form
            ),
        }
      );

      onSaved();
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to update dataset"
      );
    } finally {
      setSaving(false);
    }
  }

  const editDatasetPanelRef = useRef(null);
  useOverlayDismiss(true, onClose, { containerRef: editDatasetPanelRef });

  // P2: portal to <body> so the fixed overlay isn't trapped by the content
  // wrapper's transform containing block (sits behind the sidebar at ~1024px).
  return createPortal(
    <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex justify-end">
      <div
        ref={editDatasetPanelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-dataset-title"
        tabIndex={-1}
        className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl outline-none animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        <style>{"@keyframes drawerSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}"}</style>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id="edit-dataset-title" className="text-[17px] font-semibold">
              Edit Dataset
            </h2>

            <p className="text-[13px] text-slate-500 mt-1">
              Assignment changes are also applied to the dataset's imported CRM leads.
            </p>
          </div>

          <button
            type="button"
            onClick={
              onClose
            }
            disabled={
              saving
            }
            aria-label="Close"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100"
          >
            <X
              size={17}
              aria-hidden="true"
            />
          </button>
        </div>

        <form
          onSubmit={
            submit
          }
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto p-6 grid md:grid-cols-2 gap-4">
            {error && (
              <div className="md:col-span-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-[15px] text-rose-700">
                {error}
              </div>
            )}

            <Field
              label="Dataset Name"
              required
            >
              <input
                required
                value={
                  form.name
                }
                onChange={(
                  event
                ) =>
                  update(
                    "name",
                    event.target.value
                  )
                }
                className="form-input"
              />
            </Field>

            <Field label="Type">
              <select
                value={
                  form.type
                }
                onChange={(
                  event
                ) =>
                  update(
                    "type",
                    event.target.value
                  )
                }
                className="form-input"
              >
                {TYPES.map(
                  (
                    type
                  ) => (
                    <option
                      key={
                        type.api
                      }
                      value={
                        type.api
                      }
                    >
                      {
                        type.label
                      }
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Source">
              <input
                value={
                  form.sourceName
                }
                onChange={(
                  event
                ) =>
                  update(
                    "sourceName",
                    event.target.value
                  )
                }
                className="form-input"
              />
            </Field>

            <Field label="Assigned To">
              <select
                value={
                  form.assignedToUserId
                }
                onChange={(
                  event
                ) =>
                  update(
                    "assignedToUserId",
                    event.target.value
                  )
                }
                className="form-input"
              >
                <option value="">
                  Unassigned
                </option>

                {assignees.map(
                  (
                    user
                  ) => (
                    <option
                      key={
                        user.id
                      }
                      value={
                        user.id
                      }
                    >
                      {user.name} · {user.role.replaceAll("_", " ")}
                    </option>
                  )
                )}
              </select>
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
                    event.target.value
                  )
                }
                className="form-input min-h-[86px] py-2"
              />
            </Field>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex shrink-0 justify-end gap-2">
            <button
              type="button"
              onClick={
                onClose
              }
              className="h-9 px-4 border border-slate-200 bg-white rounded-lg text-[13px] font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2"
            >
              {saving && (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              )}

              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function MiniPill({
  label,
  value,
  tone = "slate",
}) {
  const tones = {
    slate:
      "bg-white border-slate-200 text-slate-700",
    emerald:
      "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber:
      "bg-amber-50 border-amber-200 text-amber-700",
    rose:
      "bg-rose-50 border-rose-200 text-rose-700",
  };

  return (
    <div
      className={`px-2 py-1 border rounded-md text-[13px] font-semibold ${
        tones[
          tone
        ] ||
        tones.slate
      }`}
    >
      {label}:{" "}
      <span className="font-bold">
        {value}
      </span>
    </div>
  );
}


export default function LeadStore({
  selectedYear = "all",
  currentUser = null,
  initialLeadId = null,
  onInitialLeadOpened = null,
  initialDashboardFilter = null,
  onInitialDashboardFilterApplied = null,
  focusLeadId = null,
  onFocusConsumed,
}) {
  const [
    sub,
    setSub,
  ] =
    useState(
      "all"
    );

  const [
    datasets,
    setDatasets,
  ] =
    useState([]);

  const [
    individualLeads,
    setIndividualLeads,
  ] = useState([]);

  const [
    assignees,
    setAssignees,
  ] =
    useState([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    filtersOpen,
    setFiltersOpen,
  ] =
    useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const viewBtnRef = useRef(null);
  const viewPanelRef = useRef(null);

  // Close the View (columns) panel and return focus to its trigger. Routed
  // through the shared overlay back-stack (below) so the Android hardware back
  // button and Escape both close THIS popover first — in correct LIFO order
  // with any other open overlay — instead of navigating the app away. Important
  // in the native app, where the panel is a bottom-sheet and its trigger can
  // scroll out of the horizontal toolbar.
  const closeViewPanel = useCallback(() => {
    setViewOpen(false);
    viewBtnRef.current?.focus();
  }, []);

  // Hardware back + Escape -> close this popover first (centralized back-stack,
  // same path drawers/sheets/modals use). manageFocus:false keeps it a
  // lightweight disclosure (no focus-trap, no focus-move-in); closeViewPanel
  // handles focus-return itself. Equivalent on web (Escape still closes).
  useOverlayDismiss(viewOpen, closeViewPanel, { manageFocus: false });

  // Outside-tap dismissal (the back-stack does not cover pointer-outside).
  useEffect(() => {
    if (!viewOpen) return undefined;
    const onOutside = (event) => {
      const t = event.target;
      if (viewBtnRef.current?.contains(t)) return;
      if (viewPanelRef.current?.contains(t)) return;
      closeViewPanel();
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [viewOpen, closeViewPanel]);

  const [leadStoreMetricFilter, setLeadStoreMetricFilter] = useState(null);
  const [metricPanel, setMetricPanel] = useState(null);

  // Drill-down: clicking a KPI/dataset card opens a dedicated full page (see
  // DetailPage) showing ONLY that card's records, instead of an inline panel or
  // an in-page list filter. `detailTriggerRef` captures the clicked card so
  // focus returns to it on Back.
  const [detailView, setDetailView] = useState(null);
  const detailTriggerRef = useRef(null);
  function openDetail(key) {
    detailTriggerRef.current =
      typeof document !== "undefined" ? document.activeElement : null;
    setDetailView(key);
  }

  const [
    filters,
    setFilters,
  ] =
    useState({
      status: "",
      temperature: "",
      assignedToUserId: "",
      course: "",
      source: "",
      dateFrom: "",
      dateTo: "",
    });

  const [dashboardLeadFilter, setDashboardLeadFilter] = useState(null);

  const [
    individualColumns,
    setIndividualColumns,
  ] = useState(
    DEFAULT_INDIVIDUAL_COLUMNS
  );

  const [
    individualDensity,
    setIndividualDensity,
  ] = useState(
    "compact"
  );

  const canReorderColumns = ["CLIENT_ADMIN", "MANAGER"].includes(
    String(currentUser?.role || "").toUpperCase()
  );

  const [individualColumnOrder, setIndividualColumnOrder] = useState(
    DEFAULT_INDIVIDUAL_COLUMN_ORDER
  );
  const [draggedColumn, setDraggedColumn] = useState("");
  const [columnOrderSaving, setColumnOrderSaving] = useState(false);

  // ⋮ import/metrics menu beside the Import button (replaces the old KPI cards).
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuBtnRef = useRef(null);
  const importMenuRef = useRef(null);

  // User-created columns ({ key, label, type: "Text" | "Number", visible }).
  // Values are held client-side per lead+column (no custom-field API yet).
  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnValues, setCustomColumnValues] = useState({});
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState("Text");

  const visibleCustomColumns = customColumns.filter((column) => column.visible);

  function addCustomColumn() {
    const name = newColumnName.trim();
    if (!name) return;
    const key = `cc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setCustomColumns((current) => [
      ...current,
      { key, label: name, type: newColumnType, visible: true },
    ]);
    setNewColumnName("");
    setSuccessMessage(`Column "${name}" (${newColumnType}) added`);
  }

  function removeCustomColumn(key) {
    setCustomColumns((current) => current.filter((column) => column.key !== key));
  }

  function toggleCustomColumn(key) {
    setCustomColumns((current) =>
      current.map((column) =>
        column.key === key ? { ...column, visible: !column.visible } : column
      )
    );
  }

  function setCustomColumnValue(leadId, key, value) {
    setCustomColumnValues((current) => ({ ...current, [`${leadId}:${key}`]: value }));
  }

  useEffect(() => {
    if (!importMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (
        importMenuRef.current?.contains(event.target) ||
        importMenuBtnRef.current?.contains(event.target)
      ) {
        return;
      }
      setImportMenuOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setImportMenuOpen(false);
        importMenuBtnRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [importMenuOpen]);

  const [
    expandedCustomFields,
    setExpandedCustomFields,
  ] = useState({});

  const [
    selectedLeadIds,
    setSelectedLeadIds,
  ] = useState([]);

  // Restored features: Smart Nurture (bulk follow-up over selected leads) and
  // Dial & Track (per-lead call-center modal).
  const [nurtureOpen, setNurtureOpen] = useState(false);
  const [callLead, setCallLead] = useState(null);
  const [intelligenceLead, setIntelligenceLead] = useState(null);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(25);

  const [
    bulkAssigneeId,
    setBulkAssigneeId,
  ] = useState("");

  const [
    bulkAssigning,
    setBulkAssigning,
  ] = useState(false);

  const [temperatureUpdatingId, setTemperatureUpdatingId] = useState("");
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [leadStatusOptions, setLeadStatusOptions] = useState(FIXED_LEAD_STATUSES);
  const [admissionLead, setAdmissionLead] = useState(null);

  const [messageComposerOpen, setMessageComposerOpen] = useState(false);
  const [messageLeadIds, setMessageLeadIds] = useState([]);
  const [communicationStatus, setCommunicationStatus] = useState(null);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [communicationSending, setCommunicationSending] = useState(false);
  const [communicationError, setCommunicationError] = useState("");
  const [communicationResult, setCommunicationResult] = useState("");
  const [communicationHistory, setCommunicationHistory] = useState([]);
  const [emailAttachments, setEmailAttachments] = useState([]);
  const emailAttachmentInputRef = useRef(null);
  const [emailForm, setEmailForm] = useState({
    subject: "",
    message: "",
    driveLinks: "",
  });

  // Send Message channel: "email" (default) or "sms" (per-company SMS integration).
  const [messageChannel, setMessageChannel] = useState("email");
  const [smsTemplateId, setSmsTemplateId] = useState("");

  useEffect(() => {
    let active = true;

    if (!canReorderColumns) {
      setIndividualColumnOrder(DEFAULT_INDIVIDUAL_COLUMN_ORDER);
      return undefined;
    }

    apiRequest("/api/client/lead-store/column-preferences")
      .then((data) => {
        if (active) {
          setIndividualColumnOrder(
            normalizeIndividualColumnOrder(data?.columnOrder)
          );
        }
      })
      .catch((error) => {
        console.error("Unable to load Lead Store column arrangement:", error);
      });

    return () => {
      active = false;
    };
  }, [canReorderColumns, currentUser?.id]);

  async function saveColumnOrder(nextOrder) {
    if (!canReorderColumns) return;

    setColumnOrderSaving(true);
    setError("");

    try {
      const data = await apiRequest(
        "/api/client/lead-store/column-preferences",
        {
          method: "PATCH",
          body: JSON.stringify({ columnOrder: nextOrder }),
        }
      );

      setIndividualColumnOrder(
        normalizeIndividualColumnOrder(data?.columnOrder || nextOrder)
      );
    } catch (error) {
      setError(error?.data?.message || "Unable to save column arrangement");
    } finally {
      setColumnOrderSaving(false);
    }
  }

  function moveDraggedColumn(targetColumn) {
    if (
      !canReorderColumns ||
      !draggedColumn ||
      draggedColumn === targetColumn
    ) {
      setDraggedColumn("");
      return;
    }

    const nextOrder = [...individualColumnOrder];
    const fromIndex = nextOrder.indexOf(draggedColumn);
    const targetIndex = nextOrder.indexOf(targetColumn);

    if (fromIndex < 0 || targetIndex < 0) {
      setDraggedColumn("");
      return;
    }

    nextOrder.splice(fromIndex, 1);
    nextOrder.splice(targetIndex, 0, draggedColumn);
    setIndividualColumnOrder(nextOrder);
    setDraggedColumn("");
    saveColumnOrder(nextOrder);
  }

  function formatAttachmentSize(bytes) {
    const size = Number(bytes || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleEmailAttachments(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";
    if (!selected.length) return;

    const allowedExtensions = new Set([
      "jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx",
      "xls", "xlsx", "csv", "ppt", "pptx", "txt", "zip",
    ]);

    const invalid = selected.find((file) => {
      const extension = String(file.name || "").split(".").pop()?.toLowerCase();
      return !allowedExtensions.has(extension);
    });

    if (invalid) {
      setCommunicationError(
        `Unsupported attachment: ${invalid.name}. Use images, PDF, Word, Excel, CSV, PowerPoint, TXT or ZIP files.`
      );
      return;
    }

    const merged = [...emailAttachments];
    selected.forEach((file) => {
      const duplicate = merged.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified
      );
      if (!duplicate) merged.push(file);
    });

    if (merged.length > 10) {
      setCommunicationError("Attach a maximum of 10 files per email.");
      return;
    }

    const totalBytes = merged.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (totalBytes > 18 * 1024 * 1024) {
      setCommunicationError(
        "Attachments are too large. Keep all files together under 18 MB so Gmail can send them safely."
      );
      return;
    }

    setCommunicationError("");
    setEmailAttachments(merged);
  }

  function removeEmailAttachment(index) {
    setEmailAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function closeMessageComposer() {
    setMessageComposerOpen(false);
    setMessageLeadIds([]);
    setCommunicationStatus(null);
    setCommunicationLoading(false);
    setCommunicationSending(false);
    setCommunicationError("");
    setCommunicationResult("");
    setCommunicationHistory([]);
    setEmailAttachments([]);
    setEmailForm({
      subject: "",
      message: "",
      driveLinks: "",
    });
  }

  async function openMessageComposer(leadIds) {
    const ids = Array.isArray(leadIds) ? [...new Set(leadIds)] : [];
    if (!ids.length) return;

    // Every new compose action must start clean.
    setEmailForm({
      subject: "",
      message: "",
      driveLinks: "",
    });
    setEmailAttachments([]);
    setMessageLeadIds(ids);
    setMessageComposerOpen(true);
    setCommunicationLoading(true);
    setCommunicationError("");
    setCommunicationResult("");
    setCommunicationHistory([]);
    try {
      const status = await apiRequest("/api/client/communications/status");
      setCommunicationStatus(status);
      if (ids.length === 1) {
        const history = await apiRequest(`/api/client/communications/history?leadId=${encodeURIComponent(ids[0])}&limit=10`);
        setCommunicationHistory(history.logs || []);
      } else {
        setCommunicationHistory([]);
      }
    } catch (error) {
      setCommunicationError(error?.data?.message || "Unable to load communication status");
    } finally {
      setCommunicationLoading(false);
    }
  }

  async function sendSelectedEmail() {
    if (!emailForm.subject.trim()) {
      setCommunicationError("Enter an email subject.");
      return;
    }

    if (
      !emailForm.message.trim() &&
      !emailAttachments.length &&
      !emailForm.driveLinks.trim()
    ) {
      setCommunicationError("Add a message, attachment or Google Drive link before sending.");
      return;
    }

    setCommunicationSending(true);
    setCommunicationError("");
    setCommunicationResult("");
    try {
      const formData = new FormData();
      formData.append("leadIds", JSON.stringify(messageLeadIds));
      formData.append("subject", emailForm.subject);
      formData.append("message", emailForm.message);
      formData.append("driveLinks", emailForm.driveLinks);
      emailAttachments.forEach((file) => formData.append("attachments", file, file.name));

      const data = await apiRequest("/api/client/communications/email", {
        method: "POST",
        body: formData,
      });
      const sentCount = Number(data?.sent || 0);

      if (sentCount > 0) {
        const successText =
          data?.message ||
          `${sentCount} email${sentCount === 1 ? "" : "s"} sent successfully.`;

        setCommunicationResult(successText);
        setSuccessMessage(successText);
      } else {
        const firstFailure =
          Array.isArray(data?.failures) && data.failures.length
            ? data.failures[0]?.reason
            : "";

        setCommunicationResult("");
        setCommunicationError(
          firstFailure
            ? `No emails were sent. ${firstFailure}`
            : "No emails were sent. Check that the selected lead has a valid email address and that Gmail is connected."
        );
      }

      const status = await apiRequest("/api/client/communications/status");
      setCommunicationStatus(status);
      if (messageLeadIds.length === 1) {
        const history = await apiRequest(`/api/client/communications/history?leadId=${encodeURIComponent(messageLeadIds[0])}&limit=10`);
        setCommunicationHistory(history.logs || []);
      }
    } catch (error) {
      setCommunicationError(error?.data?.message || "Unable to send email");
    } finally {
      setCommunicationSending(false);
    }
  }

  async function sendSelectedSms() {
    if (!smsTemplateId) {
      setCommunicationError("Choose an SMS template.");
      return;
    }

    setCommunicationSending(true);
    setCommunicationError("");
    setCommunicationResult("");
    try {
      const data = await apiRequest("/api/client/communications/sms", {
        method: "POST",
        body: JSON.stringify({
          leadIds: messageLeadIds,
          templateId: smsTemplateId,
        }),
      });
      const sentCount = Number(data?.sent || 0);

      if (sentCount > 0) {
        const successText =
          data?.message || `${sentCount} SMS sent successfully.`;
        setCommunicationResult(successText);
        setSuccessMessage(successText);
      } else {
        const firstFailure =
          Array.isArray(data?.failures) && data.failures.length
            ? data.failures[0]?.reason
            : "";
        setCommunicationResult("");
        setCommunicationError(
          firstFailure
            ? `No SMS were sent. ${firstFailure}`
            : "No SMS were sent. Check that the selected lead has a phone number and that SMS is connected."
        );
      }

      const status = await apiRequest("/api/client/communications/status");
      setCommunicationStatus(status);
      if (messageLeadIds.length === 1) {
        const history = await apiRequest(`/api/client/communications/history?leadId=${encodeURIComponent(messageLeadIds[0])}&limit=10`);
        setCommunicationHistory(history.logs || []);
      }
    } catch (error) {
      setCommunicationError(error?.data?.message || "Unable to send SMS");
    } finally {
      setCommunicationSending(false);
    }
  }

  function toggleIndividualColumn(
    key
  ) {
    setIndividualColumns(
      (current) => ({
        ...current,
        [key]: !current[key],
      })
    );
  }

  function toggleCustomFields(
    leadId
  ) {
    setExpandedCustomFields(
      (current) => ({
        ...current,
        [leadId]: !current[leadId],
      })
    );
  }

  const [
    showIndividual,
    setShowIndividual,
  ] =
    useState(false);

  const [
    editingIndividual,
    setEditingIndividual,
  ] = useState(null);

  const [
    detailsLead,
    setDetailsLead,
  ] = useState(null);

  // Deep-link target (from a notification or a dashboard lead click): open the
  // exact lead's detail once the list is loaded, or show an accessible notice if
  // it isn't visible to this user.
  const [focusNotice, setFocusNotice] = useState("");
  const focusNoticeRef = useRef(null);

  useEffect(() => {
    if (!focusLeadId || loading) return;
    const lead = individualLeads.find(
      (item) => String(item.id) === String(focusLeadId)
    );
    if (lead) {
      setDetailsLead(lead);
      setFocusNotice("");
    } else {
      setFocusNotice("That lead isn't available to you.");
    }
    // Clear the token in BOTH branches so list refreshes/keep-alive don't re-fire.
    onFocusConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLeadId, loading, individualLeads]);

  useEffect(() => {
    if (focusNotice) focusNoticeRef.current?.focus();
  }, [focusNotice]);

  const [
    showUpload,
    setShowUpload,
  ] =
    useState(false);

  const [
    editing,
    setEditing,
  ] =
    useState(null);

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  async function loadDatasets() {
    setLoading(true);
    setError("");

    try {
      const data =
        await apiRequest(
          `/api/client/lead-store?year=${encodeURIComponent(selectedYear)}`
        );

      setDatasets(
        data.datasets ||
          []
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load Lead Store"
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadIndividualLeads() {
    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual?year=${encodeURIComponent(selectedYear)}`
      );
      setIndividualLeads(data.leads || []);
    } catch (error) {
      setError(error?.data?.message || "Unable to load individual leads");
    }
  }

  async function loadAssignees() {
    try {
      const data =
        await apiRequest(
          "/api/client/lead-store/meta/assignees"
        );

      setAssignees(
        data.users ||
          []
      );
    } catch {
      setAssignees(
        []
      );
    }
  }

  async function loadLeadStatusOptions() {
    try {
      const data = await apiRequest(
        "/api/client/lead-store/status-options"
      );
      const options = Array.isArray(data?.options)
        ? data.options
        : FIXED_LEAD_STATUSES;
      setLeadStatusOptions(
        Array.from(new Set([...FIXED_LEAD_STATUSES, ...options]))
      );
    } catch {
      setLeadStatusOptions(FIXED_LEAD_STATUSES);
    }
  }

  useEffect(() => {
    loadDatasets();
    loadIndividualLeads();
    loadAssignees();
    loadLeadStatusOptions();
  }, [selectedYear]);

  useEffect(() => {
    const leadId = String(initialLeadId || "").trim();
    if (!leadId) return undefined;

    let cancelled = false;

    async function openRequestedLead() {
      const existing = individualLeads.find((lead) => lead.id === leadId);
      if (existing) {
        setDetailsLead(existing);
        onInitialLeadOpened?.();
        return;
      }

      try {
        const data = await apiRequest(
          `/api/client/lead-store/manual?leadId=${encodeURIComponent(leadId)}`
        );
        if (cancelled) return;

        const target = Array.isArray(data?.leads) ? data.leads[0] : null;
        if (target) {
          setIndividualLeads((current) =>
            current.some((lead) => lead.id === target.id)
              ? current
              : [target, ...current]
          );
          setDetailsLead(target);
        } else {
          setError("That lead is not available in Lead Store.");
        }
      } catch (error) {
        if (!cancelled) {
          setError(error?.data?.message || "Unable to open the selected lead");
        }
      } finally {
        if (!cancelled) onInitialLeadOpened?.();
      }
    }

    openRequestedLead();
    return () => {
      cancelled = true;
    };
  }, [initialLeadId]);

  useEffect(() => {
    const key = String(initialDashboardFilter?.key || "").trim();
    if (!key) return;
    // Dashboard leads KPIs (total-leads / new-leads / qualified-leads) now open a
    // dedicated leads page instead of filtering the in-page list. The drill came
    // from navigation (not a card), so there is no card to restore focus to.
    detailTriggerRef.current = null;
    setDetailView(key);
    onInitialDashboardFilterApplied?.();
  }, [initialDashboardFilter]);

  const selectedType =
    useMemo(
      () =>
        ALL_LEAD_TYPES.find(
          (type) =>
            type.key ===
            sub
        ) ||
        ALL_LEADS_TYPE,
      [sub]
    );

  const currentTypeLeads =
    useMemo(
      () =>
        selectedType.api === "ALL"
          ? individualLeads
          : individualLeads.filter(
              (lead) => leadCategoryApi(lead) === selectedType.api
            ),
      [
        individualLeads,
        selectedType,
      ]
    );

  const currentTypeDatasets =
    useMemo(
      () =>
        selectedType.api === "ALL"
          ? datasets
          : datasets.filter(
              (dataset) => dataset.type === selectedType.api
            ),
      [
        datasets,
        selectedType,
      ]
    );

  const selectedAssigneeName =
    useMemo(
      () => {
        if (
          !filters.assignedToUserId ||
          filters.assignedToUserId ===
            "__UNASSIGNED__"
        ) {
          return "";
        }

        return (
          assignees.find(
            (user) =>
              user.id ===
              filters.assignedToUserId
          )?.name ||
          ""
        );
      },
      [
        assignees,
        filters.assignedToUserId,
      ]
    );

  const individualStatusOptions =
    useMemo(
      () =>
        Array.from(
          new Set([
            ...FIXED_LEAD_STATUSES,
            ...leadStatusOptions,
            ...currentTypeLeads
              .map((lead) => lead.leadStatus)
              .filter(Boolean),
          ])
        ),
      [leadStatusOptions, currentTypeLeads]
    );

  const individualCourseOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            currentTypeLeads
              .map(
                (lead) =>
                  lead.course
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            String(a).localeCompare(
              String(b)
            )
        ),
      [currentTypeLeads]
    );

  const sourceOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            currentTypeLeads
              .map(
                (lead) =>
                  lead.sourceName
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            String(a).localeCompare(
              String(b)
            )
        ),
      [currentTypeLeads]
    );

  const filteredIndividualLeads =
    useMemo(
      () => {
        const query =
          normalizeFilterText(
            search
          );

        const normalizedLeadIdQuery =
          /^(?:ld)?0*\d+$/i.test(query)
            ? normalizeFilterText(
                query.toUpperCase().startsWith("LD")
                  ? `LD${String(Number(query.slice(2))).padStart(3, "0")}`
                  : `LD${String(Number(query)).padStart(3, "0")}`
              )
            : "";

        const exactLeadIdMatchExists =
          Boolean(normalizedLeadIdQuery) &&
          currentTypeLeads.some(
            (lead) =>
              normalizeFilterText(
                displayLeadId(lead.leadNumber)
              ) === normalizedLeadIdQuery
          );

        return currentTypeLeads.filter(
          (lead) => {
            const searchMatches =
              !query ||
              (exactLeadIdMatchExists
                ? normalizeFilterText(
                    displayLeadId(lead.leadNumber)
                  ) === normalizedLeadIdQuery
                : [
                    displayLeadId(lead.leadNumber),
                    lead.name,
                    lead.phone,
                    lead.alternatePhone,
                    lead.email,
                    lead.course,
                    lead.assignedToName,
                    lead.sourceName,
                    lead.leadStatus,
                    lead.stage,
                    lead.temperature,
                  ]
                    .filter(Boolean)
                    .some(
                      (value) =>
                        normalizeFilterText(
                          value
                        ).includes(
                          query
                        )
                    ));

            const dashboardStageMatches =
              !dashboardLeadFilter ||
              dashboardLeadFilter.key === "total-leads" ||
              (dashboardLeadFilter.key === "new-leads" && lead.stage === "NEW") ||
              (dashboardLeadFilter.key === "qualified-leads" &&
                (lead.stage === "QUALIFIED" || lead.stage === "ADMITTED")) ||
              // Safety net: an unrecognised drill-down key must not silently
              // filter every lead out (empty list). Fall back to showing all.
              !["total-leads", "new-leads", "qualified-leads"].includes(
                dashboardLeadFilter.key
              );

            const metricMatches =
              !leadStoreMetricFilter ||
              leadStoreMetricFilter.key === "all" ||
              (leadStoreMetricFilter.key === "imported" && Boolean(lead.datasetId)) ||
              (leadStoreMetricFilter.key === "converted" &&
                (lead.stage === "ADMITTED" || lead.leadStatus === "Admission Done"));

            const statusMatches =
              !filters.status ||
              (lead.leadStatus || "Fresh") ===
                filters.status;

            const temperatureMatches =
              !filters.temperature ||
              (lead.temperature || "WARM") === filters.temperature;

            const assignedMatches =
              !filters.assignedToUserId ||
              (
                filters.assignedToUserId ===
                  "__UNASSIGNED__"
                  ? !lead.assignedToName
                  : normalizeFilterText(
                      lead.assignedToName
                    ) ===
                    normalizeFilterText(
                      selectedAssigneeName
                    )
              );

            const courseMatches =
              !filters.course ||
              normalizeFilterText(
                lead.course
              ) ===
                normalizeFilterText(
                  filters.course
                );

            const sourceMatches =
              !filters.source ||
              normalizeFilterText(
                lead.sourceName
              ) ===
                normalizeFilterText(
                  filters.source
                );

            const dateMatches =
              matchesDateRange(
                lead.createdAt,
                filters.dateFrom,
                filters.dateTo
              );

            return (
              searchMatches &&
              dashboardStageMatches &&
              metricMatches &&
              statusMatches &&
              temperatureMatches &&
              assignedMatches &&
              courseMatches &&
              sourceMatches &&
              dateMatches
            );
          }
        );
      },
      [
        currentTypeLeads,
        search,
        filters,
        dashboardLeadFilter,
        leadStoreMetricFilter,
        selectedAssigneeName,
      ]
    );

  const filtered =
    useMemo(
      () => {
        const query =
          normalizeFilterText(
            search
          );

        return currentTypeDatasets.filter(
          (dataset) => {
            const searchMatches =
              !query ||
              [
                dataset.name,
                dataset.sourceName,
                dataset.sourceFileName,
                dataset.assignedTo,
              ]
                .filter(Boolean)
                .some(
                  (value) =>
                    normalizeFilterText(
                      value
                    ).includes(
                      query
                    )
                );

            const assignedMatches =
              !filters.assignedToUserId ||
              (
                filters.assignedToUserId ===
                  "__UNASSIGNED__"
                  ? !dataset.assignedToUser
                  : dataset
                      .assignedToUser
                      ?.id ===
                    filters
                      .assignedToUserId
              );

            const sourceMatches =
              !filters.source ||
              normalizeFilterText(
                dataset.sourceName
              ) ===
                normalizeFilterText(
                  filters.source
                );

            const dateMatches =
              matchesDateRange(
                dataset.uploadedAt ||
                  dataset.createdAt,
                filters.dateFrom,
                filters.dateTo
              );

            return (
              searchMatches &&
              assignedMatches &&
              sourceMatches &&
              dateMatches
            );
          }
        );
      },
      [
        currentTypeDatasets,
        search,
        filters,
      ]
    );

  const activeFilterCount =
    [
      filters.assignedToUserId,
      filters.source,
      filters.dateFrom,
      filters.dateTo,
      filters.status,
      filters.temperature,
      filters.course,
    ].filter(Boolean).length;

  const visibleCount =
    filteredIndividualLeads.length;

  const totalCurrentCount =
    currentTypeLeads.length;

  const leadTypeOptions =
    useMemo(
      () =>
        ALL_LEAD_TYPES.map(
          (type) => ({
            key: type.key,
            label: type.label,
            count:
              type.api === "ALL"
                ? individualLeads.length
                : individualLeads.filter(
                    (lead) => leadCategoryApi(lead) === type.api
                  ).length,
          })
        ),
      [individualLeads]
    );

  const visibleOrderedColumnKeys = useMemo(
    () =>
      individualColumnOrder.filter(
        (key) =>
          key === "leadId" ||
          key === "name" ||
          key === "intelligence" ||
          Boolean(individualColumns[key])
      ),
    [individualColumnOrder, individualColumns]
  );

  const visibleIndividualColumnCount =
    2 + visibleOrderedColumnKeys.length + visibleCustomColumns.length;

  const individualCellPadding =
    individualDensity === "compact"
      ? "py-1.5"
      : "py-2.5";

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredIndividualLeads.length /
          pageSize
      )
    );

  const currentPage =
    Math.min(
      page,
      totalPages
    );

  const pageStart =
    (currentPage - 1) *
    pageSize;

  const [sortKey, setSortKey] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [wrapText, setWrapText] = useState(false);
  // Per-column header dropdown (disclosure): { key, x, y, trigger } or null.
  const [columnMenu, setColumnMenu] = useState(null);

  useEffect(() => {
    if (!columnMenu) return undefined;
    const onDown = (event) => {
      if (
        event.target.closest("[data-col-menu]") ||
        event.target.closest("[data-col-menu-trigger]")
      )
        return;
      setColumnMenu(null);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        columnMenu.trigger?.focus();
        setColumnMenu(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [columnMenu]);

  function closeColumnMenu(refocus) {
    if (refocus) columnMenu?.trigger?.focus();
    setColumnMenu(null);
  }

  // Frozen (pinned-left) columns, kept in their visible order for offsets.
  const [frozenColumns, setFrozenColumns] = useState([]);

  const FREEZE_WIDTHS = {
    leadId: 78,
    name: 160,
    phone: 120,
    alternatePhone: 130,
    email: 175,
    course: 120,
    assignedTo: 140,
    temperature: 110,
    status: 145,
    intelligence: 135,
    created: 125,
    preferredColleges: 170,
  };
  const freezeWidthOf = (key) => FREEZE_WIDTHS[key] || 120;

  // Returns {left,width} for a frozen column (left offset = 40px sticky
  // checkbox + widths of frozen columns before it), or null when not frozen.
  function freezeMeta(columnKey) {
    if (!frozenColumns.includes(columnKey)) return null;
    const orderedFrozen = visibleOrderedColumnKeys.filter((k) =>
      frozenColumns.includes(k)
    );
    const pos = orderedFrozen.indexOf(columnKey);
    let left = 40;
    for (let i = 0; i < pos; i += 1) left += freezeWidthOf(orderedFrozen[i]);
    // isLast marks the right-most frozen column, which carries the divider line
    // so users can see where the frozen region ends.
    return {
      left,
      width: freezeWidthOf(columnKey),
      isLast: pos === orderedFrozen.length - 1,
    };
  }

  // Cycle a column through ascending -> descending -> unsorted.
  function toggleSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey("");
      setSortDir("asc");
    }
  }

  // Dataset name per lead (for the Dataset column + its sort). Declared before
  // the sort memo below, which references it — a const used earlier would hit
  // the temporal dead zone and crash the whole screen on render.
  const datasetNameById = useMemo(() => {
    const map = {};
    datasets.forEach((dataset) => {
      map[dataset.id] =
        dataset.name ||
        dataset.sourceName ||
        dataset.sourceFileName ||
        "Dataset";
    });
    return map;
  }, [datasets]);

  // Sort the FULL filtered set before pagination so sort spans all pages.
  const sortedIndividualLeads = useMemo(() => {
    if (!sortKey) return filteredIndividualLeads;
    const getVal = (lead) => {
      switch (sortKey) {
        case "leadId":
          return Number(lead.leadNumber) || 0;
        case "created":
          return new Date(lead.createdAt || 0).getTime();
        case "intelligence":
          return Number(lead?.intelligence?.score) || 0;
        case "status":
          return String(lead.stage || lead.leadStatus || "").toLowerCase();
        case "assignedTo":
          return String(lead.assignedToName || "").toLowerCase();
        case "dataset":
          if (lead.datasetId)
            return String(datasetNameById[lead.datasetId] || "").toLowerCase();
          if (lead.campaign) return String(lead.campaign).toLowerCase();
          return lead.isManual ? "manual" : "~";
        default:
          return String(lead[sortKey] ?? "").toLowerCase();
      }
    };
    const dir = sortDir === "desc" ? -1 : 1;
    return [...filteredIndividualLeads].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filteredIndividualLeads, sortKey, sortDir, datasetNameById]);

  const paginatedIndividualLeads =
    sortedIndividualLeads.slice(
      pageStart,
      pageStart + pageSize
    );

  const pageLeadIds =
    paginatedIndividualLeads.map(
      (lead) => lead.id
    );

  const allPageSelected =
    pageLeadIds.length > 0 &&
    pageLeadIds.every(
      (id) =>
        selectedLeadIds.includes(
          id
        )
    );

  useEffect(() => {
    setPage(1);
    setSelectedLeadIds([]);
  }, [
    sub,
    selectedYear,
    search,
    filters.status,
    filters.assignedToUserId,
    filters.course,
    filters.source,
    filters.dateFrom,
    filters.dateTo,
    pageSize,
  ]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function toggleLeadSelection(
    leadId
  ) {
    setSelectedLeadIds(
      (current) =>
        current.includes(leadId)
          ? current.filter(
              (id) =>
                id !== leadId
            )
          : [
              ...current,
              leadId,
            ]
    );
  }

  function togglePageSelection() {
    setSelectedLeadIds(
      (current) => {
        if (allPageSelected) {
          return current.filter(
            (id) =>
              !pageLeadIds.includes(
                id
              )
          );
        }

        return Array.from(
          new Set([
            ...current,
            ...pageLeadIds,
          ])
        );
      }
    );
  }

  function openSelectedMessageComposer() {
    if (!selectedLeadIds.length) {
      setError("Select at least one lead to send a message.");
      return;
    }

    setError("");
    openMessageComposer(selectedLeadIds);
  }

  async function assignSelectedLeads() {
    if (!selectedLeadIds.length) {
      return;
    }

    if (!bulkAssigneeId) {
      setError(
        "Select a team member for bulk assignment."
      );
      return;
    }

    const assignee =
      assignees.find(
        (user) =>
          user.id ===
          bulkAssigneeId
      );

    if (!assignee) {
      setError(
        "Selected team member is invalid."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Assign ${selectedLeadIds.length} selected lead${selectedLeadIds.length === 1 ? "" : "s"} to ${assignee.name}?`
      );

    if (!confirmed) {
      return;
    }

    setBulkAssigning(true);
    setError("");

    try {
      const data =
        await apiRequest(
          "/api/client/lead-store/manual/bulk-assign",
          {
            method:
              "PATCH",
            body:
              JSON.stringify({
                leadIds:
                  selectedLeadIds,
                assignedToUserId:
                  bulkAssigneeId,
              }),
          }
        );

      setSuccessMessage(
        data.message ||
          `${selectedLeadIds.length} leads assigned successfully.`
      );
      setSelectedLeadIds([]);
      setBulkAssigneeId("");
      await loadIndividualLeads();
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to assign selected leads"
      );
    } finally {
      setBulkAssigning(false);
    }
  }

  async function updateLeadTemperature(leadId, temperature) {
    setTemperatureUpdatingId(leadId);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual/${leadId}/temperature`,
        {
          method: "PATCH",
          body: JSON.stringify({ temperature }),
        }
      );

      setIndividualLeads((current) =>
        current.map((lead) =>
          lead.id === leadId
            ? { ...lead, temperature: data?.lead?.temperature || temperature }
            : lead
        )
      );

      setSuccessMessage(data?.message || "Lead temperature updated.");
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to update lead temperature"
      );
    } finally {
      setTemperatureUpdatingId("");
    }
  }

  // Inline save of the "Interested College" cell (saves on blur/Enter).
  async function updateLeadPreferredColleges(leadId, value) {
    const trimmed = String(value || "").trim();
    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual/${leadId}/preferred-colleges`,
        {
          method: "PATCH",
          body: JSON.stringify({ preferredColleges: trimmed }),
        }
      );

      setIndividualLeads((current) =>
        current.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                preferredColleges:
                  data?.lead?.preferredColleges ?? trimmed,
              }
            : lead
        )
      );

      setSuccessMessage(data?.message || "Interested college updated.");
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to update interested college"
      );
    }
  }

  async function updateLeadStatus(leadId, status, { custom = false } = {}) {
    setStatusUpdatingId(leadId);
    setError("");

    try {
      const data = await apiRequest(
        `/api/client/lead-store/manual/${leadId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }
      );

      const nextStatus = data?.lead?.leadStatus || status;
      setIndividualLeads((current) =>
        current.map((lead) =>
          lead.id === leadId
            ? {
                ...lead,
                leadStatus: nextStatus,
                stage: data?.lead?.stage || lead.stage,
              }
            : lead
        )
      );

      if (custom || data?.customStatus) {
        setLeadStatusOptions((current) =>
          Array.from(
            new Set([
              ...FIXED_LEAD_STATUSES,
              ...current,
              nextStatus,
            ])
          )
        );
      }

      setSuccessMessage(data?.message || "Lead status updated.");
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to update lead status"
      );
      throw error;
    } finally {
      setStatusUpdatingId("");
    }
  }

  function clearFilters() {
    setFilters({
      status: "",
      temperature: "",
      assignedToUserId: "",
      course: "",
      source: "",
      dateFrom: "",
      dateTo: "",
    });
    setDashboardLeadFilter(null);
    setLeadStoreMetricFilter(null);
  }

  function exportCurrentView() {
    const dateStamp =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );

    const rows =
      filteredIndividualLeads.map(
        (lead) => [
          displayLeadId(lead.leadNumber),
          lead.name,
          lead.phone,
          lead.alternatePhone,
          lead.email,
          lead.course,
          leadCategoryLabel(lead),
          lead.sourceName,
          lead.assignedToName ||
            "Unassigned",
          lead.temperature ||
            "WARM",
          lead.leadStatus ||
            "Fresh",
          formatDate(
            lead.createdAt
          ),
          (lead.customFields || [])
            .map(
              (field) =>
                `${field.name}: ${field.value || "—"}`
            )
            .join(
              " | "
            ),
        ]
      );

    downloadCsv(
      `lead-store-${sub}-${selectedYear}-${dateStamp}.csv`,
      [
        "Lead ID",
        "Name",
        "Phone",
        "Alternative Phone",
        "Email",
        "Course",
        "Lead Type",
        "Source",
        "Assigned To",
        "Lead Type",
        "Status",
        "Created",
        "Custom Fields",
      ],
      rows
    );
  }

  async function removeDataset(
    dataset
  ) {
    const ok =
      window.confirm(
        `Delete "${dataset.name}"?\n\nThe imported leads will remain in CRM. Only the dataset grouping will be removed.`
      );

    if (!ok) {
      return;
    }

    try {
      const data =
        await apiRequest(
          `/api/client/lead-store/${dataset.id}`,
          {
            method:
              "DELETE",
          }
        );

      setSuccessMessage(
        data.message
      );

      await loadDatasets();
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to delete dataset"
      );
    }
  }

  const totalLeads =
    individualLeads.length;

  const importedLeads =
    individualLeads.filter((lead) => Boolean(lead.datasetId)).length;

  const totalConverted =
    individualLeads.filter(
      (lead) =>
        lead.stage ===
        "ADMITTED"
    ).length;

  const assignedLeads =
    individualLeads.filter(
      (lead) =>
        Boolean(
          lead.assignedToName
        )
    ).length;

  const duplicatesSkipped =
    datasets.reduce(
      (
        sum,
        dataset
      ) =>
        sum +
        Number(
          dataset.duplicateCount ||
            0
        ),
      0
    );

  function renderColumnHeader(columnKey) {
    const widthClass = {
      leadId: "min-w-[78px] text-center",
      name: "min-w-[160px] max-w-[160px]",
      phone: "min-w-[120px]",
      alternatePhone: "min-w-[130px]",
      email: "min-w-[175px]",
      course: "min-w-[120px]",
      assignedTo: "min-w-[140px]",
      temperature: "min-w-[110px]",
      status: "min-w-[145px]",
      intelligence: "min-w-[135px]",
      dataset: "min-w-[150px] max-w-[200px]",
      created: "min-w-[125px]",
    }[columnKey] || "min-w-[120px]";

    return (
      <th
        key={columnKey}
        scope="col"
        aria-sort={sortKey === columnKey ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
        onDragOver={(event) => {
          if (canReorderColumns) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          moveDraggedColumn(columnKey);
        }}
        className={`${widthClass} px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap transition-colors ${
          draggedColumn === columnKey
            ? "bg-indigo-100 text-indigo-700 opacity-70"
            : "text-slate-500"
        }`}
      >
        <span className={`inline-flex items-center gap-1.5 ${columnKey === "leadId" ? "justify-center" : ""}`}>
          {canReorderColumns && (
            <span
              draggable
              onDragStart={(event) => {
                setDraggedColumn(columnKey);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", columnKey);
              }}
              onDragEnd={() => setDraggedColumn("")}
              title={`Drag to rearrange ${INDIVIDUAL_COLUMN_LABELS[columnKey]}`}
              aria-hidden="true"
              className="shrink-0 cursor-grab text-slate-400 active:cursor-grabbing"
            >
              <GripVertical size={12} />
            </span>
          )}
          {INDIVIDUAL_COLUMN_LABELS[columnKey]}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleSort(columnKey);
            }}
            aria-label={`Sort by ${INDIVIDUAL_COLUMN_LABELS[columnKey]}${
              sortKey === columnKey
                ? sortDir === "asc"
                  ? " (ascending)"
                  : " (descending)"
                : ""
            }`}
            className="inline-flex h-5 w-5 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
          >
            {sortKey === columnKey ? (
              sortDir === "asc" ? (
                <ArrowUp size={13} strokeWidth={2.6} className="text-indigo-600" aria-hidden="true" />
              ) : (
                <ArrowDown size={13} strokeWidth={2.6} className="text-indigo-600" aria-hidden="true" />
              )
            ) : (
              <ArrowUpDown size={12} className="text-slate-400" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            data-col-menu-trigger
            aria-haspopup="true"
            aria-expanded={columnMenu?.key === columnKey}
            aria-label={`Column options: ${INDIVIDUAL_COLUMN_LABELS[columnKey]}`}
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              setColumnMenu((prev) =>
                prev?.key === columnKey
                  ? null
                  : {
                      key: columnKey,
                      x: rect.right,
                      y: rect.bottom + 4,
                      trigger: event.currentTarget,
                    }
              );
            }}
            className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
          >
            <ChevronDown size={13} aria-hidden="true" />
          </button>
        </span>
      </th>
    );
  }

  function renderLeadColumnCell(lead, columnKey, customFields, customFieldsOpen) {
    if (columnKey === "leadId") {
      return (
        <td key={columnKey} className={`min-w-[78px] px-2.5 text-center ${individualCellPadding}`}>
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-2 text-[12px] font-bold tabular-nums text-slate-600">
            {displayLeadId(lead.leadNumber)}
          </span>
        </td>
      );
    }

    if (columnKey === "name") {
      return (
        <td key={columnKey} className={`min-w-[160px] max-w-[160px] px-3 ${individualCellPadding}`}>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDetailsLead(lead)}
              title={`View ${lead.name || "lead"} details`}
              className="min-w-0 flex-1 cursor-pointer text-left"
            >
              <span className="block truncate whitespace-nowrap text-[13px] font-semibold text-slate-900 hover:text-indigo-700 hover:underline">
                {lead.name}
              </span>
            </button>

            {customFields.length > 0 && (
              <button
                type="button"
                onClick={() => toggleCustomFields(lead.id)}
                title={customFieldsOpen ? "Hide custom fields" : "Show custom fields"}
                aria-expanded={customFieldsOpen}
                className="inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {customFieldsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {customFields.length}
              </button>
            )}
          </div>
        </td>
      );
    }

    if (columnKey === "phone" || columnKey === "alternatePhone") {
      const phone = columnKey === "phone" ? lead.phone : lead.alternatePhone;
      return (
        <td key={columnKey} className={`${columnKey === "phone" ? "min-w-[120px]" : "min-w-[130px]"} px-3 ${individualCellPadding} whitespace-nowrap text-[13px] text-slate-600`}>
          <PhoneAction
            phone={phone}
            name={lead.name}
            onCopied={setSuccessMessage}
            onDial={() => setCallLead(lead)}
          />
        </td>
      );
    }

    if (["email", "course", "assignedTo"].includes(columnKey)) {
      const value =
        columnKey === "email"
          ? lead.email
          : columnKey === "course"
            ? lead.course
            : lead.assignedToName || "Unassigned";
      const width =
        columnKey === "email"
          ? "min-w-[175px] max-w-[200px]"
          : columnKey === "course"
            ? "min-w-[120px] max-w-[145px]"
            : "min-w-[140px] max-w-[160px]";
      return (
        <td key={columnKey} className={`${width} px-3 ${individualCellPadding}`}>
          <div title={value || ""} className="truncate whitespace-nowrap text-[13px] text-slate-600">
            {value || "—"}
          </div>
        </td>
      );
    }

    if (columnKey === "preferredColleges") {
      return (
        <td key={columnKey} className={`min-w-[170px] max-w-[190px] px-3 ${individualCellPadding}`}>
          <input
            type="text"
            defaultValue={lead.preferredColleges || ""}
            placeholder="Add college"
            title={lead.preferredColleges || ""}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next !== String(lead.preferredColleges || "").trim()) {
                updateLeadPreferredColleges(lead.id, next);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.target.blur();
            }}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            aria-label={`Interested college for ${lead.name}`}
          />
        </td>
      );
    }

    if (columnKey === "temperature") {
      return (
        <td key={columnKey} className={`min-w-[110px] px-3 ${individualCellPadding} whitespace-nowrap`}>
          <select
            value={lead.temperature || "WARM"}
            disabled={temperatureUpdatingId === lead.id}
            onChange={(event) => updateLeadTemperature(lead.id, event.target.value)}
            className={`h-8 rounded-lg border px-2 text-[12px] font-bold outline-none transition disabled:opacity-60 ${temperatureSelectClass(lead.temperature || "WARM")}`}
            aria-label={`Lead type for ${lead.name}`}
          >
            {LEAD_TEMPERATURES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </td>
      );
    }

    if (columnKey === "status") {
      return (
        <td key={columnKey} className={`min-w-[145px] px-3 ${individualCellPadding} whitespace-nowrap`}>
          <LeadStatusSelect
            lead={lead}
            options={individualStatusOptions}
            disabled={statusUpdatingId === lead.id}
            onChangeStatus={updateLeadStatus}
            onAdmissionDone={setAdmissionLead}
          />
        </td>
      );
    }

    if (columnKey === "intelligence") {
      return (
        <td key={columnKey} className={`min-w-[135px] px-3 ${individualCellPadding} whitespace-nowrap`}>
          {lead.intelligence ? (
            <button
              type="button"
              onClick={() => setIntelligenceLead(lead)}
              title={lead.intelligence.nextBestAction || "View lead intelligence"}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[11px] font-extrabold ${intelligenceTone(lead.intelligence.score)}`}>
                {lead.intelligence.score}
              </span>
              <span>
                <span className="block text-[11px] font-bold text-slate-700">{lead.intelligence.conversionChance}</span>
                <span className="block text-[10px] text-slate-400">View reason</span>
              </span>
            </button>
          ) : (
            <span className="text-[12px] text-slate-400">—</span>
          )}
        </td>
      );
    }

    if (columnKey === "dataset") {
      const datasetName = lead.datasetId
        ? datasetNameById[lead.datasetId] || "Dataset"
        : "";
      return (
        <td key={columnKey} className={`min-w-[150px] max-w-[200px] px-3 ${individualCellPadding}`}>
          {lead.datasetId ? (
            <span
              title={`Imported from ${datasetName}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-medium text-slate-600"
            >
              <FileText size={12} className="shrink-0 text-indigo-500" aria-hidden="true" />
              <span className="truncate">{datasetName}</span>
            </span>
          ) : lead.campaign ? (
            <span
              title={`Campaign: ${lead.campaign}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-[12px] font-medium text-violet-700"
            >
              <Megaphone size={12} className="shrink-0 text-violet-500" aria-hidden="true" />
              <span className="truncate">{lead.campaign}</span>
            </span>
          ) : lead.isManual ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400">
              <Pencil size={12} aria-hidden="true" />
              Manual
            </span>
          ) : (
            <span className="text-[12px] font-semibold text-slate-300">—</span>
          )}
        </td>
      );
    }

    return (
      <td key={columnKey} title={formatDate(lead.createdAt)} className={`min-w-[125px] px-3 ${individualCellPadding} whitespace-nowrap text-[12px] text-slate-500`}>
        {formatDate(lead.createdAt)}
      </td>
    );
  }

  const individualModal = showIndividual ? (
    <IndividualLeadModal
      assignees={assignees}
      lead={editingIndividual}
      courseOptions={individualCourseOptions}
      defaultType={
        selectedType?.api === "ALL"
          ? "INDIVIDUAL"
          : selectedType?.api || "INDIVIDUAL"
      }
      onClose={() => {
        setShowIndividual(false);
        setEditingIndividual(null);
      }}
      onSaved={async (data) => {
        const wasEditing = Boolean(editingIndividual);

        setShowIndividual(false);
        setEditingIndividual(null);
        setSuccessMessage(
          `${data.lead.name} ${wasEditing ? "updated" : "added"} successfully.`
        );

        if (detailsLead?.id && data.lead?.id === detailsLead.id) {
          setDetailsLead((current) =>
            current?.id === data.lead.id ? { ...current, ...data.lead } : current
          );
        }

        const savedType = String(
          data.lead?.type ||
            (selectedType?.api === "ALL" ? "INDIVIDUAL" : selectedType?.api) ||
            "INDIVIDUAL"
        )
          .trim()
          .toUpperCase();

        const targetType = ALL_LEAD_TYPES.find((type) => type.api === savedType);

        setSub(targetType?.key || "individual");

        await Promise.all([loadIndividualLeads(), loadDatasets()]);
      }}
    />
  ) : null;

  if (detailsLead) {
    return (
      <>
        <style>{`
          .form-input {
            width: 100%;
            height: 40px;
            padding: 0 12px;
            border: 1px solid rgb(226 232 240);
            border-radius: 8px;
            font-size: 14px;
            background: white;
            color: rgb(15 23 42);
            outline: none;
          }
          .form-input:focus {
            border-color: rgb(129 140 248);
            box-shadow: 0 0 0 3px rgb(224 231 255);
          }
          /* 3.10: inset the dropdown arrow from the far-right edge and align it. */
          select.form-input {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            padding-right: 36px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            background-size: 16px;
          }
        `}</style>

        <LeadDetailsView
          lead={detailsLead}
          onBack={() => setDetailsLead(null)}
          onEdit={
            detailsLead.isAdmissionsSynced
              ? null
              : () => {
                  setEditingIndividual(detailsLead);
                  setShowIndividual(true);
                }
          }
          onLeadChange={(updatedLead) => {
            setDetailsLead(updatedLead);
            setIndividualLeads((current) =>
              current.map((lead) =>
                lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead
              )
            );
          }}
        />
        {individualModal}
      </>
    );
  }

  const detailData = detailView
    ? (() => {
      if (detailView === "datasets") {
        return {
          eyebrow: "Lead Store / Datasets",
          title: "Import Batches",
          subtitle:
            "Every file or batch imported into Lead Store, with the details allocated at import.",
          columns: [
            "Batch",
            "Type",
            "Source",
            "Assigned To",
            "Imported",
            "Duplicates",
            "Converted",
            "Uploaded",
          ],
          empty: "No import batches yet.",
          rows: datasets.map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-3 font-semibold text-slate-800">
                {d.name}
                {d.sourceFileName && d.sourceFileName !== d.name ? (
                  <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
                    {d.sourceFileName}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3 text-slate-600">{d.typeLabel || d.type}</td>
              <td className="px-4 py-3 text-slate-600">{d.sourceName || "—"}</td>
              <td className="px-4 py-3 text-slate-600">{d.assignedTo || "Unassigned"}</td>
              <td className="px-4 py-3 text-slate-600">
                {d.importedCount ?? d.count ?? 0}
              </td>
              <td className="px-4 py-3 text-slate-600">{d.duplicateCount || 0}</td>
              <td className="px-4 py-3 font-semibold text-emerald-700">{d.converted || 0}</td>
              <td className="px-4 py-3 text-slate-500">
                {formatDate(d.uploadedAt || d.createdAt)}
              </td>
            </tr>
          )),
        };
      }

      if (detailView === "duplicates") {
        const rows = [];
        datasets
          .filter((d) => Number(d.duplicateCount || 0) > 0)
          .forEach((d) => {
            if (
              Array.isArray(d.duplicateDetails) &&
              d.duplicateDetails.length > 0
            ) {
              d.duplicateDetails.forEach((item, index) => {
                rows.push(
                  <tr key={`${d.id}-${item.rowNumber || index}`}>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {d.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.rowNumber || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {item.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.phone || item.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.reason || item.matchedBy || "Duplicate"}
                    </td>
                  </tr>
                );
              });
            } else {
              rows.push(
                <tr key={d.id}>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    {d.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500" colSpan={3}>
                    Row-level details aren&apos;t stored for this import.
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.duplicateCount} skipped
                  </td>
                </tr>
              );
            }
          });
        return {
          eyebrow: "Lead Store / Datasets",
          title: "Duplicates Skipped",
          subtitle: "Rows skipped during import and the duplicate match used.",
          columns: ["Batch", "Row", "Lead", "Contact", "Reason"],
          empty: "No duplicate rows recorded.",
          rows,
        };
      }

      const leadRows = (list) =>
        list.map((lead) => (
          <tr key={lead.id}>
            <td className="px-4 py-3 font-semibold text-slate-800">
              {lead.name || "—"}
            </td>
            <td className="px-4 py-3 text-slate-600">{lead.phone || "—"}</td>
            <td className="px-4 py-3 text-slate-600">{lead.email || "—"}</td>
            <td className="px-4 py-3 text-slate-600">
              {lead.assignedToName || "Unassigned"}
            </td>
            <td className="px-4 py-3">
              <Badge tone={stageTone(lead.stage)}>{lead.stage || "—"}</Badge>
            </td>
            <td className="px-4 py-3 text-slate-600">
              {lead.leadStatus || "Fresh"}
            </td>
            <td className="px-4 py-3 text-slate-600">
              {lead.temperature || "—"}
            </td>
            <td className="px-4 py-3 text-slate-600">
              {lead.sourceName || lead.source || "—"}
            </td>
            <td className="px-4 py-3 text-slate-600">{lead.course || "—"}</td>
            <td className="px-4 py-3 text-slate-500">
              {formatDate(lead.createdAt)}
            </td>
          </tr>
        ));

      const LEAD_COLUMNS = [
        "Name",
        "Phone",
        "Email",
        "Owner",
        "Stage",
        "Status",
        "Temperature",
        "Source",
        "Course",
        "Created",
      ];

      // Dashboard leads KPIs open as dedicated leads pages.
      if (detailView === "total-leads") {
        return {
          eyebrow: "Dashboard / Leads",
          title: "Total Leads",
          subtitle: "Every lead in Lead Store for this period.",
          columns: LEAD_COLUMNS,
          empty: "No leads yet.",
          rows: leadRows(individualLeads),
        };
      }
      if (detailView === "new-leads") {
        return {
          eyebrow: "Dashboard / Leads",
          title: "New Leads",
          subtitle: "Leads still at the New stage.",
          columns: LEAD_COLUMNS,
          empty: "No new leads.",
          rows: leadRows(individualLeads.filter((l) => l.stage === "NEW")),
        };
      }
      if (detailView === "qualified-leads") {
        return {
          eyebrow: "Dashboard / Leads",
          title: "Qualified Leads",
          subtitle: "Leads that reached Qualified or Admitted.",
          columns: LEAD_COLUMNS,
          empty: "No qualified leads.",
          rows: leadRows(
            individualLeads.filter(
              (l) => l.stage === "QUALIFIED" || l.stage === "ADMITTED"
            )
          ),
        };
      }

      if (detailView === "imported") {
        return {
          eyebrow: "Lead Store / Leads",
          title: "Imported Leads",
          subtitle: "Leads created from imported datasets.",
          columns: LEAD_COLUMNS,
          empty: "No imported leads yet.",
          rows: leadRows(individualLeads.filter((l) => l.datasetId)),
        };
      }

      return {
        eyebrow: "Lead Store / Leads",
        title: "Converted Leads",
        subtitle: "Lead Store leads that reached Admission Done.",
        columns: LEAD_COLUMNS,
        empty: "No converted leads yet.",
        rows: leadRows(
          individualLeads.filter(
            (l) => l.stage === "ADMITTED" || l.leadStatus === "Admission Done"
          )
        ),
      };
    })()
    : null;

  return (
    <div className="space-y-3">
      <AdmissionDoneModal
        lead={admissionLead}
        onClose={() => setAdmissionLead(null)}
        onSaved={() => {
          const leadId = admissionLead?.id;
          setIndividualLeads((current) => current.map((lead) =>
            lead.id === leadId
              ? { ...lead, leadStatus: "Admission Done", stage: "ADMITTED", isAdmissionsSynced: true }
              : lead
          ));
          setDetailsLead((current) => current?.id === leadId
            ? { ...current, leadStatus: "Admission Done", stage: "ADMITTED", isAdmissionsSynced: true }
            : current
          );
          setAdmissionLead(null);
          setSuccessMessage("Admission created successfully.");
        }}
      />
      <DetailModal
        open={!!detailData}
        title={detailData?.title}
        subtitle={detailData?.subtitle}
        columns={detailData?.columns}
        rows={detailData?.rows}
        empty={detailData?.empty}
        caption={detailData?.title}
        loading={loading && (detailData?.rows?.length ?? 0) === 0}
        onClose={() => setDetailView(null)}
      />
      <style>{`
        .form-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border: 1px solid rgb(226 232 240);
          border-radius: 8px;
          font-size: 14px;
          background: white;
          color: rgb(15 23 42);
          outline: none;
        }
        .form-input:focus {
          border-color: rgb(129 140 248);
          box-shadow: 0 0 0 3px rgb(224 231 255);
        }
        /* 3.10: inset the dropdown arrow from the far-right edge and align it. */
        select.form-input {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          padding-right: 36px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 16px;
        }
      `}</style>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">
            Lead Store
          </h1>

          <p className="mt-1 text-[15px] text-slate-500">
            Import, validate, assign and track external lead datasets in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await Promise.all([loadDatasets(), loadIndividualLeads()]);
            }}
            disabled={
              loading
            }
            className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700 inline-flex items-center gap-2 shadow-sm"
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
            onClick={() => setNurtureOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={nurtureOpen}
            className="h-9 min-h-[44px] lg:min-h-0 px-3.5 border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
          >
            <Sparkles size={14} />
            <span className="leading-none text-center">Smart Nurture</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingIndividual(null);
              setShowIndividual(true);
            }}
            className="h-9 px-3.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
          >
            <UserPlus
              size={14}
            />
            Add Lead
          </button>

          <button
            type="button"
            onClick={() =>
              setShowUpload(
                true
              )
            }
            className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
          >
            <Plus
              size={14}
            />
            Import Leads
          </button>

          <div className="relative">
            <button
              ref={importMenuBtnRef}
              type="button"
              onClick={() => setImportMenuOpen((open) => !open)}
              aria-haspopup="true"
              aria-expanded={importMenuOpen}
              aria-controls="leadstore-import-menu"
              aria-label="Import stats, batches and datasets"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <MoreVertical size={16} aria-hidden="true" />
            </button>

            {importMenuOpen && (
              <div
                id="leadstore-import-menu"
                ref={importMenuRef}
                aria-label="Imports and datasets"
                className="absolute right-0 z-[60] mt-1.5 w-[300px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.18)]"
              >
                <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  Imports &amp; datasets
                </div>

                {[
                  {
                    key: "datasets",
                    label: "Import Batches",
                    sub: "Datasets uploaded — open one to see its leads",
                    count: datasets.length,
                    noun: "batches",
                    Icon: Database,
                    tone: "bg-indigo-50 text-indigo-600",
                  },
                  {
                    key: "imported",
                    label: "Imported Leads",
                    sub: "All leads brought in via import",
                    count: importedLeads,
                    noun: "leads",
                    Icon: Users,
                    tone: "bg-indigo-50 text-indigo-600",
                  },
                  {
                    key: "duplicates",
                    label: "Duplicates Skipped",
                    sub: "Not leads — review & manage",
                    count: duplicatesSkipped,
                    noun: "duplicates",
                    Icon: Layers3,
                    tone: "bg-amber-50 text-amber-600",
                  },
                  {
                    key: "converted",
                    label: "Converted",
                    sub: "Reached Admission Done",
                    count: totalConverted,
                    noun: "leads",
                    Icon: UserCheck,
                    tone: "bg-emerald-50 text-emerald-600",
                  },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setImportMenuOpen(false);
                      openDetail(item.key);
                    }}
                    aria-label={`${item.label}, ${item.count.toLocaleString("en-IN")} ${item.noun}, open`}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.tone}`}
                      aria-hidden="true"
                    >
                      <item.Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-slate-800">
                        {item.label}
                      </span>
                      <span className="block truncate text-[11px] text-slate-400">
                        {item.sub}
                      </span>
                    </span>
                    <span className="text-[16px] font-bold tabular-nums text-slate-900" aria-hidden="true">
                      {item.count.toLocaleString("en-IN")}
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-slate-300" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {leadStoreMetricFilter && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-600">Lead Store KPI</div>
            <div className="mt-0.5 text-[13px] font-semibold text-slate-800">Showing {leadStoreMetricFilter.label}</div>
          </div>
          <button type="button" onClick={() => setLeadStoreMetricFilter(null)} className="h-8 rounded-lg border border-indigo-200 bg-white px-3 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-50">Show all leads</button>
        </div>
      )}

      <div className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center native:flex-row native:flex-nowrap native:items-center native:overflow-x-auto native:[-webkit-overflow-scrolling:touch]">
            <label className="relative flex h-9 w-full items-center rounded-lg border border-slate-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 lg:w-[270px] lg:flex-shrink-0 native:h-10 native:w-[210px] native:shrink-0">
              <span className="flex-shrink-0 border-r border-slate-100 pl-3 pr-2 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-400">
                Lead type
              </span>

              <select
                value={sub}
                onChange={(event) =>
                  setSub(event.target.value)
                }
                aria-label="Lead type"
                className="h-full min-w-0 flex-1 appearance-none bg-transparent pl-2 pr-8 text-[13px] font-semibold text-slate-700 focus:outline-none"
              >
                {leadTypeOptions.map((type) => (
                  <option
                    key={type.key}
                    value={type.key}
                  >
                    {type.label} ({type.count})
                  </option>
                ))}
              </select>

              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
            </label>

            <div className="relative min-w-0 flex-1 native:w-[220px] native:flex-none native:shrink-0">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                aria-label="Search leads"
                placeholder="Search lead ID, name, phone, email or course..."
                className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[14px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 native:h-10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap native:flex-nowrap native:shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewOpen(false);
                  setFiltersOpen((current) => !current);
                }}
                className={`relative h-9 px-3.5 rounded-lg border text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors native:h-10 ${
                  filtersOpen ||
                  activeFilterCount > 0
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal size={14} />
                Filter

                {activeFilterCount > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold inline-flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="relative">
                <button
                  ref={viewBtnRef}
                  type="button"
                  aria-expanded={viewOpen}
                  aria-haspopup="true"
                  aria-controls="leadstore-columns-panel"
                  onClick={() => {
                    setFiltersOpen(false);
                    setViewOpen((current) => !current);
                  }}
                  className={`h-9 px-3.5 rounded-lg border text-[13px] font-semibold inline-flex items-center justify-center gap-2 shadow-sm native:h-10 ${viewOpen ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  <Layers3 size={14} />
                  View
                </button>

                {viewOpen &&
                  createPortal(
                    <div
                      className="fixed inset-0 z-[120] flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
                      onClick={(event) => {
                        if (event.target === event.currentTarget) closeViewPanel();
                      }}
                    >
                    <div ref={viewPanelRef} id="leadstore-columns-panel" role="dialog" aria-modal="true" aria-labelledby="leadstore-columns-title" tabIndex={-1} className="flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl outline-none animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none">
                    <style>{"@keyframes drawerSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}"}</style>
                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                      <h2 id="leadstore-columns-title" className="text-[16px] font-bold text-slate-900">Choose your columns</h2>
                      <button type="button" onClick={closeViewPanel} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
                        <X size={17} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-5">
                    <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">Visible columns</div>
                    <div className="mt-2 space-y-1">
                      {INDIVIDUAL_COLUMN_OPTIONS.map((column) => (
                        <label key={column.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                          <span>{column.label}</span>
                          <input
                            type="checkbox"
                            checked={Boolean(individualColumns[column.key])}
                            onChange={() => toggleIndividualColumn(column.key)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </label>
                      ))}

                      {customColumns.map((column) => (
                        <div key={column.key} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={column.visible}
                              onChange={() => toggleCustomColumn(column.key)}
                              className="h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="truncate">{column.label}</span>
                            <span className="shrink-0 rounded border border-slate-200 px-1 text-[9px] font-bold uppercase tracking-[0.04em] text-slate-400">
                              {column.type}
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => removeCustomColumn(column.key)}
                            aria-label={`Remove ${column.label} column`}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">Create column</div>
                      <div className="mt-2 space-y-2">
                        <label className="block">
                          <span className="mb-1 block text-[12px] font-semibold text-slate-600">Column name</span>
                          <input
                            type="text"
                            value={newColumnName}
                            onChange={(event) => setNewColumnName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addCustomColumn();
                              }
                            }}
                            placeholder="e.g. City, Budget, Batch year"
                            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        </label>
                        <div className="flex items-end gap-2">
                          <label className="min-w-0 flex-1">
                            <span className="mb-1 block text-[12px] font-semibold text-slate-600">Type</span>
                            <select
                              value={newColumnType}
                              onChange={(event) => setNewColumnType(event.target.value)}
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                            >
                              <option value="Text">Text (alphabets)</option>
                              <option value="Number">Number</option>
                            </select>
                          </label>
                          <button
                            type="button"
                            onClick={addCustomColumn}
                            disabled={!newColumnName.trim()}
                            className="h-9 shrink-0 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">Row density</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {[["compact", "Compact"], ["comfortable", "Comfortable"]].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setIndividualDensity(value)}
                            className={`h-8 rounded-lg border text-[12px] font-semibold ${individualDensity === value ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-4 text-slate-400">
                      {canReorderColumns
                        ? "Drag table column names to rearrange them. Your order is saved to your account."
                        : "Column order follows the company default. Custom fields open from the lead name."}
                    </p>
                    </div>
                    </div>
                    </div>,
                    document.body
                  )}
              </div>

              <button
                type="button"
                onClick={exportCurrentView}
                disabled={visibleCount === 0}
                className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 inline-flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={14} />
                Export CSV
              </button>

              <button
                type="button"
                onClick={openSelectedMessageComposer}
                className="h-9 px-3.5 rounded-lg bg-indigo-600 text-[13px] font-semibold text-white inline-flex items-center justify-center gap-2 shadow-sm hover:bg-indigo-700"
              >
                <Mail size={14} />
                Send Message
                {selectedLeadIds.length > 0 && (
                  <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-white/20 px-1 text-[11px] font-bold text-white">
                    {selectedLeadIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {dashboardLeadFilter ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-600">Dashboard filter</div>
              <div className="mt-0.5 text-[13px] font-semibold text-slate-800">Showing {dashboardLeadFilter.label}</div>
            </div>
            <button
              type="button"
              onClick={() => setDashboardLeadFilter(null)}
              className="h-8 rounded-lg border border-indigo-200 bg-white px-3 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              Show all leads
            </button>
          </div>
        ) : null}

        {filtersOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[120] flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
              onClick={(event) => {
                if (event.target === event.currentTarget) setFiltersOpen(false);
              }}
            >
            <div role="dialog" aria-modal="true" aria-labelledby="leadstore-filters-title" tabIndex={-1} className="flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl outline-none animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none">
            <style>{"@keyframes drawerSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}"}</style>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 id="leadstore-filters-title" className="text-[16px] font-bold text-slate-900">Filters</h2>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-1 gap-3">
              <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">
                    Status
                  </span>

                  <select
                    value={
                      filters.status
                    }
                    onChange={(
                      event
                    ) =>
                      setFilters(
                        (
                          current
                        ) => ({
                          ...current,
                          status:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="form-input"
                  >
                    <option value="">
                      All statuses
                    </option>

                    {individualStatusOptions.map(
                      (
                        status
                      ) => (
                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {
                            String(
                              status
                            ).replaceAll(
                              "_",
                              " "
                            )
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">
                  Lead Type
                </span>

                <select
                  value={filters.temperature}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      temperature: event.target.value,
                    }))
                  }
                  className="form-input"
                >
                  <option value="">All lead types</option>
                  {LEAD_TEMPERATURES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">
                  Assigned To
                </span>

                <select
                  value={
                    filters.assignedToUserId
                  }
                  onChange={(
                    event
                  ) =>
                    setFilters(
                      (
                        current
                      ) => ({
                        ...current,
                        assignedToUserId:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="form-input"
                >
                  <option value="">
                    All assignees
                  </option>

                  <option value="__UNASSIGNED__">
                    Unassigned
                  </option>

                  {assignees.map(
                    (
                      user
                    ) => (
                      <option
                        key={
                          user.id
                        }
                        value={
                          user.id
                        }
                      >
                        {
                          user.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">
                    Course
                  </span>

                  <select
                    value={
                      filters.course
                    }
                    onChange={(
                      event
                    ) =>
                      setFilters(
                        (
                          current
                        ) => ({
                          ...current,
                          course:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    className="form-input"
                  >
                    <option value="">
                      All courses
                    </option>

                    {individualCourseOptions.map(
                      (
                        course
                      ) => (
                        <option
                          key={
                            course
                          }
                          value={
                            course
                          }
                        >
                          {
                            course
                          }
                        </option>
                      )
                    )}
                  </select>
                </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">
                  Source
                </span>

                <select
                  value={
                    filters.source
                  }
                  onChange={(
                    event
                  ) =>
                    setFilters(
                      (
                        current
                      ) => ({
                        ...current,
                        source:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="form-input"
                >
                  <option value="">
                    All sources
                  </option>

                  {sourceOptions.map(
                    (
                      source
                    ) => (
                      <option
                        key={
                          source
                        }
                        value={
                          source
                        }
                      >
                        {
                          source
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">
                  From Date
                </span>

                <input
                  type="date"
                  value={
                    filters.dateFrom
                  }
                  min="2000-01-01"
                  max={new Date()
                    .toISOString()
                    .slice(0, 10)}
                  onChange={(
                    event
                  ) =>
                    setFilters(
                      (
                        current
                      ) => ({
                        ...current,
                        dateFrom:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="form-input"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-500">
                  To Date
                </span>

                <input
                  type="date"
                  value={
                    filters.dateTo
                  }
                  min={
                    filters.dateFrom ||
                    "2000-01-01"
                  }
                  max={new Date()
                    .toISOString()
                    .slice(0, 10)}
                  onChange={(
                    event
                  ) =>
                    setFilters(
                      (
                        current
                      ) => ({
                        ...current,
                        dateTo:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  className="form-input"
                />
              </label>
            </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[12px] text-slate-500">
                Showing{" "}
                <span className="font-bold text-slate-800">
                  {
                    visibleCount
                  }
                </span>{" "}
                of{" "}
                <span className="font-bold text-slate-800">
                  {
                    totalCurrentCount
                  }
                </span>{" "}
                leads
              </div>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                disabled={
                  activeFilterCount ===
                  0
                }
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 disabled:opacity-40"
              >
                <RotateCcw
                  size={12}
                />
                Clear filters
              </button>
            </div>
          </div>
          </div>,
          document.body
        )}
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-[15px]">
          <CheckCircle2
            size={15}
          />
          {successMessage}
        </div>
      )}

      {focusNotice && (
        <div
          role="alert"
          tabIndex={-1}
          ref={focusNoticeRef}
          className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[15px] outline-none"
        >
          <span className="flex items-center gap-2">
            <AlertCircle size={15} aria-hidden="true" />
            {focusNotice}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setFocusNotice("")}
            className="rounded p-1 hover:bg-amber-100"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[15px]">
          <AlertCircle
            size={15}
          />
          {error}
        </div>
      )}

      {selectedLeadIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-bold text-indigo-800">
              {selectedLeadIds.length} selected
            </span>

            {filteredIndividualLeads.length > selectedLeadIds.length && (
              <button
                type="button"
                onClick={() =>
                  setSelectedLeadIds(
                    filteredIndividualLeads.map(
                      (lead) => lead.id
                    )
                  )
                }
                className="font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Select all {filteredIndividualLeads.length} filtered leads
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedLeadIds([]);
                setBulkAssigneeId("");
              }}
              className="font-semibold text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={bulkAssigneeId}
              onChange={(event) =>
                setBulkAssigneeId(
                  event.target.value
                )
              }
              className="h-9 min-w-[210px] rounded-lg border border-indigo-200 bg-white px-3 text-[13px] font-semibold text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                Assign to team member...
              </option>

              {assignees.map(
                (user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {user.name}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              onClick={assignSelectedLeads}
              disabled={
                bulkAssigning ||
                !bulkAssigneeId
              }
              className="h-9 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkAssigning
                ? "Assigning..."
                : "Assign selected"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 flex justify-center gap-2 text-[15px] text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Loader2
            size={16}
            className="animate-spin"
          />

          Loading leads...
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="relative overflow-x-auto">
            <style>{'table[data-wrap="true"] .truncate{white-space:normal;text-overflow:clip;overflow-wrap:anywhere;word-break:break-word;}'}</style>
            {columnMenu &&
              createPortal(
                <div
                  data-col-menu
                  role="group"
                  aria-label={`Options for ${INDIVIDUAL_COLUMN_LABELS[columnMenu.key]}`}
                  style={{
                    position: "fixed",
                    top: columnMenu.y,
                    left: Math.max(8, columnMenu.x - 192),
                    width: 192,
                    zIndex: 130,
                  }}
                  className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                >
                  <button
                    type="button"
                    aria-pressed={wrapText}
                    onClick={() => {
                      setWrapText((current) => !current);
                      closeColumnMenu(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  >
                    <WrapText size={13} className="text-slate-400" aria-hidden="true" />
                    {wrapText ? "Clip text" : "Wrap text"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const key = columnMenu.key;
                      setFrozenColumns((cur) =>
                        cur.includes(key)
                          ? cur.filter((k) => k !== key)
                          : [...cur, key]
                      );
                      closeColumnMenu(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                  >
                    <Pin size={13} className="text-slate-400" aria-hidden="true" />
                    {frozenColumns.includes(columnMenu.key)
                      ? "Unfreeze column"
                      : "Freeze column"}
                  </button>
                </div>,
                document.body
              )}
            <table data-wrap={wrapText ? "true" : undefined} className="w-max min-w-full text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50/95">
                <tr>
                  <th className="sticky left-0 z-30 w-10 min-w-10 border-r border-slate-200 bg-slate-50/95 px-2.5 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={togglePageSelection}
                      aria-label="Select all leads on this page"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>

                  {visibleOrderedColumnKeys.map((columnKey) => {
                    const th = renderColumnHeader(columnKey);
                    const fz = freezeMeta(columnKey);
                    if (!fz) return th;
                    return cloneElement(th, {
                      className: `${th.props.className} sticky z-[25] bg-slate-50${
                        fz.isLast
                          ? " border-r-2 border-indigo-300 shadow-[2px_0_5px_-2px_rgba(15,23,42,0.18)]"
                          : ""
                      }`,
                      style: {
                        ...th.props.style,
                        left: fz.left,
                        width: fz.width,
                        minWidth: fz.width,
                        maxWidth: fz.width,
                      },
                    });
                  })}

                  {visibleCustomColumns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className="min-w-[140px] px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-slate-500"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {column.label}
                        <span
                          className="rounded border border-slate-200 px-1 text-[9px] font-bold text-slate-400"
                          aria-hidden="true"
                        >
                          {column.type === "Number" ? "123" : "ABC"}
                        </span>
                      </span>
                    </th>
                  ))}

                  <th className="lg:sticky lg:right-0 z-20 min-w-[92px] border-l border-slate-200 bg-slate-50/95 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredIndividualLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleIndividualColumnCount}
                      className="py-12 text-center text-sm text-slate-500"
                    >
                      No {selectedType.label.toLowerCase()} found
                    </td>
                  </tr>
                ) : (
                  paginatedIndividualLeads.map((lead) => {
                    const customFields =
                      Array.isArray(lead.customFields)
                        ? lead.customFields
                        : [];

                    const customFieldsOpen =
                      Boolean(
                        expandedCustomFields[
                          lead.id
                        ]
                      );

                    const selected =
                      selectedLeadIds.includes(
                        lead.id
                      );

                    return (
                      <Fragment key={lead.id}>
                        <tr className={`group transition-colors ${selected ? "bg-indigo-50/50" : "hover:bg-slate-50/80"}`}>
                          <td className={`sticky left-0 z-20 w-10 min-w-10 border-r border-slate-100 px-2.5 text-center ${individualCellPadding} ${selected ? "bg-indigo-50" : "bg-white group-hover:bg-slate-50"}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() =>
                                toggleLeadSelection(
                                  lead.id
                                )
                              }
                              aria-label={`Select ${lead.name}`}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>

                          {visibleOrderedColumnKeys.map((columnKey) => {
                            const cell = renderLeadColumnCell(
                              lead,
                              columnKey,
                              customFields,
                              customFieldsOpen
                            );
                            const fz = freezeMeta(columnKey);
                            if (!fz) return cell;
                            return cloneElement(cell, {
                              className: `${cell.props.className} sticky z-[15] ${
                                selected
                                  ? "bg-indigo-50"
                                  : "bg-white group-hover:bg-slate-50"
                              }${
                                fz.isLast
                                  ? " border-r-2 border-indigo-300 shadow-[2px_0_5px_-2px_rgba(15,23,42,0.18)]"
                                  : ""
                              }`,
                              style: {
                                ...cell.props.style,
                                left: fz.left,
                                width: fz.width,
                                minWidth: fz.width,
                                maxWidth: fz.width,
                              },
                            });
                          })}

                          {visibleCustomColumns.map((column) => {
                            const valueKey = `${lead.id}:${column.key}`;
                            return (
                              <td
                                key={column.key}
                                className={`min-w-[140px] px-3 ${individualCellPadding}`}
                              >
                                <input
                                  type={column.type === "Number" ? "number" : "text"}
                                  value={customColumnValues[valueKey] ?? ""}
                                  onChange={(event) =>
                                    setCustomColumnValue(lead.id, column.key, event.target.value)
                                  }
                                  aria-label={`${column.label} for ${lead.name}`}
                                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[13px] text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                              </td>
                            );
                          })}

                          <td className={`lg:sticky lg:right-0 z-10 min-w-[92px] border-l border-slate-100 px-2 ${individualCellPadding} ${selected ? "bg-indigo-50" : "bg-white group-hover:bg-slate-50"}`}>
                            <div className="flex items-center justify-end gap-1">
                              {lead.phone ? (
                                <a
                                  href={telHref(lead.phone)}
                                  title={`Call ${lead.name}`}
                                  aria-label={`Call ${lead.name}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-50"
                                >
                                  <PhoneCall size={14} aria-hidden="true" />
                                </a>
                              ) : (
                                <span
                                  title="Lead has no phone number"
                                  aria-label="Call unavailable: lead has no phone number"
                                  role="img"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300"
                                >
                                  <PhoneCall size={14} aria-hidden="true" />
                                </span>
                              )}

                              {lead.isAdmissionsSynced ? (
                                <span
                                  className="px-2 text-[11px] font-semibold text-slate-400"
                                  title="This lead is managed from Admissions"
                                >
                                  Admissions
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingIndividual(lead);
                                      setShowIndividual(true);
                                    }}
                                    title="Edit lead"
                                    aria-label={`Edit ${lead.name}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                  >
                                    <Pencil size={14} aria-hidden="true" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return;

                                      try {
                                        await apiRequest(
                                          `/api/client/lead-store/manual/${lead.id}`,
                                          { method: "DELETE" }
                                        );

                                        setSuccessMessage(`${lead.name} deleted successfully.`);
                                        setSelectedLeadIds((current) =>
                                          current.filter((id) => id !== lead.id)
                                        );

                                        await Promise.all([
                                          loadIndividualLeads(),
                                          loadDatasets(),
                                        ]);
                                      } catch (error) {
                                        setError(
                                          error?.data?.message || "Unable to delete lead"
                                        );
                                      }
                                    }}
                                    title="Delete lead"
                                    aria-label={`Delete ${lead.name}`}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {customFieldsOpen && (
                          <tr className="bg-slate-50/70">
                            <td
                              colSpan={visibleIndividualColumnCount}
                              className="px-4 py-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
                                  Custom fields
                                </span>

                                {customFields.map((field) => (
                                  <span
                                    key={field.id || field.key || field.name}
                                    title={`${field.name}: ${field.value || "—"}`}
                                    className="inline-flex max-w-[280px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-600"
                                  >
                                    <span className="font-semibold text-slate-700">
                                      {field.name}:
                                    </span>
                                    <span className="truncate whitespace-nowrap">
                                      {field.value || "—"}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="text-[12px] text-slate-500"
              role="status"
              aria-live="polite"
            >
              {filteredIndividualLeads.length > 0 ? (
                <>
                  Showing{" "}
                  <span className="font-semibold text-slate-700">
                    {pageStart + 1}
                  </span>
                  {" "}–{" "}
                  <span className="font-semibold text-slate-700">
                    {Math.min(pageStart + pageSize, filteredIndividualLeads.length)}
                  </span>
                  {" "}of{" "}
                  <span className="font-semibold text-slate-700">
                    {filteredIndividualLeads.length}
                  </span>
                  {" "}leads
                </>
              ) : (
                "No leads to display"
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-500">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-700 focus:border-indigo-400 focus:outline-none"
                >
                  {[10, 25, 50, 100].map(
                    (size) => (
                      <option
                        key={size}
                        value={size}
                      >
                        {size}
                      </option>
                    )
                  )}
                </select>
              </label>

              <nav
                aria-label="Lead table pagination"
                className="flex items-center gap-1"
              >
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  disabled={currentPage <= 1}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-40"
                >
                  Previous
                </button>

                <ul className="flex items-center gap-1">
                  {(() => {
                    const items = [];
                    if (totalPages <= 7) {
                      for (let p = 1; p <= totalPages; p += 1) {
                        items.push(p);
                      }
                    } else {
                      const left = Math.max(2, currentPage - 1);
                      const right = Math.min(totalPages - 1, currentPage + 1);
                      items.push(1);
                      if (left > 2) items.push("ellipsis-left");
                      for (let p = left; p <= right; p += 1) {
                        items.push(p);
                      }
                      if (right < totalPages - 1) items.push("ellipsis-right");
                      items.push(totalPages);
                    }
                    return items.map((item) =>
                      typeof item === "string" ? (
                        <li key={item} className="px-1">
                          <span
                            aria-hidden="true"
                            className="text-[12px] text-slate-400"
                          >
                            …
                          </span>
                        </li>
                      ) : (
                        <li key={item}>
                          <button
                            type="button"
                            onClick={() => setPage(item)}
                            aria-label={`Page ${item}`}
                            aria-current={
                              item === currentPage ? "page" : undefined
                            }
                            className={
                              item === currentPage
                                ? "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-indigo-600 bg-indigo-600 px-2 text-[12px] font-bold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                                : "inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                            }
                          >
                            {item}
                          </button>
                        </li>
                      )
                    );
                  })()}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>

          {sub !== "individual" && currentTypeDatasets.length > 0 && (
            <details className="border-t border-slate-200">
              <summary className="cursor-pointer list-none bg-white px-4 py-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                Imported dataset batches ({currentTypeDatasets.length})
              </summary>

              <div className="overflow-x-auto border-t border-slate-100">
          <Table
            columns={[
              "Dataset",
              "Type",
              "Source",
              "Imported",
              "Skipped",
              "Uploaded",
              "Assigned To",
              "Converted",
              "Conversion",
              "Actions",
            ]}
            empty="No datasets found"
            rows={filtered.map(
              (
                dataset
              ) => {
                const conversion =
                  dataset.count >
                  0
                    ? (
                        (dataset.converted /
                          dataset.count) *
                        100
                      ).toFixed(
                        1
                      )
                    : "0.0";

                return (
                  <tr
                    key={
                      dataset.id
                    }
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-[15px] font-medium text-slate-900">
                        {
                          dataset.name
                        }
                      </div>

                      {dataset.sourceFileName && (
                        <div className="text-[13px] text-slate-400 mt-0.5 inline-flex items-center gap-1">
                          <FileSpreadsheet
                            size={10}
                          />
                          {
                            dataset.sourceFileName
                          }
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      <Badge tone="slate">
                        {
                          dataset.typeLabel
                        }
                      </Badge>
                    </td>

                    <td className="px-4 py-2.5 text-[15px] text-slate-600">
                      {dataset.sourceName ||
                        "—"}
                    </td>

                    <td className="px-4 py-2.5 text-[15px] text-slate-700 font-medium">
                      {Number(
                        dataset.count
                      ).toLocaleString(
                        "en-IN"
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-[13px] text-slate-500">
                      <div>
                        Dup:{" "}
                        {
                          dataset.duplicateCount ||
                          0
                        }
                      </div>
                      <div>
                        Invalid:{" "}
                        {
                          dataset.failedCount ||
                          0
                        }
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-[15px] text-slate-500">
                      {
                        formatDate(
                          dataset.uploadedAt
                        )
                      }
                    </td>

                    <td className="px-4 py-2.5 text-[15px] text-slate-700">
                      {
                        dataset.assignedTo
                      }
                    </td>

                    <td className="px-4 py-2.5 text-[15px] text-emerald-700 font-medium">
                      {
                        dataset.converted
                      }
                    </td>

                    <td className="px-4 py-2.5 text-[15px]">
                      {conversion}%
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setEditing(
                              dataset
                            )
                          }
                          title="Edit dataset"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil
                            size={14}
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            removeDataset(
                              dataset
                            )
                          }
                          title="Delete dataset"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2
                            size={14}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
            )}
          />
              </div>
            </details>
          )}
        </div>
      )}

      {messageComposerOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-[17px] font-bold text-slate-950">Send Message</div>
                <div className="mt-1 text-[12px] text-slate-500">{messageLeadIds.length} lead{messageLeadIds.length === 1 ? "" : "s"} selected · Send email or a DLT-approved template SMS to the selected leads.</div>
              </div>
              <button type="button" onClick={closeMessageComposer} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16} /></button>
            </div>

            <div className="border-b border-slate-200 px-5 pt-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setMessageChannel("email")} className={`inline-flex items-center gap-2 rounded-t-xl border px-4 py-2.5 text-[13px] font-bold ${messageChannel === "email" ? "border-b-white border-indigo-200 bg-white text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-800"}`}><Mail size={14} /> Email</button>
                <button type="button" disabled className="inline-flex items-center gap-2 rounded-t-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-400"><MessageCircle size={14} /> WhatsApp · Soon</button>
                {communicationStatus?.sms?.enabled ? (
                  <button type="button" onClick={() => setMessageChannel("sms")} className={`inline-flex items-center gap-2 rounded-t-xl border px-4 py-2.5 text-[13px] font-bold ${messageChannel === "sms" ? "border-b-white border-indigo-200 bg-white text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-800"}`}><Smartphone size={14} /> SMS</button>
                ) : (
                  <button type="button" disabled className="inline-flex items-center gap-2 rounded-t-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-400"><Smartphone size={14} /> SMS · Soon</button>
                )}
              </div>
            </div>

            <div className="space-y-4 p-5">
              {communicationLoading ? (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-[13px] text-slate-500"><Loader2 size={15} className="animate-spin" /> Checking Gmail connection...</div>
              ) : messageChannel === "sms" ? (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">SMS Sender</div>
                      <div className="mt-1 text-[14px] font-semibold text-slate-900">{communicationStatus?.sms?.senderId || communicationStatus?.sms?.provider || "SMS connected"}</div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[12px] font-semibold text-slate-500">SMS sent today</div>
                      <div className="mt-1 text-[14px] font-bold text-slate-900">{communicationStatus?.sms?.sentToday ?? 0}</div>
                    </div>
                  </div>

                  {!(communicationStatus?.sms?.templates || []).length ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
                      No SMS templates yet. Ask your admin to add DLT-approved templates in Settings → Integrations.
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">Template *</label>
                      <select value={smsTemplateId} onChange={(e) => setSmsTemplateId(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100">
                        <option value="">Select a template…</option>
                        {(communicationStatus?.sms?.templates || []).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {smsTemplateId && (
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="text-[12px] font-bold text-slate-700">Message preview</div>
                      <div className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-slate-600">
                        {(communicationStatus?.sms?.templates || []).find((t) => t.id === smsTemplateId)?.body || "(The DLT-approved template content will be sent.)"}
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-[12px] leading-5 text-indigo-800">
                    This sends one DLT-approved template SMS per selected lead using your company&apos;s connected SMS provider. The lead&apos;s name fills the template&apos;s name variable. Leads without a phone number are skipped. Limited to {communicationStatus?.maxPerRequest || 100} leads per send.
                  </div>

                  {communicationError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">{communicationError}</div>}
                  {communicationResult && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700">{communicationResult}</div>}

                  {messageLeadIds.length === 1 && communicationHistory.length > 0 && (
                    <div className="rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-[12px] font-bold text-slate-700"><History size={14} /> Communication History</div>
                      <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto">
                        {communicationHistory.map((item) => (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3"><span className="text-[12px] font-semibold text-slate-800">{item.subject || item.channel}</span><span className={`text-[11px] font-bold ${item.status === "SENT" ? "text-emerald-600" : "text-rose-600"}`}>{item.status}</span></div>
                            <div className="mt-1 text-[11px] text-slate-400">{item.recipient} · {new Date(item.createdAt).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[12px] font-bold uppercase tracking-wide text-slate-500">From Gmail</div>
                      <div className="mt-1 text-[14px] font-semibold text-slate-900">{communicationStatus?.gmail?.email || "No Gmail connected"}</div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[12px] font-semibold text-slate-500">Bispun-tracked emails today</div>
                      <div className="mt-1 text-[14px] font-bold text-slate-900">{communicationStatus?.gmail?.sentToday ?? 0}</div>
                    </div>
                  </div>

                  {!communicationStatus?.gmail?.enabled && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
                      Gmail sending is not ready. Go to Settings → Integrations and connect/reconnect Google to grant Gmail permission.
                    </div>
                  )}

                  <div>
                    <label className="mb-1.5 block text-[12px] font-semibold text-slate-600">Subject *</label>
                    <input value={emailForm.subject} onChange={(e) => setEmailForm((c) => ({ ...c, subject: e.target.value }))} placeholder="Admission follow-up" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-[13px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="block text-[12px] font-semibold text-slate-600">Message *</label>
                      <span className="text-[11px] text-slate-400">Use {"{{name}}"}, {"{{phone}}"}, {"{{email}}"}, {"{{course}}"}</span>
                    </div>
                    <textarea value={emailForm.message} onChange={(e) => setEmailForm((c) => ({ ...c, message: e.target.value }))} rows={10} className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] leading-6 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[12px] font-bold text-slate-700">Attachments</div>
                        <div className="mt-0.5 text-[11px] text-slate-400">Images, PDF, Word, Excel, CSV, PowerPoint, TXT or ZIP · max 10 files · 18 MB total</div>
                      </div>

                      <input
                        ref={emailAttachmentInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.zip"
                        onChange={handleEmailAttachments}
                      />

                      <button
                        type="button"
                        onClick={() => emailAttachmentInputRef.current?.click()}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <Paperclip size={14} />
                        Attach files
                      </button>
                    </div>

                    {emailAttachments.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {emailAttachments.map((file, index) => (
                          <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <FileText size={15} className="shrink-0 text-indigo-500" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12px] font-semibold text-slate-700">{file.name}</div>
                              <div className="text-[10px] text-slate-400">{formatAttachmentSize(file.size)}</div>
                            </div>
                            <button type="button" onClick={() => removeEmailAttachment(index)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Remove attachment">
                              <X size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center gap-2">
                      <Link2 size={14} className="text-indigo-500" />
                      <label className="text-[12px] font-semibold text-slate-600">Google Drive links <span className="font-normal text-slate-400">(optional)</span></label>
                    </div>
                    <textarea
                      value={emailForm.driveLinks}
                      onChange={(e) => setEmailForm((c) => ({ ...c, driveLinks: e.target.value }))}
                      rows={2}
                      placeholder="Paste a Google Drive or Google Docs link here. For multiple links, use one link per line."
                      className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] leading-5 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    />
                    <div className="mt-1 text-[11px] text-slate-400">The link is added to the email body. Make sure the Drive file sharing permission allows the recipient to open it.</div>
                  </div>

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-[12px] leading-5 text-indigo-800">
                    This sends one email per lead from the connected Gmail account. The same selected attachments and Drive links are sent to every selected lead. Leads without a valid email are skipped. For stability, one send action is limited to {communicationStatus?.maxPerRequest || 100} leads; Google still controls the account&apos;s actual daily sending limit.
                  </div>

                  {communicationError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">{communicationError}</div>}
                  {communicationResult && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700">{communicationResult}</div>}

                  {messageLeadIds.length === 1 && communicationHistory.length > 0 && (
                    <div className="rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-[12px] font-bold text-slate-700"><History size={14} /> Communication History</div>
                      <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto">
                        {communicationHistory.map((item) => (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-center justify-between gap-3"><span className="text-[12px] font-semibold text-slate-800">{item.subject || item.channel}</span><span className={`text-[11px] font-bold ${item.status === "SENT" ? "text-emerald-600" : "text-rose-600"}`}>{item.status}</span></div>
                            <div className="mt-1 text-[11px] text-slate-400">{item.recipient} · {new Date(item.createdAt).toLocaleString()}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4">
              <button type="button" onClick={closeMessageComposer} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700">Cancel</button>
              {messageChannel === "sms" ? (
                <button type="button" onClick={sendSelectedSms} disabled={communicationSending || communicationLoading || !communicationStatus?.sms?.enabled || !smsTemplateId} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {communicationSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {communicationSending ? "Sending..." : `Send SMS${messageLeadIds.length > 1 ? ` to ${messageLeadIds.length} leads` : ""}`}
                </button>
              ) : (
                <button type="button" onClick={sendSelectedEmail} disabled={communicationSending || communicationLoading || !communicationStatus?.gmail?.enabled || !emailForm.subject.trim() || (!emailForm.message.trim() && !emailAttachments.length && !emailForm.driveLinks.trim())} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {communicationSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {communicationSending ? "Sending..." : `Send ${messageLeadIds.length > 1 ? `to ${messageLeadIds.length} leads` : "Email"}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {individualModal}

      {showUpload && (
        <UploadDatasetModal
          assignees={
            assignees
          }
          courseOptions={individualCourseOptions}
          defaultType={
            sub === "individual" || sub === "all"
              ? "EXTERNAL_DATA"
              : selectedType?.api ||
                "EXTERNAL_DATA"
          }
          onClose={() =>
            setShowUpload(
              false
            )
          }
          onImported={async (
            data
          ) => {
            setShowUpload(
              false
            );

            setSuccessMessage(
              `${data.importSummary.imported} leads imported · ${data.importSummary.duplicates} duplicates skipped · ${data.importSummary.failed} invalid rows skipped`
            );

            const importedType =
              String(
                data.dataset?.type ||
                  "EXTERNAL_DATA"
              )
                .trim()
                .toUpperCase();

            const targetType =
              TYPES.find(
                (type) =>
                  type.api ===
                  importedType
              );

            if (targetType) {
              setSub(
                targetType.key
              );
            }

            await Promise.all([
              loadDatasets(),
              loadIndividualLeads(),
            ]);
          }}
        />
      )}

      {editing && (
        <EditDatasetModal
          dataset={
            editing
          }
          assignees={
            assignees
          }
          onClose={() =>
            setEditing(
              null
            )
          }
          onSaved={async () => {
            setEditing(
              null
            );

            setSuccessMessage(
              "Dataset updated successfully"
            );

            await loadDatasets();
          }}
        />
      )}

      {intelligenceLead && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600">Lead Intelligence</div>
                <div className="mt-1 text-[18px] font-bold text-slate-950">{intelligenceLead.name}</div>
                <div className="mt-0.5 text-[12px] text-slate-500">Score, conversion chance, reasons and the next best action.</div>
              </div>
              <button
                type="button"
                onClick={() => setIntelligenceLead(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Lead Score</div>
                  <div className="mt-2 flex items-end gap-2">
                    <span className={`inline-flex h-12 min-w-12 items-center justify-center rounded-xl border px-2 text-[20px] font-extrabold ${intelligenceTone(intelligenceLead.intelligence?.score)}`}>
                      {intelligenceLead.intelligence?.score ?? "—"}
                    </span>
                    <span className="pb-1 text-[12px] text-slate-400">/ 100</span>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Conversion Chance</div>
                  <div className="mt-2 text-[20px] font-extrabold text-slate-950">{intelligenceLead.intelligence?.conversionChance || "—"}</div>
                  <div className="mt-1 text-[12px] text-slate-500">Current probability signal: {intelligenceLead.intelligence?.conversionPercent ?? 0}%</div>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-indigo-500">Next Best Action</div>
                <div className="mt-2 text-[14px] font-semibold leading-6 text-indigo-950">
                  {intelligenceLead.intelligence?.nextBestAction || "Follow up and record the next step."}
                </div>
              </div>

              <div>
                <div className="text-[12px] font-bold text-slate-700">Why this score</div>
                <div className="mt-2 space-y-2">
                  {(intelligenceLead.intelligence?.reasons || []).map((reason, index) => (
                    <div key={`${reason}-${index}`} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[12px] leading-5 text-slate-600">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Tracked contacts</div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-800">{intelligenceLead.intelligence?.communicationCount ?? 0}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Last contact</div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-800">{intelligenceLead.intelligence?.lastContactAt ? formatDate(intelligenceLead.intelligence.lastContactAt) : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Next follow-up</div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-800">{intelligenceLead.intelligence?.nextFollowUpAt ? formatDate(intelligenceLead.intelligence.nextFollowUpAt) : "Not scheduled"}</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 bg-slate-50/70 px-5 py-4">
              <button type="button" onClick={() => setIntelligenceLead(null)} className="h-9 rounded-lg bg-slate-900 px-4 text-[12px] font-semibold text-white hover:bg-slate-800">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <NurtureCenter
        open={nurtureOpen}
        onClose={() => setNurtureOpen(false)}
        selectedLeadIds={selectedLeadIds}
      />

      <CallCenterModal
        open={Boolean(callLead)}
        onClose={() => setCallLead(null)}
        lead={callLead}
      />
    </div>
  );
}
