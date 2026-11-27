import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  TrendingUp,
  IndianRupee,
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
  CalendarDays,
  CheckCircle2,
  XCircle,
  Upload,
  Pencil,
  Trash2,
  UserCheck,
} from "lucide-react";

import {
  ComposedChart,
  Area,
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

import DetailModal from "../../components/DetailModal";

import { apiRequest } from "../../lib/api";
import { formatUiDate } from "../../lib/uiPreferences";
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

// Accessible-modal helper: moves focus into the dialog on open, traps Tab,
// closes on Escape, locks body scroll, and restores focus to the opener on
// close. Keeps the historical modal visuals unchanged.
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
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-slate-600 mb-1">
        {label}
        {required && (
          <span className="text-rose-500 ml-0.5" aria-hidden="true">
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
  const headingId = useId();
  const descId = useId();
  const { panelRef, onKeyDown } = useModalA11y(onClose);

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
    <div className="fixed inset-0 z-[9999] bg-slate-950/55 backdrop-blur-[3px] flex justify-end">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="bg-white shadow-2xl border-l border-slate-200 w-full max-w-3xl h-full overflow-hidden flex flex-col focus:outline-none animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex flex-shrink-0 items-center justify-between">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-indigo-500">
              Finance / Expense Claim
            </div>

            <h2 id={headingId} className="mt-1 text-xl font-bold text-slate-950">
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
            aria-label="Close"
            className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 inline-flex items-center justify-center text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex-1 min-h-0 flex flex-col"
        >
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5">
            {error && (
              <div role="alert" className="bg-rose-50 text-rose-700 border border-rose-200 rounded-xl px-3 py-2 text-[15px]">
                {error}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={15} aria-hidden="true" className="text-indigo-600" />
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
                  <label htmlFor={descId} className="block text-[13px] font-medium text-slate-600 mb-1">
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
                    placeholder="Why this expense was incurred..."
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard size={15} aria-hidden="true" className="text-indigo-600" />
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
                <FileText size={15} aria-hidden="true" className="text-indigo-600" />
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
                          aria-hidden="true"
                          className="mx-auto text-indigo-600 animate-spin motion-reduce:animate-none"
                        />

                        <div className="mt-3 text-[15px] font-semibold text-slate-800">
                          Uploading proof...
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-11 h-11 mx-auto rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Upload size={19} aria-hidden="true" />
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
                      <FileText size={17} aria-hidden="true" />
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
                      aria-label="Preview proof document (opens in new tab)"
                      className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      title="Preview"
                    >
                      <Eye size={13} aria-hidden="true" />
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
                      aria-label="Remove proof document"
                      className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      title="Remove"
                    >
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex flex-shrink-0 justify-end gap-2">
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
                <Loader2 size={13} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Plus size={13} aria-hidden="true" />
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
  const headingId = useId();
  const { panelRef, onKeyDown } = useModalA11y(onClose);

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
            <div className="text-[13px] font-bold uppercase tracking-[0.1em] text-slate-500">
              Expense Details
            </div>

            <h2 id={headingId} className="mt-1 text-xl font-bold text-slate-950">
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
            aria-label="Close"
            className="w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X size={16} aria-hidden="true" />
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {details.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-500">
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
                  <FileText size={15} aria-hidden="true" className="text-indigo-600" />

                  <div className="min-w-0 flex-1 text-[13px] font-mono text-slate-600 truncate">
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
                    className="h-8 px-3 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-semibold inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <Download size={12} aria-hidden="true" />
                    Download
                    <span className="sr-only"> (opens in new tab)</span>
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
              className="flex-1 h-10 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-[13px] font-semibold inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Ban size={14} aria-hidden="true" />
              Reject
            </button>

            <button
              type="button"
              onClick={() => onStatus(expense.id, "APPROVED")}
              className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
    <div className="fixed inset-0 z-[130] bg-slate-950/55 backdrop-blur-[2px] flex justify-end">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="bg-white shadow-2xl border-l border-slate-200 w-full max-w-lg h-full overflow-hidden flex flex-col focus:outline-none animate-[drawerSlideIn_0.25s_ease-out] motion-reduce:animate-none"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex flex-shrink-0 justify-between">
          <div>
            <h2 id={headingId} className="font-semibold">
              {incentive ? "Edit Incentive" : "Add Incentive"}
            </h2>

            <p className="text-[13px] text-slate-500">
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

        <form onSubmit={submit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            {error && (
              <div role="alert" className="bg-rose-50 text-rose-700 border border-rose-200 rounded p-2 text-[15px]">
                {error}
              </div>
            )}

            {users.length > 0 ? (
              <div>
                <label htmlFor={employeeId} className="block text-[13px] font-medium text-slate-600 mb-1">
                  Employee / Counsellor
                  <span className="text-rose-500 ml-0.5" aria-hidden="true">
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
              <label htmlFor={descId} className="block text-[13px] font-medium text-slate-600 mb-1">
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/70 flex flex-shrink-0 justify-end gap-2">
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
  onClick,
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  const clickable = typeof onClick === "function";
  const Wrapper = clickable ? "button" : "div";

  return (
    <Wrapper
      type={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
      aria-label={clickable ? `${label} — view details` : undefined}
      className={`group flex w-full flex-col text-left border rounded-xl bg-white border-slate-200 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_26px_-16px_rgba(15,23,42,0.4)] motion-reduce:transform-none ${
        clickable
          ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.07em] leading-tight text-slate-500">
          {label}
        </div>

        <div
          className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] border ${
            tones[tone] || tones.indigo
          }`}
        >
          <Icon size={15} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-2.5 font-display text-[19px] font-bold tracking-tight break-words tabular-nums text-slate-950">
        {value}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11.5px] leading-5 text-slate-400">
        <span className="min-w-0">{detail}</span>
        {clickable ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
            View
            <ArrowUpRight size={12} aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </Wrapper>
  );
}

// Compact stat tile (artifact ".stat" style) for the Expenses summary row:
// smaller than RevenueMetric, label + small tinted icon + value, no footer.
function StatCard({ label, value, icon: Icon, tone = "slate" }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
          {label}
        </div>

        <div
          className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border ${
            tones[tone] || tones.slate
          }`}
        >
          <Icon size={13} aria-hidden="true" />
        </div>
      </div>

      <div className="mt-2 font-display text-[18px] font-bold tracking-tight tabular-nums text-slate-950">
        {value}
      </div>
    </div>
  );
}

/* =========================================================
   Metric detail-page column presets + row helpers
========================================================= */

const ADMISSION_COLUMNS = [
  { key: "studentName", label: "Student", strong: true, render: (r) => r.studentName || "—" },
  { key: "college", label: "College", render: (r) => r.college || "—" },
  { key: "counsellorName", label: "Counsellor", render: (r) => r.counsellorName || "Unassigned" },
  { key: "totalFee", label: "Total fee", align: "right", render: (r) => money(r.totalFee) },
  { key: "paidAmount", label: "Received", align: "right", render: (r) => money(r.paidAmount) },
  { key: "pendingAmount", label: "Pending", align: "right", render: (r) => money(r.pendingAmount) },
];

const EXPENSE_COLUMNS = [
  { key: "title", label: "Title", strong: true, render: (r) => r.title || r.category || "—" },
  { key: "category", label: "Category", render: (r) => r.category || "—" },
  { key: "vendorName", label: "Vendor", render: (r) => r.vendorName || "—" },
  { key: "expenseDate", label: "Date", render: (r) => formatUiDate(r.expenseDate) },
  { key: "amount", label: "Amount", align: "right", render: (r) => money(r.amount) },
];

const INCENTIVE_COLUMNS = [
  { key: "employeeName", label: "Employee", strong: true, render: (r) => r.employeeName || "—" },
  { key: "title", label: "For", render: (r) => r.title || r.admission?.studentName || "—" },
  { key: "incentiveDate", label: "Date", render: (r) => formatUiDate(r.incentiveDate) },
  { key: "status", label: "Status", render: (r) => r.status || "—" },
  { key: "amount", label: "Amount", align: "right", render: (r) => money(r.amount) },
];

const RISK_COLUMNS = [
  { key: "studentName", label: "Student", strong: true, render: (r) => r.studentName || "—" },
  { key: "college", label: "College", render: (r) => r.college || "—" },
  { key: "counsellorName", label: "Counsellor", render: (r) => r.counsellorName || "Unassigned" },
  { key: "ageDays", label: "Age", align: "right", render: (r) => `${Number(r.ageDays || 0)} d` },
  { key: "pendingAmount", label: "Pending", align: "right", render: (r) => money(r.pendingAmount) },
];

const LEAD_COLUMNS = [
  { key: "leadName", label: "Lead", strong: true, render: (r) => r.leadName || r.studentName || "—" },
  { key: "assignedToName", label: "Owner", render: (r) => r.assignedToName || "Unassigned" },
  { key: "conversionChance", label: "Chance", render: (r) => r.conversionChance || "—" },
  { key: "score", label: "Score", align: "right", render: (r) => (r.score ?? "—") },
  { key: "nextBestAction", label: "Next best action", render: (r) => r.nextBestAction || "—" },
];

const PROFIT_COLUMNS = [
  { key: "label", label: "Component", strong: true, render: (r) => r.label },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    render: (r) => `${r.sign ? `${r.sign} ` : ""}${money(r.amount)}`,
  },
];

// Render one record as a <tr> for the shared DetailPage table, reusing a column
// preset (ADMISSION_COLUMNS, EXPENSE_COLUMNS, …) to decide cells. Status cells
// render as a Badge; the primary (strong) cell is bolded.
function renderDetailRow(cols, record, rowKey) {
  return (
    <tr key={rowKey}>
      {cols.map((c) => {
        const cellClass = `px-4 py-3 ${
          c.align === "right" ? "text-right tabular-nums " : ""
        }${c.strong ? "font-semibold text-slate-800" : "text-slate-700"}`;

        if (c.key === "status") {
          const status = record.status;
          return (
            <td key={c.key} className={cellClass}>
              {status ? (
                <Badge tone={statusTone(status)}>{status}</Badge>
              ) : (
                "—"
              )}
            </td>
          );
        }

        return (
          <td key={c.key} className={cellClass}>
            {c.render ? c.render(record) : record[c.key] ?? "—"}
          </td>
        );
      })}
    </tr>
  );
}

// Shared config for the four At-Risk Revenue categories, used both to render the
// cards/lists and to build their dedicated detail pages.
function buildRadarCategories(radar) {
  const safeRadar = radar || {};
  return [
    {
      key: "overdue",
      title: "Overdue Collections",
      subtitle: `Pending for ${safeRadar.rules?.overdueCollectionDays || 30}+ days`,
      data: safeRadar.overdueCollections || {},
      tone: "rose",
      icon: Clock,
    },
    {
      key: "pending",
      title: "Admissions with Pending Fee",
      subtitle: "Admissions where collection is still incomplete",
      data: safeRadar.pendingFees || {},
      tone: "amber",
      icon: CreditCard,
    },
    {
      key: "leads",
      title: "High-value Leads · No Follow-up",
      subtitle: "Hot / qualified / high-scoring leads without a next step",
      data: safeRadar.highValueNoFollowUp || {},
      tone: "indigo",
      icon: UserCheck,
    },
    {
      key: "stuck",
      title: "Revenue Stuck Too Long",
      subtitle: `Buffer revenue pending for ${safeRadar.rules?.stuckRevenueDays || 60}+ days`,
      data: safeRadar.stuckRevenue || {},
      tone: "slate",
      icon: AlertCircle,
    },
  ];
}

function LeakageRadarView({ radar, onOpenDetail }) {
  const safeRadar = radar || {};
  const summary = safeRadar.summary || {};

  const categories = buildRadarCategories(radar);

  const toneClass = {
    rose: "border-rose-100 bg-rose-50/60 text-rose-700",
    amber: "border-amber-100 bg-amber-50/60 text-amber-700",
    indigo: "border-indigo-100 bg-indigo-50/60 text-indigo-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  const openRisk = (cat) => onOpenDetail?.(`risk-${cat.key}`);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-rose-600">
              At-Risk Revenue
            </div>
            <h2 className="mt-1 text-[18px] font-bold text-slate-950">
              Money and opportunities that need attention
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              Uses existing admission, payment and lead activity to surface recovery priorities.
            </p>
          </div>

          <div className="w-full rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 sm:w-auto sm:min-w-[210px] sm:text-right">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-rose-500">
              Revenue at risk
            </div>
            <div className="mt-1 text-[24px] font-extrabold tracking-tight text-rose-700">
              {money(summary.atRiskAmount)}
            </div>
            <div className="mt-1 text-[12px] text-rose-600/80">
              {Number(summary.atRiskAdmissions || 0).toLocaleString("en-IN")} admission{Number(summary.atRiskAdmissions || 0) === 1 ? "" : "s"} need collection attention
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 native:grid-cols-2">
          {categories.map(({ key, title, subtitle, data, tone, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => openRisk({ key, title, subtitle, data })}
              className="group flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_24px_-16px_rgba(15,23,42,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-900">{title}</div>
                  <div className="mt-1 text-[12px] leading-5 text-slate-500">{subtitle}</div>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${toneClass[tone]}`}>
                  <Icon size={16} aria-hidden="true" />
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Cases</div>
                  <div className="mt-1 text-[22px] font-extrabold text-slate-950">{Number(data.count || 0).toLocaleString("en-IN")}</div>
                </div>
                {data.amount !== undefined ? (
                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Value</div>
                    <div className="mt-1 text-[15px] font-bold text-slate-800">{money(data.amount)}</div>
                  </div>
                ) : null}
              </div>

              <div className="mt-auto pt-3 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600">
                View all records
                <ArrowUpRight size={12} />
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {categories.map(({ key, title, subtitle, data }) => {
          const items = Array.isArray(data.items) ? data.items : [];
          const totalCount = Number(data.count || 0);
          return (
            <section key={`list-${key}`} className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
                  <p className="mt-0.5 text-[12px] text-slate-500">Top priority cases</p>
                </div>
                <button
                  type="button"
                  onClick={() => openRisk({ key, title, subtitle, data })}
                  className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                >
                  {totalCount.toLocaleString("en-IN")}
                </button>
              </div>

              {items.length ? (
                <div className="divide-y divide-slate-100">
                  {items.slice(0, 5).map((item) => (
                    <div key={`${key}-${item.id}`} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-slate-900">
                          {item.studentName || item.leadName || "—"}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          {key === "leads"
                            ? `${item.conversionChance || "—"} chance · Score ${item.score ?? "—"}`
                            : `${item.college || "College not set"} · ${item.ageDays || 0} days`}
                        </div>
                        {key === "leads" && item.nextBestAction ? (
                          <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-indigo-600">
                            {item.nextBestAction}
                          </div>
                        ) : null}
                      </div>

                      {item.pendingAmount !== undefined ? (
                        <div className="shrink-0 text-right text-[13px] font-bold text-slate-800">
                          {money(item.pendingAmount)}
                        </div>
                      ) : (
                        <div className="shrink-0 text-[11px] font-semibold text-slate-500">
                          {item.assignedToName || "Unassigned"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center text-[12px] text-slate-500">
                  No cases in this category.
                </div>
              )}

              {totalCount > 5 ? (
                <button
                  type="button"
                  onClick={() => openRisk({ key, title, subtitle, data })}
                  className="mt-auto flex w-full items-center justify-center gap-1 border-t border-slate-100 px-4 py-2.5 text-[12px] font-bold text-indigo-600 hover:bg-indigo-50"
                >
                  View all {totalCount.toLocaleString("en-IN")} cases
                  <ArrowUpRight size={13} />
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-5 text-slate-500">
        “Overdue” currently means pending for {safeRadar.rules?.overdueCollectionDays || 30}+ days, and “stuck” means Buffer revenue pending for {safeRadar.rules?.stuckRevenueDays || 60}+ days. If you later add an explicit fee due-date field, the radar can switch to that exact due date.
      </div>
    </div>
  );
}

export default function Revenue({
  selectedYear = "all",
  initialDashboardMetric = null,
  onInitialDashboardMetricApplied = null,
  initialDetail = null,
  onInitialDetailApplied = null,
  onOpenLead = null,
}) {
  const [tab, setTab] =
    useState("overview");

  // Overview KPI / at-risk card drill-down: clicking a card swaps the card grid
  // for a dedicated full page (shared DetailPage) showing ONLY that card's
  // records — no modal. `detailTriggerRef` captures the clicked card so focus
  // returns to it on Back.
  const [detailView, setDetailView] = useState(null);
  const detailTriggerRef = useRef(null);
  function openDetail(key) {
    detailTriggerRef.current =
      typeof document !== "undefined" ? document.activeElement : null;
    setDetailView(key);
  }

  const [data, setData] =
    useState({
      summary: {},
      monthlyRevenue: [],
      leakageRadar: null,
      expenses: [],
      incentives: [],
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // If access to the current section was removed, fall back to the first
  // section the viewer is still allowed to open.
  useEffect(() => {
    const allowed = data.allowedSections;
    if (
      allowed &&
      tab !== "collegeSlabs" &&
      tab !== "staffIncentives" &&
      ((tab === "leakage" && !allowed.overview) ||
        (tab !== "leakage" && !allowed[tab]))
    ) {
      const first = ["overview", "expenses"].find(
        (s) => allowed[s]
      );
      if (first) setTab(first);
    }
  }, [data.allowedSections, tab]);

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

  // Cross-module entry: the Dashboard's revenue KPI drill lands on the matching
  // dedicated detail page. Its keys (potential-revenue, received-revenue,
  // pending-revenue, current-profit) already match the KPI detail keys.
  useEffect(() => {
    const key = String(initialDashboardMetric || "").trim();
    if (!key) return;
    setTab("overview");
    openDetail(key);
    onInitialDashboardMetricApplied?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDashboardMetric]);

  // Cross-module entry: open a specific detail page by key on mount/update.
  useEffect(() => {
    const key = String(initialDetail || "").trim();
    if (!key) return;
    setTab("overview");
    openDetail(key);
    onInitialDetailApplied?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDetail]);

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

  // ---- Record sets powering the overview KPI drill-downs ----
  const admissionsBreakdown = Array.isArray(data.admissionsBreakdown)
    ? data.admissionsBreakdown
    : [];
  const expenseRecords = Array.isArray(data.expenses) ? data.expenses : [];
  const incentiveRecords = Array.isArray(data.incentives) ? data.incentives : [];

  const inBucketAdmissions = admissionsBreakdown.filter(
    (a) => a.revenueStatus === "IN_BUCKET"
  );
  const bufferAdmissions = admissionsBreakdown.filter(
    (a) => a.revenueStatus === "BUFFER_ZONE"
  );
  const receivedAdmissions = admissionsBreakdown
    .filter((a) => Number(a.paidAmount || 0) > 0)
    .slice()
    .sort((a, b) => Number(b.paidAmount || 0) - Number(a.paidAmount || 0));
  const pendingAdmissions = admissionsBreakdown
    .filter((a) => Number(a.pendingAmount || 0) > 0)
    .slice()
    .sort((a, b) => Number(b.pendingAmount || 0) - Number(a.pendingAmount || 0));
  const approvedExpenseRecords = expenseRecords.filter(
    (e) => e.status === "APPROVED"
  );

  const profitComponents = [
    { id: "received", label: "Received amount", amount: Number(summary.receivedAmount || 0), sign: "+" },
    { id: "expenses", label: "Approved expenses", amount: Number(summary.approvedExpenses || 0), sign: "−" },
    { id: "incentives", label: "Incentives paid", amount: Number(summary.totalIncentives || 0), sign: "−" },
    { id: "profit", label: "Current profit", amount: Number(summary.currentProfit || 0) },
  ];

  const detailData = detailView
    ? (() => {
      const colsOf = (defs) => defs.map((c) => c.label);
      const rowsOf = (defs, list) =>
        (Array.isArray(list) ? list : []).map((r, i) =>
          renderDetailRow(defs, r, r.id || `${detailView}-${i}`)
        );

      switch (detailView) {
        case "total-admissions":
          return {
            eyebrow: "Finance / Revenue",
            title: "Total Admissions",
            subtitle: "Every admission counted in revenue.",
            columns: colsOf(ADMISSION_COLUMNS),
            empty: "No admissions found.",
            rows: rowsOf(ADMISSION_COLUMNS, admissionsBreakdown),
          };
        case "potential-revenue":
          return {
            eyebrow: "Finance / Revenue",
            title: "Total Potential Revenue",
            subtitle: `Total potential revenue = sum of every admission's total fee = ${money(
              summary.potentialRevenue
            )}`,
            columns: colsOf(ADMISSION_COLUMNS),
            empty: "No admissions found.",
            rows: rowsOf(ADMISSION_COLUMNS, admissionsBreakdown),
          };
        case "in-bucket":
          return {
            eyebrow: "Finance / Revenue",
            title: "In Bucket Revenue",
            subtitle: `In-bucket revenue = total fee of admissions with status In Bucket = ${money(
              summary.inBucketRevenue
            )}`,
            columns: colsOf(ADMISSION_COLUMNS),
            empty: "No in-bucket admissions.",
            rows: rowsOf(ADMISSION_COLUMNS, inBucketAdmissions),
          };
        case "buffer":
          return {
            eyebrow: "Finance / Revenue",
            title: "Buffer Revenue",
            subtitle: `Buffer revenue = total fee of admissions with status Buffer = ${money(
              summary.bufferRevenue
            )}`,
            columns: colsOf(ADMISSION_COLUMNS),
            empty: "No buffer admissions.",
            rows: rowsOf(ADMISSION_COLUMNS, bufferAdmissions),
          };
        case "approved-expenses":
          return {
            eyebrow: "Finance / Revenue",
            title: "Approved Expenses",
            subtitle: "Expense records with status Approved.",
            columns: colsOf(EXPENSE_COLUMNS),
            empty: "No approved expenses.",
            rows: rowsOf(EXPENSE_COLUMNS, approvedExpenseRecords),
          };
        case "total-incentive":
          return {
            eyebrow: "Finance / Revenue",
            title: "Total Incentive Amount",
            subtitle: "Approved and paid employee incentives.",
            columns: colsOf(INCENTIVE_COLUMNS),
            empty: "No incentive records.",
            rows: rowsOf(INCENTIVE_COLUMNS, incentiveRecords),
          };
        case "received-revenue":
          return {
            eyebrow: "Finance / Revenue",
            title: "Received Amount",
            subtitle:
              "Admissions that have collected part or all of their fee.",
            columns: colsOf(ADMISSION_COLUMNS),
            empty: "No collections received yet.",
            rows: rowsOf(ADMISSION_COLUMNS, receivedAdmissions),
          };
        case "pending-revenue":
          return {
            eyebrow: "Finance / Revenue",
            title: "Pending Amount",
            subtitle: "Admissions with an outstanding balance.",
            columns: colsOf(ADMISSION_COLUMNS),
            empty: "No pending collections.",
            rows: rowsOf(ADMISSION_COLUMNS, pendingAdmissions),
          };
        case "current-profit":
          return {
            eyebrow: "Finance / Revenue",
            title: "Current Profit",
            subtitle: `Current Profit = Received amount − Approved expenses − Incentives paid = ${money(
              summary.currentProfit
            )}`,
            columns: colsOf(PROFIT_COLUMNS),
            empty: "No data.",
            rows: rowsOf(PROFIT_COLUMNS, profitComponents),
          };
        default: {
          if (detailView.startsWith("risk-")) {
            const catKey = detailView.slice(5);
            const cat = buildRadarCategories(data.leakageRadar).find(
              (c) => c.key === catKey
            );
            const defs = catKey === "leads" ? LEAD_COLUMNS : RISK_COLUMNS;
            const items = Array.isArray(cat?.data?.items)
              ? cat.data.items
              : [];
            return {
              eyebrow: "Finance / At-Risk Revenue",
              title: cat?.title || "At-risk records",
              subtitle: cat?.subtitle,
              columns: colsOf(defs),
              empty: "No cases in this category.",
              rows: rowsOf(defs, items),
            };
          }
          return null;
        }
      }
    })()
    : null;

  return (
    <div className="space-y-4">
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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
            aria-hidden="true"
            className={loading ? "animate-spin motion-reduce:animate-none" : ""}
          />
          Refresh data
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-[15px]">
          <AlertCircle size={15} aria-hidden="true" />
          {error}
        </div>
      )}

      {loading ? (
        <div role="status" aria-live="polite" className="bg-white border border-slate-200 rounded-xl p-14 flex items-center justify-center gap-2 text-[15px] text-slate-500">
          <Loader2
            size={16}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
          Loading revenue...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 native:grid-cols-2">
            <RevenueMetric
              label="Current Profit"
              value={money(summary.currentProfit)}
              icon={ArrowUpRight}
              detail="Received less approved expenses and incentives"
              onClick={() => openDetail("current-profit")}
            />

            <RevenueMetric
              label="Total Admissions"
              value={Number(summary.totalAdmissions || 0).toLocaleString("en-IN")}
              icon={UserCheck}
              detail="Admissions included in revenue"
              tone="slate"
              onClick={() => openDetail("total-admissions")}
            />

            <RevenueMetric
              label="Total Potential Revenue"
              value={money(summary.potentialRevenue)}
              icon={TrendingUp}
              detail="Total admission revenue value"
              tone="indigo"
              onClick={() => openDetail("potential-revenue")}
            />

            <RevenueMetric
              label="In Bucket Revenue"
              value={money(summary.inBucketRevenue)}
              icon={IndianRupee}
              detail="Admission value currently in bucket"
              tone="emerald"
              onClick={() => openDetail("in-bucket")}
            />

            <RevenueMetric
              label="Buffer Revenue"
              value={money(summary.bufferRevenue)}
              icon={Clock}
              detail="Admission value currently classified as buffer revenue"
              tone="amber"
              onClick={() => openDetail("buffer")}
            />

            <RevenueMetric
              label="Approved Expenses"
              value={money(summary.approvedExpenses)}
              icon={Receipt}
              detail="Approved operating costs"
              tone="rose"
              onClick={() => openDetail("approved-expenses")}
            />

            <RevenueMetric
              label="Total Incentive Amount"
              value={money(summary.totalIncentives)}
              icon={Award}
              detail="Approved and paid employee incentives"
              tone="slate"
              onClick={() => openDetail("total-incentive")}
            />

            <RevenueMetric
              label="Received Amount"
              value={money(summary.receivedAmount)}
              icon={IndianRupee}
              detail="Collections received"
              tone="emerald"
              onClick={() => openDetail("received-revenue")}
            />

            <RevenueMetric
              label="Pending Amount"
              value={money(summary.pendingAmount)}
              icon={Clock}
              detail="Outstanding collections"
              tone="amber"
              onClick={() => openDetail("pending-revenue")}
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-wrap gap-1 native:flex-nowrap native:max-w-full native:relative native:overflow-x-auto native:[-webkit-overflow-scrolling:touch]">
            {[
              ["overview", "Overview"],
              ["leakage", "At-Risk Revenue"],
              ["expenses", "Expenses"],
              ["collegeSlabs", "College Revenue / College Slab"],
              ["staffIncentives", "Employee Incentives"],
            ]
              .filter(
                ([item]) =>
                  item === "collegeSlabs" ||
                  item === "staffIncentives" ||
                  !data.allowedSections ||
                  (item === "leakage"
                    ? data.allowedSections.overview
                    : data.allowedSections[item])
              )
              .map(([item, label]) => (
              <button
                key={item}
                type="button"
                aria-pressed={tab === item}
                onClick={() => setTab(item)}
                className={`h-8 px-3 rounded-lg text-[13px] font-semibold transition-colors native:shrink-0 native:whitespace-nowrap native:focus-visible:outline-none native:focus-visible:ring-2 native:focus-visible:ring-inset native:focus-visible:ring-indigo-500 ${
                  tab === item
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-indigo-700 hover:bg-indigo-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "leakage" && (
            <LeakageRadarView
              radar={data.leakageRadar}
              onOpenDetail={openDetail}
            />
          )}

          {tab ===
            "overview" && (
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <h2 className="font-semibold text-[15px] text-slate-900 mb-1">
                  Monthly Revenue
                </h2>

                <div className="text-[13px] text-slate-500 mb-5">
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
                    <ComposedChart
                      accessibilityLayer
                      data={
                        data.monthlyRevenue
                      }
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="revReceivedFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>

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
                        stroke="#94a3b8"
                        strokeWidth={1.75}
                        strokeDasharray="5 5"
                        dot={false}
                      />

                      <Area
                        type="monotone"
                        dataKey="received"
                        name="Received"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#revReceivedFill)"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className="sr-only">
                <table>
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
                    {(data.monthlyRevenue || []).map((row, index) => (
                      <tr key={index}>
                        <th scope="row">{row.m}</th>
                        <td>{money(row.potential)}</td>
                        <td>{money(row.received)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <h2 className="font-semibold text-[15px] text-slate-900 mb-1">
                  Breakdown
                </h2>

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

                  <div className="mt-1 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="font-semibold text-slate-900">
                      Current Profit
                    </span>
                    <span className="font-display text-[20px] font-bold tabular-nums text-emerald-600">
                      {money(summary.currentProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab ===
            "expenses" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 native:grid-cols-2">
                <StatCard
                  label="Total Expenses"
                  value={money(expenseStats.total)}
                  icon={Receipt}
                  tone="slate"
                />

                <StatCard
                  label="Pending Approval"
                  value={money(expenseStats.pending)}
                  icon={Clock}
                  tone="amber"
                />

                <StatCard
                  label="Approved"
                  value={money(expenseStats.approved)}
                  icon={CheckCircle2}
                  tone="emerald"
                />

                <StatCard
                  label="Rejected"
                  value={money(expenseStats.rejected)}
                  icon={XCircle}
                  tone="rose"
                />

                <StatCard
                  label="This Month"
                  value={money(expenseStats.thisMonth)}
                  icon={CalendarDays}
                  tone="indigo"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
                  <h3 className="text-[13px] font-bold text-slate-900">
                    Expense Claims
                    <span className="ml-2 text-[12px] font-semibold text-slate-400">
                      {filteredExpenses.length} shown
                    </span>
                  </h3>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportExpenses}
                      disabled={!filteredExpenses.length}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download size={14} aria-hidden="true" />
                      Export
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowExpense(true)}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                    >
                      <Plus size={14} aria-hidden="true" />
                      Add Expense
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:grid-cols-[minmax(180px,1fr)_160px_170px] native:relative native:flex native:flex-nowrap native:items-center native:gap-2 native:max-w-full native:overflow-x-auto">
                  <label className="relative min-w-0 native:w-[220px] native:shrink-0">
                    <span className="sr-only">Search expenses</span>
                    <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={expenseSearch}
                      onChange={(event) => setExpenseSearch(event.target.value)}
                      placeholder="Search expense, vendor, invoice, employee..."
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[14px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </label>

                  <label className="min-w-0 native:w-[150px] native:shrink-0">
                    <span className="sr-only">Filter by status</span>
                    <select
                      value={expenseStatusFilter}
                      onChange={(event) => setExpenseStatusFilter(event.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="ALL">All Status</option>
                      <option value="PENDING">Pending</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </label>

                  <label className="min-w-0 native:w-[160px] native:shrink-0">
                    <span className="sr-only">Filter by category</span>
                    <select
                      value={expenseCategoryFilter}
                      onChange={(event) => setExpenseCategoryFilter(event.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="ALL">All Categories</option>
                      {expenseCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <caption className="sr-only">
                      Expense claims
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
                          Vendor
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
                                  <FileText size={13} aria-hidden="true" />
                                  View
                                  <span className="sr-only"> (opens in new tab)</span>
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
                                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  title="View details"
                                  aria-label="View expense details"
                                >
                                  <Eye size={14} aria-hidden="true" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExpense(expense);
                                    setShowExpense(true);
                                  }}
                                  className="w-8 h-8 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  title="Edit expense"
                                  aria-label="Edit expense"
                                >
                                  <Pencil size={14} aria-hidden="true" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    deleteExpense(expense)
                                  }
                                  className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                  title="Delete expense"
                                  aria-label="Delete expense"
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
                                      className="w-8 h-8 rounded-lg border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                      title="Approve"
                                      aria-label="Approve expense"
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
                                      className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                      title="Reject"
                                      aria-label="Reject expense"
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
                            colSpan={8}
                            className="p-12 text-center"
                          >
                            <div className="w-11 h-11 mx-auto rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                              <Receipt size={18} aria-hidden="true" />
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
                  className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[13px] font-semibold inline-flex items-center gap-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add Incentive
                </button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <table className="w-full text-[13px]">
                  <caption className="sr-only">
                    Employee incentives
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
                                className="w-8 h-8 rounded-lg border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                title="Edit incentive"
                                aria-label="Edit incentive"
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteIncentive(incentive)
                                }
                                className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                title="Delete incentive"
                                aria-label="Delete incentive"
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
                                    className="w-8 h-8 rounded-lg border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    title="Approve"
                                    aria-label="Approve incentive"
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
                                    className="w-8 h-8 rounded-lg border border-rose-100 bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    title="Reject"
                                    aria-label="Reject incentive"
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
                                  className="h-8 px-2.5 text-[13px] font-semibold bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 rounded-lg inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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

      <span className="font-display tabular-nums">{value}</span>
    </div>
  );
}
