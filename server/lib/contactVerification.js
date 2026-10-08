import crypto from "crypto";
import jwt from "jsonwebtoken";

import { sendMail } from "./mailer.js";

const EMAIL_PURPOSES = new Set(["company_email", "admin_email"]);
const PHONE_PURPOSES = new Set(["company_phone"]);
const SEND_COOLDOWN_MS = 60_000;
const sendCooldowns = new Map();

export class ContactVerificationError extends Error {
  constructor(message, status = 400, code = "VERIFICATION_ERROR") {
    super(message);
    this.name = "ContactVerificationError";
    this.status = status;
    this.code = code;
  }
}

function getSecret() {
  const secret = process.env.OTP_SIGNING_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new ContactVerificationError(
      "OTP signing is not configured on the server",
      503,
      "OTP_NOT_CONFIGURED"
    );
  }
  return secret;
}

function normalizePurpose(channel, purpose) {
  const value = String(purpose || "").trim().toLowerCase();
  const allowed = channel === "email" ? EMAIL_PURPOSES : PHONE_PURPOSES;
  if (!allowed.has(value)) {
    throw new ContactVerificationError("Invalid verification purpose", 400);
  }
  return value;
}

export function normalizeVerificationTarget(channel, value) {
  if (channel === "email") {
    return String(value || "").trim().toLowerCase();
  }
  if (channel === "phone") {
    return String(value || "").replace(/\D/g, "").slice(-10);
  }
  throw new ContactVerificationError("Invalid verification channel", 400);
}

function assertCooldown(channel, target, purpose) {
  const key = `${channel}:${purpose}:${target}`;
  const last = sendCooldowns.get(key) || 0;
  const remaining = SEND_COOLDOWN_MS - (Date.now() - last);
  if (remaining > 0) {
    throw new ContactVerificationError(
      `Please wait ${Math.ceil(remaining / 1000)} seconds before requesting another OTP`,
      429,
      "OTP_COOLDOWN"
    );
  }
  sendCooldowns.set(key, Date.now());
}

