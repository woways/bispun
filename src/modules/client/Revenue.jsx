import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  TrendingUp,
  DollarSign,
  Clock,
  ArrowUpRight,
  Receipt,
  Award,
  Plus,
  Loader2,
  RefreshCw,
  X,
  Check,
  Ban,
  Wallet,
  AlertCircle,
  Search,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Building2,
  CreditCard,
  Filter,
  CalendarDays,
  CircleDollarSign,
  CheckCircle2,
  XCircle,
  Upload,
  Pencil,
  Trash2,
  UserCheck,
} from "lucide-react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import {
  Badge,
} from "../../components/ui";

import { apiRequest } from "../../lib/api";
import { formatUiDate } from "../../lib/uiPreferences";

function money(value) {
  return `₹${Number(
    value || 0
  ).toLocaleString("en-IN")}`;
}

function axisMoney(value) {
  const amount =
    Number(value || 0);

  if (
    Math.abs(amount) >=
    10000000
  ) {
    return `₹${(
      amount / 10000000
    ).toFixed(1)}Cr`;
  }

  if (
    Math.abs(amount) >=
    100000
  ) {
    return `₹${(
      amount / 100000
    ).toFixed(1)}L`;
  }

  if (
    Math.abs(amount) >= 1000
  ) {
    return `₹${(
      amount / 1000
    ).toFixed(0)}k`;
  }

  return `₹${amount}`;
}

function dateText(value) {
  if (!value) return "—";

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

function statusTone(status) {
  if (
    status === "APPROVED" ||
    status === "PAID"
  ) {
    return "emerald";
  }

  if (
    status === "REJECTED"
  ) {
    return "rose";
  }

  return "amber";
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  min,
  max,
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
        placeholder={placeholder}
        min={min}
        max={max}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
      />
    </div>
  );
}

