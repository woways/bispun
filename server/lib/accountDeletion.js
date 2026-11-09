/* =========================================================
   ACCOUNT DELETION REQUEST — intake helpers (pure, testable)

   Scope: capture and route a user's request to delete their
   account/data (Google Play compliance). This module does NOT
   delete or anonymize anything — actual destruction is a
   separate, policy-gated operation. These helpers validate the
   request and format the notification sent to the deletion inbox.
========================================================= */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_REASON = 2000;

export const DELETION_POLICY_TEXT =
  "When you request deletion, we remove your personal profile and login " +
  "credentials and disable your access. Business records that we are legally " +
  "required to keep (billing/payment history and audit logs) are retained for " +
  "the period required by law and then deleted. Company-owned CRM data created " +
  "for your organization may be retained by your organization's administrator. " +
  "Requests are processed within 30 days; we may contact you to verify ownership.";

export function validateDeletionRequest({ email, reason } = {}) {
  const errors = [];
  const normEmail = String(email || "").trim().toLowerCase();
  if (!normEmail) {
    errors.push("Email is required.");
  } else if (!EMAIL_RE.test(normEmail)) {
    errors.push("Enter a valid email address.");
  }
  const normReason = String(reason || "").trim();
  if (normReason.length > MAX_REASON) {
    errors.push(`Reason must be ${MAX_REASON} characters or fewer.`);
  }
  return {
    ok: errors.length === 0,
    errors,
    normalized: { email: normEmail, reason: normReason },
  };
}

export function buildDeletionRequestEmail({ email, reason, source, actor } = {}) {
  const lines = [
    "A Bispun account deletion request was submitted.",
    "",
    `Requester email: ${email}`,
    `Source: ${source || "unknown"}`,
    `Reason: ${reason && reason.length ? reason : "(none provided)"}`,
  ];
  if (actor && actor.userId) {
    lines.push(
      "",
      "Identity: VERIFIED (submitted from an authenticated in-app session).",
      `User id: ${actor.userId}`,
      `Company id: ${actor.companyId || "(unknown)"}`,
      `Role: ${actor.role || "(unknown)"}`
    );
  } else {
    lines.push(
      "",
      "Identity: UNVERIFIED (public request) — verify account ownership before processing."
    );
  }
  lines.push(
    "",
    "Action required: process per the account-deletion policy. Do NOT delete or",
    "anonymize data without the reviewed deletion policy and authorization."
  );
  return {
    subject: `Account deletion request — ${email}`,
    text: lines.join("\n"),
  };
}
