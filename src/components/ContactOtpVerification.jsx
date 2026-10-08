import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import { apiRequest } from "../lib/api";

function cleanOtp(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

export default function ContactOtpVerification({
  endpointBase,
  channel,
  purpose,
  target,
  valid,
  verifiedToken,
  onVerified,
}) {
  const [challengeToken, setChallengeToken] = useState("");
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [sentTarget, setSentTarget] = useState("");

  useEffect(() => {
    if (sentTarget && sentTarget !== target) {
      setChallengeToken("");
      setOtp("");
      setMessage("");
      setSentTarget("");
    }
  }, [target, sentTarget]);

  async function sendOtp() {
    if (!valid || sending) return;
    setSending(true);
    setMessage("");
    setOtp("");
    try {
      const data = await apiRequest(`${endpointBase}/verification/send`, {
        method: "POST",
        body: JSON.stringify({ channel, purpose, target }),
      });
      setChallengeToken(data.challengeToken || "");
      setSentTarget(target);
      setMessage(
        channel === "email"
          ? "OTP sent to this email. It is valid for 10 minutes."
          : "OTP sent to this phone number. It is valid for 10 minutes."
      );
    } catch (error) {
      setMessage(error?.data?.message || "Unable to send OTP");
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6 || verifying || !challengeToken) return;
    setVerifying(true);
    setMessage("");
    try {
      const data = await apiRequest(`${endpointBase}/verification/verify`, {
        method: "POST",
        body: JSON.stringify({
          channel,
          purpose,
          target,
          otp,
          challengeToken,
        }),
      });
      onVerified(data.verificationToken || "");
      setMessage("Verified successfully");
    } catch (error) {
      onVerified("");
      setMessage(error?.data?.message || "Unable to verify OTP");
    } finally {
      setVerifying(false);
    }
  }

  if (verifiedToken) {
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 size={13} /> Verified
      </div>
    );
  }

  return (
    <div className="mt-1.5 space-y-2">
      {!challengeToken ? (
        <button
          type="button"
          onClick={sendOtp}
          disabled={!valid || sending}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
          {sending ? "Sending OTP..." : "Get OTP"}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(cleanOtp(event.target.value))}
            placeholder="6-digit OTP"
            className="h-8 w-32 rounded-lg border border-slate-200 bg-white px-2.5 text-xs tracking-[0.18em] focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button
            type="button"
            onClick={verifyOtp}
            disabled={otp.length !== 6 || verifying}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {verifying && <Loader2 size={13} className="animate-spin" />}
            {verifying ? "Verifying..." : "Verify OTP"}
          </button>
          <button
            type="button"
            onClick={sendOtp}
            disabled={sending}
            className="h-8 px-2 text-[11px] font-semibold text-slate-500 hover:text-indigo-700 disabled:opacity-50"
          >
            {sending ? "Sending..." : "Resend"}
          </button>
        </div>
      )}

      {message && (
        <p className={`text-[11px] leading-4 ${message === "Verified successfully" ? "text-emerald-700" : "text-slate-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