function otpDigest(channel, purpose, target, otp) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${channel}|${purpose}|${target}|${otp}`)
    .digest("hex");
}

function timingSafeHexEqual(a, b) {
  try {
    const one = Buffer.from(String(a || ""), "hex");
    const two = Buffer.from(String(b || ""), "hex");
    return one.length === two.length && crypto.timingSafeEqual(one, two);
  } catch {
    return false;
  }
}

function signChallenge({ channel, purpose, target, digest = null }) {
  return jwt.sign(
    {
      kind: "contact_otp_challenge",
      channel,
      purpose,
      target,
      ...(digest ? { digest } : {}),
    },
    getSecret(),
    { expiresIn: "10m", issuer: "bispun" }
  );
}

function readChallenge(token, expected) {
  let decoded;
  try {
    decoded = jwt.verify(String(token || ""), getSecret(), {
      issuer: "bispun",
    });
  } catch {
    throw new ContactVerificationError(
      "OTP expired or invalid. Request a new OTP.",
      400,
      "OTP_CHALLENGE_INVALID"
    );
  }

  if (
    decoded?.kind !== "contact_otp_challenge" ||
    decoded?.channel !== expected.channel ||
    decoded?.purpose !== expected.purpose ||
    decoded?.target !== expected.target
  ) {
    throw new ContactVerificationError(
      "OTP does not match the current contact detail. Request a new OTP.",
      400,
      "OTP_TARGET_MISMATCH"
    );
  }
  return decoded;
}

function signVerified({ channel, purpose, target }) {
  return jwt.sign(
    {
      kind: "contact_verified",
      channel,
      purpose,
      target,
      verified: true,
    },
    getSecret(),
    { expiresIn: "30m", issuer: "bispun" }
  );
}

async function sendEmailOtp(target, purpose) {
  const otp = String(crypto.randomInt(100000, 1000000));
  const digest = otpDigest("email", purpose, target, otp);
  const challengeToken = signChallenge({
    channel: "email",
    purpose,
    target,
    digest,
  });

  const result = await sendMail({
    to: target,
    subject: "Your Bispun verification code",
    text: `Your Bispun verification code is ${otp}. It is valid for 10 minutes. Do not share this code with anyone.`,
    html: `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
        <div style="font-size:22px;font-weight:700;color:#4f46e5;margin-bottom:18px">Bispun</div>
        <h2 style="font-size:18px;margin:0 0 8px">Verify your email</h2>
        <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 18px">Use this one-time code to verify your email address.</p>
        <div style="font-size:30px;letter-spacing:8px;font-weight:700;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;text-align:center">${otp}</div>
        <p style="font-size:12px;color:#64748b;line-height:1.6;margin:16px 0 0">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>`,
  });

  if (!result?.sent) {
    throw new ContactVerificationError(
      "Email OTP could not be sent. Check SMTP configuration and try again.",
      503,
      "EMAIL_OTP_SEND_FAILED"
    );
  }

  return { challengeToken };
}

function msg91Mobile(target) {
  return `91${target}`;
}

function getMsg91Config() {
  const authKey = String(process.env.MSG91_AUTH_KEY || "").trim();
  const templateId = String(process.env.MSG91_OTP_TEMPLATE_ID || "").trim();
  if (!authKey || !templateId) {
    throw new ContactVerificationError(
      "Phone OTP is not configured. Add MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID on the server.",
      503,
      "PHONE_OTP_NOT_CONFIGURED"
    );
  }
  return { authKey, templateId };
}

async function msg91Json(url, options) {
  const response = await fetch(url, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const failed =
    !response.ok ||
    String(body?.type || "").toLowerCase() === "error" ||
    String(body?.status || "").toLowerCase() === "error";

  if (failed) {
    const message =
      body?.message || body?.error || `MSG91 request failed (${response.status})`;
    throw new ContactVerificationError(
      String(message),
      response.status >= 500 ? 503 : 400,
      "MSG91_ERROR"
    );
  }
  return body || {};
}

async function sendPhoneOtp(target, purpose) {
  const { authKey, templateId } = getMsg91Config();
  const url = new URL("https://control.msg91.com/api/v5/otp");
  url.searchParams.set("template_id", templateId);
  url.searchParams.set("mobile", msg91Mobile(target));

  await msg91Json(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey: authKey,
    },
  });

  return {
    challengeToken: signChallenge({ channel: "phone", purpose, target }),
  };
}

async function verifyPhoneOtp(target, otp) {
  const { authKey } = getMsg91Config();
  const url = new URL("https://control.msg91.com/api/v5/otp/verify");
  url.searchParams.set("otp", otp);
  url.searchParams.set("mobile", msg91Mobile(target));

  const body = await msg91Json(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      authkey: authKey,
    },
  });

  const type = String(body?.type || body?.status || "").toLowerCase();
  if (type && !["success", "verified", "true"].includes(type)) {
    throw new ContactVerificationError(
      body?.message || "Incorrect phone OTP",
      400,
      "OTP_INCORRECT"
    );
  }
}

export async function sendContactVerificationOtp({ channel, purpose, target }) {
  const normalizedChannel = String(channel || "").trim().toLowerCase();
  if (!["email", "phone"].includes(normalizedChannel)) {
    throw new ContactVerificationError("Invalid verification channel", 400);
  }
  const normalizedPurpose = normalizePurpose(normalizedChannel, purpose);
  const normalizedTarget = normalizeVerificationTarget(normalizedChannel, target);
  assertCooldown(normalizedChannel, normalizedTarget, normalizedPurpose);

  if (normalizedChannel === "email") {
    const result = await sendEmailOtp(normalizedTarget, normalizedPurpose);
    return { ...result, expiresInSeconds: 600 };
  }

  const result = await sendPhoneOtp(normalizedTarget, normalizedPurpose);
  return { ...result, expiresInSeconds: 600 };
}

export async function verifyContactVerificationOtp({
  channel,
  purpose,
  target,
  otp,
  challengeToken,
}) {
  const normalizedChannel = String(channel || "").trim().toLowerCase();
  if (!["email", "phone"].includes(normalizedChannel)) {
    throw new ContactVerificationError("Invalid verification channel", 400);
  }
  const normalizedPurpose = normalizePurpose(normalizedChannel, purpose);
  const normalizedTarget = normalizeVerificationTarget(normalizedChannel, target);
  const cleanOtp = String(otp || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(cleanOtp)) {
    throw new ContactVerificationError("Enter the 6-digit OTP", 400);
  }

  const challenge = readChallenge(challengeToken, {
    channel: normalizedChannel,
    purpose: normalizedPurpose,
    target: normalizedTarget,
  });

  if (normalizedChannel === "email") {
    const providedDigest = otpDigest(
      normalizedChannel,
      normalizedPurpose,
      normalizedTarget,
      cleanOtp
    );
    if (!timingSafeHexEqual(challenge.digest, providedDigest)) {
      throw new ContactVerificationError(
        "Incorrect OTP. Please check the code and try again.",
        400,
        "OTP_INCORRECT"
      );
    }
  } else {
    await verifyPhoneOtp(normalizedTarget, cleanOtp);
  }

  return {
    verificationToken: signVerified({
      channel: normalizedChannel,
      purpose: normalizedPurpose,
      target: normalizedTarget,
    }),
    expiresInSeconds: 1800,
  };
}

export function assertContactVerified(token, { channel, purpose, target }) {
  const normalizedChannel = String(channel || "").trim().toLowerCase();
  const normalizedPurpose = normalizePurpose(normalizedChannel, purpose);
  const normalizedTarget = normalizeVerificationTarget(normalizedChannel, target);

  let decoded;
  try {
    decoded = jwt.verify(String(token || ""), getSecret(), {
      issuer: "bispun",
    });
  } catch {
    throw new ContactVerificationError(
      "Contact verification expired. Please verify again.",
      400,
      "CONTACT_NOT_VERIFIED"
    );
  }

  if (
    decoded?.kind !== "contact_verified" ||
    decoded?.verified !== true ||
    decoded?.channel !== normalizedChannel ||
    decoded?.purpose !== normalizedPurpose ||
    decoded?.target !== normalizedTarget
  ) {
    throw new ContactVerificationError(
      "Please verify the current contact details before continuing.",
      400,
      "CONTACT_NOT_VERIFIED"
    );
  }

  return true;
}