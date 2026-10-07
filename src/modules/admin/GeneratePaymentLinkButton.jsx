import { useState } from "react";
import { apiRequest } from "../../lib/api";

/**
 * Drop-in Super Admin button: generates a Razorpay payment link for a client
 * and shows it with a Copy button. Render it anywhere you have the client id:
 *
 *   <GeneratePaymentLinkButton companyId={client.id} planKey={client.planKey} />
 *
 * planKey is optional — if omitted, the client's current subscription plan is used.
 */
export default function GeneratePaymentLinkButton({ companyId, planKey }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await apiRequest("/api/admin/payment-links", {
        method: "POST",
        body: JSON.stringify({ companyId, ...(planKey ? { planKey } : {}) }),
      });
      setResult(data);
    } catch (err) {
      setError(err?.data?.message || err.message || "Could not generate link");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; user can select manually */
    }
  }

  return (
    <div className="inline-flex flex-col gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-indigo-600 text-indigo-600 hover:bg-indigo-50 disabled:opacity-60 text-sm font-semibold px-3 py-2 transition"
      >
        {loading ? "Generating…" : "Generate payment link"}
      </button>

      {error && <span className="text-xs text-red-600">{error}</span>}

      {result && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 w-full max-w-sm">
          <div className="text-xs text-slate-500 mb-1">
            {result.plan?.name} · ₹
            {Number(result.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            {" "}· expires in {result.expiresInDays} days
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={result.payUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700"
            />
            <button
              type="button"
              onClick={copy}
              className="text-xs font-semibold rounded bg-indigo-600 text-white px-2 py-1 hover:bg-indigo-700"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
