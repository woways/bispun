// Public (unauthenticated) account/data deletion request intake.
// Google Play compliance: a public URL where anyone can request deletion of
// their account/data. This endpoint ONLY records/forwards the request; it never
// deletes or anonymizes data (that is a separate, policy-gated operation).
import { Router } from "express";

import prisma from "../lib/prisma.js";
import {
  validateDeletionRequest,
  buildDeletionRequestEmail,
  buildDeletionRecordData,
  DELETION_POLICY_TEXT,
} from "../lib/accountDeletion.js";
import { sendMail, isEmailConfigured } from "../lib/mailer.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

const router = Router();

const limiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyPrefix: "data-deletion",
  message: "Too many requests. Please try again later.",
});

// Public policy text for the deletion page to render.
router.get("/policy", (_req, res) =>
  res.json({ success: true, policy: DELETION_POLICY_TEXT })
);

router.post("/", limiter, async (req, res) => {
  const { ok, errors, normalized } = validateDeletionRequest(req.body || {});
  if (!ok) {
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  // DURABLE record is primary (requirement: never imply acceptance of an
  // unpersisted request). The endpoints guard on the client delegate so this
  // is safe before the migration lands (delegate absent -> record stays null).
  let record = null;
  try {
    if (prisma.accountDeletionRequest?.create) {
      record = await prisma.accountDeletionRequest.create({
        data: {
          ...buildDeletionRecordData({ ...normalized, source: "public" }),
          ipAddress: req.ip || null,
          userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
        },
      });
    }
  } catch (error) {
    console.error("[data-deletion] persist failed:", error?.message || error);
    record = null;
  }

  if (!record) {
    // Honest: we could not durably record this. Do NOT claim acceptance.
    const inbox = String(process.env.DATA_DELETION_INBOX || "privacy@bispun.com").trim();
    return res.status(503).json({
      success: false,
      message: `We couldn't record your request automatically right now. Please email ${inbox} and we'll process your deletion request.`,
    });
  }

  // Secondary notification (never blocks or gates success).
  const inbox = String(
    process.env.DATA_DELETION_INBOX || process.env.SMTP_USER || ""
  ).trim();
  if (inbox && isEmailConfigured()) {
    const { subject, text } = buildDeletionRequestEmail({ ...normalized, source: "public" });
    Promise.resolve()
      .then(() => sendMail({ to: inbox, subject, text }))
      .catch((error) =>
        console.error("[data-deletion] notify failed:", error?.message || error)
      );
  }

  // Privacy-safe confirmation (does not reveal whether an account exists).
  return res.json({
    success: true,
    requestId: record.id,
    status: record.status,
    message:
      "If an account matches this email, we've recorded your deletion request and will process it within 30 days.",
  });
});

export default router;
