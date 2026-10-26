import { useState, useEffect, useCallback } from "react";

import { apiRequest } from "../../lib/api";

/*
 * VerifiedInput
 * -------------
 * A text/email/phone input with a built-in OTP verify flow, wired to the
 * super-admin contact-verification endpoints that already exist:
 *
 *   POST /api/admin/clients/verification/send    { channel, purpose, target } -> { challengeToken }
 *   POST /api/admin/clients/verification/verify  { channel, purpose, target, otp, challengeToken } -> { verificationToken }
 *
 * Props:
 *   label, required, type, placeholder, inputMode, maxLength  -> passed to the field
 *   channel   "email" | "phone"
 *   purpose   "company_email" | "admin_email" | "company_phone"
 *   value     current field value (controlled by parent form)
 *   onChange  (e) => void   updates the parent form value
 *   onToken   (token) => void  called with the verificationToken on success, "" when reset
 *
 * The parent stores the token in form state; because the onboard request sends
 * the whole form, the token rides along automatically.
 */
export default function VerifiedInput({
  label,
  required,
  type = "text",
  placeholder,
  inputMode,
  maxLength,
  channel,
  purpose,
  value,
  onChange,
  onToken,
}) {
  const [challengeToken, setChallengeToken] = useState("");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [msg, setMsg] = useState(null); // { text, tone: "ok" | "err" }

  // If the user edits the value after verifying, invalidate the verification.
  useEffect(() => {
    setVerified(false);
    setChallengeToken("");
    setOtp("");
    setMsg(null);
    onToken?.("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sendOtp = useCallback(async () => {
    if (!String(value || "").trim()) {
      setMsg({ text: "Enter a value first", tone: "err" });
      return;
    }
    setSending(true);
    setMsg(null);
    try {
      const res = await apiRequest("/api/admin/clients/verification/send", {
        method: "POST",
        body: JSON.stringify({ channel, purpose, target: value }),
      });
      setChallengeToken(res?.challengeToken || "");
      setMsg({ text: "Code sent to this address", tone: "ok" });
    } catch (error) {
      setMsg({
        text: error?.data?.message || error?.message || "Could not send code",
        tone: "err",
      });
    } finally {
      setSending(false);
    }
  }, [value, channel, purpose]);

  const verifyOtp = useCallback(async () => {
    if (!otp) {
      setMsg({ text: "Enter the code", tone: "err" });
      return;
    }
    setVerifying(true);
    setMsg(null);
    try {
      const res = await apiRequest("/api/admin/clients/verification/verify", {
        method: "POST",
        body: JSON.stringify({ channel, purpose, target: value, otp, challengeToken }),
      });
      setVerified(true);
      onToken?.(res?.verificationToken || "");
      setMsg({ text: "Verified", tone: "ok" });
    } catch (error) {
      setMsg({
        text: error?.data?.message || error?.message || "Wrong or expired code",
        tone: "err",
      });
    } finally {
      setVerifying(false);
    }
  }, [otp, challengeToken, value, channel, purpose, onToken]);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
        {verified && (
          <span className="ml-2 text-[11px] font-semibold text-emerald-600">
            ✓ Verified
          </span>
        )}
      </label>

      <div className="flex gap-2">
        <input
          type={type}
          inputMode={inputMode}
          maxLength={maxLength}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={verified}
          className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-colors disabled:bg-slate-50 disabled:text-slate-500"
        />
        {!verified && (
          <button
            type="button"
            onClick={sendOtp}
            disabled={sending || !String(value || "").trim()}
            className="h-10 shrink-0 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {sending ? "Sending…" : challengeToken ? "Resend" : "Send OTP"}
          </button>
        )}
      </div>

      {!verified && challengeToken && (
        <div className="mt-2 flex gap-2">
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            inputMode="numeric"
            className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={verifyOtp}
            disabled={verifying || otp.length < 4}
            className="h-10 shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {verifying ? "Verifying…" : "Verify"}
          </button>
        </div>
      )}

      {msg && (
        <p
          className={`mt-1 text-[11px] font-medium ${
            msg.tone === "ok" ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
