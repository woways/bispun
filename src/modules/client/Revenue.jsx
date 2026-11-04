import {
  useEffect,
  useId,
  useMemo,
  useRef,
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
  Filter,
  Download,
  Eye,
  FileText,
  Upload,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import {
  Badge,
} from "../../components/ui";

import { apiRequest } from "../../lib/api";
import RevenueSlabs from "./RevenueSlabs";

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

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
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
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-600 mb-1"
      >
        {label}
        {required && (
          <span className="text-rose-500 ml-0.5" aria-label="required">
            *
          </span>
        )}
      </label>

      <input
        id={id}
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
      />
    </div>
  );
}

// Accessible-modal helper: moves focus into the dialog on open, traps Tab,
// closes on Escape, and restores focus to the opener on close. Keeps the
// historical modal visuals unchanged. (accessibility-lead Critical 4.)
const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useModalA11y(onClose) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const panel = panelRef.current;
    const first = panel?.querySelector(FOCUSABLE_SELECTOR);
    (first || panel)?.focus?.();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
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
    const items = panel.querySelectorAll(FOCUSABLE_SELECTOR);
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  return { panelRef, onKeyDown };
}

function ExpenseModal({
  expense = null,
  onClose,
  onSaved,
}) {
  const headingId = useId();
  const descId = useId();
  const { panelRef, onKeyDown } = useModalA11y(onClose);

  const removeProofRef = useRef(null);
  const pendingProofFocusRef = useRef(false);

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

  // After an upload completes the focused file input unmounts; move focus to
  // the Remove control so keyboard/SR users keep their place inside the dialog.
  useEffect(() => {
    if (form.receiptUrl && pendingProofFocusRef.current) {
      pendingProofFocusRef.current = false;
      removeProofRef.current?.focus();
    }
  }, [form.receiptUrl]);

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

    if (file.size > 8 * 1024 * 1024) {
      setError(
        "Proof file must be 8 MB or smaller"
      );
      return;
    }

    setProofUploading(true);
    setError("");

    try {
      const dataUrl =
        await new Promise(
          (resolve, reject) => {
            const reader =
              new FileReader();
            reader.onload = () =>
              resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }
        );

      const result =
        await apiRequest(
          "/api/client/revenue/expenses/proof-upload",
          {
            method: "POST",
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type,
              fileSize: file.size,
              dataUrl,
            }),
          }
        );

      update("receiptUrl", result.url);
      setProofName(file.name);
      pendingProofFocusRef.current = true;
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
    <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="bg-white rounded-2xl shadow-2xl border border-white/70 w-full max-w-2xl overflow-hidden focus:outline-none"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 id={headingId} className="font-semibold">
              {expense ? "Edit Expense" : "Add Expense"}
            </h2>

            <p className="text-xs text-slate-500">
              {expense
                ? "Correct this expense while keeping its current approval status."
                : "Expense remains pending until approved."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="p-6 grid md:grid-cols-2 gap-4">
            {error && (
              <div role="alert" className="md:col-span-2 bg-rose-50 text-rose-700 border border-rose-200 rounded p-2 text-sm">
                {error}
              </div>
            )}

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
              placeholder="Google Ads"
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
              placeholder="Marketing"
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
              placeholder="UPI / Bank"
            />

            <Field
              label="Transaction Ref"
              value={
                form.transactionRef
              }
              onChange={(value) =>
                update(
                  "transactionRef",
                  value
                )
              }
            />

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
            />

            <div className="md:col-span-2">
              <label htmlFor={descId} className="block text-xs font-medium text-slate-600 mb-1">
                Description
              </label>

              <textarea
                id={descId}
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="md:col-span-2">
              <div className="block text-xs font-medium text-slate-600 mb-1">
                Receipt / Invoice / Proof
              </div>

              <p className="text-xs text-slate-500 mb-2">
                Upload JPG, PNG, WEBP or PDF proof. Maximum file size: 8 MB.
              </p>

              <p className="sr-only" role="status" aria-live="polite">
                {proofUploading
                  ? "Uploading proof document."
                  : form.receiptUrl
                  ? "Proof document upload complete."
                  : ""}
              </p>

              {!form.receiptUrl ? (
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    disabled={proofUploading}
                    onChange={(event) =>
                      uploadProof(
                        event.target.files?.[0]
                      )
                    }
                  />

                  <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white px-5 py-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                    {proofUploading ? (
                      <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
                        <Loader2
                          size={16}
                          aria-hidden="true"
                          className="animate-spin motion-reduce:animate-none"
                        />
                        Uploading proof...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
                        <Upload size={16} aria-hidden="true" />
                        Choose receipt or invoice
                      </div>
                    )}
                  </div>
                </label>
              ) : (
                <div className="rounded-lg bg-white border border-slate-300 p-3 flex items-center gap-3">
                  <FileText size={17} aria-hidden="true" className="text-indigo-600 flex-shrink-0" />

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-800 truncate">
                      {proofName || "Expense proof document"}
                    </div>
                    <div className="text-xs text-emerald-600 font-medium">
                      Upload complete
                    </div>
                  </div>

                  <a
                    href={form.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Preview proof document (opens in new tab)"
                    className="rounded-lg p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Eye size={15} aria-hidden="true" />
                  </a>

                  <button
                    ref={removeProofRef}
                    type="button"
                    onClick={() => {
                      update("receiptUrl", "");
                      setProofName("");
                    }}
                    aria-label="Remove proof document"
                    className="rounded-lg p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              disabled={saving || proofUploading}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm"
            >
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

function IncentiveModal({
  incentive = null,
  onClose,
  onSaved,
}) {
  const headingId = useId();
  const descId = useId();
  const employeeId = useId();
  const { panelRef, onKeyDown } = useModalA11y(onClose);

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

  // Incentives should be tied to real company staff, so offer a dropdown of
  // authorized company users instead of a free-text field.
  const [users, setUsers] =
    useState([]);

  useEffect(() => {
    let active = true;
    apiRequest("/api/client/chat/users")
      .then((data) => {
        if (active) setUsers(data.users || []);
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
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="bg-white rounded-2xl shadow-2xl border border-white/70 w-full max-w-lg overflow-hidden focus:outline-none"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex justify-between">
          <div>
            <h2 id={headingId} className="font-semibold">
              {incentive ? "Edit Incentive" : "Add Incentive"}
            </h2>

            <p className="text-xs text-slate-500">
              {incentive
                ? "Correct this incentive while keeping its current status."
                : "Incentive affects profit only after approval."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={submit}>
          <div className="p-6 space-y-4">
            {error && (
              <div role="alert" className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-2 text-sm">
                {error}
              </div>
            )}

            {users.length > 0 ? (
              <div>
                <label
                  htmlFor={employeeId}
                  className="block text-xs font-medium text-slate-600 mb-1"
                >
                  Employee / Counsellor
                  <span className="text-rose-500 ml-0.5" aria-label="required">
                    *
                  </span>
                </label>
                <select
                  id={employeeId}
                  required
                  value={form.employeeName}
                  onChange={(event) =>
                    update(
                      "employeeName",
                      event.target.value
                    )
                  }
                  className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
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
              <label htmlFor={descId} className="block text-xs font-medium text-slate-600 mb-1">
                Description
              </label>

              <textarea
                id={descId}
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
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700"
            >
              Cancel
            </button>

            <button
              disabled={saving}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm"
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


function ExpenseDetails({
  expense,
  onClose,
  onStatus,
}) {
  const headingId = useId();
  const { panelRef, onKeyDown } = useModalA11y(onClose);
  const closeRef = useRef(null);

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
    <div className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px] flex justify-end">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col focus:outline-none"
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Expense Details
            </div>

            <h2 id={headingId} className="mt-1 text-lg font-bold text-slate-950">
              {expense.title}
            </h2>

            <div className="mt-2">
              <Badge tone={statusTone(expense.status)}>
                {expense.status}
              </Badge>
            </div>
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="rounded-xl bg-slate-950 text-white p-5">
            <div className="text-[11px] uppercase tracking-[0.1em] text-slate-300 font-semibold">
              Expense Amount
            </div>

            <div className="mt-2 text-2xl font-bold tracking-tight">
              {money(expense.amount)}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
              >
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {label}
                </dt>

                <dd className="mt-1 text-sm font-medium text-slate-800 break-words">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Description
            </h3>

            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 leading-6">
              {expense.description || "No description provided."}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Receipt / Invoice Proof
            </h3>

            {expense.receiptUrl ? (
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center gap-2">
                  <FileText size={15} aria-hidden="true" className="text-indigo-600" />

                  <div className="min-w-0 flex-1 text-xs font-mono text-slate-600 truncate">
                    {expense.receiptUrl}
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <a
                    href={expense.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Eye size={12} aria-hidden="true" />
                    Preview
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>

                  <a
                    href={expense.receiptUrl}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Download size={12} aria-hidden="true" />
                    Download
                    <span className="sr-only"> (opens in new tab)</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
                No proof document attached.
              </div>
            )}
          </div>
        </div>

        {expense.status === "PENDING" ? (
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex gap-2">
            <button
              type="button"
              onClick={async () => {
                closeRef.current?.focus();
                await onStatus(expense.id, "REJECTED");
              }}
              className="flex-1 h-10 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-sm font-semibold inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Ban size={14} aria-hidden="true" />
              Reject
            </button>

            <button
              type="button"
              onClick={async () => {
                closeRef.current?.focus();
                await onStatus(expense.id, "APPROVED");
              }}
              className="flex-1 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Check size={14} aria-hidden="true" />
              Approve
            </button>
          </div>
        ) : null}
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
          ? "bg-slate-950 border-slate-950 shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
          : "bg-white border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`text-[10px] font-semibold uppercase tracking-[0.09em] ${
              featured ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {label}
          </div>

          <div
            className={`mt-2 text-xl leading-none font-bold tracking-tight ${
              featured ? "text-white" : "text-slate-950"
            }`}
          >
            {value}
          </div>
        </div>

        <div
          className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
            featured
              ? "bg-white/10 border-white/10 text-white"
              : tones[tone] || tones.indigo
          }`}
        >
          <Icon size={17} aria-hidden="true" />
        </div>
      </div>

      <div
        className={`mt-3 pt-3 border-t text-[11px] ${
          featured
            ? "border-white/10 text-slate-400"
            : "border-slate-100 text-slate-500"
        }`}
      >
        {detail}
      </div>
    </div>
  );
}

export default function Revenue({ selectedYear = "all" }) {
  const expenseSearchId = useId();
  const statusFilterId = useId();
  const categoryFilterId = useId();

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
        ? { ...current, status }
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

  // Merge categories that differ only by case, keeping the first-seen spelling
  // so the filter doesn't split one category into two.
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
      const query = expenseSearch
        .trim()
        .toLowerCase();

      return expenses.filter((expense) => {
        if (
          expenseStatusFilter !== "ALL" &&
          expense.status !== expenseStatusFilter
        ) {
          return false;
        }

        if (
          expenseCategoryFilter !== "ALL" &&
          String(expense.category || "")
            .trim()
            .toLowerCase() !==
            String(expenseCategoryFilter || "")
              .trim()
              .toLowerCase()
        ) {
          return false;
        }

        if (!query) return true;

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
      });
    }, [
      expenses,
      expenseSearch,
      expenseStatusFilter,
      expenseCategoryFilter,
    ]);

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
      ...filteredExpenses.map((expense) =>
        [
          expense.title,
          expense.category,
          expense.amount,
          dateText(expense.expenseDate),
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
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bispun-expenses.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const summary =
    data.summary || {};

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Finance / Revenue management
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Revenue
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Monitor collections, outstanding revenue, approved costs, incentives and operating profit.
          </p>
        </div>

        <button
          type="button"
          onClick={loadRevenue}
          disabled={loading}
          className="h-9 px-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-2 shadow-sm"
        >
          <RefreshCw
            size={13}
            aria-hidden="true"
            className={loading ? "animate-spin motion-reduce:animate-none" : ""}
          />
          Refresh data
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-sm">
          <AlertCircle size={15} aria-hidden="true" />
          {error}
        </div>
      )}

      {loading ? (
        <div role="status" aria-live="polite" className="bg-white border border-slate-200 rounded-xl p-14 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2
            size={16}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          Loading revenue...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <RevenueMetric
              label="Potential Revenue"
              value={money(summary.potentialRevenue)}
              icon={TrendingUp}
              detail="Total admission value"
              tone="indigo"
            />

            <RevenueMetric
              label="Received"
              value={money(summary.receivedAmount)}
              icon={DollarSign}
              detail="Collections received"
              tone="emerald"
            />

            <RevenueMetric
              label="Pending"
              value={money(summary.pendingAmount)}
              icon={Clock}
              detail="Outstanding collections"
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
              label="Current Profit"
              value={money(summary.currentProfit)}
              icon={ArrowUpRight}
              detail="Received less approved costs"
              featured
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] inline-flex gap-1">
            {[
              ["overview", "Overview"],
              ["expenses", "Expenses"],
              ["incentives", "Incentives"],
              ["collegeSlabs", "College Revenue"],
              ["staffIncentives", "Staff Incentives"],
            ].map(([item, label]) => (
              <button
                key={item}
                type="button"
                aria-pressed={tab === item}
                onClick={() => setTab(item)}
                className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${
                  tab === item
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
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
                <h2 className="font-semibold text-sm text-slate-900 mb-1">
                  Monthly Revenue
                </h2>

                <div className="text-xs text-slate-500 mb-5">
                  Potential versus collected revenue by month
                </div>

                <div
                  role="img"
                  aria-label="Line chart of monthly revenue: potential versus collected revenue by month. A text table of the same data follows."
                >
                  <ResponsiveContainer
                    width="100%"
                    height={280}
                  >
                    <LineChart
                      accessibilityLayer
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

                      <Legend />

                      <Line
                        type="monotone"
                        dataKey="potential"
                        name="Potential"
                        stroke="#64748b"
                        strokeDasharray="5 5"
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

                <table className="sr-only">
                  <caption>
                    Monthly revenue: potential versus received
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col">Potential</th>
                      <th scope="col">Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.monthlyRevenue || []).map(
                      (row, index) => (
                        <tr key={index}>
                          <th scope="row">{row.m}</th>
                          <td>{money(row.potential)}</td>
                          <td>{money(row.received)}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <h2 className="font-semibold text-sm text-slate-900 mb-1">
                  Breakdown
                </h2>

                <div className="text-xs text-slate-500 mb-5">
                  Current financial position
                </div>

                <div className="space-y-3 text-sm">
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
            <div className="space-y-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col xl:flex-row xl:items-center gap-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="relative flex-1 max-w-lg">
                  <Search
                    size={14}
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <label htmlFor={expenseSearchId} className="sr-only">
                    Search expenses
                  </label>
                  <input
                    id={expenseSearchId}
                    type="search"
                    value={expenseSearch}
                    onChange={(event) =>
                      setExpenseSearch(
                        event.target.value
                      )
                    }
                    placeholder="Search expense, vendor, invoice, employee..."
                    className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap gap-2 xl:ml-auto">
                  <div className="relative">
                    <Filter
                      size={13}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <label htmlFor={statusFilterId} className="sr-only">
                      Filter by status
                    </label>
                    <select
                      id={statusFilterId}
                      value={expenseStatusFilter}
                      onChange={(event) =>
                        setExpenseStatusFilter(
                          event.target.value
                        )
                      }
                      className="h-9 pl-8 pr-8 border border-slate-300 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="ALL">All Status</option>
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>

                  <label htmlFor={categoryFilterId} className="sr-only">
                    Filter by category
                  </label>
                  <select
                    id={categoryFilterId}
                    value={expenseCategoryFilter}
                    onChange={(event) =>
                      setExpenseCategoryFilter(
                        event.target.value
                      )
                    }
                    className="h-9 px-3 border border-slate-300 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="ALL">All Categories</option>
                    {expenseCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={exportExpenses}
                    disabled={!filteredExpenses.length}
                    className="h-9 px-3 border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Download size={13} aria-hidden="true" />
                    Export
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingExpense(null);
                      setShowExpense(true);
                    }}
                    className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Add Expense
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Expense claims ({filteredExpenses.length} shown). Activate a row to view full details and proof.
                  </caption>
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Expense
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Category
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Proof
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                            setSelectedExpense(expense)
                          }
                          className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900">
                              {expense.title}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {expense.submittedByName || "—"}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {expense.category}
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
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                              >
                                <FileText size={13} aria-hidden="true" />
                                View
                                <span className="sr-only"> (opens in new tab)</span>
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <Badge
                              tone={statusTone(
                                expense.status
                              )}
                            >
                              {
                                expense.status
                              }
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
                                  setSelectedExpense(expense)
                                }
                                aria-label="View expense details"
                                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <Eye size={14} aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setShowExpense(true);
                                }}
                                aria-label="Edit expense"
                                className="w-8 h-8 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteExpense(expense)
                                }
                                aria-label="Delete expense"
                                className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <Trash2 size={14} aria-hidden="true" />
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
                                    aria-label="Approve expense"
                                    className="w-8 h-8 rounded-lg border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  >
                                    <Check size={15} aria-hidden="true" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      expenseStatus(
                                        expense.id,
                                        "REJECTED"
                                      )
                                    }
                                    aria-label="Reject expense"
                                    className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  >
                                    <Ban size={15} aria-hidden="true" />
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
                          colSpan={7}
                          className="p-8 text-center text-slate-500"
                        >
                          No expenses found. Try changing the filters or add a new expense.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "collegeSlabs" && (
            <RevenueSlabs selectedYear={selectedYear} view="college" />
          )}

          {tab === "staffIncentives" && (
            <RevenueSlabs selectedYear={selectedYear} view="employee" />
          )}

          {tab ===
            "incentives" && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setEditingIncentive(null);
                    setShowIncentive(true);
                  }}
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add Incentive
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Incentives
                  </caption>
                  <thead className="bg-slate-50/80">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Employee
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Title
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Date
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Status
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
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
                                aria-label="Edit incentive"
                                className="w-8 h-8 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteIncentive(incentive)
                                }
                                aria-label="Delete incentive"
                                className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                              >
                                <Trash2 size={14} aria-hidden="true" />
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
                                    aria-label="Approve incentive"
                                    className="w-8 h-8 rounded-lg border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  >
                                    <Check size={16} aria-hidden="true" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      incentiveStatus(
                                        incentive.id,
                                        "REJECTED"
                                      )
                                    }
                                    aria-label="Reject incentive"
                                    className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  >
                                    <Ban size={16} aria-hidden="true" />
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
                                  className="h-8 px-2.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 rounded-lg inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                >
                                  <Wallet size={12} aria-hidden="true" />
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
          onStatus={expenseStatus}
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
