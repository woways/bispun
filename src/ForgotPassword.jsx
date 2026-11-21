import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { apiRequest } from "./lib/api";
import bispunLogo from "./assets/bispun-logo.svg";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      await apiRequest("/api/client/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setLoading(false);
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-7">
        <Link to="/login" className="inline-flex items-center gap-2">
          <img
            src={bispunLogo}
            alt="Bispun"
            className="h-10 w-auto rounded-lg object-contain shadow-sm ring-1 ring-slate-200/60"
          />
        </Link>
      </div>

      <div className="w-full max-w-[440px] rounded-2xl border border-slate-200 bg-white px-7 py-8 shadow-[0_2px_8px_rgba(15,23,42,0.04)] sm:px-9">
        {sent ? (
          <>
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} strokeWidth={1.8} />
              </div>
            </div>
            <h1 className="text-center text-[20px] font-bold tracking-[-0.02em] text-slate-900">
              Check your email
            </h1>
            <p className="mt-2 text-center text-[13px] leading-5 text-slate-500">
              If an account exists for <strong className="text-slate-700">{email}</strong>, you'll receive a password reset link shortly.
            </p>
            <Link
              to="/login"
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[13px] font-semibold text-white hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Login
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[20px] font-bold tracking-[-0.02em] text-slate-900">
              Forgot your password?
            </h1>
            <p className="mt-2 text-[13px] leading-5 text-slate-500">
              Enter the email you sign in with and we'll send you a link to choose a new one.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <div className="mb-1.5 text-[13px] font-semibold text-slate-700">
                  Email
                </div>
                <input
                  type="email"
                  required
                  disabled={loading}
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-[14px] text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-[14px] font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="mt-5 text-[13px] text-slate-500">
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1">
          <ArrowLeft size={13} />
          Back to Login
        </Link>
      </p>
    </div>
  );
}
