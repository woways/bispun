import { Router } from "express";

import prisma from "../lib/prisma.js";
import { sendGmailMessage } from "../lib/google.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";

const router = Router();
const MAX_EMAILS_PER_REQUEST = 100;

router.use(requireClientUser);
router.use(
  requireClientPermission(
    "canManageLeads",
    "You do not have permission to communicate with leads"
  )
);

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function personalize(template, lead) {
  return String(template || "")
    .replaceAll("{{name}}", lead.name || "")
    .replaceAll("{{phone}}", lead.phone || "")
    .replaceAll("{{email}}", lead.email || "")
    .replaceAll("{{course}}", lead.course || "");
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

router.get("/status", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.clientUser.userId },
      select: {
        googleEmail: true,
        googleRefreshToken: true,
        googleScopes: true,
      },
    });

    const gmailScope = "https://www.googleapis.com/auth/gmail.send";
    const sentToday = await prisma.leadCommunication.count({
      where: {
        companyId: req.clientUser.companyId,
        userId: req.clientUser.userId,
        channel: "EMAIL",
        status: "SENT",
        createdAt: { gte: startOfToday() },
      },
    });

    return res.json({
      success: true,
      gmail: {
        connected: Boolean(user?.googleRefreshToken),
        enabled: Array.isArray(user?.googleScopes) && user.googleScopes.includes(gmailScope),
        email: user?.googleEmail || null,
        sentToday,
      },
      channels: {
        email: true,
        whatsapp: false,
        sms: false,
      },
      maxPerRequest: MAX_EMAILS_PER_REQUEST,
    });
  } catch (error) {
    console.error("Communication status failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load communication status" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const leadId = String(req.query.leadId || "").trim();
    const take = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);

    const logs = await prisma.leadCommunication.findMany({
      where: {
        companyId: req.clientUser.companyId,
        ...(leadId ? { leadId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return res.json({ success: true, logs });
  } catch (error) {
    console.error("Communication history failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load communication history" });
  }
});

router.post("/email", async (req, res) => {
  try {
    const leadIds = Array.isArray(req.body?.leadIds)
      ? [...new Set(req.body.leadIds.map((id) => String(id || "").trim()).filter(Boolean))]
      : [];
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!leadIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one lead." });
    }
    if (leadIds.length > MAX_EMAILS_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        message: `Send to a maximum of ${MAX_EMAILS_PER_REQUEST} leads at a time.`,
      });
    }
    if (!subject) {
      return res.status(400).json({ success: false, message: "Email subject is required." });
    }
    if (!message) {
      return res.status(400).json({ success: false, message: "Email message is required." });
    }

    const leads = await prisma.lead.findMany({
      where: {
        companyId: req.clientUser.companyId,
        id: { in: leadIds },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        course: true,
      },
    });

    const orderedLeads = leadIds
      .map((id) => leads.find((lead) => lead.id === id))
      .filter(Boolean);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const failures = [];

    // Send sequentially so a bulk action does not burst the Gmail API.
    for (const lead of orderedLeads) {
      const recipient = String(lead.email || "").trim();
      if (!validEmail(recipient)) {
        skipped += 1;
        failures.push({ leadId: lead.id, name: lead.name, reason: "No valid email address" });
        continue;
      }

      const personalizedSubject = personalize(subject, lead);
      const personalizedMessage = personalize(message, lead);

      try {
        const result = await sendGmailMessage(req.clientUser.userId, {
          to: recipient,
          subject: personalizedSubject,
          text: personalizedMessage,
        });
        sent += 1;
        await prisma.leadCommunication.create({
          data: {
            companyId: req.clientUser.companyId,
            userId: req.clientUser.userId,
            leadId: lead.id,
            channel: "EMAIL",
            status: "SENT",
            sender: result.from,
            recipient,
            subject: personalizedSubject,
            message: personalizedMessage,
            providerMessageId: result.id,
          },
        });
      } catch (error) {
        failed += 1;
        const reason = String(error?.message || "Unable to send email").slice(0, 500);
        failures.push({ leadId: lead.id, name: lead.name, reason });
        await prisma.leadCommunication.create({
          data: {
            companyId: req.clientUser.companyId,
            userId: req.clientUser.userId,
            leadId: lead.id,
            channel: "EMAIL",
            status: "FAILED",
            recipient,
            subject: personalizedSubject,
            message: personalizedMessage,
            errorMessage: reason,
          },
        });

        if (/permission|scope|not connected|invalid_grant/i.test(reason)) {
          return res.status(400).json({
            success: false,
            message: "Reconnect Google in Settings → Integrations to grant Gmail permission.",
            sent,
            failed,
            skipped,
            failures,
          });
        }
      }
    }

    return res.json({
      success: true,
      message:
        sent > 0
          ? `${sent} email${sent === 1 ? "" : "s"} sent successfully${skipped ? ` · ${skipped} skipped` : ""}${failed ? ` · ${failed} failed` : ""}.`
          : "No emails were sent.",
      sent,
      failed,
      skipped,
      failures,
    });
  } catch (error) {
    console.error("Bulk Gmail send failed:", error);
    return res.status(500).json({ success: false, message: "Unable to send emails" });
  }
});

export default router;
