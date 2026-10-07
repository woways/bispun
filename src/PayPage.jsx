import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiRequest } from "./lib/api";
import { downloadInvoicePdf } from "./lib/invoicePdf";

const inr = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function loadRazorpayCheckout() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector('script[data-bispun-razorpay="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Unable to load Razorpay")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.bispunRazorpay = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Razorpay"));
    document.body.appendChild(script);
  });
}

export default function PayPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiRequest(`/api/public/pay/${token}`);
        if (!active) return;
        if (data.paid && data.receipt) setReceipt(data.receipt);
        else setInfo(data);
      } catch (err) {
        if (active) setError(err?.data?.message || err.message || "This link is invalid or expired");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  async function pay() {
    if (!info) return;
    setProcessing(true);
    setError("");
    try {
      await loadRazorpayCheckout();
      const rzp = new window.Razorpay({
        key: info.keyId,
        amount: info.order.amount,
        currency: info.order.currency,
        name: "Bispun",
        description: `${info.plan?.name || "Subscription"} annual subscription`,
        order_id: info.order.id,
        prefill: info.prefill || {},
        notes: { company: info.company?.name || "" },
        theme: { color: "#4f46e5" },
        handler: async (response) => {
          try {
            const verified = await apiRequest(`/api/public/pay/${token}/verify`, {
              method: "POST",
              body: JSON.stringify(response),
            });
            if (verified.receipt) setReceipt(verified.receipt);
            else setError(verified.message || "Payment received; activating shortly.");
          } catch (err) {
            setError(err?.data?.message || err.message || "Could not verify payment");
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setProcessing(false),
        },
      });
      rzp.on("payment.failed", (resp) => {
        setError(resp?.error?.description || "Payment failed. Please try again.");
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      setError(err.message || "Unable to start payment");
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="text-2xl font-bold text-indigo-600 mb-1">Bispun</div>

        {loading && <p className="text-slate-500 text-sm mt-6">Loading payment…</p>}

        {!loading && error && !receipt && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
            {error}
          </div>
        )}

        {/* Payment required */}
        {!loading && info && !receipt && (
          <>
            <p className="text-slate-500 text-sm">Complete your subscription payment</p>
            <div className="mt-5 rounded-xl border border-slate-200 divide-y divide-slate-100">
              <Row label={`${info.plan?.name || "Plan"} (Annual)`} value={inr(info.breakdown.listPrice)} />
              {Number(info.breakdown.discount) > 0 && (
                <Row label="Discount" value={"- " + inr(info.breakdown.discount)} />
              )}
              <Row label="Subtotal" value={inr(info.breakdown.subtotal)} />
              {Number(info.breakdown.gstAmount) > 0 && (
                <Row label={`GST (${info.breakdown.gstRate}%)`} value={inr(info.breakdown.gstAmount)} />
              )}
              <Row label="Total payable" value={inr(info.breakdown.finalAmount)} bold />
            </div>

            <button
              onClick={pay}
              disabled={processing}
              className="mt-5 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold py-3 transition"
            >
              {processing ? "Opening…" : `Pay ${inr(info.breakdown.finalAmount)}`}
            </button>
            <p className="text-[11px] text-slate-400 mt-3 text-center">
              Secured by Razorpay · UPI, cards, net-banking & wallets
            </p>
          </>
        )}

        {/* Success */}
        {!loading && receipt && (
          <>
            <div className="mt-4 flex items-center gap-2 text-green-600 font-semibold">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100">✓</span>
              Payment successful
            </div>
            <p className="text-slate-500 text-sm mt-1">
              {receipt.plan?.name} subscription is now active.
            </p>
            <div className="mt-5 rounded-xl border border-slate-200 divide-y divide-slate-100">
              <Row label="Invoice" value={receipt.receiptNumber || receipt.id} />
              <Row label="Subtotal" value={inr(receipt.subtotal)} />
              {Number(receipt.gstAmount) > 0 && (
                <Row label={`GST (${receipt.gstRate}%)`} value={inr(receipt.gstAmount)} />
              )}
              <Row label="Total paid" value={inr(receipt.finalAmount != null ? receipt.finalAmount : receipt.amount)} bold />
            </div>
            <button
              onClick={() => downloadInvoicePdf(receipt)}
              className="mt-5 w-full rounded-xl border border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-3 transition"
            >
              Download PDF invoice
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className={`text-sm ${bold ? "font-semibold text-slate-800" : "text-slate-500"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-slate-900" : "text-slate-700"}`}>{value}</span>
    </div>
  );
}
