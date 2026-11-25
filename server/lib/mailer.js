// System email (OTP, welcome, etc.) via the Gmail API — NOT raw SMTP.
//
// Why: Render (and most cloud PaaS) block outbound SMTP ports 25/465/587 on
// free/entry tiers, so nodemailer+Gmail silently times out. The Gmail API runs
// over HTTPS (port 443), which is never blocked, so this works on any tier.
//
// These are platform emails (no client user behind them), so they send from a
// single connected Google account: a SUPER_ADMIN who has connected Google with
// the gmail.send scope in Super Admin → System Settings. See
// server/lib/google.js (getPlatformGmail / sendPlatformEmail).
//
// Optional env:
//   PLATFORM_GMAIL_ADDRESS   which connected account to prefer as sender
//                            (default info@bispun.com)
//
// If no platform Google account is connected, sendMail returns { sent:false }
// instead of throwing, so a signup/onboarding is never hard-crashed by email.

import { sendPlatformEmail, isGoogleConfigured } from "./google.js";

// True when Google OAuth is configured on the server. (Whether an account is
// actually connected is checked at send time.)
export function isEmailConfigured() {
  return isGoogleConfigured();
}

// Base URL of the client app, used to build the login link in emails.
export function getAppLoginUrl() {
  const base =
    (process.env.CLIENT_URL || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)[0] || "https://bispun.com";
  return `${base.replace(/\/+$/, "")}/login`;
}

const inr = (n) =>
  "₹" +
  Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Low-level send via the Gmail API. Best-effort: resolves to { sent: false }
 * on any failure instead of throwing, so callers never break their main flow.
 * Keeps the same signature and return shape as the old SMTP sendMail().
 */
export async function sendMail({ to, subject, html, text }) {
  if (!to) return { sent: false, skipped: true };
  try {
    const result = await sendPlatformEmail({ to, subject, html, text });
    return { sent: true, messageId: result?.id || null };
  } catch (error) {
    console.error("[mailer] Failed to send email to", to, error.message);
    return { sent: false, error: error.message };
  }
}

/**
 * Welcome email sent after a self-serve signup is paid and the workspace is
 * created. Carries the login link (the key value: a closed-tab buyer still
 * gets their way in) plus a short receipt summary.
 */
