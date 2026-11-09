// Authenticated account-deletion request (in-app "Request account deletion").
// Records a persistent, admin-trackable request via the existing audit log
// (no schema change) and notifies the deletion inbox. Does NOT delete or
// anonymize any data — that is a separate, policy-gated operation.
import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";
import {
  validateDeletionRequest,
  buildDeletionRequestEmail,
  buildDeletionRecordData,
} from "../lib/accountDeletion.js";
import { sendMail, isEmailConfigured } from "../lib/mailer.js";
import { writeAuditLog } from "../lib/auditLog.js";

const router = Router();
router.use(requireClientUser);

router.post("/deletion-request", async (req, res) => {
  try {
    const me = await prisma.user.findFirst({
      where: { id: req.clientUser.userId, companyId: req.clientUser.companyId },
      select: { email: true, name: true },
    });
    const email = String(me?.email || "").trim().toLowerCase();

    const { ok, errors, normalized } = validateDeletionRequest({
      email,
      reason: req.body?.reason,
    });
    if (!ok) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    const actor = {
      userId: req.clientUser.userId,
      companyId: req.clientUser.companyId,
      role: req.clientUser.role,
      name: me?.name || req.clientUser.name || null,
      email,
    };

    // Persistent, admin-trackable record (reuses existing audit infrastructure).
    await writeAuditLog({
      req,
      companyId: req.clientUser.companyId,
      actor: { id: actor.userId, name: actor.name, email, role: actor.role },
      action: "ACCOUNT_DELETION_REQUESTED",
      entityType: "User",
      entityId: actor.userId,
      summary: `Account deletion requested by ${email}`,
      metadata: { reason: normalized.reason || null, source: "in-app" },
    });

    // Durable dedicated record when the store is provisioned (guarded so it is
    // safe before the migration). The AuditLog above is the guaranteed record,
    // so an authenticated request is durably tracked either way.
    let requestId = null;
    let status = "PENDING";
    try {
      if (prisma.accountDeletionRequest?.create) {
        const record = await prisma.accountDeletionRequest.create({
          data: {
            ...buildDeletionRecordData({ ...normalized, source: "in-app", actor }),
            ipAddress: req.ip || null,
            userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
          },
        });
        requestId = record.id;
        status = record.status;
      }
    } catch (error) {
      console.error("[account-deletion] persist failed:", error?.message || error);
    }

    const inbox = String(
      process.env.DATA_DELETION_INBOX || process.env.SMTP_USER || ""
    ).trim();
    if (inbox && isEmailConfigured()) {
      const { subject, text } = buildDeletionRequestEmail({
        ...normalized,
        source: "in-app",
        actor,
      });
      // Fire-and-forget so a slow SMTP never blocks the response. The durable
      // record is the audit log written above.
      Promise.resolve()
        .then(() => sendMail({ to: inbox, subject, text }))
        .catch((error) =>
          console.error("[account-deletion] notify failed:", error?.message || error)
        );
    }

    return res.json({
      success: true,
      requestId,
      status,
      message:
        "Your account deletion request has been recorded. Our team will process it within 30 days and may contact you to verify.",
    });
  } catch (error) {
    console.error("Account deletion request failed:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to submit your request right now. Please try again.",
    });
  }
});

export default router;
