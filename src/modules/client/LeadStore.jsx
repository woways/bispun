import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  Smartphone,
  History,
  Copy,
  PhoneCall,
} from "lucide-react";

import {
  Table,
  Badge,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";
import { formatUiDate } from "../../lib/uiPreferences";

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
];

const INDIVIDUAL_LEAD_TYPE = {
  key: "individual",
  api: "INDIVIDUAL",
  label: "Individual Leads",
};

const ALL_LEAD_TYPES = [
  INDIVIDUAL_LEAD_TYPE,
  ...TYPES,
];

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
  "Admission Done",
];

function statusSelectClass(value) {
  if (value === "Admission Done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
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
  { key: "email", label: "Email" },
  { key: "course", label: "Course" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "temperature", label: "Lead Type" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
];

const DEFAULT_INDIVIDUAL_COLUMNS = {
  phone: true,
  email: true,
  course: true,
  assignedTo: true,
  temperature: true,
  status: true,
  created: false,
};


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


function PhoneAction({ phone, name, onCopied }) {
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
      top: Math.min(rect.bottom + 6, window.innerHeight - 112),
      left: Math.min(Math.max(8, rect.left), window.innerWidth - menuWidth - 8),
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openMenu}
        className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
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


function LeadStatusSelect({
  lead,
  options,
  disabled,
  onChangeStatus,
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


function IndividualLeadModal({
  assignees,
  onClose,
  onSaved,
  lead = null,
  defaultType = "INDIVIDUAL",
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

  const [
    form,
    setForm,
  ] =
    useState({
      name: lead?.name || "",
      phone: lead?.phone || "",
      email: lead?.email || "",
      course: lead?.course || "",
      temperature: lead?.temperature || "WARM",
      type: lead?.type || defaultType || "INDIVIDUAL",
      sourceName: lead?.sourceName || "",
      assignedToUserId: "",
      notes: lead?.notes || "",
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

    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length) {
      setError("Please correct the highlighted fields.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data =
        await apiRequest(
          lead
            ? `/api/client/lead-store/manual/${lead.id}`
            : "/api/client/lead-store/manual",
          {
            method: lead ? "PATCH" : "POST",
            body:
              JSON.stringify({
                ...form,
                name: form.name.trim(),
                phone: normalizeManualLeadPhone(form.phone),
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

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-white/70 w-full max-w-2xl max-h-[92vh] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold">
              {lead ? "Edit Lead" : "Add Lead"}
            </h2>

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
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
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
          className="overflow-y-auto max-h-[calc(92vh-78px)]"
        >
          <div className="p-6 grid md:grid-cols-2 gap-4">
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
                value={
                  form.phone
                }
                onChange={(
                  event
                ) =>
                  update(
                    "phone",
                    event.target.value
                  )
                }
                inputMode="numeric"
                autoComplete="tel"
                className={`form-input ${
                  fieldErrors.phone
                    ? "border-rose-300 focus:border-rose-400"
                    : ""
                }`}
                placeholder="9876543210"
                aria-invalid={Boolean(fieldErrors.phone)}
              />

              {fieldErrors.phone && (
                <div className="mt-1 text-xs font-medium text-rose-600">
                  {fieldErrors.phone}
                </div>
              )}
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
              <input
                value={
                  form.course
                }
                onChange={(
                  event
                ) =>
                  update(
                    "course",
                    event.target.value
                  )
                }
                className="form-input"
                placeholder="B.Tech / MBA / NEET"
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
                placeholder="Justdial / Reference / College Expo"
              />
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

            <div className="md:col-span-2 bg-indigo-50/60 border border-indigo-100 rounded-lg px-3 py-2.5 text-[13px] text-indigo-800 leading-5">
              This lead is stored directly in the main CRM Leads table. We do not create a fake one-row dataset. It will immediately appear in the normal Leads module.
            </div>
          </div>

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
    </div>
  );
}

function UploadDatasetModal({
  assignees,
  onClose,
  onImported,
  defaultType = "EXTERNAL_DATA",
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
      assignedToUserId:
        "",
      notes:
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

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-white/70 w-full max-w-3xl max-h-[92vh] overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold">
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
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
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
          className="overflow-y-auto max-h-[calc(92vh-80px)]"
        >
          <div className="p-6 space-y-5">
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
                  placeholder="Justdial / College Expo"
                />
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
    </div>
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

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-white/70 w-full max-w-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold">
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
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100"
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
        >
          <div className="p-6 grid md:grid-cols-2 gap-4">
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

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end gap-2">
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
    </div>
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

function StoreMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "indigo",
}) {
  const tones = {
    indigo:
      "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald:
      "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber:
      "bg-amber-50 text-amber-600 border-amber-100",
    slate:
      "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.09em] text-slate-400">
            {label}
          </div>

          <div className="mt-2 text-[22px] leading-none font-bold tracking-tight text-slate-950">
            {value}
          </div>
        </div>

        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
            tones[
              tone
            ] ||
            tones.indigo
          }`}
        >
          <Icon
            size={17}
          />
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 text-[13px] leading-5 text-slate-500">
        {detail}
      </div>
    </div>
  );
}

export default function LeadStore({ selectedYear = "all" }) {
  const [
    sub,
    setSub,
  ] =
    useState(
      "individual"
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

  const [
    expandedCustomFields,
    setExpandedCustomFields,
  ] = useState({});

  const [
    selectedLeadIds,
    setSelectedLeadIds,
  ] = useState([]);

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

  const [messageComposerOpen, setMessageComposerOpen] = useState(false);
  const [messageLeadIds, setMessageLeadIds] = useState([]);
  const [communicationStatus, setCommunicationStatus] = useState(null);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [communicationSending, setCommunicationSending] = useState(false);
  const [communicationError, setCommunicationError] = useState("");
  const [communicationResult, setCommunicationResult] = useState("");
  const [communicationHistory, setCommunicationHistory] = useState([]);
  const [emailForm, setEmailForm] = useState({
    subject: "",
    message: "",
  });

  function closeMessageComposer() {
    setMessageComposerOpen(false);
    setMessageLeadIds([]);
    setCommunicationStatus(null);
    setCommunicationLoading(false);
    setCommunicationSending(false);
    setCommunicationError("");
    setCommunicationResult("");
    setCommunicationHistory([]);
    setEmailForm({
      subject: "",
      message: "",
    });
  }

  async function openMessageComposer(leadIds) {
    const ids = Array.isArray(leadIds) ? [...new Set(leadIds)] : [];
    if (!ids.length) return;

    // Every new compose action must start clean.
    setEmailForm({
      subject: "",
      message: "",
    });
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
    if (!emailForm.subject.trim() || !emailForm.message.trim()) {
      setCommunicationError("Enter both a subject and message.");
      return;
    }
    setCommunicationSending(true);
    setCommunicationError("");
    setCommunicationResult("");
    try {
      const data = await apiRequest("/api/client/communications/email", {
        method: "POST",
        body: JSON.stringify({
          leadIds: messageLeadIds,
          subject: emailForm.subject,
          message: emailForm.message,
        }),
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

  const selectedType =
    useMemo(
      () =>
        ALL_LEAD_TYPES.find(
          (type) =>
            type.key ===
            sub
        ) ||
        INDIVIDUAL_LEAD_TYPE,
      [sub]
    );

  const currentTypeLeads =
    useMemo(
      () =>
        individualLeads.filter(
          (lead) => {
            const leadType =
              String(
                lead.type ||
                  (lead.isManual
                    ? "INDIVIDUAL"
                    : "")
              )
                .trim()
                .toUpperCase();

            return (
              leadType ===
              selectedType.api
            );
          }
        ),
      [
        individualLeads,
        selectedType,
      ]
    );

  const currentTypeDatasets =
    useMemo(
      () =>
        datasets.filter(
          (dataset) =>
            !selectedType ||
            dataset.type ===
              selectedType.api
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

        return currentTypeLeads.filter(
          (lead) => {
            const searchMatches =
              !query ||
              [
                lead.name,
                lead.phone,
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
                );

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
            count: individualLeads.filter(
              (lead) =>
                String(
                  lead.type ||
                    (lead.isManual
                      ? "INDIVIDUAL"
                      : "")
                )
                  .trim()
                  .toUpperCase() ===
                type.api
            ).length,
          })
        ),
      [individualLeads]
    );


  const visibleIndividualColumnCount =
    3 +
    INDIVIDUAL_COLUMN_OPTIONS.filter(
      (column) => individualColumns[column.key]
    ).length;

  const individualCellPadding =
    individualDensity === "compact"
      ? "py-2"
      : "py-3";

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

  const paginatedIndividualLeads =
    filteredIndividualLeads.slice(
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
          lead.name,
          lead.phone,
          lead.email,
          lead.course,
          selectedType.label,
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
        "Name",
        "Phone",
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

  return (
    <div className="space-y-4">
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
      `}</style>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Data / Lead inventory
          </div>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            Lead Store
          </h1>

          <p className="mt-1 text-[15px] text-slate-500">
            Import, validate, assign and track external lead datasets as real CRM leads.
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
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <StoreMetric
          label="Datasets"
          value={
            datasets.length
          }
          icon={
            Database
          }
          detail="Lead datasets currently stored"
          tone="indigo"
        />

        <StoreMetric
          label="Imported Leads"
          value={
            totalLeads.toLocaleString(
              "en-IN"
            )
          }
          icon={
            Users
          }
          detail="Real CRM leads imported from datasets"
          tone="slate"
        />

        <StoreMetric
          label="Converted"
          value={
            totalConverted.toLocaleString(
              "en-IN"
            )
          }
          icon={
            UserCheck
          }
          detail="Lead Store leads that reached Admitted"
          tone="emerald"
        />

        <StoreMetric
          label="Duplicates Skipped"
          value={
            duplicatesSkipped.toLocaleString(
              "en-IN"
            )
          }
          icon={
            Layers3
          }
          detail={`${assignedLeads} leads currently assigned`}
          tone="amber"
        />
      </div>

      <div className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center">
            <label className="relative flex h-9 w-full items-center rounded-lg border border-slate-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 lg:w-[270px] lg:flex-shrink-0">
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

            <div className="relative min-w-0 flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search name, phone, email or course..."
                className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-[14px] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
              <button
                type="button"
                onClick={() =>
                  setFiltersOpen(
                    (current) => !current
                  )
                }
                className={`relative h-9 px-3.5 rounded-lg border text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
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

              <details className="relative">
                  <summary className="h-9 cursor-pointer list-none px-3.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 inline-flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <Layers3 size={14} />
                    View
                  </summary>

                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
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
                      Name and Actions stay pinned. Custom fields open from the lead name.
                    </p>
                  </div>
                </details>

              <button
                type="button"
                onClick={exportCurrentView}
                disabled={visibleCount === 0}
                className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 inline-flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {filtersOpen && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
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

            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
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
            <button
              type="button"
              onClick={() => openMessageComposer(selectedLeadIds)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50"
            >
              <Mail size={14} />
              Send Message
            </button>

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
            <table className="w-max min-w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50/95">
                <tr>
                  <th className="sticky left-0 z-30 w-11 min-w-11 border-r border-slate-200 bg-slate-50/95 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={togglePageSelection}
                      aria-label="Select all leads on this page"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>

                  <th className="sticky left-11 z-20 min-w-[220px] max-w-[220px] border-r border-slate-200 bg-slate-50/95 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Name
                  </th>

                  {individualColumns.phone && <th className="min-w-[145px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Phone</th>}
                  {individualColumns.email && <th className="min-w-[210px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Email</th>}
                  {individualColumns.course && <th className="min-w-[145px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Course</th>}
                  {individualColumns.assignedTo && <th className="min-w-[170px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Assigned To</th>}
                  {individualColumns.temperature && <th className="min-w-[125px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Lead Type</th>}
                  {individualColumns.status && <th className="min-w-[170px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Status</th>}
                  {individualColumns.created && <th className="min-w-[150px] px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap">Created</th>}

                  <th className="sticky right-0 z-20 min-w-[96px] border-l border-slate-200 bg-slate-50/95 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                          <td className={`sticky left-0 z-20 w-11 min-w-11 border-r border-slate-100 px-3 text-center ${individualCellPadding} ${selected ? "bg-indigo-50" : "bg-white group-hover:bg-slate-50"}`}>
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

                          <td className={`sticky left-11 z-10 min-w-[220px] max-w-[220px] border-r border-slate-100 px-4 ${individualCellPadding} ${selected ? "bg-indigo-50" : "bg-white group-hover:bg-slate-50"}`}>
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                title={lead.name || ""}
                                className="min-w-0 flex-1 truncate whitespace-nowrap text-[14px] font-semibold text-slate-900"
                              >
                                {lead.name}
                              </span>

                              {customFields.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleCustomFields(
                                      lead.id
                                    )
                                  }
                                  title={
                                    customFieldsOpen
                                      ? "Hide custom fields"
                                      : "Show custom fields"
                                  }
                                  aria-expanded={
                                    customFieldsOpen
                                  }
                                  className="inline-flex h-7 flex-shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] font-semibold text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                                >
                                  {customFieldsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  {customFields.length}
                                </button>
                              )}
                            </div>
                          </td>

                          {individualColumns.phone && (
                            <td className={`min-w-[145px] px-4 ${individualCellPadding} whitespace-nowrap text-[14px] text-slate-600`}>
                              <PhoneAction
                                phone={lead.phone}
                                name={lead.name}
                                onCopied={setSuccessMessage}
                              />
                            </td>
                          )}
                          {individualColumns.email && <td className={`min-w-[210px] max-w-[240px] px-4 ${individualCellPadding}`}><div title={lead.email || ""} className="truncate whitespace-nowrap text-[14px] text-slate-600">{lead.email || "—"}</div></td>}
                          {individualColumns.course && <td className={`min-w-[145px] max-w-[170px] px-4 ${individualCellPadding}`}><div title={lead.course || ""} className="truncate whitespace-nowrap text-[14px] text-slate-600">{lead.course || "—"}</div></td>}
                          {individualColumns.assignedTo && <td className={`min-w-[170px] max-w-[190px] px-4 ${individualCellPadding}`}><div title={lead.assignedToName || "Unassigned"} className="truncate whitespace-nowrap text-[14px] text-slate-600">{lead.assignedToName || "Unassigned"}</div></td>}
                          {individualColumns.temperature && (
                            <td className={`min-w-[125px] px-4 ${individualCellPadding} whitespace-nowrap`}>
                              <select
                                value={lead.temperature || "WARM"}
                                disabled={temperatureUpdatingId === lead.id}
                                onChange={(event) =>
                                  updateLeadTemperature(lead.id, event.target.value)
                                }
                                className={`h-8 rounded-lg border px-2 text-[12px] font-bold outline-none transition disabled:opacity-60 ${temperatureSelectClass(lead.temperature || "WARM")}`}
                                aria-label={`Lead type for ${lead.name}`}
                              >
                                {LEAD_TEMPERATURES.map((item) => (
                                  <option key={item.value} value={item.value}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                          {individualColumns.status && (
                            <td className={`min-w-[170px] px-4 ${individualCellPadding} whitespace-nowrap`}>
                              <LeadStatusSelect
                                lead={lead}
                                options={individualStatusOptions}
                                disabled={statusUpdatingId === lead.id}
                                onChangeStatus={updateLeadStatus}
                              />
                            </td>
                          )}
                          {individualColumns.created && <td title={formatDate(lead.createdAt)} className={`min-w-[150px] px-4 ${individualCellPadding} whitespace-nowrap text-[13px] text-slate-500`}>{formatDate(lead.createdAt)}</td>}

                          <td className={`sticky right-0 z-10 min-w-[96px] border-l border-slate-100 px-3 ${individualCellPadding} ${selected ? "bg-indigo-50" : "bg-white group-hover:bg-slate-50"}`}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openMessageComposer([lead.id])}
                                title={lead.email ? `Email ${lead.name}` : "Lead has no email address"}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${lead.email ? "text-indigo-600 hover:bg-indigo-50" : "text-slate-300 hover:bg-slate-50"}`}
                              >
                                <Mail size={14} />
                              </button>

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
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                                  >
                                    <Pencil size={14} />
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
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    <Trash2 size={14} />
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
            <div className="text-[12px] text-slate-500">
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

              <span className="text-[12px] font-semibold text-slate-500">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                onClick={() =>
                  setPage(
                    (current) =>
                      Math.max(
                        1,
                        current - 1
                      )
                  )
                }
                disabled={currentPage <= 1}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={() =>
                  setPage(
                    (current) =>
                      Math.min(
                        totalPages,
                        current + 1
                      )
                  )
                }
                disabled={
                  currentPage >= totalPages
                }
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
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
                <div className="mt-1 text-[12px] text-slate-500">{messageLeadIds.length} lead{messageLeadIds.length === 1 ? "" : "s"} selected · Email is active now; WhatsApp and SMS can plug into this same flow later.</div>
              </div>
              <button type="button" onClick={closeMessageComposer} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={16} /></button>
            </div>

            <div className="border-b border-slate-200 px-5 pt-4">
              <div className="flex gap-2">
                <button type="button" className="inline-flex items-center gap-2 rounded-t-xl border border-b-white border-indigo-200 bg-white px-4 py-2.5 text-[13px] font-bold text-indigo-700"><Mail size={14} /> Email</button>
                <button type="button" disabled className="inline-flex items-center gap-2 rounded-t-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-400"><MessageCircle size={14} /> WhatsApp · Soon</button>
                <button type="button" disabled className="inline-flex items-center gap-2 rounded-t-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-slate-400"><Smartphone size={14} /> SMS · Soon</button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              {communicationLoading ? (
                <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-[13px] text-slate-500"><Loader2 size={15} className="animate-spin" /> Checking Gmail connection...</div>
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

                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-[12px] leading-5 text-indigo-800">
                    This sends one email per lead from the connected Gmail account. Leads without a valid email are skipped. For stability, one send action is limited to {communicationStatus?.maxPerRequest || 100} leads; Google still controls the account&apos;s actual daily sending limit.
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
              <button type="button" onClick={sendSelectedEmail} disabled={communicationSending || communicationLoading || !communicationStatus?.gmail?.enabled || !emailForm.subject.trim() || !emailForm.message.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-[13px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                {communicationSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {communicationSending ? "Sending..." : `Send ${messageLeadIds.length > 1 ? `to ${messageLeadIds.length} leads` : "Email"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showIndividual && (
        <IndividualLeadModal
          assignees={assignees}
          lead={editingIndividual}
          defaultType={
            selectedType?.api ||
            "INDIVIDUAL"
          }
          onClose={() => {
            setShowIndividual(false);
            setEditingIndividual(null);
          }}
          onSaved={async (data) => {
            const wasEditing =
              Boolean(
                editingIndividual
              );

            setShowIndividual(false);
            setEditingIndividual(null);
            setSuccessMessage(
              `${data.lead.name} ${wasEditing ? "updated" : "added"} successfully.`
            );

            const savedType =
              String(
                data.lead?.type ||
                  selectedType?.api ||
                  "INDIVIDUAL"
              )
                .trim()
                .toUpperCase();

            const targetType =
              ALL_LEAD_TYPES.find(
                (type) =>
                  type.api ===
                  savedType
              );

            setSub(
              targetType?.key ||
                "individual"
            );

            await Promise.all([
              loadIndividualLeads(),
              loadDatasets(),
            ]);
          }}
        />
      )}

      {showUpload && (
        <UploadDatasetModal
          assignees={
            assignees
          }
          defaultType={
            sub === "individual"
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
    </div>
  );
}
