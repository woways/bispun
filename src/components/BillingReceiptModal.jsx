import { CheckCircle2, Loader2 } from "lucide-react";

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
    const receiptNode = document.getElementById("bispun-admin-payment-receipt");
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
            @page { size: A4; margin: 6mm; }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
            #bispun-admin-payment-receipt {
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
              setTimeout(function () { window.print(); }, 500);
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="fixed inset-0 z-[140] overflow-y-auto bg-slate-950/70 p-2 backdrop-blur-[3px] sm:p-3">
      <div className="mx-auto max-w-[780px]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl border border-white/20 bg-white/10 px-4 text-xs font-semibold text-white shadow-sm hover:bg-white/15"
          >
            Close
          </button>

          <button
            type="button"
            onClick={printReceipt}
            disabled={!receipt || loading}
            className="h-10 rounded-xl bg-white px-5 text-xs font-bold text-slate-950 shadow-sm disabled:opacity-50"
          >
            Print / Save PDF
          </button>

          <button
            type="button"
            onClick={() => receipt && downloadInvoicePdf(receipt)}
            disabled={!receipt || loading}
            className="h-10 rounded-xl bg-indigo-600 px-5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            Download PDF invoice
          </button>
        </div>

        <div
          id="bispun-admin-payment-receipt"
          className="overflow-hidden rounded-[24px] bg-white shadow-2xl"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading receipt...
            </div>
          ) : receipt ? (
            <>
              <div className="border-b border-slate-100 px-6 pb-5 pt-6 sm:px-8">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <img src={bispunLogo} alt="Bispun" className="h-11 w-auto object-contain" />
                      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        CRM Subscription
                      </div>
                    </div>

                    <div className="mt-5 text-[13px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Payment Receipt
                    </div>
                    <div className="mt-1.5 text-[25px] font-black leading-none tracking-[-0.045em] text-slate-950 sm:text-[30px]">
                      {formatMoney(receipt.finalAmount ?? receipt.amount)}
                    </div>
                    <div className="mt-1.5 text-[12px] font-semibold text-emerald-600">
                      Payment successful
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                      <CheckCircle2 size={12} /> Paid
                    </div>
                    <div className="mt-3 text-[13px] text-slate-400">Receipt No.</div>
                    <div className="mt-1 max-w-[220px] break-all text-xs font-bold text-slate-800">
                      {receipt.receiptNumber || receipt.id}
                    </div>
                    <div className="mt-2 text-[13px] text-slate-400">Payment Date</div>
                    <div className="mt-1 text-xs font-semibold text-slate-700">
                      {formatDate(receipt.paidAt || receipt.createdAt)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 sm:px-8">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">Billed To</div>
                    <div className="mt-3 text-sm font-bold text-slate-950">
                      {receipt.company?.brandName || receipt.company?.name || "—"}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {receipt.company?.email || "—"}<br />
                      {receipt.company?.phone || ""}
                      {receipt.company?.city ? ` · ${receipt.company.city}` : ""}
                    </div>
                  </div>

                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">Subscription</div>
                    <div className="mt-3 text-sm font-bold text-slate-950">
                      {receipt.plan?.name || "Bispun"} Plan
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      Annual Billing<br />
                      Renewal: {formatDate(receipt.subscription?.renewalDate)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[1fr_auto] bg-slate-50 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    <div>Description</div><div>Amount</div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] border-t border-slate-100 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Bispun {receipt.plan?.name || "Subscription"} Plan</div>
                      <div className="mt-1 text-[13px] text-slate-500">Annual CRM subscription</div>
                    </div>
                    <div className="text-sm font-bold text-slate-950">{formatMoney(receipt.listPrice ?? receipt.amount)}</div>
                  </div>

                  <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Original Price</span>
                      <span className="font-semibold text-slate-800">{formatMoney(receipt.listPrice ?? receipt.amount)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Discount</span>
                      <span className={Number(receipt.discountAmount || 0) > 0 ? "font-semibold text-rose-600" : "font-semibold text-slate-500"}>
                        {Number(receipt.discountAmount || 0) > 0 ? `− ${formatMoney(receipt.discountAmount)}` : "No discount"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-slate-800">{formatMoney(receipt.subtotal)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-500">GST ({Number(receipt.gstRate ?? 18)}%)</span>
                      <span className="font-semibold text-slate-800">{formatMoney(receipt.gstAmount)}</span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-200 pt-3">
                      <span className="text-sm font-bold text-slate-950">Total Paid</span>
                      <span className="text-[19px] font-black tracking-tight text-slate-950">{formatMoney(receipt.finalAmount ?? receipt.amount)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-400">Payment Details</div>
                  <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    {[
                      ["Payment Method", "Razorpay"],
                      ["Currency", receipt.currency || "INR"],
                      ["Payment ID", receipt.providerPaymentId || "—"],
                      ["Order ID", receipt.providerOrderId || "—"],
                      ["Status", receipt.status || "CAPTURED"],
                      ["Billing Cycle", "Annual"],
                    ].map(([label, value]) => (
                      <div key={label} className="border-b border-slate-100 pb-2">
                        <div className="text-[12px] text-slate-400">{label}</div>
                        <div className="mt-1 break-all text-xs font-semibold text-slate-800">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900">Thank you for choosing Bispun.</div>
                    <div className="mt-1 text-[13px] text-slate-500">This receipt confirms successful payment for your CRM subscription.</div>
                  </div>
                  <div className="text-[12px] text-slate-400 sm:text-right">
                    Bispun CRM<br />Subscription Receipt<br />
                    <span className="font-semibold text-slate-600">WOWAYS PRIVATE LIMITED</span>
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
