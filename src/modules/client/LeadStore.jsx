import {
  useEffect,
  useMemo,
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
  Gift,
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
      type: lead?.type || "EXTERNAL_DATA",
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
              {lead ? "Edit Individual Lead" : "Add Individual Lead"}
            </h2>

            <p className="text-[13px] text-slate-500 mt-1">
              {lead
                ? "Update this lead and its custom field values."
                : "Add one lead directly to the CRM without creating a spreadsheet."}
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
        "EXTERNAL_DATA",
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
      "external"
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
      assignedToUserId: "",
      course: "",
      source: "",
      dateFrom: "",
      dateTo: "",
    });

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

  useEffect(() => {
    loadDatasets();
    loadIndividualLeads();
    loadAssignees();
  }, [selectedYear]);

  const selectedType =
    useMemo(
      () =>
        TYPES.find(
          (type) =>
            type.key ===
            sub
        ) ||
        null,
      [sub]
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
          new Set(
            individualLeads
              .map(
                (lead) =>
                  lead.stage
              )
              .filter(Boolean)
          )
        ).sort(),
      [individualLeads]
    );

  const individualCourseOptions =
    useMemo(
      () =>
        Array.from(
          new Set(
            individualLeads
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
      [individualLeads]
    );

  const sourceOptions =
    useMemo(
      () => {
        const rows =
          sub === "individual"
            ? individualLeads
            : currentTypeDatasets;

        return Array.from(
          new Set(
            rows
              .map(
                (row) =>
                  row.sourceName
              )
              .filter(Boolean)
          )
        ).sort(
          (a, b) =>
            String(a).localeCompare(
              String(b)
            )
        );
      },
      [
        sub,
        individualLeads,
        currentTypeDatasets,
      ]
    );

  const filteredIndividualLeads =
    useMemo(
      () => {
        const query =
          normalizeFilterText(
            search
          );

        return individualLeads.filter(
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
                lead.stage,
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
              lead.stage ===
                filters.status;

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
              assignedMatches &&
              courseMatches &&
              sourceMatches &&
              dateMatches
            );
          }
        );
      },
      [
        individualLeads,
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
      ...(sub === "individual"
        ? [
            filters.status,
            filters.course,
          ]
        : []),
    ].filter(Boolean).length;

  const visibleCount =
    sub === "individual"
      ? filteredIndividualLeads.length
      : filtered.length;

  const totalCurrentCount =
    sub === "individual"
      ? individualLeads.length
      : currentTypeDatasets.length;

  function clearFilters() {
    setFilters({
      status: "",
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

    if (
      sub === "individual"
    ) {
      const rows =
        filteredIndividualLeads.map(
          (lead) => [
            lead.name,
            lead.phone,
            lead.email,
            lead.course,
            lead.sourceName,
            lead.assignedToName ||
              "Unassigned",
            lead.stage ||
              "NEW",
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
        `lead-store-individual-${selectedYear}-${dateStamp}.csv`,
        [
          "Name",
          "Phone",
          "Email",
          "Course",
          "Source",
          "Assigned To",
          "Status",
          "Created",
          "Custom Fields",
        ],
        rows
      );

      return;
    }

    const rows =
      filtered.map(
        (dataset) => {
          const conversion =
            Number(
              dataset.count ||
                0
            ) >
            0
              ? (
                  (
                    Number(
                      dataset.converted ||
                        0
                    ) /
                    Number(
                      dataset.count ||
                        0
                    )
                  ) *
                  100
                ).toFixed(
                  1
                )
              : "0.0";

          return [
            dataset.name,
            dataset.typeLabel ||
              dataset.type,
            dataset.sourceName,
            dataset.sourceFileName,
            dataset.count ||
              0,
            dataset.duplicateCount ||
              0,
            dataset.failedCount ||
              0,
            formatDate(
              dataset.uploadedAt ||
                dataset.createdAt
            ),
            dataset.assignedTo ||
              "Unassigned",
            dataset.converted ||
              0,
            `${conversion}%`,
          ];
        }
      );

    downloadCsv(
      `lead-store-${sub}-${selectedYear}-${dateStamp}.csv`,
      [
        "Dataset",
        "Type",
        "Source",
        "Source File",
        "Imported",
        "Duplicates",
        "Invalid",
        "Uploaded",
        "Assigned To",
        "Converted",
        "Conversion",
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
    datasets.reduce(
      (
        sum,
        dataset
      ) =>
        sum +
        Number(
          dataset.count ||
            0
        ),
      0
    );

  const totalConverted =
    datasets.reduce(
      (
        sum,
        dataset
      ) =>
        sum +
        Number(
          dataset.converted ||
            0
        ),
      0
    );

  const assignedDatasets =
    datasets.filter(
      (
        dataset
      ) =>
        Boolean(
          dataset
            .assignedToUser
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
          detail="Imported leads that reached Admitted"
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
          detail={`${assignedDatasets} datasets currently assigned`}
          tone="amber"
        />
      </div>

      <div className="space-y-3">
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 flex flex-col gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] xl:flex-row xl:items-center">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max gap-1">
              <button
                type="button"
                onClick={() =>
                  setSub(
                    "individual"
                  )
                }
                className={`px-3 py-2 text-[13px] font-semibold border-b-2 whitespace-nowrap ${
                  sub ===
                  "individual"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Individual Leads
              </button>

              {TYPES.map(
                (
                  type
                ) => (
                  <button
                    key={
                      type.key
                    }
                    type="button"
                    onClick={() =>
                      setSub(
                        type.key
                      )
                    }
                    className={`px-3 py-2 text-[13px] font-semibold border-b-2 whitespace-nowrap ${
                      sub ===
                      type.key
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {
                      type.label
                    }
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:w-auto">
            <div className="relative w-full sm:min-w-[280px] xl:w-[320px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event
                      .target
                      .value
                  )
                }
                placeholder={
                  sub ===
                  "individual"
                    ? "Search name, phone, email or course..."
                    : "Search dataset, source, file or assignee..."
                }
                className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                setFiltersOpen(
                  (current) =>
                    !current
                )
              }
              className={`relative h-9 px-3.5 rounded-lg border text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                filtersOpen ||
                activeFilterCount >
                  0
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal
                size={14}
              />
              Filter

              {activeFilterCount >
                0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold inline-flex items-center justify-center">
                  {
                    activeFilterCount
                  }
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={
                exportCurrentView
              }
              disabled={
                visibleCount ===
                0
              }
              className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-700 inline-flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download
                size={14}
              />
              Export CSV
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {sub ===
                "individual" && (
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
              )}

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

              {sub ===
                "individual" && (
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
              )}

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
                    undefined
                  }
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
                {
                  sub ===
                  "individual"
                    ? "leads"
                    : "datasets"
                }
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

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 flex justify-center gap-2 text-[15px] text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Loader2
            size={16}
            className="animate-spin"
          />

          Loading datasets...
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          {sub === "individual" ? (
            <Table
              columns={[
                "Name",
                "Phone",
                "Email",
                "Course",
                "Custom Fields",
                "Assigned To",
                "Status",
                "Created",
                "Actions",
              ]}
              empty="No individual leads found"
              rows={filteredIndividualLeads
                .map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-2.5 text-[15px] font-semibold text-slate-900">{lead.name}</td>
                    <td className="px-4 py-2.5 text-[15px] text-slate-600">{lead.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-[15px] text-slate-600">{lead.email || "—"}</td>
                    <td className="px-4 py-2.5 text-[15px] text-slate-600">{lead.course || "—"}</td>
                    <td className="px-4 py-2.5">
                      {lead.customFields?.length ? (
                        <div className="space-y-1">
                          {lead.customFields.map((field) => (
                            <div key={field.id} className="text-[12px] text-slate-600">
                              <span className="font-semibold text-slate-700">{field.name}:</span> {field.value || "—"}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[13px] text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[15px] text-slate-600">{lead.assignedToName || "Unassigned"}</td>
                    <td className="px-4 py-2.5"><Badge tone="slate">{lead.stage || "NEW"}</Badge></td>
                    <td className="px-4 py-2.5 text-[13px] text-slate-500">{formatDate(lead.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIndividual(lead);
                            setShowIndividual(true);
                          }}
                          title="Edit lead"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiRequest("/api/client/referrals/tag", {
                                method: "POST",
                                body: JSON.stringify({ leadId: lead.id }),
                              });
                              setSuccessMessage(`${lead.name} tagged as your referral.`);
                            } catch (error) {
                              setError(error?.data?.message || "Unable to tag referral");
                            }
                          }}
                          title="Tag as my referral"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        >
                          <Gift size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
                            try {
                              await apiRequest(`/api/client/lead-store/manual/${lead.id}`, { method: "DELETE" });
                              setSuccessMessage(`${lead.name} deleted successfully.`);
                              await loadIndividualLeads();
                            } catch (error) {
                              setError(error?.data?.message || "Unable to delete lead");
                            }
                          }}
                          title="Delete lead"
                          className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            />
          ) : (
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
          )}
        </div>
      )}

      {showIndividual && (
        <IndividualLeadModal
          assignees={assignees}
          lead={editingIndividual}
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
            setSub("individual");
            await loadIndividualLeads();
          }}
        />
      )}

      {showUpload && (
        <UploadDatasetModal
          assignees={
            assignees
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

            await loadDatasets();
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
