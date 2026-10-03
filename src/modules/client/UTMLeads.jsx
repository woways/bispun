import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Plus,
  Link2,
  FileSpreadsheet,
  Globe,
  MessageSquare,
  Instagram,
  Copy,
  MoreVertical,
  Search,
  RefreshCw,
  X,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
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
  Upload,
  PhoneCall,
} from "lucide-react";

import {
  Table,
  Badge,
  stageTone,
} from "../../components/ui";

import { apiRequest } from "../../lib/api";
import { formatUiDateTime } from "../../lib/uiPreferences";

const SOURCES = [
  {
    value: "GOOGLE_FORM",
    label: "Google Form",
  },
  {
    value: "WEBSITE_FORM",
    label: "Website Form",
  },
  {
    value: "IM_LEADS",
    label: "IM Leads",
  },
  {
    value: "DM_LEADS",
    label: "DM Leads",
  },
  {
    value: "INTERNAL",
    label: "Internal Leads",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

const INTERNAL_SOURCE_KEYS = [
  "INTERNAL",
  "GOOGLE_FORM",
  "WEBSITE_FORM",
  "IM_LEADS",
  "DM_LEADS",
];

const INTERNAL_SOURCE_TABS = [
  {
    key: "INTERNAL",
    label: "Internal Leads",
    icon: Users,
  },
  {
    key: "GOOGLE_FORM",
    label: "Google Form",
    icon: FileSpreadsheet,
  },
  {
    key: "WEBSITE_FORM",
    label: "Website Form",
    icon: Globe,
  },
  {
    key: "IM_LEADS",
    label: "IM Leads",
    icon: MessageSquare,
  },
  {
    key: "DM_LEADS",
    label: "DM Leads",
    icon: Instagram,
  },
];

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

function LeadModal({
  onClose,
  onCreated,
  defaultSource = "GOOGLE_FORM",
}) {
  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] =
    useState({
      name: "",
      phone: "",
      email: "",
      course: "",
      source: defaultSource,
      stage: "NEW",
      temperature: "WARM",
      campaign: "",
      medium: "",
      assignedToName: "",
      notes: "",
    });

  function update(
    key,
    value
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data =
        await apiRequest(
          "/api/client/leads",
          {
            method: "POST",

            body: JSON.stringify(
              form
            ),
          }
        );

      onCreated(data.lead);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to create lead"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">
              New Lead
            </h2>

            <p className="text-[13px] text-slate-500 mt-0.5">
              Add a lead to your
              company CRM.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500"
          >
            <X size={17} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="overflow-y-auto max-h-[calc(92vh-72px)]"
        >
          <div className="p-5">
            {error && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 border border-rose-200 bg-rose-50 rounded-lg text-[15px] text-rose-700">
                <AlertCircle
                  size={14}
                />

                {error}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Field
                  label="Lead Name"
                  required
                  value={form.name}
                  onChange={(value) =>
                    update(
                      "name",
                      value
                    )
                  }
                  placeholder="Student / customer name"
                />
                {form.name.trim().length > 0 &&
                  form.name.trim().length < 2 && (
                    <p className="mt-1 text-[13px] font-semibold text-rose-600">
                      Name must be at least 2 characters.
                    </p>
                  )}
              </div>

              <div>
                <Field
                  label="Phone"
                  required
                  value={form.phone}
                  onChange={(value) =>
                    update(
                      "phone",
                      value
                    )
                  }
                  placeholder="9876543210"
                />
                {form.phone.trim().length > 0 &&
                  !isValidPhone(form.phone) && (
                    <p className="mt-1 text-[13px] font-semibold text-rose-600">
                      Enter a valid 10-digit phone number.
                    </p>
                  )}
              </div>

              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) =>
                  update(
                    "email",
                    value
                  )
                }
                placeholder="student@email.com"
              />

              <Field
                label="Course / Interest"
                value={form.course}
                onChange={(value) =>
                  update(
                    "course",
                    value
                  )
                }
                placeholder="MBBS Abroad"
              />

              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1">
                  Source
                  <span className="text-rose-500 ml-0.5">
                    *
                  </span>
                </label>

                <select
                  value={form.source}
                  onChange={(event) =>
                    update(
                      "source",
                      event.target.value
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-[15px]"
                >
                  {SOURCES.map(
                    (source) => (
                      <option
                        key={
                          source.value
                        }
                        value={
                          source.value
                        }
                      >
                        {source.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1">
                  Stage
                </label>

                <select
                  value={form.stage}
                  onChange={(event) =>
                    update(
                      "stage",
                      event.target.value
                    )
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-[15px]"
                >
                  {STAGES.map(
                    (stage) => (
                      <option
                        key={
                          stage.value
                        }
                        value={
                          stage.value
                        }
                      >
                        {stage.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1">
                  Lead Temperature
                </label>

                <select
                  value={form.temperature}
                  onChange={(event) => update("temperature", event.target.value)}
                  className={`w-full px-3 py-2 border rounded-md text-[15px] font-semibold ${temperatureClass(form.temperature)}`}
                >
                  {LEAD_TEMPERATURES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <Field
                label="Campaign"
                value={
                  form.campaign
                }
                onChange={(value) =>
                  update(
                    "campaign",
                    value
                  )
                }
                placeholder="MBBS-Ukraine-Q4"
              />

              <Field
                label="Medium"
                value={form.medium}
                onChange={(value) =>
                  update(
                    "medium",
                    value
                  )
                }
                placeholder="Meta Ads"
              />

              <Field
                label="Assigned To"
                value={
                  form.assignedToName
                }
                onChange={(value) =>
                  update(
                    "assignedToName",
                    value
                  )
                }
                placeholder="Counsellor name"
              />

              <div className="md:col-span-2">
                <label className="block text-[13px] font-medium text-slate-600 mb-1">
                  Notes
                </label>

                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    update(
                      "notes",
                      event.target.value
                    )
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-[15px] resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-200 rounded-md text-[15px] text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                form.name.trim().length < 2 ||
                !isValidPhone(form.phone)
              }
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-[15px] inline-flex items-center gap-2"
            >
              {saving && (
                <Loader2
                  size={14}
                  className="animate-spin"
                />
              )}

              {saving
                ? "Creating..."
                : "Create Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function ImportInternalLeadsModal({
  defaultSource = "INTERNAL",
  onClose,
  onImported,
}) {
  const safeDefaultSource = INTERNAL_SOURCE_KEYS.includes(defaultSource)
    ? defaultSource
    : "INTERNAL";

  const [source, setSource] = useState(safeDefaultSource);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();

    if (!file) {
      setError("Choose a CSV or XLSX file.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("source", source);

      const data = await apiRequest(
        "/api/client/leads/internal/import",
        {
          method: "POST",
          body,
        }
      );

      onImported(data, source);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to import internal leads"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-[17px] font-semibold text-slate-900">
              Import Internal Leads
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Upload CSV/XLSX and choose where these manually managed leads should appear.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-4 p-5">
            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] font-semibold text-rose-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Lead Source
              </label>
              <select
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[15px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                {SOURCES.filter((item) =>
                  INTERNAL_SOURCE_KEYS.includes(item.value)
                ).map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[13px] font-medium text-slate-600">
                Lead File
              </label>
              <label className="flex min-h-[110px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-5 text-center transition hover:border-indigo-300 hover:bg-indigo-50/30">
                <input
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  disabled={saving}
                  onChange={(event) =>
                    setFile(event.target.files?.[0] || null)
                  }
                />
                <div>
                  <Upload size={22} className="mx-auto text-indigo-500" />
                  <div className="mt-2 text-[14px] font-semibold text-slate-800">
                    {file ? file.name : "Choose CSV or XLSX"}
                  </div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    Imported records are added as real CRM leads.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !file}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Upload size={14} />
              )}
              {saving ? "Importing..." : "Import Leads"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// A valid link must start with http(s):// AND have a real host (so
// "https:mccccccc.com" — missing the // — is rejected). Used for CA-013/014/015/017.
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
function isValidPhone(value) {
  const d = String(value || "").replace(/\D/g, "");
  return (
    d.length === 10 ||
    (d.length === 12 && d.startsWith("91"))
  );
}

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
    useState({
      campaign:
        editing?.campaign || "",
      source:
        editing?.source || "",
      medium:
        editing?.medium || "",
      url:
        editing?.url || "",
      cost:
        editing?.cost ?? "",
    });

  const generatedUrl =
    mode === "generate"
      ? buildTrackedUrl(form)
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
        source:
          form.source,
        medium:
          form.medium,
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

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-slate-950">
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
            className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="p-5 space-y-4">
            {error ? (
              <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[15px]">
                {error}
              </div>
            ) : null}

            {!editing ? (
              <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() =>
                    setMode(
                      "generate"
                    )
                  }
                  className={`h-8 px-3 rounded-lg text-[13px] font-semibold ${
                    mode ===
                    "generate"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  Generate UTM
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setMode(
                      "manual"
                    )
                  }
                  className={`h-8 px-3 rounded-lg text-[13px] font-semibold ${
                    mode ===
                    "manual"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500"
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

              <Field
                label="Medium"
                required
                value={form.medium}
                onChange={(value) =>
                  update(
                    "medium",
                    value
                  )
                }
                placeholder="cpc / social / referral"
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
                <div className="text-[13px] font-bold uppercase tracking-[0.1em] text-indigo-500">
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
              className="h-9 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                !form.campaign.trim() ||
                !form.source.trim() ||
                !form.medium.trim() ||
                !form.url.trim() ||
                (mode ===
                  "generate" &&
                  !generatedUrl)
              }
              className="h-9 px-4 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2
                  size={13}
                  className="animate-spin"
                />
              ) : editing ? (
                <Check size={13} />
              ) : (
                <Link2 size={13} />
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
    </div>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  type = "text",
  placeholder,
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-600 mb-1">
        {label}

        {required && (
          <span className="text-rose-500 ml-0.5">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={placeholder}
        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
      />
    </div>
  );
}


function PlatformSelect({
  label = "Platform",
  value,
  onChange,
}) {
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
      <label className="mb-1 block text-[13px] font-medium text-slate-600">
        {label}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-10 text-[15px] text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  detail,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {label}
          </div>

          <div className="mt-2 text-[22px] leading-none font-bold text-slate-950">
            {value}
          </div>
        </div>

        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
          <Icon size={16} />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 text-[13px] leading-5 text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function downloadCsv(rows) {
  const headers = [
    "Campaign",
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




function downloadSourceLeads(rows, filename = "leads.csv") {
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
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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


function PhoneAction({ phone, name }) {
  const [menu, setMenu] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

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

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [menu]);

  if (!phone) {
    return <span className="text-slate-400">—</span>;
  }

  function openMenu(event) {
    if (menu) {
      setMenu(null);
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

    setMenu(null);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
        title={`Copy or dial ${name || "lead"} number`}
      >
        {phone}
      </button>

      {menu ? (
        <div
          ref={menuRef}
          className="fixed z-[130] w-[178px] overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl"
          style={{
            top: menu.top,
            left: menu.left,
          }}
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
            href={`tel:${phone}`}
            onClick={() => setMenu(null)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            <PhoneCall size={14} />
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

  const [leadSourceView, setLeadSourceView] =
    useState("INTERNAL");

  const [showInternalLeadModal, setShowInternalLeadModal] =
    useState(false);

  const [showInternalImportModal, setShowInternalImportModal] =
    useState(false);

  const [internalImportMessage, setInternalImportMessage] =
    useState("");

  const [internalLeadSearch, setInternalLeadSearch] = useState("");
  const [internalFiltersOpen, setInternalFiltersOpen] = useState(false);
  const [internalFilters, setInternalFilters] = useState({
    temperature: "",
    stage: "",
    assigned: "",
    source: "",
    course: "",
    dateFrom: "",
    dateTo: "",
  });

  const [temperatureUpdatingId, setTemperatureUpdatingId] =
    useState("");

  const [generateForm, setGenerateForm] = useState({
    url: "",
    source: "",
    medium: "",
    campaign: "",
    cost: "",
  });

  const [manualForm, setManualForm] = useState({
    url: "",
    source: "",
    medium: "",
    campaign: "",
    cost: "",
  });

  const [generateSaving, setGenerateSaving] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [manualError, setManualError] = useState("");
  const [copiedGenerated, setCopiedGenerated] = useState(false);

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
    } catch (error) {
      setError(error?.data?.message || "Unable to update lead temperature");
    } finally {
      setTemperatureUpdatingId("");
    }
  }

  const generatedUrl = useMemo(
    () =>
      buildTrackedUrl({
        url: generateForm.url,
        campaign: generateForm.campaign,
        source: generateForm.source,
        medium: generateForm.medium,
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
      !generateForm.medium.trim() ||
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

    try {
      await apiRequest(
        "/api/client/leads/utm/links",
        {
          method: "POST",
          body: JSON.stringify({
            mode: "generate",
            url: generateForm.url,
            source: generateForm.source,
            medium: generateForm.medium,
            campaign: generateForm.campaign,
            cost: Number(generateForm.cost || 0),
          }),
        }
      );

      setGenerateForm({
        url: "",
        source: "",
        medium: "",
        campaign: "",
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
      !manualForm.medium.trim() ||
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
            medium: manualForm.medium,
            campaign: manualForm.campaign,
            cost: Number(manualForm.cost || 0),
          }),
        }
      );

      setManualForm({
        url: "",
        source: "",
        medium: "",
        campaign: "",
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
    if (!generatedUrl) return;

    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopiedGenerated(true);
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


  const internalGroupLeads = useMemo(
    () =>
      leads.filter((lead) =>
        INTERNAL_SOURCE_KEYS.includes(lead.sourceKey)
      ),
    [leads]
  );

  const internalAssignedOptions = useMemo(
    () =>
      Array.from(
        new Set(
          internalGroupLeads
            .map((lead) => lead.assigned)
            .filter(
              (value) => value && value !== "Unassigned"
            )
        )
      ).sort(),
    [internalGroupLeads]
  );

  const internalCourseOptions = useMemo(
    () =>
      Array.from(
        new Set(
          internalGroupLeads
            .map((lead) => lead.course)
            .filter(Boolean)
        )
      ).sort(),
    [internalGroupLeads]
  );

  const sourceViewLeads = useMemo(() => {
    const query = internalLeadSearch.trim().toLowerCase();

    return internalGroupLeads.filter((lead) => {
      if (lead.sourceKey !== leadSourceView) {
        return false;
      }

      if (
        internalFilters.source &&
        lead.sourceKey !== internalFilters.source
      ) {
        return false;
      }

      if (
        internalFilters.temperature &&
        (lead.temperature || "WARM") !==
          internalFilters.temperature
      ) {
        return false;
      }

      if (
        internalFilters.stage &&
        lead.stageKey !== internalFilters.stage
      ) {
        return false;
      }

      if (
        internalFilters.assigned &&
        lead.assigned !== internalFilters.assigned
      ) {
        return false;
      }

      if (
        internalFilters.course &&
        lead.course !== internalFilters.course
      ) {
        return false;
      }

      const createdAt = new Date(lead.createdAt);

      if (
        internalFilters.dateFrom &&
        createdAt < new Date(`${internalFilters.dateFrom}T00:00:00`)
      ) {
        return false;
      }

      if (internalFilters.dateTo) {
        const dateTo = new Date(
          `${internalFilters.dateTo}T23:59:59.999`
        );
        if (createdAt > dateTo) {
          return false;
        }
      }

      if (!query) return true;

      return [
        lead.name,
        lead.phone,
        lead.email,
        lead.course,
        lead.source,
        lead.campaign,
        lead.medium,
        lead.stage,
        lead.temperature,
        lead.assigned,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query)
        );
    });
  }, [
    internalGroupLeads,
    leadSourceView,
    internalLeadSearch,
    internalFilters,
  ]);

  const hasInternalFilters = Boolean(
    internalLeadSearch.trim() ||
      Object.values(internalFilters).some(Boolean)
  );

  function clearInternalFilters() {
    setInternalLeadSearch("");
    setInternalFilters({
      temperature: "",
      stage: "",
      assigned: "",
      source: "",
      course: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  const summary = analytics.summary || {};

  function PerformanceCard({
    title,
    rows,
    labelKey,
  }) {
    const max =
      Math.max(
        1,
        ...rows.map((row) => Number(row.leads || 0))
      );

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
        <div className="text-[15px] font-bold text-slate-900">
          {title}
        </div>

        <div className="mt-4 space-y-4">
          {rows.slice(0, 6).map((row) => {
            const value = Number(row.leads || 0);
            const width = Math.max(8, (value / max) * 100);

            return (
              <div key={row[labelKey]}>
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-[13px] font-semibold text-slate-700">
                    {row[labelKey]}
                  </div>

                  <div className="text-[13px] font-bold text-slate-950">
                    {value}
                  </div>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}

          {!rows.length ? (
            <div className="py-8 text-center text-[13px] text-slate-500">
              No data yet.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
          Campaign tracking
        </div>

        <h1 className="mt-2 text-[30px] font-bold tracking-[-0.04em] text-slate-950">
          UTM Leads
        </h1>

        <p className="mt-1 text-[15px] text-slate-500">
          Generate links, save influencer links, review UTM leads and analyse performance.
        </p>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[15px] text-rose-700">
          <AlertCircle size={15} />
          {error}
        </div>
      ) : null}

      {/* 1. Generate UTM Link */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-white px-5 py-4">
          <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-indigo-600">
            UTM Generator
          </div>

          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Generate UTM Link
          </h2>

          <p className="mt-1 text-[13px] text-slate-500">
            Build a tracked campaign URL and save it directly.
          </p>
        </div>

        <div className="space-y-4 p-5">
          {generateError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] text-rose-700">
              {generateError}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Field
                label="Destination URL"
                required
                value={generateForm.url}
                onChange={(value) =>
                  updateGenerate("url", value)
                }
                placeholder="https://studentmentor.co.in/"
              />
              {generateForm.url.trim() &&
                !isValidHttpUrl(generateForm.url) && (
                  <p className="mt-1 text-[12px] font-semibold text-rose-600">
                    Enter a full URL starting with http:// or https://
                  </p>
                )}
            </div>

            <Field
              label="Campaign"
              required
              value={generateForm.campaign}
              onChange={(value) =>
                updateGenerate("campaign", value)
              }
              placeholder="August Admissions 2026"
            />

            <PlatformSelect
              label="Platform"
              value={generateForm.source}
              onChange={(value) =>
                updateGenerate(
                  "source",
                  value
                )
              }
            />

            <Field
              label="Medium"
              required
              value={generateForm.medium}
              onChange={(value) =>
                updateGenerate("medium", value)
              }
              placeholder="social"
            />

            <div>
              <Field
                label="Campaign Cost"
                type="number"
                value={generateForm.cost}
                onChange={(value) =>
                  updateGenerate("cost", value)
                }
                placeholder="0"
              />
              {Number(generateForm.cost) < 0 && (
                <p className="mt-1 text-[12px] font-semibold text-rose-600">
                  Cost can't be negative.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="text-[13px] font-bold uppercase tracking-[0.1em] text-indigo-600">
              Generated Link
            </div>

            <div className="mt-2 min-h-[22px] break-all font-mono text-[13px] text-slate-700">
              {generatedUrl ||
                "Complete the fields to preview the generated UTM URL."}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveGenerate}
              disabled={
                generateSaving ||
                !generatedUrl ||
                Number(generateForm.cost) < 0
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {generateSaving ? (
                <Loader2
                  size={13}
                  className="animate-spin"
                />
              ) : (
                <Link2 size={13} />
              )}
              Generate & Save
            </button>

            <button
              type="button"
              onClick={copyGeneratedLink}
              disabled={!generatedUrl}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 disabled:opacity-50"
            >
              {copiedGenerated ? (
                <Check size={13} />
              ) : (
                <Copy size={13} />
              )}
              {copiedGenerated ? "Copied" : "Copy Link"}
            </button>
          </div>
        </div>
      </section>

      {/* 2. Manually Add UTM Link */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-500">
            Existing link
          </div>

          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Manually Add UTM Link
          </h2>

          <p className="mt-1 text-[13px] text-slate-500">
            Save an already-created influencer or campaign UTM link.
          </p>
        </div>

        <div className="space-y-4 p-5">
          {manualError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[15px] text-rose-700">
              {manualError}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <Field
                label="UTM URL"
                required
                value={manualForm.url}
                onChange={(value) =>
                  updateManual("url", value)
                }
                placeholder="https://example.com/?utm_source=..."
              />
              {manualForm.url.trim() &&
                !isValidHttpUrl(manualForm.url) && (
                  <p className="mt-1 text-[12px] font-semibold text-rose-600">
                    Enter a full URL starting with http:// or https://
                  </p>
                )}
            </div>

            <Field
              label="Campaign"
              required
              value={manualForm.campaign}
              onChange={(value) =>
                updateManual("campaign", value)
              }
              placeholder="Influencer August"
            />

            <PlatformSelect
              label="Platform / Source"
              value={manualForm.source}
              onChange={(value) =>
                updateManual(
                  "source",
                  value
                )
              }
            />

            <Field
              label="Medium"
              required
              value={manualForm.medium}
              onChange={(value) =>
                updateManual("medium", value)
              }
              placeholder="instagram"
            />

            <Field
              label="Campaign Cost"
              type="number"
              value={manualForm.cost}
              onChange={(value) =>
                updateManual("cost", value)
              }
              placeholder="0"
            />
          </div>

          <button
            type="button"
            onClick={saveManual}
            disabled={
              manualSaving ||
              !isValidHttpUrl(manualForm.url) ||
              !manualForm.source.trim() ||
              !manualForm.medium.trim() ||
              !manualForm.campaign.trim() ||
              Number(manualForm.cost) < 0
            }
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {manualSaving ? (
              <Loader2
                size={13}
                className="animate-spin"
              />
            ) : (
              <Plus size={13} />
            )}
            Save Manual UTM
          </button>
        </div>
      </section>

      {/* 3. Saved Influencer Links */}
      <section
        id="saved-utm-links"
        className="space-y-3 scroll-mt-28"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">
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
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 disabled:opacity-50"
          >
            <Download size={13} />
            Export
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="grid gap-2 xl:grid-cols-[1fr_180px_180px_150px_150px]">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={linkSearch}
                onChange={(event) =>
                  setLinkSearch(event.target.value)
                }
                placeholder="Search campaign, source, medium, URL or latest lead..."
                className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-[15px]"
              />
            </div>

            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value)
              }
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700"
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
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700"
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
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700"
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
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700"
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
                  <div className="text-[15px] font-semibold text-slate-900">
                    {link.campaign}
                  </div>
                  <div className="mt-0.5 text-[13px] text-slate-400">
                    {formatDate(link.createdAt)}
                  </div>
                </td>

                <td className="px-4 py-3 text-[15px] capitalize text-slate-600">
                  {link.source} / {link.medium}
                </td>

                <td className="px-4 py-3">
                  <div className="flex max-w-[250px] items-center gap-2">
                    <span className="truncate font-mono text-[13px] text-slate-600">
                      {link.url}
                    </span>

                    <button
                      type="button"
                      onClick={() => copyLink(link.url)}
                    >
                      <Copy
                        size={12}
                        className="text-slate-400 hover:text-indigo-600"
                      />
                    </button>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink
                        size={12}
                        className="text-slate-400 hover:text-indigo-600"
                      />
                    </a>
                  </div>
                </td>

                <td className="px-4 py-3 text-[15px] font-bold text-slate-900">
                  {link.leads || 0}
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-700">
                  ₹{Number(link.cost || 0).toLocaleString("en-IN")}
                </td>

                <td className="px-4 py-3 text-[15px] font-semibold text-slate-700">
                  {link.leads
                    ? `₹${Number(link.costPerLead || 0).toLocaleString("en-IN")}`
                    : "—"}
                </td>

                <td className="px-4 py-3">
                  <div className="text-[15px] font-semibold text-slate-900">
                    {link.latestLead?.name || "—"}
                  </div>
                  <div className="mt-0.5 text-[13px] text-slate-500">
                    {link.latestLead?.phone ||
                      (link.latestLead?.createdAt
                        ? formatDate(link.latestLead.createdAt)
                        : "No leads yet")}
                  </div>
                </td>

                <td className="px-4 py-3 text-[15px] font-bold text-emerald-700">
                  {link.adm || 0}
                </td>

                <td className="px-4 py-3 text-[15px] font-bold text-slate-900">
                  ₹{Number(link.rev || 0).toLocaleString("en-IN")}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLink(link);
                        setShowLinkModal(true);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteLink(link)}
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
      </section>


      {/* Internal lead sources */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Lead Sources
            </div>

            <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-950">
              Internal Leads
            </h2>

            <p className="mt-1 text-[13px] text-slate-500">
              Manage manually added or imported Internal, Google Form, Website Form, IM and DM leads in one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowInternalLeadModal(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[13px] font-bold text-white hover:bg-indigo-700"
            >
              <Plus size={14} />
              Add Lead
            </button>

            <button
              type="button"
              onClick={() => setShowInternalImportModal(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-[13px] font-bold text-white hover:bg-slate-800"
            >
              <Upload size={14} />
              Import Leads
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {INTERNAL_SOURCE_TABS.map((item) => {
            const Icon = item.icon;
            const count = internalGroupLeads.filter(
              (lead) => lead.sourceKey === item.key
            ).length;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setLeadSourceView(item.key)}
                className={`inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold ${
                  leadSourceView === item.key
                    ? "bg-indigo-600 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={14} />
                {item.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[12px] ${
                    leadSourceView === item.key
                      ? "bg-white/15"
                      : "bg-slate-100"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={internalLeadSearch}
                  onChange={(event) =>
                    setInternalLeadSearch(event.target.value)
                  }
                  placeholder="Search name, phone, email, course, source, stage or assigned user..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setInternalFiltersOpen((current) => !current)
                }
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-[13px] font-bold ${
                  internalFiltersOpen ||
                  Object.values(internalFilters).some(Boolean)
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <SlidersHorizontal size={14} />
                Filter
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadSourceLeads(
                    sourceViewLeads,
                    `${leadSourceView.toLowerCase()}-leads.csv`
                  )
                }
                disabled={!sourceViewLeads.length}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download size={14} />
                Export
              </button>
            </div>

            {internalFiltersOpen ? (
              <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-slate-500">
                    Temperature
                  </label>
                  <select
                    value={internalFilters.temperature}
                    onChange={(event) =>
                      setInternalFilters((current) => ({
                        ...current,
                        temperature: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
                  >
                    <option value="">All temperatures</option>
                    {LEAD_TEMPERATURES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-slate-500">
                    Stage / Status
                  </label>
                  <select
                    value={internalFilters.stage}
                    onChange={(event) =>
                      setInternalFilters((current) => ({
                        ...current,
                        stage: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
                  >
                    <option value="">All stages</option>
                    {STAGES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-slate-500">
                    Assigned To
                  </label>
                  <select
                    value={internalFilters.assigned}
                    onChange={(event) =>
                      setInternalFilters((current) => ({
                        ...current,
                        assigned: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
                  >
                    <option value="">All assignees</option>
                    <option value="Unassigned">Unassigned</option>
                    {internalAssignedOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-slate-500">
                    Source
                  </label>
                  <select
                    value={internalFilters.source}
                    onChange={(event) =>
                      setInternalFilters((current) => ({
                        ...current,
                        source: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
                  >
                    <option value="">All sources</option>
                    {SOURCES.filter((item) =>
                      INTERNAL_SOURCE_KEYS.includes(item.value)
                    ).map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-slate-500">
                    Course
                  </label>
                  <select
                    value={internalFilters.course}
                    onChange={(event) =>
                      setInternalFilters((current) => ({
                        ...current,
                        course: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
                  >
                    <option value="">All courses</option>
                    {internalCourseOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-slate-500">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={internalFilters.dateFrom}
                    onChange={(event) =>
                      setInternalFilters((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-slate-500">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={internalFilters.dateTo}
                    onChange={(event) =>
                      setInternalFilters((current) => ({
                        ...current,
                        dateTo: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[13px]"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={clearInternalFilters}
                    disabled={!hasInternalFilters}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {internalImportMessage ? (
            <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700">
              {internalImportMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-[12px] text-slate-500">
            <span>
              Showing <strong className="text-slate-700">{sourceViewLeads.length}</strong> of {internalGroupLeads.length} internal leads
            </span>
            <span>
              {INTERNAL_SOURCE_TABS.find(
                (item) => item.key === leadSourceView
              )?.label || "Internal Leads"}
            </span>
          </div>

          <Table
            columns={[
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
            empty="No internal leads match the selected filters"
            rows={sourceViewLeads.map((lead) => (
              <tr key={lead.id} className="hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="text-[15px] font-semibold text-slate-900">
                    {lead.name}
                  </div>
                  <div className="mt-0.5 text-[13px] text-slate-500">
                    <PhoneAction
                      phone={lead.phone}
                      name={lead.name}
                    />
                  </div>
                  {lead.email ? (
                    <div className="mt-0.5 text-[12px] text-slate-400">
                      {lead.email}
                    </div>
                  ) : null}
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-700">
                  {lead.course || "—"}
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-600">
                  {lead.source || "—"}
                </td>

                <td className="px-4 py-3 text-[15px] font-semibold text-slate-700">
                  {lead.campaign || "—"}
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-600">
                  {lead.medium || "—"}
                </td>

                <td className="px-4 py-3">
                  <Badge tone={stageTone(lead.stageKey || lead.stage)}>
                    {lead.stage}
                  </Badge>
                </td>

                <td className="px-4 py-3">
                  <select
                    value={lead.temperature || "WARM"}
                    disabled={temperatureUpdatingId === lead.id}
                    onChange={(event) =>
                      updateLeadTemperature(lead.id, event.target.value)
                    }
                    className={`h-8 rounded-lg border px-2 text-[12px] font-bold outline-none disabled:opacity-60 ${temperatureClass(
                      lead.temperature || "WARM"
                    )}`}
                  >
                    {LEAD_TEMPERATURES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-700">
                  {lead.assigned || "Unassigned"}
                </td>

                <td className="px-4 py-3 text-[13px] text-slate-500">
                  {formatDate(lead.createdAt)}
                </td>
              </tr>
            ))}
          />
        </div>
      </section>


      {/* UTM Lead Details */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">
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
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download size={13} />
            Export UTM Lead Details
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="relative max-w-xl">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={leadSearch}
              onChange={(event) =>
                setLeadSearch(
                  event.target.value
                )
              }
              placeholder="Search UTM lead by name, phone, campaign, source or stage..."
              className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-[15px]"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table
            columns={[
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
                <td className="px-4 py-3">
                  <div className="text-[15px] font-semibold text-slate-900">
                    {lead.name}
                  </div>

                  <div className="mt-0.5 text-[13px] text-slate-500">
                    <PhoneAction
                      phone={lead.phone}
                      name={lead.name}
                    />
                  </div>
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-700">
                  {lead.course || "—"}
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-600">
                  {lead.source || "—"}
                </td>

                <td className="px-4 py-3 text-[15px] font-semibold text-slate-700">
                  {lead.campaign || "—"}
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-600">
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
                    onChange={(event) => updateLeadTemperature(lead.id, event.target.value)}
                    className={`h-8 rounded-lg border px-2 text-[12px] font-bold outline-none disabled:opacity-60 ${temperatureClass(lead.temperature || "WARM")}`}
                  >
                    {LEAD_TEMPERATURES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="px-4 py-3 text-[15px] text-slate-700">
                  {lead.assigned || "Unassigned"}
                </td>

                <td className="px-4 py-3 text-[13px] text-slate-500">
                  {formatDate(
                    lead.createdAt
                  )}
                </td>
              </tr>
            ))}
          />
        </div>
      </section>

      {/* UTM Analysis */}
      <section className="space-y-4">
        <div>
          <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Performance
          </div>

          <h2 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-slate-950">
            UTM Analysis
          </h2>

          <p className="mt-1 text-[13px] text-slate-500">
            Campaign performance for the selected year.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
          <MetricCard
            label="UTM Links"
            value={summary.totalUtmLinks ?? links.length}
            icon={Link2}
            detail="Saved campaign links"
          />

          <MetricCard
            label="Registrations"
            value={summary.totalRegistrations ?? 0}
            icon={UserPlus}
            detail="Tracked registrations"
          />

          <MetricCard
            label="UTM Leads"
            value={summary.totalLeads ?? utmLeads.length}
            icon={Users}
            detail="Tracked UTM leads"
          />

          <MetricCard
            label="Admissions"
            value={summary.totalAdmissions ?? 0}
            icon={UserCheck}
            detail="Admissions from UTM leads"
          />

          <MetricCard
            label="Revenue"
            value={`₹${Number(
              summary.totalRevenue || 0
            ).toLocaleString("en-IN")}`}
            icon={IndianRupee}
            detail="Received admission revenue"
          />
        </div>

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
            detail={`Period: ${
              selectedYear === "all"
                ? "All Time"
                : selectedYear
            }`}
          />

          <MetricCard
            label="Top Source"
            value={summary.topSource || "—"}
            icon={Globe}
            detail="Best performing UTM source"
          />

          <MetricCard
            label="UTM Conversion"
            value={`${Number(
              summary.conversionRate || 0
            ).toFixed(1)}%`}
            icon={MousePointerClick}
            detail="Admissions / UTM leads"
          />
        </div>
      </section>


      {showInternalLeadModal ? (
        <LeadModal
          defaultSource={leadSourceView}
          onClose={() => setShowInternalLeadModal(false)}
          onCreated={async (lead) => {
            setShowInternalLeadModal(false);
            await loadData();
            if (lead?.sourceKey && INTERNAL_SOURCE_KEYS.includes(lead.sourceKey)) {
              setLeadSourceView(lead.sourceKey);
            }
          }}
        />
      ) : null}

      {showInternalImportModal ? (
        <ImportInternalLeadsModal
          defaultSource={leadSourceView}
          onClose={() => setShowInternalImportModal(false)}
          onImported={async (data, source) => {
            setShowInternalImportModal(false);
            setInternalImportMessage(
              `${data.importSummary?.imported || 0} imported · ${
                data.importSummary?.duplicates || 0
              } duplicates · ${
                data.importSummary?.invalid || 0
              } invalid skipped`
            );
            await loadData();
            setLeadSourceView(source);
          }}
        />
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
