"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

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
  CircleDollarSign,
  Pencil,
  Trash2,
  Building2,
  ArrowLeft,
  Upload,
  ChevronRight,
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

import {
  apiRequest,
} from "../../lib/api";
import { formatUiDate } from "../../lib/uiPreferences";

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
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </div>

      <div className="mt-1.5 text-2xl font-bold tracking-[-0.03em] text-slate-950">
        {value}
      </div>

      <div className="mt-1 text-[13px] leading-5 text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function Breadcrumbs({
  items,
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[13px] font-medium text-slate-500">
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
              <span className="font-semibold text-slate-700">
                {
                  item.label
                }
              </span>
            )}
          </div>
        )
      )}
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  max = "max-w-md",
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        className={`w-full ${max} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[17px] font-bold text-slate-950">
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
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        {children}
      </div>
    </div>
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
            placeholder="Medical"
            className="sm-input"
          />
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
          <select
            required
            value={streamId}
            onChange={(
              event
            ) =>
              setStreamId(
                event.target
                  .value
              )
            }
            className="sm-input"
          >
            <option value="">
              Select stream
            </option>

            {streams.map(
              (item) => (
                <option
                  key={
                    item.id
                  }
                  value={
                    item.id
                  }
                >
                  {
                    item.name
                  }
                </option>
              )
            )}
          </select>
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
            className="h-9 rounded-lg bg-slate-950 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
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
            className="h-9 rounded-lg bg-slate-950 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
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
                  Direct admission / no linked lead
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
                      {
                        lead.name
                      }{" "}
                      ·{" "}
                      {
                        lead.phone
                      }
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

            <Field label="Phone">
              <input
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
              label="University Name"
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
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
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
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
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
}) {
  // Admissions Done is always opened in a concrete market from the sidebar.
  // Keeping the market tied directly to the route avoids Domestic/International
  // data carrying over when the user switches between the two sections.
  const activeMarket = market === "INTERNATIONAL" ? "INTERNATIONAL" : "DOMESTIC";
  const [streams, setStreams] = useState([]);
  const [partners, setPartners] = useState([]);
  const [branches, setBranches] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [allAdmissions, setAllAdmissions] = useState([]);

  const [selectedStream, setSelectedStream] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [showAllAdmissions, setShowAllAdmissions] = useState(false);

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
  const [sortBy, setSortBy] = useState("date-desc");
  const [dateFilter, setDateFilter] = useState("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const [streamModal, setStreamModal] = useState(null);
  const [collegeModal, setCollegeModal] = useState(null);
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
      primary: "bg-gradient-to-br from-[#2563eb] via-[#1d4ed8] to-[#3730a3]",
      secondary: "bg-gradient-to-br from-[#3b82f6] via-[#2563eb] to-[#1d4ed8]",
    },
    orange: {
      primary: "bg-gradient-to-br from-[#f97316] via-[#ea580c] to-[#c2410c]",
      secondary: "bg-gradient-to-br from-[#fb923c] via-[#f97316] to-[#ea580c]",
    },
    purple: {
      primary: "bg-gradient-to-br from-[#7c3aed] via-[#7e22ce] to-[#6b21a8]",
      secondary: "bg-gradient-to-br from-[#a855f7] via-[#9333ea] to-[#7e22ce]",
    },
    green: {
      primary: "bg-gradient-to-br from-[#059669] via-[#0d9488] to-[#0f766e]",
      secondary: "bg-gradient-to-br from-[#10b981] via-[#059669] to-[#0d9488]",
    },
    rose: {
      primary: "bg-gradient-to-br from-[#e11d48] via-[#be123c] to-[#be185d]",
      secondary: "bg-gradient-to-br from-[#f43f5e] via-[#e11d48] to-[#be123c]",
    },
    slate: {
      primary: "bg-gradient-to-br from-[#475569] via-[#334155] to-[#1e293b]",
      secondary: "bg-gradient-to-br from-[#64748b] via-[#475569] to-[#334155]",
    },
    sky: {
      primary: "bg-gradient-to-br from-[#0ea5e9] via-[#0284c7] to-[#1d4ed8]",
      secondary: "bg-gradient-to-br from-[#38bdf8] via-[#0ea5e9] to-[#0284c7]",
    },
    cyan: {
      primary: "bg-gradient-to-br from-[#06b6d4] via-[#0891b2] to-[#0f766e]",
      secondary: "bg-gradient-to-br from-[#22d3ee] via-[#06b6d4] to-[#0e7490]",
    },
    teal: {
      primary: "bg-gradient-to-br from-[#14b8a6] via-[#0d9488] to-[#047857]",
      secondary: "bg-gradient-to-br from-[#2dd4bf] via-[#14b8a6] to-[#0d9488]",
    },
    lime: {
      primary: "bg-gradient-to-br from-[#84cc16] via-[#65a30d] to-[#15803d]",
      secondary: "bg-gradient-to-br from-[#a3e635] via-[#84cc16] to-[#65a30d]",
    },
    yellow: {
      primary: "bg-gradient-to-br from-[#facc15] via-[#f59e0b] to-[#ea580c]",
      secondary: "bg-gradient-to-br from-[#fde047] via-[#facc15] to-[#f59e0b]",
    },
    amber: {
      primary: "bg-gradient-to-br from-[#f59e0b] via-[#d97706] to-[#a16207]",
      secondary: "bg-gradient-to-br from-[#fbbf24] via-[#f59e0b] to-[#d97706]",
    },
    red: {
      primary: "bg-gradient-to-br from-[#ef4444] via-[#dc2626] to-[#be123c]",
      secondary: "bg-gradient-to-br from-[#f87171] via-[#ef4444] to-[#dc2626]",
    },
    pink: {
      primary: "bg-gradient-to-br from-[#ec4899] via-[#db2777] to-[#be123c]",
      secondary: "bg-gradient-to-br from-[#f472b6] via-[#ec4899] to-[#db2777]",
    },
    fuchsia: {
      primary: "bg-gradient-to-br from-[#c026d3] via-[#a21caf] to-[#be185d]",
      secondary: "bg-gradient-to-br from-[#d946ef] via-[#c026d3] to-[#a21caf]",
    },
    indigo: {
      primary: "bg-gradient-to-br from-[#4f46e5] via-[#4338ca] to-[#1e40af]",
      secondary: "bg-gradient-to-br from-[#6366f1] via-[#4f46e5] to-[#4338ca]",
    },
    navy: {
      primary: "bg-gradient-to-br from-[#1e3a8a] via-[#172554] to-[#0f172a]",
      secondary: "bg-gradient-to-br from-[#1e40af] via-[#1e3a8a] to-[#172554]",
    },
    black: {
      primary: "bg-gradient-to-br from-[#27272a] via-[#18181b] to-[#000000]",
      secondary: "bg-gradient-to-br from-[#3f3f46] via-[#27272a] to-[#18181b]",
    },
    emerald: {
      primary: "bg-gradient-to-br from-[#10b981] via-[#059669] to-[#065f46]",
      secondary: "bg-gradient-to-br from-[#34d399] via-[#10b981] to-[#047857]",
    },
  };

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
      soft: "bg-white/16",
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
    const visibleStreams = streams.slice(0, 4);

    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap gap-3">
          <div className="w-full rounded-xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 px-4 py-4 text-white sm:w-[210px] lg:w-[220px]">
            <div className="text-[13px] font-semibold text-white/70">
              Total Admissions
            </div>

            <div className="mt-2 text-3xl font-bold">
              {overall.admissions}
            </div>

            <div className="mt-2 text-[13px] text-white/60">
              Across all streams
            </div>
          </div>

          {visibleStreams.map((stream, index) => {
            const gradient =
              gradientForColor(
                stream.color ||
                  recommendedStreamColor(stream.name),
                index
              );

            return (
              <div
                key={stream.id}
                className={`w-full rounded-xl px-4 py-4 text-white sm:w-[210px] lg:w-[220px] ${gradient.bg}`}
              >
                <div className="text-[13px] font-semibold text-white/75">
                  {stream.name}
                </div>

                <div className="mt-2 text-3xl font-bold">
                  {stream.totalAdmissions || 0}
                </div>

                <div className="mt-2 text-[13px] text-white/70">
                  {stream.totalColleges || 0} colleges
                </div>
              </div>
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
    extra,
  }) {
    const gradient =
      gradientForColor(
        color,
        index
      );

    return (
      <div
        className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)] ${gradient.bg}`}
      >
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-14 -left-10 h-36 w-36 rounded-full bg-black/10" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${gradient.soft}`}>
              <Icon size={20} />
            </div>

            <div className="flex gap-2">
              {onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/12 text-white hover:bg-white/20"
                >
                  <Pencil size={13} />
                </button>
              ) : null}

              {onDelete ? (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/12 text-white hover:bg-white/20"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[17px] font-bold tracking-[-0.02em]">
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
      <div className="space-y-5">
        {sharedStyle}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setShowAllAdmissions(false)}
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={15} />
              Back to Admissions Done
            </button>

            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.04em] text-slate-950">
              All Admissions
            </h1>

            <p className="mt-1 text-[15px] text-slate-500">
              View every admission across streams, colleges and branches.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              exportAdmissions(
                filteredAllAdmissions,
                "all-admissions.csv"
              )
            }
            disabled={!filteredAllAdmissions.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[13px] font-bold text-white disabled:opacity-50"
          >
            <Download size={14} />
            Export Admissions
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={allSearch}
                onChange={(event) =>
                  setAllSearch(event.target.value)
                }
                placeholder="Search student, stream, college, branch, counsellor..."
                className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-[15px] outline-none focus:border-slate-400"
              />
            </div>

            <div className="flex flex-wrap gap-2">
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
                  onClick={() => setDateFilter(key)}
                  className={`h-9 rounded-xl px-3 text-[13px] font-bold ${
                    dateFilter === key
                      ? "bg-slate-950 text-white"
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

                  <td className="px-4 py-3">
                    <div className="whitespace-nowrap text-[15px] font-semibold text-slate-900">
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

                  <td className="whitespace-nowrap px-4 py-3 text-[15px] text-slate-700">
                    {admission.phone || "—"}
                  </td>

                  <td
                    className="max-w-[220px] truncate whitespace-nowrap px-4 py-3 text-[15px] text-slate-700"
                    title={admission.universityName || ""}
                  >
                    {admission.universityName || "—"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold text-slate-700">
                    {admission.branch?.name ||
                      admission.course ||
                      "—"}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold text-slate-800">
                    {money(
                      admission.incentiveAmount ??
                        admission.total
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold text-emerald-700">
                    {money(
                      admission.receivedAmount ??
                        admission.paid
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold text-amber-700">
                    {money(
                      admission.pendingAmount ??
                        admission.pending
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-500">
                    {formatDate(admission.admissionDate)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-[15px] text-slate-700">
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
    );
  }

  if (showAllAdmissions) {
    return <AllAdmissionsView />;
  }

  if (!selectedStream) {
    return (
      <div className="space-y-5">
        {sharedStyle}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Admissions
            </div>

            <h1 className="mt-2 text-[30px] font-bold tracking-[-0.04em] text-slate-950">
              {activeMarket === "INTERNATIONAL" ? "International" : "Domestic"} Admissions Done
            </h1>

            <p className="mt-1 text-[15px] text-slate-500">
              Manage streams, colleges, branches and completed admissions.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAllAdmissions(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <UserCheck size={14} />
              View All Admissions
            </button>

            <button
              type="button"
              onClick={() =>
                setStreamModal({ mode: "create" })
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <Plus size={14} />
              Add Stream
            </button>
          </div>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-900">
              Admissions Overview
            </h2>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Overall admissions and stream-level counts.
            </p>
          </div>
          <OverviewStrip />
        </section>

        <PageMessage />

        <div>
          <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-900">
            Stream-wise Breakdown
          </h2>
          <p className="mt-0.5 text-[13px] text-slate-500">
            Open a stream to view its colleges, branches and admissions.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-20 text-[15px] text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading streams...
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {streams.map((stream, index) => {
              const Icon = streamIcon(stream.name);

              return (
                <GradientCard
                  key={stream.id}
                  title={stream.name}
                  subtitle={`${stream.totalAdmissions || 0} Admissions`}
                  description={
                    stream.description ||
                    `${stream.totalColleges || 0} colleges · ${
                      stream.totalBranches || 0
                    } branches`
                  }
                  icon={Icon}
                  index={index}
                  color={
                    stream.color ||
                    recommendedStreamColor(stream.name)
                  }
                  openLabel={`Open ${stream.name}`}
                  onOpen={() => {
                    setSelectedStream(stream);
                    setSelectedPartner(null);
                    setSelectedBranch(null);
                  }}
                  onEdit={() =>
                    setStreamModal({
                      mode: "edit",
                      stream,
                    })
                  }
                  onDelete={() => deleteStream(stream)}
                  extra={
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-white/12 px-3 py-2.5">
                        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                          Colleges
                        </div>
                        <div className="mt-1 text-xl font-bold">
                          {stream.totalColleges || 0}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white/12 px-3 py-2.5">
                        <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                          Branches
                        </div>
                        <div className="mt-1 text-xl font-bold">
                          {stream.totalBranches || 0}
                        </div>
                      </div>
                    </div>
                  }
                />
              );
            })}
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
      </div>
    );
  }

  if (!selectedPartner) {
    return (
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

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setSelectedStream(null)}
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={15} />
              Back to Streams
            </button>

            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.04em] text-slate-950">
              {selectedStream.name}
            </h1>

            <p className="mt-1 text-[15px] text-slate-500">
              Choose a college inside this stream.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setCollegeModal({ mode: "create" })
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[13px] font-bold text-white"
          >
            <Plus size={14} />
            Add College
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {partners.map((partner, index) => (
            <GradientCard
              key={partner.id}
              title={partner.name}
              subtitle={`${partner.totalAdmissions || 0} Admissions`}
              description={
                partner.description ||
                `${partner.totalBranches || 0} branches available`
              }
              icon={Building2}
              index={index + 1}
              color={selectedStream.color || "blue"}
              openLabel={`Open ${partner.name}`}
              onOpen={() => {
                setSelectedPartner(partner);
                setSelectedBranch(null);
              }}
              onEdit={() =>
                setCollegeModal({
                  mode: "edit",
                  partner,
                })
              }
              onDelete={() => deletePartner(partner)}
              extra={
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/12 px-3 py-2.5">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                      Branches
                    </div>
                    <div className="mt-1 text-xl font-bold">
                      {partner.totalBranches || 0}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/12 px-3 py-2.5">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                      Received Amount
                    </div>
                    <div className="mt-1 text-[15px] font-bold">
                      {money(partner.received)}
                    </div>
                  </div>
                </div>
              }
            />
          ))}
        </div>

        {!loading && partners.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
            <Building2
              size={24}
              className="mx-auto text-slate-300"
            />
            <div className="mt-3 text-[15px] font-bold text-slate-800">
              No colleges yet
            </div>
            <div className="mt-1 text-[13px] text-slate-500">
              Add the first college inside {selectedStream.name}.
            </div>
          </div>
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
    );
  }

  if (!selectedBranch) {
    return (
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

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              type="button"
              onClick={() => setSelectedPartner(null)}
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft size={15} />
              Back to Colleges
            </button>

            <h1 className="mt-4 text-[30px] font-bold tracking-[-0.04em] text-slate-950">
              {selectedPartner.name}
            </h1>

            <p className="mt-1 text-[15px] text-slate-500">
              Select a branch such as MBBS, BDS, Pharmacy, CSE or MBA.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setBranchModal({ mode: "create" })
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[13px] font-bold text-white"
          >
            <Plus size={14} />
            Add Branch
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((branch, index) => (
            <GradientCard
              key={branch.id}
              title={branch.name}
              subtitle={`${branch.totalAdmissions || 0} Admissions`}
              description={
                branch.description ||
                `${selectedPartner.name} · ${selectedStream.name}`
              }
              icon={BookOpen}
              index={index + 2}
              color={recommendedBranchColor(branch.name, index)}
              openLabel={`Open ${branch.name}`}
              onOpen={() => setSelectedBranch(branch)}
              onEdit={() =>
                setBranchModal({
                  mode: "edit",
                  branch,
                })
              }
              onDelete={() => deleteBranch(branch)}
              extra={
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-white/12 px-3 py-2.5">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                      Received Amount
                    </div>
                    <div className="mt-1 text-[15px] font-bold">
                      {money(branch.received)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/12 px-3 py-2.5">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
                      Pending Amount
                    </div>
                    <div className="mt-1 text-[15px] font-bold">
                      {money(branch.pending)}
                    </div>
                  </div>
                </div>
              }
            />
          ))}
        </div>

        {!loading && branches.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
            <BookOpen
              size={24}
              className="mx-auto text-slate-300"
            />
            <div className="mt-3 text-[15px] font-bold text-slate-800">
              No branches yet
            </div>
            <div className="mt-1 text-[13px] text-slate-500">
              For Medical, add MBBS, BDS, Pharmacy and Nursing separately.
            </div>
          </div>
        ) : null}

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
    );
  }

  return (
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() => setSelectedBranch(null)}
            className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={15} />
            Back to Branches
          </button>

          <h1 className="mt-4 text-[30px] font-bold tracking-[-0.04em] text-slate-950">
            {selectedBranch.name} Admissions
          </h1>

          <p className="mt-1 text-[15px] text-slate-500">
            {selectedStream.name} → {selectedPartner.name} →{" "}
            {selectedBranch.name}
          </p>
        </div>

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
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[13px] font-bold text-white"
          >
            <Plus size={14} />
            New Admission
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder={`Search ${selectedBranch.name} admissions...`}
            className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-[15px] outline-none focus:border-slate-400"
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

                <td className="px-4 py-3">
                  <div className="whitespace-nowrap text-[15px] font-semibold text-slate-900">
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

                <td className="whitespace-nowrap px-4 py-3 text-[15px] text-slate-700">
                  {admission.phone || "—"}
                </td>

                <td
                  className="max-w-[220px] truncate whitespace-nowrap px-4 py-3 text-[15px] text-slate-700"
                  title={admission.universityName || ""}
                >
                  {admission.universityName || "—"}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold text-slate-700">
                  {admission.branch?.name ||
                    admission.course}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold text-slate-800">
                  {money(
                    admission.incentiveAmount ??
                      admission.total
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold text-emerald-700">
                  {money(
                    admission.receivedAmount ??
                      admission.paid
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[15px] font-semibold text-amber-700">
                  {money(
                    admission.pendingAmount ??
                      admission.pending
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[13px] text-slate-500">
                  {formatDate(admission.admissionDate)}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-[15px] text-slate-700">
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
  );
}


function AdmissionsOverall({ selectedYear = "all" }) {
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
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Admissions</div>
          <h1 className="mt-2 text-[30px] font-bold tracking-[-0.04em] text-slate-950">Overall Admissions</h1>
          <p className="mt-1 text-[15px] text-slate-500">View all admissions across Domestic and International.</p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {[['ALL','All'],['DOMESTIC','Domestic'],['INTERNATIONAL','International']].map(([value,label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`h-9 rounded-lg px-4 text-[13px] font-semibold transition ${filter === value ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Overall Admissions",
            value: data.all.length,
            detail: "Across Domestic & International",
          },
          {
            label: "Domestic Admissions",
            value: data.domestic.length,
            detail: "All Domestic admissions",
          },
          {
            label: "International Admissions",
            value: data.international.length,
            detail: "All International admissions",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="text-[12px] font-semibold uppercase tracking-[0.09em] text-slate-400">
              {item.label}
            </div>

            <div className="mt-2 text-[24px] font-bold leading-none tracking-tight text-slate-950">
              {item.value}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3 text-[13px] leading-5 font-medium text-slate-500">
              {item.detail}
            </div>
          </div>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[16px] font-bold text-slate-950">All Admissions</h2>
            <p className="mt-0.5 text-[12px] text-slate-500">{filteredRows.length} admission{filteredRows.length === 1 ? '' : 's'} shown</p>
          </div>
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
        <div className="grid grid-cols-[minmax(180px,1fr)_150px_150px_130px_130px_130px_auto] items-start gap-2 border-b border-slate-100 bg-slate-50/70 p-3">
          <label className="relative min-w-0">
            <span className="sr-only">Search by student name</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Search student name"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="min-w-0">
            <input type="date" aria-label="From date" value={startDate} onChange={(event) => setStartDate(event.target.value)} min="2000-01-01" max={endDate || new Date().toISOString().slice(0, 10)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            <span className="mt-1 block px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">From date</span>
          </label>
          <label className="min-w-0">
            <input type="date" aria-label="To date" value={endDate} onChange={(event) => setEndDate(event.target.value)} min={startDate || "2000-01-01"} max={new Date().toISOString().slice(0, 10)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            <span className="mt-1 block px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">To date</span>
          </label>
          <label>
            <span className="sr-only">Stream</span>
            <select aria-label="Stream" value={streamFilter} onChange={(event) => setStreamFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">All streams</option>
              {filterOptions.streams.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">College</span>
            <select aria-label="College" value={collegeFilter} onChange={(event) => setCollegeFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">All colleges</option>
              {filterOptions.colleges.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Branch</span>
            <select aria-label="Branch" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="">All branches</option>
              {filterOptions.branches.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={clearFilters} className="h-10 px-1 text-[13px] font-semibold text-indigo-700 transition hover:text-indigo-900">Clear</button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />Loading admissions...</div>
        ) : filteredRows.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">No admissions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-slate-50 text-[13px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                <tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Stream</th><th className="px-5 py-3">College</th><th className="px-5 py-3">Branch</th><th className="px-5 py-3">Admission Date</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((admission) => (
                  <tr key={admission.id} className="text-[13px] text-slate-700 hover:bg-slate-50/60">
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
    </div>
  );
}

export default function Admissions(props) {
  if (props.overviewOnly) return <AdmissionsOverall selectedYear={props.selectedYear} />;
  return <AdmissionsManager {...props} />;
}
