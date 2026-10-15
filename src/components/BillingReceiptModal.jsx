import {
  CheckCircle2,
  Crown,
  Download,
  FileText,
  Link2,
  Loader2,
  Printer,
  UserRound,
} from "lucide-react";

import bispunLogo from "../assets/bispun-logo.svg";
import { downloadInvoicePdf } from "../lib/invoicePdf";

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BillingReceiptModal({
  open,
  loading,
  receipt,
  onClose,
  onError,
}) {
  if (!open) return null;

  function printReceipt() {
    const receiptNode = document.getElementById("bispun-payment-receipt");
    if (!receiptNode) return;

    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) {
      onError?.("Please allow pop-ups to print the receipt.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bispun Payment Receipt</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: A4; margin: 8mm; }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
            #bispun-payment-receipt {
              width: 100%;
              max-width: 794px;
              margin: 0 auto;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
          </style>
        </head>
        <body>
          ${receiptNode.outerHTML}
          <script>
            window.addEventListener("load", function () {
              setTimeout(function () { window.print(); }, 400);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  const listPrice = Number(
    receipt?.listPrice ?? receipt?.subtotal ?? receipt?.amount ?? 0
  );
  const discount = Number(receipt?.discountAmount || 0);
  const subtotal = Number(
    receipt?.subtotal ?? Math.max(0, listPrice - discount)
  );
  const gst = Number(receipt?.gstAmount || 0);
  const paidAmount = Number(
    receipt?.finalAmount ?? receipt?.amount ?? subtotal + gst
  );
  const gstRate = Number(receipt?.gstRate ?? (gst > 0 ? 18 : 0));

  return (
    <div className="fixed inset-0 z-[140] overflow-y-auto bg-slate-950/70 p-2 backdrop-blur-[3px] sm:p-4">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/15"
          >
            Close
          </button>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={printReceipt}
              disabled={!receipt || loading}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-slate-950 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <Printer size={17} />
              Print / Save PDF
            </button>

            <button
              type="button"
              onClick={() => receipt && downloadInvoicePdf(receipt)}
              disabled={!receipt || loading}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Download size={17} />
              Download PDF invoice
            </button>
          </div>
        </div>

        <div
          id="bispun-payment-receipt"
          className="overflow-hidden rounded-[26px] bg-white shadow-2xl"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-28 text-sm text-slate-500">
              <Loader2 size={17} className="animate-spin" />
              Loading receipt...
            </div>
          ) : receipt ? (
            <>
              <div className="border-b border-slate-100 px-6 py-7 sm:px-9 sm:py-8">
                <div className="grid gap-6 md:grid-cols-[1fr_1.35fr_1fr] md:items-start">
                  <div className="min-w-0">
                    <img
                      src={bispunLogo}
                      alt="Bispun"
                      className="h-12 w-auto max-w-[190px] object-contain object-left"
                    />
                    <div className="mt-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      CRM Subscription
                    </div>
                  </div>

                  <div className="text-left md:text-center">
                    <h2 className="text-[30px] font-black leading-none tracking-[-0.045em] text-slate-950 sm:text-[34px]">
                      Payment Receipt
                    </h2>
                    <p className="mt-3 text-[13px] leading-5 text-slate-500">
                      Thank you for your payment. Your subscription is active.
                    </p>
                  </div>

                  <div className="md:text-right">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                      <CheckCircle2 size={14} /> Paid
                    </div>

                    <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] md:grid-cols-1 md:gap-y-0.5">
                      <span className="text-slate-400">Receipt No.</span>
                      <span className="break-all font-semibold text-slate-700 md:ml-auto md:max-w-[230px]">
                        {receipt.receiptNumber || receipt.id}
                      </span>
                      <span className="mt-2 text-slate-400">Payment Date</span>
                      <span className="font-semibold text-slate-700">
                        {formatDate(receipt.paidAt || receipt.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-9 sm:py-7">
                <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/55 md:grid-cols-2">
                  <div className="flex gap-4 p-5 sm:p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <UserRound size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        Billed To
                      </div>
                      <div className="mt-2 text-[16px] font-bold text-slate-950">
                        {receipt.company?.brandName || receipt.company?.name || "—"}
                      </div>
                      <div className="mt-1 text-[13px] leading-5 text-slate-500">
                        {receipt.company?.email || "—"}
                        {(receipt.company?.phone || receipt.company?.city) ? (
                          <>
                            <br />
                            {[receipt.company?.phone, receipt.company?.city]
                              .filter(Boolean)
                              .join(" · ")}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 border-t border-slate-200 p-5 sm:p-6 md:border-l md:border-t-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                      <Crown size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        Subscription
                      </div>
                      <div className="mt-2 text-[16px] font-bold text-slate-950">
                        {receipt.plan?.name || "Bispun"} Plan
                      </div>
                      <div className="mt-1 text-[13px] leading-5 text-slate-500">
                        Annual Billing
                        {receipt.subscription?.renewalDate ? (
                          <> · Renews {formatDate(receipt.subscription.renewalDate)}</>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <FileText size={16} />
                    </div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Payment Summary
                    </div>
                  </div>

                  <div className="px-5 py-4 text-[13px] sm:px-6">
                    <div className="flex items-center justify-between gap-4 py-1.5">
                      <span className="text-slate-500">Plan price</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(listPrice)}
                      </span>
                    </div>

                    {discount > 0 ? (
                      <div className="flex items-center justify-between gap-4 py-1.5">
                        <span className="text-slate-500">Discount</span>
                        <span className="font-semibold text-rose-600">
                          − {formatMoney(discount)}
                        </span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between gap-4 py-1.5">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(subtotal)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-1.5">
                      <span className="text-slate-500">GST ({gstRate}%)</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(gst)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-indigo-50/70 px-4 py-3.5">
                      <span className="text-[15px] font-black text-slate-950">
                        Total Paid
                      </span>
                      <span className="text-[25px] font-black tracking-[-0.035em] text-indigo-700">
                        {formatMoney(paidAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/65 px-5 py-3.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <Link2 size={16} />
                    </div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Payment Reference
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3">
                    <div className="p-4 sm:p-5">
                      <div className="text-[12px] text-slate-400">Method</div>
                      <div className="mt-1 text-[13px] font-semibold text-slate-800">
                        Razorpay
                      </div>
                    </div>
                    <div className="border-t border-slate-100 p-4 sm:border-l sm:border-t-0 sm:p-5">
                      <div className="text-[12px] text-slate-400">Payment ID</div>
                      <div className="mt-1 break-all font-mono text-[12px] font-semibold text-slate-700">
                        {receipt.providerPaymentId || "—"}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 p-4 sm:border-l sm:border-t-0 sm:p-5">
                      <div className="text-[12px] text-slate-400">Order ID</div>
                      <div className="mt-1 break-all font-mono text-[12px] font-semibold text-slate-700">
                        {receipt.providerOrderId || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[13px] text-slate-500">
                    Thank you for choosing{" "}
                    <span className="font-semibold text-slate-900">Bispun.</span>
                  </div>
                  <div className="text-[12px] font-semibold text-slate-500 sm:text-right">
                    A Product of WOWAYS PRIVATE LIMITED
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
