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

// Create a calendar event with a Google Meet link; returns the meet URL.
export async function createMeetEvent(
  userId,
  { summary, description, startISO, endISO, attendees = [] }
) {
  const calendar = await getCalendarForUser(userId);
  if (!calendar) throw new Error("Google account not connected");
  const res = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: summary || "Meeting",
      description: description || "",
      start: { dateTime: startISO },
      end: { dateTime: endISO },
      attendees: attendees.filter(Boolean).map((email) => ({ email })),
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });
  const meetLink =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find(
      (e) => e.entryPointType === "video"
    )?.uri ||
    null;
  return { meetLink, eventId: res.data.id, htmlLink: res.data.htmlLink };
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
