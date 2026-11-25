import crypto from "crypto";
import { google } from "googleapis";
import prisma from "./prisma.js";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  "http://localhost:4000/api/client/google/callback";

// We request calendar.events (to create Meet links) plus openid+email so we can
// show which Google account is connected. All are consent-time scopes.
const SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
];

export function isGoogleConfigured() {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

export function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(state) {
  const oauth2 = createOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force a refresh_token every time
    scope: SCOPES,
    state,
    include_granted_scopes: true,
  });
}

export async function exchangeCodeForTokens(code) {
  const oauth2 = createOAuthClient();
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

/* ---- refresh-token encryption (AES-256-GCM, key derived from JWT_SECRET) --- */
function tokenKey() {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

export function encryptToken(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", tokenKey(), iv);
  const enc = Buffer.concat([
    cipher.update(String(plain), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptToken(payload) {
  try {
    const [ivB, tagB, dataB] = String(payload).split(":");
    const iv = Buffer.from(ivB, "base64");
    const tag = Buffer.from(tagB, "base64");
    const data = Buffer.from(dataB, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", tokenKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8"
    );
  } catch {
    return null;
  }
}

// Authorized Calendar client for a user, or null if they haven't connected.
export async function getCalendarForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true },
  });
  if (!user?.googleRefreshToken) return null;
  const refreshToken = decryptToken(user.googleRefreshToken);
  if (!refreshToken) return null;
  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth: oauth2 });
}

function extractMeetLink(eventData) {
  return (
    eventData?.hangoutLink ||
    eventData?.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === "video"
    )?.uri ||
    null
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Create a calendar event with a Google Meet link; returns the meet URL.
//
// Google Meet conference creation is ASYNCHRONOUS: the events.insert response
// frequently comes back with conferenceData.createRequest.status = "pending"
// and NO hangoutLink yet. The previous implementation read hangoutLink from
// that first response, so it was usually null ("no immediate Meet link").
// We now poll the event until Google finishes provisioning the conference, and
// surface a `pending` flag if it is still not ready — we never fabricate a link.
export async function createMeetEvent(
  userId,
  {
    summary,
    description,
    startISO,
    endISO,
    attendees = [],
    // When set (e.g. "all"), Google Calendar emails each attendee a real
    // invitation. Omitted by default so existing callers notify nobody.
    sendUpdates,
    // When false, create a plain calendar event WITHOUT a Google Meet
    // conference (used when the organizer pasted their own Zoom/Teams link).
    withMeet = true,
    // Optional location/link text stored on the event (shown in the invite).
    location,
  }
) {
  const calendar = await getCalendarForUser(userId);
  if (!calendar) throw new Error("Google account not connected");

  const requestBody = {
    summary: summary || "Meeting",
    description: description || "",
    start: { dateTime: startISO },
    end: { dateTime: endISO },
    attendees: attendees.filter(Boolean).map((email) => ({ email })),
  };
  if (location) requestBody.location = location;
  if (withMeet) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const insertParams = {
    calendarId: "primary",
    conferenceDataVersion: withMeet ? 1 : 0,
    requestBody,
  };
  // Without sendUpdates Google sends no invitation emails (API default), which
  // also keeps automated/test runs from notifying real attendees.
  if (sendUpdates) insertParams.sendUpdates = sendUpdates;

  const res = await calendar.events.insert(insertParams);

  let data = res.data;
  const eventId = data.id;
  let meetLink = extractMeetLink(data);

  // A pasted-link event has no conference to provision — return immediately.
  if (!withMeet) {
    return { meetLink: null, pending: false, eventId, htmlLink: data.htmlLink };
  }

  // Poll for the asynchronously-created conference (short, bounded backoff).
  let attempts = 0;
  while (!meetLink && eventId && attempts < 5) {
    const statusCode = data.conferenceData?.createRequest?.status?.statusCode;
    // "success" without a link, or "failure", means polling won't help.
    if (statusCode && statusCode !== "pending") break;
    await sleep(800);
    try {
      const got = await calendar.events.get({
        calendarId: "primary",
        eventId,
        conferenceDataVersion: 1,
      });
      data = got.data;
      meetLink = extractMeetLink(data);
    } catch {
      break;
    }
    attempts += 1;
  }

  const statusCode = data.conferenceData?.createRequest?.status?.statusCode;
  const pending = !meetLink && (!statusCode || statusCode === "pending");

  return {
    meetLink,
    pending,
    eventId,
    htmlLink: data.htmlLink,
  };
}

// Push a reschedule / detail change to an existing Google Calendar event so the
// invited guests are re-notified. Best-effort: resolves to { ok:false } instead
// of throwing, so a failed sync never breaks the calendar update.
export async function updateMeetEvent(
  userId,
  eventId,
  {
    summary,
    description,
    startISO,
    endISO,
    location,
    attendees,
    sendUpdates = "all",
  } = {}
) {
  if (!eventId) return { ok: false };
  try {
    const calendar = await getCalendarForUser(userId);
    if (!calendar) return { ok: false };
    const requestBody = {};
    if (summary !== undefined) requestBody.summary = summary || "Meeting";
    if (description !== undefined) requestBody.description = description || "";
    if (startISO) requestBody.start = { dateTime: startISO };
    if (endISO) requestBody.end = { dateTime: endISO };
    if (location !== undefined) requestBody.location = location || "";
    if (Array.isArray(attendees)) {
      requestBody.attendees = attendees
        .filter(Boolean)
        .map((email) => ({ email }));
    }
    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId,
      sendUpdates,
      requestBody,
    });
    return { ok: true, meetLink: extractMeetLink(res.data) };
  } catch (error) {
    console.error("[google] updateMeetEvent failed:", error.message);
    return { ok: false, error: error.message };
  }
}