export async function sendWelcomeEmail({
  toEmail,
  adminName,
  companyName,
  planName,
  receiptNumber,
  amount,
  loginUrl,
}) {
  if (!toEmail) return { sent: false, skipped: true };
  const link = loginUrl || getAppLoginUrl();
  const safeName = adminName || "there";

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <div style="font-size:22px;font-weight:700;color:#4f46e5;margin-bottom:8px">Bispun</div>
    <h2 style="font-size:18px;margin:16px 0 4px">Welcome, ${safeName} 👋</h2>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px">
      Your <strong>${companyName || "company"}</strong> workspace is live and your
      <strong>${planName || "subscription"}</strong> plan is active. You can log in now
      with your admin email.
    </p>

    <a href="${link}"
       style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
              font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;margin:4px 0 20px">
      Log in to your CRM
    </a>

    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;font-size:13px;color:#334155">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="color:#64748b">Invoice</span><span>${receiptNumber || "—"}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:#64748b">Amount paid</span><span style="font-weight:700">${inr(amount)}</span>
      </div>
    </div>

    <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:18px 0 0">
      If the button doesn't work, copy this link into your browser:<br>
      <span style="color:#4f46e5">${link}</span>
    </p>
    <p style="font-size:12px;color:#94a3b8;margin:14px 0 0">— Team Bispun</p>
  </div>`;

  const text = `Welcome, ${safeName}!

Your ${companyName || "company"} workspace is live and your ${planName || "subscription"} plan is active.

Log in: ${link}

Invoice: ${receiptNumber || "—"}
Amount paid: ${inr(amount)}

— Team Bispun`;

  return sendMail({
    to: toEmail,
    subject: `Welcome to Bispun — your ${planName || ""} workspace is ready`.trim(),
    html,
    text,
  });
}

/* ---------------- meeting invite (fallback when Google not connected) -------- */

// Build a "YYYYMMDDTHHMMSSZ" UTC stamp for a Google Calendar template link.
function gcalStamp(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

// "Add to Google Calendar" template URL — works in any browser/Gmail with no
// server state. Pre-fills title, time, details and location/link.
function addToGoogleCalendarUrl({ title, startAt, endAt, description, location }) {
  const start = gcalStamp(startAt);
  const end = gcalStamp(endAt || new Date(new Date(startAt).getTime() + 3600000));
  if (!start || !end) return "";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title || "Meeting",
    dates: `${start}/${end}`,
  });
  if (description) params.set("details", description);
  if (location) params.set("location", location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatWhen(startAt, endAt) {
  const opts = {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  };
  const start = new Date(startAt);
  const startStr = new Intl.DateTimeFormat("en-IN", opts).format(start);
  if (!endAt) return `${startStr} IST`;
  const end = new Date(endAt);
  const endStr = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(end);
  return `${startStr} – ${endStr} IST`;
}

/**
 * Meeting invite sent to a guest when the organizer hasn't connected Google (so
 * Google Calendar can't send its native invite). Carries the join link, the
 * meeting details and an "Add to Google Calendar" button. Best-effort via
 * sendMail — never throws.
 */
export async function sendMeetingInviteEmail({
  toEmail,
  guestName,
  title,
  description,
  startAt,
  endAt,
  location,
  meetingLink,
  organizerName,
}) {
  if (!toEmail) return { sent: false, skipped: true };
  const safeName = guestName || "there";
  const whenStr = formatWhen(startAt, endAt);
  const host = organizerName ? ` by ${organizerName}` : "";
  const addUrl = addToGoogleCalendarUrl({
    title,
    startAt,
    endAt,
    description,
    location: meetingLink || location,
  });

  const joinButton = meetingLink
    ? `<a href="${meetingLink}"
         style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;
                font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;margin:4px 8px 4px 0">
        Join meeting
      </a>`
    : "";

  const addButton = addUrl
    ? `<a href="${addUrl}"
         style="display:inline-block;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;
                text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;margin:4px 0">
        Add to Google Calendar
      </a>`
    : "";

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <div style="font-size:22px;font-weight:700;color:#4f46e5;margin-bottom:8px">Bispun</div>
    <h2 style="font-size:18px;margin:16px 0 4px">You're invited to a meeting</h2>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px">
      Hi ${safeName}, you've been invited${host} to <strong>${title || "a meeting"}</strong>.
    </p>

    <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;font-size:13px;color:#334155;margin-bottom:18px">
      <div style="margin-bottom:6px"><span style="color:#64748b">When:</span> <strong>${whenStr}</strong></div>
      ${location ? `<div style="margin-bottom:6px"><span style="color:#64748b">Where:</span> ${location}</div>` : ""}
      ${meetingLink ? `<div><span style="color:#64748b">Link:</span> <a href="${meetingLink}" style="color:#4f46e5">${meetingLink}</a></div>` : ""}
    </div>

    ${description ? `<p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 16px">${description}</p>` : ""}

    <div>${joinButton}${addButton}</div>

    <p style="font-size:12px;color:#94a3b8;margin:20px 0 0">— Sent via Bispun</p>
  </div>`;

  const text = `You're invited to a meeting${host}.

${title || "Meeting"}
When: ${whenStr}
${location ? `Where: ${location}\n` : ""}${meetingLink ? `Join: ${meetingLink}\n` : ""}${description ? `\n${description}\n` : ""}
${addUrl ? `Add to Google Calendar: ${addUrl}` : ""}

— Sent via Bispun`;

  return sendMail({
    to: toEmail,
    subject: `Invitation: ${title || "Meeting"} — ${whenStr}`,
    html,
    text,
  });
}