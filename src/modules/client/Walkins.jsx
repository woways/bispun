import {
  useEffect,
  useState,
} from "react";

import {
  Plus,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Search,
  SlidersHorizontal,
  Pencil,
  Trash2,
  UserRoundCheck,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

import {
  Table,
  Badge,
  statusTone,
} from "../../components/ui";

import {
  apiRequest,
} from "../../lib/api";
import { formatUiDateTime } from "../../lib/uiPreferences";

const OTHER_OPTION = "__OTHER__";

const PURPOSE_OPTIONS = [
  "General Enquiry",
  "Know More About Programs",
  "College Enquiry",
  "Admission Enquiry",
  "Stream / Course Enquiry",
  "Fees & Payment Enquiry",
  "Scholarship / Financial Aid",
  "Counselling",
  "Eligibility / Documentation",
  "Follow-up Visit",
];

const CAME_WITH_OPTIONS = [
  "Alone",
  "Parent",
  "Both Parents",
  "Brother",
  "Sister",
  "Guardian",
  "Parent + Sibling",
  "Family / Relative",
  "Friend(s)",
];

const EMPTY_FORM = {
  visitorName: "",
  studentName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  course: "",
  courseOther: "",
  purpose: "",
  purposeOther: "",
  accompaniedBy: "",
  accompaniedByOther: "",
  counsellorName: "",
  notes: "",
  status: "NEW",
  arrivedAt: "",
};

const STATUS_OPTIONS = [
  ["NEW", "New"],
  ["IN_PROGRESS", "In Progress"],
  ["CONVERTED", "Converted"],
  ["LOST", "Lost"],
];

function toLocalInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60 * 1000
  );
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return "—";
  return formatUiDateTime(value);
}

function WalkinMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "indigo",
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.09em] text-slate-400">
            {label}
          </div>
          <div className="mt-2 text-[22px] leading-none font-bold tracking-tight text-slate-950">
            {value}
          </div>
        </div>
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${tones[tone] || tones.indigo}`}>
          <Icon size={17} />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 text-[13px] leading-5 text-slate-500">
        {detail}
      </div>
    </div>
  );
}

function Field({ label, required, full, children }) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <div className="text-[13px] font-semibold text-slate-600 mb-1.5">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </div>
      {children}
    </label>
  );
}

export default function Walkins({ selectedYear = "all", market = "DOMESTIC" }) {
  const [walkIns, setWalkIns] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    converted: 0,
    inProgress: 0,
    lost: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionId, setActionId] = useState("");
  const [streamOptions, setStreamOptions] = useState([]);
  const [counsellorOptions, setCounsellorOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  async function loadFormOptions(showError = false) {
    setOptionsLoading(true);

    try {
      const activeMarket =
        market === "INTERNATIONAL" ? "INTERNATIONAL" : "DOMESTIC";

      const data = await apiRequest(
        `/api/client/walkins/options?market=${encodeURIComponent(activeMarket)}`
      );

      setStreamOptions(data.streams || []);
      setCounsellorOptions(data.counsellors || []);
    } catch (error) {
      setStreamOptions([]);
      setCounsellorOptions([]);

      if (showError) {
        setFormError(
          error?.data?.message ||
            "Unable to load stream and counsellor options"
        );
      }
    } finally {
      setOptionsLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    setLoadError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (selectedYear !== "all") params.set("year", selectedYear);
      if (market && market !== "ALL") params.set("market", market);
      const query = params.toString();

      const data = await apiRequest(
        `/api/client/walkins${query ? `?${query}` : ""}`
      );

      setWalkIns(data.walkIns || []);
      setSummary(
        data.summary || {
          total: 0,
          converted: 0,
          inProgress: 0,
          lost: 0,
        }
      );
    } catch (error) {
      setLoadError(error?.data?.message || "Unable to load walk-ins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadData, 250);
    return () => window.clearTimeout(timer);
  }, [search, statusFilter, selectedYear, market]);

  useEffect(() => {
    loadFormOptions();
  }, [market]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreate() {
    setEditing(null);
    setFormError("");
    setForm({
      ...EMPTY_FORM,
      arrivedAt: toLocalInput(new Date()),
    });
    setModalOpen(true);
    loadFormOptions(true);
  }

  function openEdit(walkIn) {
    const existingPurpose = walkIn.purpose || "";
    const existingAccompaniedBy =
      walkIn.accompaniedBy === "—" ? "" : walkIn.accompaniedBy || "";
    const existingCourse = walkIn.course || "";

    setEditing(walkIn);
    setFormError("");
    setForm({
      visitorName: walkIn.visitorName || "",
      studentName: walkIn.studentName || "",
      phone: walkIn.phone || "",
      alternatePhone: walkIn.alternatePhone || "",
      email: walkIn.email || "",
      course: existingCourse,
      courseOther: existingCourse,
      purpose: existingPurpose,
      purposeOther: PURPOSE_OPTIONS.includes(existingPurpose)
        ? ""
        : existingPurpose,
      accompaniedBy: existingAccompaniedBy,
      accompaniedByOther: CAME_WITH_OPTIONS.includes(existingAccompaniedBy)
        ? ""
        : existingAccompaniedBy,
      counsellorName: walkIn.counsellorName || "",
      notes:
        (walkIn.notes === "—" ? "" : walkIn.notes) ||
        (walkIn.outcome === "—" ? "" : walkIn.outcome) ||
        "",
      status: walkIn.statusKey || "NEW",
      arrivedAt: toLocalInput(walkIn.arrivedAt),
    });
    setModalOpen(true);
    loadFormOptions(true);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const resolvedCourse =
        form.course === OTHER_OPTION
          ? form.courseOther.trim()
          : String(form.course || "").trim();

      const resolvedPurpose =
        form.purpose === OTHER_OPTION
          ? form.purposeOther.trim()
          : String(form.purpose || "").trim();

      const resolvedAccompaniedBy =
        form.accompaniedBy === OTHER_OPTION
          ? form.accompaniedByOther.trim()
          : String(form.accompaniedBy || "").trim();

      if (!resolvedPurpose) {
        setFormError("Purpose is required");
        setSaving(false);
        return;
      }

      const payload = {
        visitorName: form.visitorName,
        studentName: form.studentName,
        phone: form.phone,
        alternatePhone: form.alternatePhone,
        email: form.email,
        course: resolvedCourse,
        purpose: resolvedPurpose,
        accompaniedBy: resolvedAccompaniedBy,
        counsellorName: form.counsellorName,
        notes: form.notes,
        status: form.status,
        market,
        arrivedAt: form.arrivedAt
          ? new Date(form.arrivedAt).toISOString()
          : new Date().toISOString(),
      };

      await apiRequest(
        editing ? `/api/client/walkins/${editing.id}` : "/api/client/walkins",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );

      setModalOpen(false);
      await loadData();
    } catch (error) {
      setFormError(error?.data?.message || "Unable to save walk-in");
    } finally {
      setSaving(false);
    }
  }

  async function convert(walkIn) {
    if (walkIn.convertedLeadId) return;
    if (!window.confirm(`Convert ${walkIn.visitorName} into a CRM lead?`)) return;

    setActionId(walkIn.id);
    try {
      await apiRequest(`/api/client/walkins/${walkIn.id}/convert-to-lead`, {
        method: "POST",
      });
      await loadData();
      window.alert("Walk-in converted to a lead successfully.");
    } catch (error) {
      window.alert(error?.data?.message || "Unable to convert walk-in");
    } finally {
      setActionId("");
    }
  }

  async function remove(walkIn) {
    if (!window.confirm(`Delete walk-in for ${walkIn.visitorName}?`)) return;

    setActionId(walkIn.id);
    try {
      await apiRequest(`/api/client/walkins/${walkIn.id}`, {
        method: "DELETE",
      });
      await loadData();
    } catch (error) {
      window.alert(error?.data?.message || "Unable to delete walk-in");
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Leads / Offline engagement
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {market === "INTERNATIONAL" ? "International Walk-ins" : "Domestic Walk-ins"}
          </h1>
          <p className="mt-1 text-[15px] text-slate-500">
            Track office visitors, counsellor interactions and conversion outcomes.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold rounded-lg inline-flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus size={14} />
          Log Walk-in
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4">
        <WalkinMetric
          label="Walk-ins"
          value={summary.total}
          icon={UserPlus}
          detail="Visitors recorded this month"
          tone="indigo"
        />
        <WalkinMetric
          label="Walk-ins Converted"
          value={summary.converted}
          icon={ArrowUpRight}
          detail="Visitors converted into CRM leads"
          tone="emerald"
        />
        <WalkinMetric
          label="In Progress"
          value={summary.inProgress}
          icon={Clock}
          detail="Walk-ins requiring follow-up"
          tone="amber"
        />
        <WalkinMetric
          label="Lost"
          value={summary.lost}
          icon={ArrowDownRight}
          detail="Visitors closed without conversion"
          tone="rose"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0 max-w-lg">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search visitor, phone, purpose or counsellor..."
            className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
        </div>

        <div className="sm:ml-auto inline-flex items-center gap-2">
          <SlidersHorizontal size={13} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 px-3 border border-slate-200 bg-white rounded-lg text-[13px] font-semibold text-slate-700"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError ? (
        <div className="flex items-start gap-2 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
          <AlertCircle size={14} className="mt-0.5" />
          {loadError}
        </div>
      ) : null}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-[15px] text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading walk-ins...
          </div>
        ) : walkIns.length === 0 ? (
          <div className="py-16 text-center px-5">
            <UserPlus size={24} className="mx-auto text-slate-300" />
            <div className="mt-3 text-[15px] font-semibold text-slate-800">
              No walk-ins found
            </div>
            <div className="mt-1 text-[13px] text-slate-500">
              Log your first visitor to start tracking walk-ins.
            </div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
          <Table
            columns={[
              "Arrived",
              "Visitor / Student",
              "Phone",
              "Purpose",
              "Came With",
              "Counsellor",
              "Notes",
              "Status",
              "Actions",
            ]}
            rows={walkIns.map((walkIn) => (
              <tr key={walkIn.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-4 py-3 text-[13px] text-slate-500 whitespace-nowrap">
                  {formatDateTime(walkIn.arrivedAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="text-[15px] font-semibold text-slate-900">
                    {walkIn.visitorName}
                  </div>
                  {walkIn.studentName ? (
                    <div className="text-[12px] text-slate-500 mt-0.5">
                      Student: {walkIn.studentName}
                    </div>
                  ) : null}
                  {walkIn.course ? (
                    <div className="text-xs text-slate-400 mt-0.5">
                      {walkIn.course}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[15px] text-slate-600 whitespace-nowrap">
                  <div>{walkIn.phone}</div>
                  {walkIn.alternatePhone ? (
                    <div className="mt-0.5 text-xs text-slate-400">
                      Alt: {walkIn.alternatePhone}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-[15px] text-slate-700">
                  {walkIn.purpose}
                </td>
                <td className="px-4 py-3 text-[15px] text-slate-600">
                  {walkIn.accompaniedBy}
                </td>
                <td className="px-4 py-3 text-[15px] font-medium text-slate-700">
                  {walkIn.counsellor}
                </td>
                <td className="px-4 py-3 text-[15px] text-slate-600">
                  {walkIn.notes || walkIn.outcome}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(walkIn.status)}>{walkIn.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {!walkIn.convertedLeadId ? (
                      <button
                        type="button"
                        title="Convert to lead"
                        onClick={() => convert(walkIn)}
                        disabled={actionId === walkIn.id}
                        className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {actionId === walkIn.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <UserRoundCheck size={14} />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => openEdit(walkIn)}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-slate-500 hover:bg-slate-100"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={() => remove(walkIn)}
                      className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-rose-500 hover:bg-rose-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          />
          </div>
        )}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/55 backdrop-blur-[2px] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="w-full max-w-2xl max-h-[92vh] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[17px] font-bold text-slate-950">
                  {editing ? "Edit Walk-in" : "Log Walk-in"}
                </div>
                <div className="text-[13px] text-slate-500 mt-1">
                  Record visitor and counselling context.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submit} className="p-5 overflow-y-auto max-h-[calc(92vh-74px)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Visitor Name" required>
                  <input
                    required
                    value={form.visitorName}
                    onChange={(event) => updateForm("visitorName", event.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>
                <Field label="Student Name">
                  <input
                    value={form.studentName}
                    onChange={(event) => updateForm("studentName", event.target.value)}
                    placeholder="If different from the visitor"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>
                <Field label="Phone" required>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(event) => updateForm("phone", event.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>

                <Field label="Alternate Phone">
                  <input
                    type="tel"
                    value={form.alternatePhone}
                    onChange={(event) =>
                      updateForm("alternatePhone", event.target.value)
                    }
                    placeholder="Optional alternate number"
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateForm("email", event.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>

                <Field label="Course / Interest">
                  <div className="space-y-2">
                    <select
                      value={
                        form.course === OTHER_OPTION
                          ? OTHER_OPTION
                          : streamOptions.some(
                              (stream) => stream.name === form.course
                            )
                            ? form.course
                            : form.course
                              ? OTHER_OPTION
                              : ""
                      }
                      onChange={(event) => {
                        const value = event.target.value;

                        if (value === OTHER_OPTION) {
                          setForm((current) => ({
                            ...current,
                            course: OTHER_OPTION,
                            courseOther:
                              current.course === OTHER_OPTION
                                ? current.courseOther
                                : "",
                          }));
                        } else {
                          setForm((current) => ({
                            ...current,
                            course: value,
                            courseOther: "",
                          }));
                        }
                      }}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                    >
                      <option value="">
                        {optionsLoading ? "Loading streams..." : "Select stream"}
                      </option>
                      {streamOptions.map((stream) => (
                        <option key={stream.id} value={stream.name}>
                          {stream.name}
                        </option>
                      ))}
                      <option value={OTHER_OPTION}>Other</option>
                    </select>

                    {(form.course === OTHER_OPTION ||
                      (form.course &&
                        !streamOptions.some(
                          (stream) => stream.name === form.course
                        ))) ? (
                      <input
                        value={
                          form.course === OTHER_OPTION
                            ? form.courseOther
                            : form.courseOther || form.course
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            course: OTHER_OPTION,
                            courseOther: event.target.value,
                          }))
                        }
                        placeholder="Type course / interest"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                      />
                    ) : null}
                  </div>
                </Field>

                <Field label="Purpose" required>
                  <div className="space-y-2">
                    <select
                      required
                      value={
                        form.purpose === OTHER_OPTION
                          ? OTHER_OPTION
                          : PURPOSE_OPTIONS.includes(form.purpose)
                            ? form.purpose
                            : form.purpose
                              ? OTHER_OPTION
                              : ""
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((current) => ({
                          ...current,
                          purpose: value,
                          purposeOther:
                            value === OTHER_OPTION
                              ? current.purposeOther
                              : "",
                        }));
                      }}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                    >
                      <option value="">Select purpose</option>
                      {PURPOSE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value={OTHER_OPTION}>Other</option>
                    </select>

                    {(form.purpose === OTHER_OPTION ||
                      (form.purpose &&
                        !PURPOSE_OPTIONS.includes(form.purpose))) ? (
                      <input
                        required
                        value={
                          form.purpose === OTHER_OPTION
                            ? form.purposeOther
                            : form.purposeOther || form.purpose
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            purpose: OTHER_OPTION,
                            purposeOther: event.target.value,
                          }))
                        }
                        placeholder="Specify purpose"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                      />
                    ) : null}
                  </div>
                </Field>

                <Field label="Came With">
                  <div className="space-y-2">
                    <select
                      value={
                        form.accompaniedBy === OTHER_OPTION
                          ? OTHER_OPTION
                          : CAME_WITH_OPTIONS.includes(form.accompaniedBy)
                            ? form.accompaniedBy
                            : form.accompaniedBy
                              ? OTHER_OPTION
                              : ""
                      }
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((current) => ({
                          ...current,
                          accompaniedBy: value,
                          accompaniedByOther:
                            value === OTHER_OPTION
                              ? current.accompaniedByOther
                              : "",
                        }));
                      }}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                    >
                      <option value="">Select</option>
                      {CAME_WITH_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                      <option value={OTHER_OPTION}>Other</option>
                    </select>

                    {(form.accompaniedBy === OTHER_OPTION ||
                      (form.accompaniedBy &&
                        !CAME_WITH_OPTIONS.includes(form.accompaniedBy))) ? (
                      <input
                        value={
                          form.accompaniedBy === OTHER_OPTION
                            ? form.accompaniedByOther
                            : form.accompaniedByOther || form.accompaniedBy
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            accompaniedBy: OTHER_OPTION,
                            accompaniedByOther: event.target.value,
                          }))
                        }
                        placeholder="Specify who came with the visitor"
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px]"
                      />
                    ) : null}
                  </div>
                </Field>

                <Field label="Counsellor">
                  <select
                    value={form.counsellorName}
                    onChange={(event) =>
                      updateForm("counsellorName", event.target.value)
                    }
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                  >
                    <option value="">
                      {optionsLoading ? "Loading employees..." : "Unassigned"}
                    </option>
                    {form.counsellorName &&
                    !counsellorOptions.some(
                      (user) => user.name === form.counsellorName
                    ) ? (
                      <option value={form.counsellorName}>
                        {form.counsellorName} (current)
                      </option>
                    ) : null}
                    {counsellorOptions.map((user) => (
                      <option key={user.id} value={user.name}>
                        {user.name}
                        {user.jobTitle
                          ? ` · ${user.jobTitle}`
                          : user.role
                            ? ` · ${String(user.role).replaceAll("_", " ")}`
                            : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(event) => updateForm("status", event.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white"
                  >
                    {STATUS_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Arrival Date & Time" full>
                  <input
                    type="datetime-local"
                    value={form.arrivedAt}
                    onChange={(event) => updateForm("arrivedAt", event.target.value)}
                    onClick={(event) => event.currentTarget.showPicker?.()}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] cursor-pointer"
                  />
                </Field>
                <Field label="Notes" full>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => updateForm("notes", event.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[15px]"
                  />
                </Field>
              </div>

              {formError ? (
                <div className="mt-4 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
                  {formError}
                </div>
              ) : null}

              <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-9 px-4 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                  {editing ? "Save Changes" : "Log Walk-in"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
