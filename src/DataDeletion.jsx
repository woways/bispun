import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { apiRequest } from "./lib/api";

// Public (unauthenticated) account/data deletion request page.
// URL: /data-deletion  — this is the link provided to Google Play Console.
// It only submits a request; it never deletes data.
export default function DataDeletion() {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState("");

  const emailRef = useRef(null);
  const confirmHeadingRef = useRef(null);

  useEffect(() => {
    const prev = document.title;
    document.title = "Request account deletion — BISPUN";
    return () => {
      document.title = prev;
    };
  }, []);

  useEffect(() => {
    if (done && confirmHeadingRef.current) {
      confirmHeadingRef.current.focus();
    }
  }, [done]);

  function validate() {
    const value = email.trim();
    if (!value) return "Email is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    const err = validate();
    setEmailError(err);
    if (err) {
      emailRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiRequest("/api/public/data-deletion", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() }),
      });
      if (result && result.success) {
        setDone(true);
      } else {
        setFormError(result?.message || "Something went wrong. Please try again.");
      }
    } catch {
      setFormError("We couldn't submit your request right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <header className="mx-auto max-w-2xl px-4 pt-10">
        <span className="text-2xl font-extrabold tracking-tight text-indigo-700">BISPUN</span>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {done ? (
          <section aria-labelledby="dd-confirm-heading">
            <h1
              id="dd-confirm-heading"
              ref={confirmHeadingRef}
              tabIndex={-1}
              className="text-2xl font-bold outline-none"
            >
              Request received
            </h1>
            {/* role=status so screen readers announce the outcome */}
            <p role="status" className="mt-4 text-slate-700">
              If an account matches this email, we&apos;ve received your deletion request and
              will process it within 30 days. We may contact you to verify ownership.
            </p>
          </section>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Request account deletion</h1>
            <p className="mt-3 text-slate-700">
              Use this form to request deletion of your Bispun account and associated personal
              data. Submitting a request does not immediately delete anything — our team
              verifies ownership and processes it.
            </p>

            <h2 className="mt-6 text-base font-semibold">What is deleted</h2>
            <p className="mt-1 text-sm text-slate-600">
              Your personal profile and login credentials, and your access to the app.
            </p>
            <h2 className="mt-4 text-base font-semibold">What is retained</h2>
            <p className="mt-1 text-sm text-slate-600">
              Records we are legally required to keep (billing/payment history and audit logs)
              are retained for the period required by law and then deleted. Company-owned CRM
              data created for your organization may be retained by your organization&apos;s
              administrator.
            </p>
            <h2 className="mt-4 text-base font-semibold">Processing time</h2>
            <p className="mt-1 text-sm text-slate-600">Requests are processed within 30 days.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
              <p className="text-xs text-slate-500">
                <span aria-hidden="true">*</span> required
              </p>

              <div>
                <label htmlFor="dd-email" className="block text-sm font-semibold">
                  Work email <span aria-hidden="true" className="text-rose-600">*</span>
                </label>
                <input
                  id="dd-email"
                  ref={emailRef}
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  aria-invalid={emailError ? "true" : undefined}
                  aria-describedby={emailError ? "dd-email-error" : undefined}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="you@example.com"
                />
                {emailError ? (
                  <p id="dd-email-error" role="alert" className="mt-1 text-sm text-rose-700">
                    {emailError}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor="dd-reason" className="block text-sm font-semibold">
                  Reason (optional)
                </label>
                <textarea
                  id="dd-reason"
                  rows={4}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  placeholder="Tell us anything that helps us process your request"
                />
              </div>

              {/* Pre-mounted live region for async failures (empty until needed) */}
              <div role="alert" aria-live="assertive" className="min-h-[1.25rem] text-sm text-rose-700">
                {formError}
              </div>

              <button
                type="submit"
                disabled={submitting}
                aria-busy={submitting ? "true" : undefined}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
                {submitting ? "Submitting…" : "Submit request"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
