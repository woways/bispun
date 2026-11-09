// Public (unauthenticated) account/data deletion request intake.
// Google Play compliance: a public URL where anyone can request deletion of
// their account/data. This endpoint ONLY records/forwards the request; it never
// deletes or anonymizes data (that is a separate, policy-gated operation).
import { Router } from "express";

import {
  validateDeletionRequest,
  buildDeletionRequestEmail,
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

  const inbox = String(
    process.env.DATA_DELETION_INBOX || process.env.SMTP_USER || ""
  ).trim();
  if (inbox && isEmailConfigured()) {
    const { subject, text } = buildDeletionRequestEmail({
      ...normalized,
      source: "public",
    });
    // Fire-and-forget: a slow/unreachable SMTP must never block or fail the
    // user's request. Detached from the response path; errors are swallowed.
    Promise.resolve()
      .then(() => sendMail({ to: inbox, subject, text }))
      .catch((error) =>
        console.error("[data-deletion] notify failed:", error?.message || error)
      );
  } else {
    console.warn(
      "[data-deletion] request received but DATA_DELETION_INBOX/SMTP not configured; notification skipped"
    );
  }

  // Privacy-safe generic confirmation (does not reveal whether an account exists).
  return res.json({
    success: true,
    message:
      "If an account matches this email, we've received your deletion request and will process it within 30 days.",
  });
});

export default router;
