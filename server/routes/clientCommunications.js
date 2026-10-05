import { Router } from "express";
import multer from "multer";

import prisma from "../lib/prisma.js";
import { sendGmailMessage } from "../lib/google.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";

const router = Router();
const MAX_EMAILS_PER_REQUEST = 100;
const MAX_ATTACHMENTS = 10;
// Gmail's final MIME message is larger than the original files because attachments
// are base64 encoded. Keep the uploaded binary total conservative for reliability.
const MAX_TOTAL_ATTACHMENT_BYTES = 18 * 1024 * 1024;
const MAX_SINGLE_ATTACHMENT_BYTES = 18 * 1024 * 1024;

const BUSINESS_ATTACHMENT_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".ppt",
  ".pptx",
  ".txt",
  ".zip",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_ATTACHMENTS,
    fileSize: MAX_SINGLE_ATTACHMENT_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || "").toLowerCase();
    const dotIndex = name.lastIndexOf(".");
    const extension = dotIndex >= 0 ? name.slice(dotIndex) : "";

    if (!BUSINESS_ATTACHMENT_EXTENSIONS.has(extension)) {
      return cb(
        new Error(
          "Unsupported attachment. Use images, PDF, Word, Excel, CSV, PowerPoint, TXT or ZIP files."
        )
      );
    }

    return cb(null, true);
  },
});

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

function parseLeadIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((id) => String(id || "").trim()).filter(Boolean))];
  }

  const raw = String(value || "").trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return [...new Set(parsed.map((id) => String(id || "").trim()).filter(Boolean))];
    }
  } catch {
    // Fall back to comma separated IDs for compatibility.
  }

  return [...new Set(raw.split(",").map((id) => id.trim()).filter(Boolean))];
}

function parseDriveLinks(value) {
  const rawLinks = String(value || "")
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const links = [];

  for (const raw of rawLinks) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      throw new Error("Enter a valid Google Drive link.");
    }

    if (url.protocol !== "https:") {
      throw new Error("Google Drive links must use https://");
    }

    const hostname = url.hostname.toLowerCase();
    const allowed =
      hostname === "drive.google.com" ||
      hostname === "docs.google.com" ||
      hostname.endsWith(".drive.google.com") ||
      hostname.endsWith(".docs.google.com");

    if (!allowed) {
      throw new Error("Only Google Drive or Google Docs links are allowed here.");
    }

    links.push(url.toString());
  }

  return [...new Set(links)];
}

function appendDriveLinks(message, driveLinks) {
  if (!driveLinks.length) return String(message || "");

  const linkBlock = [
    "Google Drive links:",
    ...driveLinks.map((link) => `- ${link}`),
  ].join("\n");

  const body = String(message || "").trimEnd();
  return body ? `${body}\n\n${linkBlock}` : linkBlock;
}

function runAttachmentUpload(req, res, next) {
  upload.array("attachments", MAX_ATTACHMENTS)(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "One attachment is too large. Keep the total attachment size under 18 MB.",
        });
      }
      if (error.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          message: `Attach a maximum of ${MAX_ATTACHMENTS} files per email.`,
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: error?.message || "Unable to upload email attachment",
    });
  });
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
      emailAttachments: {
        enabled: true,
        maxFiles: MAX_ATTACHMENTS,
        maxTotalBytes: MAX_TOTAL_ATTACHMENT_BYTES,
        driveLinks: true,
      },
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

router.post("/email", runAttachmentUpload, async (req, res) => {
  try {
    const leadIds = parseLeadIds(req.body?.leadIds);
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();
    const driveLinks = parseDriveLinks(req.body?.driveLinks);
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];
    const totalAttachmentBytes = uploadedFiles.reduce(
      (sum, file) => sum + Number(file.size || 0),
      0
    );

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
    if (!message && !uploadedFiles.length && !driveLinks.length) {
      return res.status(400).json({
        success: false,
        message: "Add a message, attachment or Google Drive link before sending.",
      });
    }
    if (totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      return res.status(400).json({
        success: false,
        message: "Total attachment size is too large. Keep all attachments together under 18 MB.",
      });
    }

    const attachments = uploadedFiles.map((file) => ({
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    }));

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
    const emailTemplate = appendDriveLinks(message, driveLinks);
    const attachmentNames = attachments.map((item) => item.filename);

    // Send sequentially so a bulk action does not burst the Gmail API.
    for (const lead of orderedLeads) {
      const recipient = String(lead.email || "").trim();
      if (!validEmail(recipient)) {
        skipped += 1;
        failures.push({ leadId: lead.id, name: lead.name, reason: "No valid email address" });
        continue;
      }

      const personalizedSubject = personalize(subject, lead);
      const personalizedMessage = personalize(emailTemplate, lead);
      const historyMessage = attachmentNames.length
        ? `${personalizedMessage}${personalizedMessage ? "\n\n" : ""}Attachments: ${attachmentNames.join(", ")}`
        : personalizedMessage;

      try {
        const result = await sendGmailMessage(req.clientUser.userId, {
          to: recipient,
          subject: personalizedSubject,
          text: personalizedMessage,
          attachments,
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
            message: historyMessage || "(Attachment only email)",
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
            message: historyMessage || "(Attachment only email)",
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
          ? `${sent} email${sent === 1 ? "" : "s"} sent successfully${attachmentNames.length ? ` with ${attachmentNames.length} attachment${attachmentNames.length === 1 ? "" : "s"}` : ""}${driveLinks.length ? ` · ${driveLinks.length} Drive link${driveLinks.length === 1 ? "" : "s"}` : ""}${skipped ? ` · ${skipped} skipped` : ""}${failed ? ` · ${failed} failed` : ""}.`
          : "No emails were sent.",
      sent,
      failed,
      skipped,
      failures,
      attachmentCount: attachmentNames.length,
      driveLinkCount: driveLinks.length,
    });
  } catch (error) {
    console.error("Bulk Gmail send failed:", error);
    return res.status(400).json({
      success: false,
      message: error?.message || "Unable to send emails",
    });
  }
});

export default router;
