import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { apiRequest } from "../../lib/api";

// In-app "Request account deletion" for authenticated users.
// Uses a native <dialog> (auto focus-trap + Escape). Records a request only;
// it does not delete data. POSTs to /api/client/account/deletion-request.
export default function AccountDeletionSection() {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  const cancelRef = useRef(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  function open() {
    setError("");
    setStatus("");
    const dlg = dialogRef.current;
    if (dlg && typeof dlg.showModal === "function") {
      dlg.showModal();
      // Initial focus on the safe (Cancel) control, not the destructive one.
      requestAnimationFrame(() => cancelRef.current?.focus());
    }
  }

  function close() {
    const dlg = dialogRef.current;
    if (dlg && dlg.open) dlg.close();
    // Native <dialog> does not reliably restore focus to the trigger — do it.
    triggerRef.current?.focus();
  }

  async function confirm() {
    setSubmitting(true);
    setError("");
    try {
      const result = await apiRequest("/api/client/account/deletion-request", {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (result && result.success) {
        setStatus(result.message || "Your account deletion request has been recorded.");
        close();
      } else {
        setError(result?.message || "Something went wrong. Please try again.");
      }
    } catch {
      setError("We couldn't submit your request right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="acct-deletion-heading" className="mt-6">
      <h3 id="acct-deletion-heading" className="text-sm font-semibold text-slate-900">
        Account deletion
      </h3>
      <p className="mt-1 text-sm text-slate-600">
        Request deletion of your account and personal data. Legally required billing and
        audit records are retained for the period required by law.
      </p>

      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className="mt-3 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
      >
        Request account deletion
      </button>

      {/* Pre-mounted status region so the outcome is announced */}
      <p role="status" aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm text-emerald-700">
        {status}
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby="acct-del-dialog-title"
        aria-describedby="acct-del-dialog-desc"
        className="rounded-xl p-0 backdrop:bg-slate-900/40"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <div className="w-[min(92vw,420px)] p-5">
          <h2 id="acct-del-dialog-title" className="text-lg font-bold text-slate-900">
            Request account deletion?
          </h2>
          <p id="acct-del-dialog-desc" className="mt-2 text-sm text-slate-600">
            This sends a request to delete your account and personal data. Your access will be
            revoked once processed (within 30 days). This cannot be undone once completed.
          </p>

          <label htmlFor="acct-del-reason" className="mt-4 block text-sm font-semibold">
            Reason (optional)
          </label>
          <textarea
            id="acct-del-reason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          />

          <div role="alert" aria-live="assertive" className="mt-2 min-h-[1.25rem] text-sm text-rose-700">
            {error}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={close}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={submitting}
              aria-busy={submitting ? "true" : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
              {submitting ? "Submitting…" : "Request deletion"}
            </button>
          </div>
        </div>
      </dialog>
    </section>
  );
}