function ExpenseModal({
  expense = null,
  onClose,
  onSaved,
}) {
  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [proofUploading, setProofUploading] =
    useState(false);

  const [proofName, setProofName] =
    useState(
      expense?.receiptUrl
        ? "Existing proof document"
        : ""
    );

  const [form, setForm] =
    useState({
      title: expense?.title || "",
      category: expense?.category || "",
      description: expense?.description || "",
      amount: expense?.amount ?? "",
      expenseDate: expense?.expenseDate
        ? new Date(expense.expenseDate)
            .toISOString()
            .slice(0, 10)
        : new Date()
            .toISOString()
            .slice(0, 10),
      paymentMode: expense?.paymentMode || "",
      transactionRef: expense?.transactionRef || "",
      vendorName: expense?.vendorName || "",
      invoiceNumber: expense?.invoiceNumber || "",
      receiptUrl: expense?.receiptUrl || "",
    });

  function update(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function uploadProof(file) {
    if (!file) return;

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Only JPG, PNG, WEBP and PDF files are allowed"
      );
      return;
    }

    const maxSize =
      8 * 1024 * 1024;

    if (file.size > maxSize) {
      setError(
        "Proof file must be 8 MB or smaller"
      );
      return;
    }

    setProofUploading(true);
    setError("");

    try {
      const base64 =
        await new Promise(
          (resolve, reject) => {
            const reader =
              new FileReader();

            reader.onload = () =>
              resolve(
                reader.result
              );

            reader.onerror =
              reject;

            reader.readAsDataURL(
              file
            );
          }
        );

      const result =
        await apiRequest(
          "/api/client/revenue/expenses/proof-upload",
          {
            method: "POST",
            body: JSON.stringify({
              fileName:
                file.name,
              mimeType:
                file.type,
              fileSize:
                file.size,
              dataUrl:
                base64,
            }),
          }
        );

      update(
        "receiptUrl",
        result.url
      );

      setProofName(
        file.name
      );
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to upload proof document"
      );
    } finally {
      setProofUploading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        expense
          ? `/api/client/revenue/expenses/${expense.id}`
          : "/api/client/revenue/expenses",
        {
          method: expense
            ? "PATCH"
            : "POST",

          body: JSON.stringify({
            ...form,
            amount:
              Number(
                form.amount
              ),
          }),
        }
      );

      onSaved();
    } catch (error) {
      setError(
        error?.data?.message ||
          (expense
            ? "Unable to update expense"
            : "Unable to create expense")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/55 backdrop-blur-[3px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-white/70 w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-indigo-500">
              Finance / Expense Claim
            </div>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {expense ? "Edit Expense" : "Add Expense"}
            </h2>

            <p className="mt-1 text-[13px] text-slate-500">
              {expense
                ? "Correct this expense while keeping its current approval status."
                : "Add expense details, payment information and receipt proof. New expenses remain pending until approved."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 inline-flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="min-h-0 flex flex-col"
        >
          <div className="p-6 overflow-y-auto space-y-5">
            {error && (
              <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl px-3 py-2 text-[15px]">
                {error}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={15} className="text-indigo-600" />
                <div className="text-[15px] font-bold text-slate-900">
                  Expense Details
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field
                  label="Expense Title"
                  required
                  value={form.title}
                  onChange={(value) =>
                    update(
                      "title",
                      value
                    )
                  }
                  placeholder="Google Ads / Travel / Office Supplies"
                />

                <Field
                  label="Category"
                  required
                  value={
                    form.category
                  }
                  onChange={(value) =>
                    update(
                      "category",
                      value
                    )
                  }
                  placeholder="Marketing / Travel / Operations"
                />

                <Field
                  label="Amount"
                  required
                  type="number"
                  value={form.amount}
                  onChange={(value) =>
                    update(
                      "amount",
                      value
                    )
                  }
                  placeholder="50000"
                />

                <Field
                  label="Expense Date"
                  required
                  type="date"
                  min="2000-01-01"
                  max={new Date()
                    .toISOString()
                    .slice(0, 10)}
                  value={
                    form.expenseDate
                  }
                  onChange={(value) =>
                    update(
                      "expenseDate",
                      value
                    )
                  }
                />

                <div className="md:col-span-2">
                  <label className="block text-[13px] font-medium text-slate-600 mb-1">
                    Description
                  </label>

                  <textarea
                    rows={3}
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      update(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="Why this expense was incurred..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard size={15} className="text-indigo-600" />
                <div className="text-[15px] font-bold text-slate-900">
                  Vendor & Payment
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field
                  label="Vendor"
                  value={
                    form.vendorName
                  }
                  onChange={(value) =>
                    update(
                      "vendorName",
                      value
                    )
                  }
                  placeholder="Google India / Vendor Name"
                />

                <Field
                  label="Invoice Number"
                  value={
                    form.invoiceNumber
                  }
                  onChange={(value) =>
                    update(
                      "invoiceNumber",
                      value
                    )
                  }
                  placeholder="INV-2026-001"
                />

                <Field
                  label="Payment Mode"
                  value={
                    form.paymentMode
                  }
                  onChange={(value) =>
                    update(
                      "paymentMode",
                      value
                    )
                  }
                  placeholder="UPI / Bank / Card / Cash"
                />

                <Field
                  label="Transaction Reference"
                  value={
                    form.transactionRef
                  }
                  onChange={(value) =>
                    update(
                      "transactionRef",
                      value
                    )
                  }
                  placeholder="UTR / transaction ID"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={15} className="text-indigo-600" />
                <div className="text-[15px] font-bold text-slate-900">
                  Receipt / Invoice / Proof
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Upload JPG, PNG, WEBP or PDF proof. Maximum file size: 8 MB.
              </p>

              {!form.receiptUrl ? (
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    disabled={proofUploading}
                    onChange={(event) =>
                      uploadProof(
                        event.target.files?.[0]
                      )
                    }
                  />

                  <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-white px-5 py-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
                    {proofUploading ? (
                      <>
                        <Loader2
                          size={24}
                          className="mx-auto text-indigo-600 animate-spin"
                        />

                        <div className="mt-3 text-[15px] font-semibold text-slate-800">
                          Uploading proof...
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-11 h-11 mx-auto rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Upload size={19} />
                        </div>

                        <div className="mt-3 text-[15px] font-semibold text-slate-800">
                          Choose receipt or invoice
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          Click to upload image or PDF
                        </div>
                      </>
                    )}
                  </div>
                </label>
              ) : (
                <div className="rounded-xl bg-white border border-indigo-100 p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                      <FileText size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-slate-800 truncate">
                        {proofName || "Expense proof document"}
                      </div>

                      <div className="mt-0.5 text-[13px] text-emerald-600 font-semibold">
                        Upload complete
                      </div>
                    </div>

                    <a
                      href={form.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 inline-flex items-center justify-center"
                      title="Preview"
                    >
                      <Eye size={13} />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        update(
                          "receiptUrl",
                          ""
                        );
                        setProofName(
                          ""
                        );
                      }}
                      className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center"
                      title="Remove"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              disabled={saving || proofUploading}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold shadow-sm inline-flex items-center gap-2"
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Plus size={13} />
              )}

              {saving
                ? expense
                  ? "Saving..."
                  : "Creating..."
                : expense
                ? "Save Changes"
                : "Add Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpenseDetails({
  expense,
  onClose,
  onStatus,
}) {
  if (!expense) return null;

  const details = [
    ["Category", expense.category],
    ["Expense Date", dateText(expense.expenseDate)],
    ["Submitted By", expense.submittedByName || "—"],
    ["Vendor", expense.vendorName || "—"],
    ["Payment Mode", expense.paymentMode || "—"],
    ["Transaction Ref", expense.transactionRef || "—"],
    ["Invoice Number", expense.invoiceNumber || "—"],
    ["Approved By", expense.approvedByName || "—"],
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/45 backdrop-blur-[2px] flex justify-end">
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-400">
              Expense Details
            </div>

            <h2 className="mt-1 text-xl font-bold text-slate-950">
              {expense.title}
            </h2>

            <div className="mt-2">
              <Badge tone={statusTone(expense.status)}>
                {expense.status}
              </Badge>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center text-slate-500"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="rounded-2xl bg-slate-950 text-white p-5">
            <div className="text-[13px] uppercase tracking-[0.1em] text-slate-400 font-semibold">
              Expense Amount
            </div>

            <div className="mt-2 text-3xl font-bold tracking-tight">
              {money(expense.amount)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  {label}
                </div>

                <div className="mt-1.5 text-[13px] font-semibold text-slate-800 break-words">
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="text-[13px] font-bold text-slate-900">
              Description
            </div>

            <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-[15px] text-slate-600 leading-6">
              {expense.description || "No description provided."}
            </div>
          </div>

          <div>
            <div className="text-[13px] font-bold text-slate-900">
              Receipt / Invoice Proof
            </div>

            {expense.receiptUrl ? (
              <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-indigo-600" />

                  <div className="min-w-0 flex-1 text-[13px] font-mono text-slate-600 truncate">
                    {expense.receiptUrl}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <a
                    href={expense.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Eye size={12} />
                    Preview
                  </a>

                  <a
                    href={expense.receiptUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 px-3 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Download size={12} />
                    Download
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[13px] text-slate-500">
                No proof document attached.
              </div>
            )}
          </div>
        </div>

        {expense.status === "PENDING" ? (
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex gap-2">
            <button
              type="button"
              onClick={() => onStatus(expense.id, "REJECTED")}
              className="flex-1 h-10 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-[13px] font-semibold inline-flex items-center justify-center gap-2"
            >
              <Ban size={14} />
              Reject
            </button>

            <button
              type="button"
              onClick={() => onStatus(expense.id, "APPROVED")}
              className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2"
            >
              <Check size={14} />
              Approve
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function IncentiveModal({
  incentive = null,
  onClose,
  onSaved,
}) {
  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] =
    useState({
      employeeName: incentive?.employeeName || "",
      title: incentive?.title || "",
      description: incentive?.description || "",
      amount: incentive?.amount ?? "",
      incentiveDate: incentive?.incentiveDate
        ? new Date(incentive.incentiveDate)
            .toISOString()
            .slice(0, 10)
        : new Date()
            .toISOString()
            .slice(0, 10),
    });

  // CA-028: incentives should be tied to real company staff, so offer a
  // dropdown of users instead of a free-text field.
  const [users, setUsers] =
    useState([]);

  useEffect(() => {
    let active = true;
    apiRequest("/api/client/chat/users")
      .then((data) => {
        if (active)
          setUsers(data.users || []);
      })
      .catch(() => {
        if (active) setUsers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function update(
    field,
    value
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        incentive
          ? `/api/client/revenue/incentives/${incentive.id}`
          : "/api/client/revenue/incentives",
        {
          method: incentive
            ? "PATCH"
            : "POST",

          body: JSON.stringify({
            ...form,
            amount:
              Number(
                form.amount
              ),
          }),
        }
      );

      onSaved();
    } catch (error) {
      setError(
        error?.data?.message ||
          (incentive
            ? "Unable to update incentive"
            : "Unable to create incentive")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-white/70 w-full max-w-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between">
          <div>
            <h2 className="font-semibold">
              {incentive ? "Edit Incentive" : "Add Incentive"}
            </h2>

            <p className="text-[13px] text-slate-500">
              {incentive
                ? "Correct this incentive while keeping its current status."
                : "Incentive affects profit only after approval."}
            </p>
          </div>

          <button
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-2 text-[15px]">
                {error}
              </div>
            )}

            {users.length > 0 ? (
              <div>
                <label className="block text-[13px] font-medium text-slate-600 mb-1">
                  Employee / Counsellor
                  <span className="text-rose-500 ml-0.5">
                    *
                  </span>
                </label>
                <select
                  required
                  value={form.employeeName}
                  onChange={(event) =>
                    update(
                      "employeeName",
                      event.target.value
                    )
                  }
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                >
                  <option value="">
                    Select an employee…
                  </option>
                  {users.map((u) => (
                    <option
                      key={u.id}
                      value={u.name}
                    >
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <Field
                label="Employee / Counsellor"
                required
                value={
                  form.employeeName
                }
                onChange={(value) =>
                  update(
                    "employeeName",
                    value
                  )
                }
                placeholder="ABC Counsellor"
              />
            )}

            <Field
              label="Title"
              value={form.title}
              onChange={(value) =>
                update(
                  "title",
                  value
                )
              }
              placeholder="Admission Incentive"
            />

            <Field
              label="Amount"
              required
              type="number"
              value={form.amount}
              onChange={(value) =>
                update(
                  "amount",
                  value
                )
              }
              placeholder="10000"
            />

            <Field
              label="Incentive Date"
              required
              type="date"
              min="2000-01-01"
              max={new Date()
                .toISOString()
                .slice(0, 10)}
              value={
                form.incentiveDate
              }
              onChange={(value) =>
                update(
                  "incentiveDate",
                  value
                )
              }
            />

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1">
                Description
              </label>

              <textarea
                rows={3}
                value={
                  form.description
                }
                onChange={(event) =>
                  update(
                    "description",
                    event.target.value
                  )
                }
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              disabled={saving}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[13px] font-semibold shadow-sm"
            >
              {saving
                ? incentive
                  ? "Saving..."
                  : "Creating..."
                : incentive
                ? "Save Changes"
                : "Add Incentive"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function RevenueMetric({
  label,
  value,
  icon: Icon,
  detail,
  tone = "indigo",
  featured = false,
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div
      className={`border rounded-xl p-4 transition-all ${
        featured
          ? "bg-indigo-600 border-indigo-600 shadow-[0_10px_30px_rgba(79,70,229,0.16)]"
          : "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-[13px] font-semibold uppercase tracking-[0.09em] ${
              featured ? "text-indigo-100" : "text-slate-400"
            }`}
          >
            {label}
          </div>

          <div
            className={`mt-2 text-[22px] leading-none font-bold tracking-tight ${
              featured ? "text-white" : "text-slate-950"
            }`}
          >
            {value}
          </div>
        </div>

        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
            featured
              ? "bg-white/15 border-white/20 text-white"
              : tones[tone] || tones.indigo
          }`}
        >
          <Icon size={17} />
        </div>
      </div>

      <div
        className={`mt-3 pt-3 border-t text-[13px] leading-5 ${
          featured
            ? "border-white/20 text-indigo-100"
            : "border-slate-100 text-slate-500"
        }`}
      >
        {detail}
      </div>
    </div>
  );
}

export default function Revenue({ selectedYear = "all" }) {
  const [tab, setTab] =
    useState("overview");

  const [data, setData] =
    useState({
      summary: {},
      monthlyRevenue: [],
      expenses: [],
      incentives: [],
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    showExpense,
    setShowExpense,
  ] = useState(false);

  const [
    showIncentive,
    setShowIncentive,
  ] = useState(false);

  const [
    editingExpense,
    setEditingExpense,
  ] = useState(null);

  const [
    editingIncentive,
    setEditingIncentive,
  ] = useState(null);

  const [
    selectedExpense,
    setSelectedExpense,
  ] = useState(null);

  const [
    expenseSearch,
    setExpenseSearch,
  ] = useState("");

  const [
    expenseStatusFilter,
    setExpenseStatusFilter,
  ] = useState("ALL");

  const [
    expenseCategoryFilter,
    setExpenseCategoryFilter,
  ] = useState("ALL");

  async function loadRevenue() {
    setLoading(true);
    setError("");

    try {
      const result =
        await apiRequest(
          `/api/client/revenue?year=${encodeURIComponent(selectedYear)}`
        );

      setData(result);
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to load revenue"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRevenue();
  }, [selectedYear]);

  async function expenseStatus(
    id,
    status
  ) {
    await apiRequest(
      `/api/client/revenue/expenses/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
        }),
      }
    );

    await loadRevenue();

    setSelectedExpense((current) =>
      current?.id === id
        ? {
            ...current,
            status,
          }
        : current
    );
  }

  async function incentiveStatus(
    id,
    status
  ) {
    await apiRequest(
      `/api/client/revenue/incentives/${id}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status,
        }),
      }
    );

    await loadRevenue();
  }

  async function deleteExpense(expense) {
    if (
      !window.confirm(
        `Delete ${expense.title}? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/api/client/revenue/expenses/${expense.id}`,
        { method: "DELETE" }
      );

      setSelectedExpense(null);
      await loadRevenue();
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to delete expense"
      );
    }
  }

  async function deleteIncentive(incentive) {
    if (
      !window.confirm(
        `Delete ${incentive.title || "this incentive"}? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await apiRequest(
        `/api/client/revenue/incentives/${incentive.id}`,
        { method: "DELETE" }
      );

      await loadRevenue();
    } catch (error) {
      setError(
        error?.data?.message ||
          "Unable to delete incentive"
      );
    }
  }

  const expenses =
    data.expenses || [];

  // CA-029: merge categories that differ only by case (Marketing == marketing),
  // keeping the first-seen spelling so the filter doesn't split one category.
  const expenseCategories =
    useMemo(() => {
      const seen = new Map();
      expenses.forEach((expense) => {
        const raw = String(
          expense.category || ""
        ).trim();
        if (!raw) return;
        const key = raw.toLowerCase();
        if (!seen.has(key)) seen.set(key, raw);
      });
      return Array.from(seen.values()).sort(
        (a, b) =>
          a.localeCompare(b, undefined, {
            sensitivity: "base",
          })
      );
    }, [expenses]);

  const filteredExpenses =
    useMemo(() => {
      const query =
        expenseSearch
          .trim()
          .toLowerCase();

      return expenses.filter(
        (expense) => {
          if (
            expenseStatusFilter !==
              "ALL" &&
            expense.status !==
              expenseStatusFilter
          ) {
            return false;
          }

          if (
            expenseCategoryFilter !==
              "ALL" &&
            String(expense.category || "")
              .trim()
              .toLowerCase() !==
              String(expenseCategoryFilter || "")
                .trim()
                .toLowerCase()
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return [
            expense.title,
            expense.category,
            expense.vendorName,
            expense.invoiceNumber,
            expense.submittedByName,
            expense.paymentMode,
            expense.transactionRef,
          ]
            .filter(Boolean)
            .some((value) =>
              String(value)
                .toLowerCase()
                .includes(query)
            );
        }
      );
    }, [
      expenses,
      expenseSearch,
      expenseStatusFilter,
      expenseCategoryFilter,
    ]);

  const expenseStats =
    useMemo(() => {
      const now =
        new Date();

      return {
        total:
          expenses.reduce(
            (sum, item) =>
              sum +
              Number(
                item.amount ||
                  0
              ),
            0
          ),

        pending:
          expenses
            .filter(
              (item) =>
                item.status ===
                "PENDING"
            )
            .reduce(
              (sum, item) =>
                sum +
                Number(
                  item.amount ||
                    0
                ),
              0
            ),

        approved:
          expenses
            .filter(
              (item) =>
                item.status ===
                "APPROVED"
            )
            .reduce(
              (sum, item) =>
                sum +
                Number(
                  item.amount ||
                    0
                ),
              0
            ),

        rejected:
          expenses
            .filter(
              (item) =>
                item.status ===
                "REJECTED"
            )
            .reduce(
              (sum, item) =>
                sum +
                Number(
                  item.amount ||
                    0
                ),
              0
            ),

        thisMonth:
          expenses
            .filter(
              (item) => {
                const date =
                  new Date(
                    item.expenseDate
                  );

                return (
                  date.getMonth() ===
                    now.getMonth() &&
                  date.getFullYear() ===
                    now.getFullYear()
                );
              }
            )
            .reduce(
              (sum, item) =>
                sum +
                Number(
                  item.amount ||
                    0
                ),
              0
            ),
      };
    }, [expenses]);

  function exportExpenses() {
    const headers = [
      "Expense",
      "Category",
      "Amount",
      "Expense Date",
      "Vendor",
      "Payment Mode",
      "Transaction Ref",
      "Invoice Number",
      "Submitted By",
      "Approved By",
      "Status",
      "Receipt URL",
    ];

    const escape = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const csv = [
      headers.map(escape).join(","),
      ...filteredExpenses.map(
        (expense) =>
          [
            expense.title,
            expense.category,
            expense.amount,
            dateText(
              expense.expenseDate
            ),
            expense.vendorName,
            expense.paymentMode,
            expense.transactionRef,
            expense.invoiceNumber,
            expense.submittedByName,
            expense.approvedByName,
            expense.status,
            expense.receiptUrl,
          ]
            .map(escape)
            .join(",")
      ),
    ].join("\\n");

    const blob =
      new Blob(
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

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download =
      "consulbuzz-expenses.csv";

    document.body.appendChild(
      link
    );

    link.click();
    link.remove();

    URL.revokeObjectURL(
      url
    );
  }

  const summary =
    data.summary || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Finance / Revenue management
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Revenue
          </h1>

          <p className="mt-1 text-[15px] text-slate-500">
            Monitor collections, outstanding revenue, approved costs, incentives and operating profit.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRevenue}
          disabled={loading}
          className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-[13px] font-semibold text-slate-700 inline-flex items-center justify-center gap-2 shadow-sm"
        >
          <RefreshCw
            size={13}
            className={loading ? "animate-spin" : ""}
          />
          Refresh data
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-[15px]">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 flex items-center justify-center gap-2 text-[15px] text-slate-500">
          <Loader2
            size={16}
            className="animate-spin"
          />
          Loading revenue...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <RevenueMetric
              label="Total Admissions"
              value={Number(summary.totalAdmissions || 0).toLocaleString("en-IN")}
              icon={UserCheck}
              detail="Admissions included in revenue"
              tone="slate"
            />

            <RevenueMetric
              label="Total Potential Revenue"
              value={money(summary.potentialRevenue)}
              icon={TrendingUp}
              detail="Total admission revenue value"
              tone="indigo"
            />

            <RevenueMetric
              label="In Bucket Revenue"
              value={money(summary.inBucketRevenue)}
              icon={CircleDollarSign}
              detail="Admission value currently in bucket"
              tone="emerald"
            />

            <RevenueMetric
              label="Buffer Zone Revenue"
              value={money(summary.bufferRevenue)}
              icon={Clock}
              detail="Admission value currently in buffer zone"
              tone="amber"
            />

            <RevenueMetric
              label="Approved Expenses"
              value={money(summary.approvedExpenses)}
              icon={Receipt}
              detail="Approved operating costs"
              tone="rose"
            />

            <RevenueMetric
              label="Total Incentive Amount"
              value={money(summary.totalIncentives)}
              icon={Award}
              detail="Approved and paid staff incentives"
              tone="slate"
            />

            <RevenueMetric
              label="Received Amount"
              value={money(summary.receivedAmount)}
              icon={DollarSign}
              detail="Collections received"
              tone="emerald"
            />

            <RevenueMetric
              label="Pending Amount"
              value={money(summary.pendingAmount)}
              icon={Clock}
              detail="Outstanding collections"
              tone="amber"
            />

            <RevenueMetric
              label="Current Profit"
              value={money(summary.currentProfit)}
              icon={ArrowUpRight}
              detail="Received less approved expenses and incentives"
              featured
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] inline-flex gap-1">
            {[
              ["overview", "Overview"],
              ["expenses", "Expenses"],
              ["incentives", "Incentives"],
            ].map(([item, label]) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`h-8 px-3 rounded-lg text-[13px] font-semibold transition-colors ${
                  tab === item
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab ===
            "overview" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <h3 className="font-semibold text-[15px] text-slate-900 mb-1">
                  Monthly Revenue
                </h3>

                <div className="text-[13px] text-slate-500 mb-5">
                  Potential versus collected revenue by month
                </div>

                <ResponsiveContainer
                  width="100%"
                  height={280}
                >
                  <LineChart
                    data={
                      data.monthlyRevenue
                    }
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />

                    <XAxis
                      dataKey="m"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />

                    <YAxis
                      tickFormatter={
                        axisMoney
                      }
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                    />

                    <Tooltip
                      formatter={
                        money
                      }
                    />

                    <Line
                      type="monotone"
                      dataKey="potential"
                      name="Potential"
                      stroke="#cbd5e1"
                    />

                    <Line
                      type="monotone"
                      dataKey="received"
                      name="Received"
                      stroke="#6366f1"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <h3 className="font-semibold text-[15px] text-slate-900 mb-1">
                  Breakdown
                </h3>

                <div className="text-[13px] text-slate-500 mb-5">
                  Current financial position
                </div>

                <div className="space-y-3 text-[15px]">
                  <Row
                    label="Received"
                    value={money(
                      summary.receivedAmount
                    )}
                  />

                  <Row
                    label="- Approved Expenses"
                    value={money(
                      summary.approvedExpenses
                    )}
                  />

                  <Row
                    label="- Incentives"
                    value={money(
                      summary.totalIncentives
                    )}
                  />

                  <div className="border-t pt-3">
                    <Row
                      label="Current Profit"
                      value={money(
                        summary.currentProfit
                      )}
                      bold
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab ===
            "expenses" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
                <RevenueMetric
                  label="Total Expenses"
                  value={money(expenseStats.total)}
                  icon={Receipt}
                  detail="All expense claims in the selected period"
                  tone="slate"
                />

                <RevenueMetric
                  label="Pending Approval"
                  value={money(expenseStats.pending)}
                  icon={Clock}
                  detail="Awaiting Client Admin review"
                  tone="amber"
                />

                <RevenueMetric
                  label="Approved"
                  value={money(expenseStats.approved)}
                  icon={CheckCircle2}
                  detail="Included in current profit"
                  tone="emerald"
                />

                <RevenueMetric
                  label="Rejected"
                  value={money(expenseStats.rejected)}
                  icon={XCircle}
                  detail="Rejected expense value"
                  tone="rose"
                />

                <RevenueMetric
                  label="This Month"
                  value={money(expenseStats.thisMonth)}
                  icon={CalendarDays}
                  detail="Expenses dated this month"
                  tone="indigo"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-3 flex flex-col xl:flex-row xl:items-center gap-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="relative flex-1 max-w-lg">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={expenseSearch}
                    onChange={(event) =>
                      setExpenseSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search expense, vendor, invoice, employee..."
                    className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-xl text-[15px] focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
                  />
                </div>

                <div className="flex flex-wrap gap-2 xl:ml-auto">
                  <div className="relative">
                    <Filter
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <select
                      value={expenseStatusFilter}
                      onChange={(event) =>
                        setExpenseStatusFilter(
                          event.target.value
                        )
                      }
                      className="h-9 pl-8 pr-8 border border-slate-200 bg-white rounded-xl text-[13px] font-semibold text-slate-700"
                    >
                      <option value="ALL">
                        All Status
                      </option>
                      <option value="PENDING">
                        Pending
                      </option>
                      <option value="APPROVED">
                        Approved
                      </option>
                      <option value="REJECTED">
                        Rejected
                      </option>
                    </select>
                  </div>

                  <select
                    value={expenseCategoryFilter}
                    onChange={(event) =>
                      setExpenseCategoryFilter(
                        event.target.value
                      )
                    }
                    className="h-9 px-3 border border-slate-200 bg-white rounded-xl text-[13px] font-semibold text-slate-700"
                  >
                    <option value="ALL">
                      All Categories
                    </option>

                    {expenseCategories.map(
                      (category) => (
                        <option
                          key={category}
                          value={category}
                        >
                          {category}
                        </option>
                      )
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={exportExpenses}
                    disabled={!filteredExpenses.length}
                    className="h-9 px-3 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-xl text-[13px] font-semibold text-slate-700 inline-flex items-center gap-2"
                  >
                    <Download size={13} />
                    Export
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setShowExpense(true)
                    }
                    className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
                  >
                    <Plus size={14} />
                    Add Expense
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[15px] font-bold text-slate-900">
                      Expense Claims
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                      {filteredExpenses.length} visible · click any row to view complete details and proof
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[15px]">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Expense
                        </th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Vendor
                        </th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Proof
                        </th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Actions
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredExpenses.map(
                        (expense) => (
                          <tr
                            key={
                              expense.id
                            }
                            onClick={() =>
                              setSelectedExpense(
                                expense
                              )
                            }
                            className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900">
                                {expense.title}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-500">
                                {expense.submittedByName || "—"}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {expense.category}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {expense.vendorName || "—"}
                            </td>

                            <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                              {money(
                                expense.amount
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-600">
                              {dateText(
                                expense.expenseDate
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {expense.receiptUrl ? (
                                <a
                                  href={expense.receiptUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) =>
                                    event.stopPropagation()
                                  }
                                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700"
                                >
                                  <FileText size={13} />
                                  View
                                </a>
                              ) : (
                                <span className="text-[13px] text-slate-400">
                                  —
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              <Badge
                                tone={statusTone(
                                  expense.status
                                )}
                              >
                                {expense.status}
                              </Badge>
                            </td>

                            <td className="px-4 py-3">
                              <div
                                className="flex items-center gap-1"
                                onClick={(event) =>
                                  event.stopPropagation()
                                }
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedExpense(
                                      expense
                                    )
                                  }
                                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 inline-flex items-center justify-center"
                                  title="View details"
                                >
                                  <Eye size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExpense(expense);
                                    setShowExpense(true);
                                  }}
                                  className="w-8 h-8 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 inline-flex items-center justify-center"
                                  title="Edit expense"
                                >
                                  <Pencil size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteExpense(expense)
                                  }
                                  className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center"
                                  title="Delete expense"
                                >
                                  <Trash2 size={14} />
                                </button>

                                {expense.status ===
                                  "PENDING" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        expenseStatus(
                                          expense.id,
                                          "APPROVED"
                                        )
                                      }
                                      className="w-8 h-8 rounded-lg border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 inline-flex items-center justify-center"
                                      title="Approve"
                                    >
                                      <Check size={15} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        expenseStatus(
                                          expense.id,
                                          "REJECTED"
                                        )
                                      }
                                      className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center"
                                      title="Reject"
                                    >
                                      <Ban size={15} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      )}

                      {!filteredExpenses.length && (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-12 text-center"
                          >
                            <div className="w-11 h-11 mx-auto rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                              <Receipt size={18} />
                            </div>

                            <div className="mt-3 text-[15px] font-semibold text-slate-700">
                              No expenses found
                            </div>

                            <div className="mt-1 text-[13px] text-slate-500">
                              Try changing the filters or add a new expense.
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab ===
            "incentives" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setEditingIncentive(null);
                    setShowIncentive(true);
                  }}
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm"
                >
                  <Plus size={14} />
                  Add Incentive
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <table className="w-full text-[15px]">
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Employee
                      </th>
                      <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {data.incentives.map(
                      (incentive) => (
                        <tr
                          key={
                            incentive.id
                          }
                          className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="px-4 py-3">
                            {
                              incentive.employeeName
                            }
                          </td>

                          <td className="px-4 py-3">
                            {incentive.title ||
                              "—"}
                          </td>

                          <td className="px-4 py-3 font-semibold tabular-nums text-slate-900">
                            {money(
                              incentive.amount
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {dateText(
                              incentive.incentiveDate
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <Badge
                              tone={statusTone(
                                incentive.status
                              )}
                            >
                              {
                                incentive.status
                              }
                            </Badge>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIncentive(incentive);
                                  setShowIncentive(true);
                                }}
                                className="w-8 h-8 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 inline-flex items-center justify-center"
                                title="Edit incentive"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteIncentive(incentive)
                                }
                                className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center"
                                title="Delete incentive"
                              >
                                <Trash2 size={14} />
                              </button>

                              {incentive.status ===
                                "PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      incentiveStatus(
                                        incentive.id,
                                        "APPROVED"
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 inline-flex items-center justify-center"
                                    title="Approve"
                                  >
                                    <Check size={16} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      incentiveStatus(
                                        incentive.id,
                                        "REJECTED"
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center"
                                    title="Reject"
                                  >
                                    <Ban size={16} />
                                  </button>
                                </>
                              )}

                              {incentive.status ===
                                "APPROVED" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    incentiveStatus(
                                      incentive.id,
                                      "PAID"
                                    )
                                  }
                                  className="h-8 px-2.5 text-[13px] font-semibold bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 rounded-lg inline-flex items-center gap-1.5"
                                >
                                  <Wallet size={12} />
                                  Mark Paid
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    )}

                    {!data.incentives
                      .length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-slate-500"
                        >
                          No incentives
                          yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {selectedExpense && (
        <ExpenseDetails
          expense={selectedExpense}
          onClose={() =>
            setSelectedExpense(null)
          }
          onStatus={async (id, status) => {
            await expenseStatus(id, status);

            setSelectedExpense((current) =>
              current
                ? {
                    ...current,
                    status,
                  }
                : current
            );
          }}
        />
      )}

      {showExpense && (
        <ExpenseModal
          expense={editingExpense}
          onClose={() => {
            setShowExpense(false);
            setEditingExpense(null);
          }}
          onSaved={async () => {
            setShowExpense(false);
            setEditingExpense(null);
            setSelectedExpense(null);
            await loadRevenue();
          }}
        />
      )}

      {showIncentive && (
        <IncentiveModal
          incentive={editingIncentive}
          onClose={() => {
            setShowIncentive(false);
            setEditingIncentive(null);
          }}
          onSaved={async () => {
            setShowIncentive(false);
            setEditingIncentive(null);
            await loadRevenue();
          }}
        />
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}) {
  return (
    <div
      className={`flex justify-between ${
        bold
          ? "font-semibold"
          : ""
      }`}
    >
      <span className="text-slate-600">
        {label}
      </span>

      <span>{value}</span>
    </div>
  );
}
