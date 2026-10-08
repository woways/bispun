import nodemailer from "nodemailer";

/**
 * Email sending via Gmail SMTP (or any SMTP).
 *
 * Required env vars (set these in server/.env and on Render):
 *   SMTP_USER   the Gmail address that sends mail (e.g. tech@woways.in)
 *   SMTP_PASS   a Gmail "App Password" (NOT your normal password)
 *   SMTP_FROM   optional display sender, e.g. "Bispun <tech@woways.in>"
 *                (defaults to SMTP_USER)
 *   SMTP_HOST   optional, defaults to smtp.gmail.com
 *   SMTP_PORT   optional, defaults to 465 (SSL)
 *
 * If SMTP_USER / SMTP_PASS are missing, email is skipped silently so that
 * account creation is never blocked by email problems.
 */

let cachedTransport = null;

function getTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user, pass },
    });
  }
  return cachedTransport;
}

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
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
 * Low-level send. Best-effort: resolves to { sent: false } on any failure
 * instead of throwing, so callers never break their main flow.
 */
export async function sendMail({ to, subject, html, text }) {
  const transport = getTransport();
  if (!transport) {
    console.warn("[mailer] SMTP not configured; skipping email to", to);
    return { sent: false, skipped: true };
  }
  try {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await transport.sendMail({ from, to, subject, html, text });
    return { sent: true, messageId: info.messageId };
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
