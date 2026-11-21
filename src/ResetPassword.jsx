import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { apiRequest } from "./lib/api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("/api/client/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, token, newPassword: password }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err?.data?.message || "Unable to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 text-center shadow-xl">
          <XCircle size={40} className="mx-auto text-rose-500 mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invalid Reset Link</h1>
          <p className="text-sm text-slate-500 mb-6">This password reset link is invalid or incomplete.</p>
          <Link to="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl p-8 text-center shadow-xl">
          <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Password Reset</h1>
          <p className="text-sm text-slate-500 mb-6">Your password has been updated. You can now sign in with your new password.</p>
          <Link to="/login" className="inline-block bg-indigo-600 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050b18] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <LockKeyhole size={22} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Set New Password</h1>
          <p className="text-sm text-slate-500 mt-1">Enter a new password for <strong className="text-slate-700">{email}</strong></p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full h-12 px-4 pr-11 rounded-xl border border-slate-200 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirm Password</label>
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full h-12 px-4 rounded-xl border border-slate-200 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link to="/login" className="text-sm text-indigo-600 font-medium hover:text-indigo-700">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