// Cancel/delete a Google Calendar event and notify guests. Best-effort.
export async function cancelMeetEvent(userId, eventId, { sendUpdates = "all" } = {}) {
  if (!eventId) return { ok: false };
  try {
    const calendar = await getCalendarForUser(userId);
    if (!calendar) return { ok: false };
    await calendar.events.delete({ calendarId: "primary", eventId, sendUpdates });
    return { ok: true };
  } catch (error) {
    console.error("[google] cancelMeetEvent failed:", error.message);
    return { ok: false, error: error.message };
  }
}

export function hasGmailSendScope(scopes = []) {
  return Array.isArray(scopes) &&
    scopes.includes("https://www.googleapis.com/auth/gmail.send");
}

export async function getGmailForUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true, googleScopes: true, googleEmail: true },
  });
  if (!user?.googleRefreshToken) throw new Error("Google account not connected");
  if (!hasGmailSendScope(user.googleScopes || [])) {
    throw new Error("Gmail permission missing. Reconnect Google in Settings → Integrations.");
  }
  const refreshToken = decryptToken(user.googleRefreshToken);
  if (!refreshToken) throw new Error("Google account not connected");
  const oauth2 = createOAuthClient();
  oauth2.setCredentials({ refresh_token: refreshToken });
  return { gmail: google.gmail({ version: "v1", auth: oauth2 }), email: user.googleEmail || null };
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(String(value || ""), "utf8").toString("base64")}?=`;
}

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function wrapBase64(value) {
  return String(value || "").match(/.{1,76}/g)?.join("\r\n") || "";
}

function safeAttachmentName(value) {
  return String(value || "attachment")
    .replace(/[\r\n]/g, " ")
    .replace(/["\\]/g, "_")
    .trim() || "attachment";
}

export async function sendGmailMessage(
  userId,
  { to, subject, text, attachments = [] }
) {
  const { gmail, email } = await getGmailForUser(userId);
  const headers = [
    `To: ${String(to || "").trim()}`,
    email ? `From: ${email}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);

  let mimeMessage;

  if (attachments.length) {
    const boundary = `bispun_${crypto.randomBytes(16).toString("hex")}`;
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    const parts = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(Buffer.from(String(text || ""), "utf8").toString("base64")),
    ];

    for (const attachment of attachments) {
      const filename = safeAttachmentName(attachment.filename);
      const mimeType = String(attachment.mimeType || "application/octet-stream")
        .replace(/[\r\n]/g, "")
        .trim() || "application/octet-stream";
      const content = Buffer.isBuffer(attachment.buffer)
        ? attachment.buffer
        : Buffer.from(attachment.buffer || "");

      parts.push(
        `--${boundary}`,
        `Content-Type: ${mimeType}; name="${filename}"`,
        `Content-Disposition: attachment; filename="${filename}"`,
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(content.toString("base64"))
      );
    }

    parts.push(`--${boundary}--`, "");
    mimeMessage = `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`;
  } else {
    headers.push(
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64"
    );
    const body = wrapBase64(
      Buffer.from(String(text || ""), "utf8").toString("base64")
    );
    mimeMessage = `${headers.join("\r\n")}\r\n\r\n${body}`;
  }

  const raw = base64Url(mimeMessage);
  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });

  return {
    id: result.data.id || null,
    threadId: result.data.threadId || null,
    from: email,
  };
}

