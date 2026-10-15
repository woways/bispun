import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";
import {
  isWhatsAppConfigured,
  publicWhatsAppConfig,
  exchangeCodeForToken,
  subscribeAppToWaba,
  getWabaPhoneNumbers,
  sendTemplateMessage,
  encryptToken,
  decryptToken,
} from "../lib/whatsapp.js";

const router = Router();

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

async function findLeadByPhone(companyId, value) {
  const digits = phoneDigits(value);
  if (!digits) return null;
  const lastTen = digits.slice(-10);

  const candidates = await prisma.lead.findMany({
    where: {
      companyId,
      phone: { contains: lastTen },
    },
    select: { id: true, phone: true, name: true },
    take: 25,
  });

  return (
    candidates.find((lead) => phoneDigits(lead.phone).slice(-10) === lastTen) ||
    null
  );
}

function inboundMessageText(message) {
  const type = String(message?.type || "message");
  if (message?.text?.body) return String(message.text.body);
  if (message?.button?.text) return String(message.button.text);
  if (message?.interactive?.button_reply?.title) {
    return String(message.interactive.button_reply.title);
  }
  if (message?.interactive?.list_reply?.title) {
    return String(message.interactive.list_reply.title);
  }
  if (message?.image?.caption) return String(message.image.caption);
  if (message?.document?.caption) return String(message.document.caption);
  return `[${type} WhatsApp message]`;
}

function publicStatus(conn) {
  return {
    connected: Boolean(conn && conn.status === "CONNECTED"),
    status: conn?.status || "DISCONNECTED",
    displayNumber: conn?.displayNumber || null,
    verifiedName: conn?.verifiedName || null,
    wabaId: conn?.wabaId || null,
    connectedAt: conn?.connectedAt || null,
    lastError: conn?.lastError || null,
  };
}

/**
 * GET /status — is WhatsApp connected for this company?
 * Also returns the public config the frontend needs to launch Embedded Signup.
 */
router.get("/status", requireClientUser, async (req, res) => {
  try {
    const conn = await prisma.whatsAppConnection.findUnique({
      where: { companyId: req.clientUser.companyId },
    });
    return res.json({
      success: true,
      configured: isWhatsAppConfigured(),
      config: publicWhatsAppConfig(),
      ...publicStatus(conn),
    });
  } catch (error) {
    console.error("WhatsApp status failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load WhatsApp status" });
  }
});

/**
 * POST /connect — finalize Embedded Signup.
 * Body: { code, wabaId, phoneNumberId }
 *  - code: returned by FB.login (Embedded Signup)
 *  - wabaId, phoneNumberId: captured from the Embedded Signup postMessage event
 * Exchanges the code for a token, verifies the number, stores the connection.
 */
router.post("/connect", requireClientUser, async (req, res) => {
  if (!isWhatsAppConfigured()) {
    return res.status(400).json({ success: false, message: "WhatsApp is not configured on the server yet." });
  }
  const code = String(req.body?.code || "").trim();
  let wabaId = String(req.body?.wabaId || "").trim();
  let phoneNumberId = String(req.body?.phoneNumberId || "").trim();
  if (!code || !wabaId) {
    return res.status(400).json({ success: false, message: "Missing signup details. Please try connecting again." });
  }

  try {
    const token = await exchangeCodeForToken(code);

    // Confirm the number + pick up display name. If the frontend didn't pass a
    // phoneNumberId, fall back to the first number on the WABA.
    let displayNumber = null;
    let verifiedName = null;
    try {
      const numbers = await getWabaPhoneNumbers(wabaId, token);
      const match =
        numbers.find((n) => n.id === phoneNumberId) || numbers[0] || null;
      if (match) {
        phoneNumberId = match.id;
        displayNumber = match.display_phone_number || null;
        verifiedName = match.verified_name || null;
      }
    } catch (e) {
      // Non-fatal: we can still store the connection and refine later.
      console.warn("WhatsApp phone lookup failed:", e.message);
    }

    // Subscribe our app to the WABA so webhooks flow (best-effort).
    try {
      await subscribeAppToWaba(wabaId, token);
    } catch (e) {
      console.warn("WhatsApp subscribe failed:", e.message);
    }

    const data = {
      wabaId,
      phoneNumberId: phoneNumberId || null,
      displayNumber,
      verifiedName,
      accessToken: encryptToken(token),
      status: "CONNECTED",
      connectedByUserId: req.clientUser.userId,
      connectedAt: new Date(),
      lastError: null,
    };

    const conn = await prisma.whatsAppConnection.upsert({
      where: { companyId: req.clientUser.companyId },
      update: data,
      create: { companyId: req.clientUser.companyId, ...data },
    });

    return res.json({ success: true, ...publicStatus(conn) });
  } catch (error) {
    console.error("WhatsApp connect failed:", error);
    await prisma.whatsAppConnection
      .upsert({
        where: { companyId: req.clientUser.companyId },
        update: { status: "ERROR", lastError: error.message?.slice(0, 300) || "Connect failed" },
        create: {
          companyId: req.clientUser.companyId,
          status: "ERROR",
          lastError: error.message?.slice(0, 300) || "Connect failed",
        },
      })
      .catch(() => {});
    return res.status(500).json({ success: false, message: "Could not finish connecting WhatsApp. Please try again." });
  }
});

/** POST /disconnect — remove the stored connection. */
router.post("/disconnect", requireClientUser, async (req, res) => {
  try {
    await prisma.whatsAppConnection
      .delete({ where: { companyId: req.clientUser.companyId } })
      .catch(() => {});
    return res.json({ success: true, connected: false, status: "DISCONNECTED" });
  } catch (error) {
    console.error("WhatsApp disconnect failed:", error);
    return res.status(500).json({ success: false, message: "Unable to disconnect WhatsApp" });
  }
});

/**
 * POST /send-template — send an approved template to one recipient.
 * Body: { to, templateName, languageCode?, components? }
 * Used by the "send test" button and later by lead messaging.
 */
router.post("/send-template", requireClientUser, async (req, res) => {
  try {
    const conn = await prisma.whatsAppConnection.findUnique({
      where: { companyId: req.clientUser.companyId },
    });
    if (!conn || conn.status !== "CONNECTED" || !conn.phoneNumberId) {
      return res.status(400).json({ success: false, message: "WhatsApp is not connected." });
    }
    const token = decryptToken(conn.accessToken);
    if (!token) {
      return res.status(400).json({ success: false, message: "Stored WhatsApp token is invalid. Please reconnect." });
    }
    const to = String(req.body?.to || "").replace(/\D/g, "");
    const templateName = String(req.body?.templateName || "").trim();
    if (!to || !templateName) {
      return res.status(400).json({ success: false, message: "Recipient and template name are required." });
    }

    const result = await sendTemplateMessage({
      phoneNumberId: conn.phoneNumberId,
      token,
      to,
      templateName,
      languageCode: req.body?.languageCode || "en_US",
      components: Array.isArray(req.body?.components) ? req.body.components : [],
    });

    const messageId = result?.messages?.[0]?.id || null;
    const lead = await findLeadByPhone(req.clientUser.companyId, to).catch(() => null);

    await prisma.leadCommunication.create({
      data: {
        companyId: req.clientUser.companyId,
        userId: req.clientUser.userId,
        leadId: lead?.id || null,
        channel: "WHATSAPP",
        status: "SENT",
        sender: conn.displayNumber || conn.phoneNumberId || null,
        recipient: to,
        subject: "WhatsApp template",
        message: `Template: ${templateName}`,
        providerMessageId: messageId,
      },
    }).catch((error) => {
      console.warn("WhatsApp communication log failed:", error?.message);
    });

    if (lead?.id) {
      await prisma.leadCommunication.updateMany({
        where: {
          companyId: req.clientUser.companyId,
          leadId: lead.id,
          channel: "WHATSAPP_INBOUND",
          status: "WAITING_REPLY",
        },
        data: { status: "REPLIED" },
      }).catch(() => {});
    }

    return res.json({ success: true, messageId });
  } catch (error) {
    console.error("WhatsApp send-template failed:", error);
    return res.status(502).json({ success: false, message: error.message || "WhatsApp send failed" });
  }
});

export default router;

/**
 * Public webhook router (no auth) — mounted separately. Meta calls this.
 * GET: verification handshake. POST: inbound messages / status updates.
 */
export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.get("/", (req, res) => {
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && verifyToken && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

whatsappWebhookRouter.post("/", async (req, res) => {
  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const value = change?.value || {};
        const phoneNumberId = String(value?.metadata?.phone_number_id || "").trim();
        const messages = Array.isArray(value?.messages) ? value.messages : [];

        if (!phoneNumberId || !messages.length) continue;

        const conn = await prisma.whatsAppConnection.findFirst({
          where: { phoneNumberId },
          select: {
            companyId: true,
            connectedByUserId: true,
            displayNumber: true,
            phoneNumberId: true,
          },
        });

        if (!conn) continue;

        for (const message of messages) {
          const providerMessageId = String(message?.id || "").trim() || null;

          if (providerMessageId) {
            const duplicate = await prisma.leadCommunication.findFirst({
              where: {
                companyId: conn.companyId,
                providerMessageId,
              },
              select: { id: true },
            });
            if (duplicate) continue;
          }

          const from = phoneDigits(message?.from);
          const lead = await findLeadByPhone(conn.companyId, from).catch(() => null);

          await prisma.leadCommunication.create({
            data: {
              companyId: conn.companyId,
              userId: conn.connectedByUserId || "whatsapp-webhook",
              leadId: lead?.id || null,
              channel: "WHATSAPP_INBOUND",
              status: "WAITING_REPLY",
              sender: from || null,
              recipient: conn.displayNumber || conn.phoneNumberId || "WhatsApp",
              subject: "Inbound WhatsApp",
              message: inboundMessageText(message),
              providerMessageId,
            },
          });

          // Smart Nurture enrollment reply update: an inbound WhatsApp message
          // means the lead responded, so stop any active nurture sequences for
          // this lead immediately instead of waiting for the next worker tick.
          if (lead?.id) {
            const activeEnrollments = await prisma.nurtureEnrollment.findMany({
              where: {
                companyId: conn.companyId,
                leadId: lead.id,
                status: "ACTIVE",
              },
              select: { id: true, nextStepIndex: true },
            }).catch(() => []);

            if (activeEnrollments.length) {
              const completedAt = new Date();
              await prisma.nurtureEnrollment.updateMany({
                where: { id: { in: activeEnrollments.map((item) => item.id) } },
                data: {
                  status: "REPLIED",
                  completedAt,
                  nextRunAt: null,
                  lastError: null,
                },
              });

              await prisma.nurtureRunLog.createMany({
                data: activeEnrollments.map((item) => ({
                  companyId: conn.companyId,
                  enrollmentId: item.id,
                  leadId: lead.id,
                  stepIndex: item.nextStepIndex,
                  stepType: "RESPONSE_CHECK",
                  status: "REPLIED",
                  summary: "Sequence stopped because the lead replied on WhatsApp.",
                  executedAt: completedAt,
                })),
              }).catch(() => {});
            }
          }
        }
      }
    }
  } catch (error) {
    // Always acknowledge Meta so a temporary application error does not create
    // an aggressive webhook retry loop. Log the failure for server monitoring.
    console.error("WhatsApp inbound webhook handling failed:", error);
  }

  return res.sendStatus(200);
});