// ---------------------------------------------------------------------------
// Platform (system) email sender.
//
// Onboarding OTP, welcome and other system emails are NOT tied to a client
// user, so they send from a single connected Google account at the platform
// level: a SUPER_ADMIN whose Google is connected with the gmail.send scope.
// This runs over the Gmail API (HTTPS), so it works where outbound SMTP is
// blocked (e.g. Render free tier). Prefers PLATFORM_GMAIL_ADDRESS
// (default info@bispun.com) when several SUPER_ADMINs have connected.
// ---------------------------------------------------------------------------
export async function getPlatformGmail() {
  const preferred = String(
    process.env.PLATFORM_GMAIL_ADDRESS || "info@bispun.com"
  )
    .trim()
    .toLowerCase();

  const base = {
    role: "SUPER_ADMIN",
    googleRefreshToken: { not: null },
    googleScopes: { has: "https://www.googleapis.com/auth/gmail.send" },
  };

  const user =
    (await prisma.user.findFirst({
      where: {
        ...base,
        googleEmail: { equals: preferred, mode: "insensitive" },
      },
      select: { id: true },
    })) ||
    (await prisma.user.findFirst({
      where: base,
      orderBy: { googleConnectedAt: "desc" },
      select: { id: true },
    }));

  if (!user) {
    throw new Error(
      "No system email sender connected. Connect a Google account (with Gmail send) in Super Admin → System Settings."
    );
  }
  return getGmailForUser(user.id);
}

// Send an HTML (with optional plain-text alternative) system email from the
// platform Gmail account. Mirrors sendGmailMessage but supports HTML bodies.
export async function sendPlatformEmail({ to, subject, html, text }) {
  const { gmail, email } = await getPlatformGmail();

  const recipient = String(to || "").trim();
  if (!recipient) throw new Error("Missing recipient");

  const headers = [
    `To: ${recipient}`,
    email ? `From: ${email}` : null,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
  ].filter(Boolean);

  let mimeMessage;
  if (html && text) {
    const boundary = `bispun_alt_${crypto.randomBytes(12).toString("hex")}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    mimeMessage =
      `${headers.join("\r\n")}\r\n\r\n` +
      [
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(Buffer.from(String(text), "utf8").toString("base64")),
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        wrapBase64(Buffer.from(String(html), "utf8").toString("base64")),
        `--${boundary}--`,
        "",
      ].join("\r\n");
  } else {
    const isHtml = Boolean(html);
    headers.push(
      `Content-Type: text/${isHtml ? "html" : "plain"}; charset="UTF-8"`,
      "Content-Transfer-Encoding: base64"
    );
    const body = wrapBase64(
      Buffer.from(String(html || text || ""), "utf8").toString("base64")
    );
    mimeMessage = `${headers.join("\r\n")}\r\n\r\n${body}`;
  }

  const raw = base64Url(mimeMessage);
  const result = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return { id: result.data.id || null, from: email };
}