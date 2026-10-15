import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);
router.use((req, res, next) => {
  if (
    req.clientUser?.role === "CLIENT_ADMIN" ||
    req.clientUser?.permissions?.canManageLeads === true ||
    req.clientUser?.permissions?.canManageAdmissions === true
  ) {
    return next();
  }
  return res.status(403).json({
    success: false,
    forbidden: true,
    message: "You do not have permission to manage lead calls",
  });
});

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeStatus(value, fallback = "DIALLED") {
  const status = String(value || "").trim().toUpperCase();
  const allowed = new Set([
    "DIALLED",
    "RINGING",
    "CONNECTED",
    "NOT_CONNECTED",
    "COMPLETED",
    "MISSED",
    "FAILED",
  ]);
  return allowed.has(status) ? status : fallback;
}

function normalizeDirection(value, fallback = "OUTBOUND") {
  const direction = String(value || "").trim().toUpperCase();
  return ["OUTBOUND", "INBOUND", "MISSED"].includes(direction)
    ? direction
    : fallback;
}


async function syncCallCommunication(call) {
  if (!call?.id) return;
  const providerMessageId = `call:${call.id}`;
  const duration = Number(call.durationSeconds || 0);
  const durationText = duration ? ` · ${Math.floor(duration / 60)}m ${duration % 60}s` : "";
  const outcomeText = call.outcome ? ` · ${call.outcome}` : "";
  const summary = `${String(call.direction || "OUTBOUND").replaceAll("_", " ")} call · ${String(call.status || "DIALLED").replaceAll("_", " ")}${outcomeText}${durationText}${call.notes ? `\n${call.notes}` : ""}`;

  const existing = await prisma.leadCommunication.findFirst({
    where: { companyId: call.companyId, providerMessageId },
    select: { id: true },
  });

  const data = {
    companyId: call.companyId,
    userId: call.userId || "telephony-webhook",
    leadId: call.leadId || null,
    channel: "CALL",
    status: call.status || "DIALLED",
    sender: call.direction === "INBOUND" || call.direction === "MISSED" ? call.phone : null,
    recipient: call.phone,
    subject: `${String(call.direction || "OUTBOUND").replaceAll("_", " ")} call`,
    message: summary,
    providerMessageId,
  };

  if (existing) {
    await prisma.leadCommunication.update({ where: { id: existing.id }, data });
  } else {
    await prisma.leadCommunication.create({ data });
  }
}

function telephonyStatus() {
  const provider = String(process.env.TELEPHONY_PROVIDER || "").trim();
  const outboundUrl = String(process.env.TELEPHONY_OUTBOUND_URL || "").trim();
  return {
    provider: provider || "CRM Dial",
    cloudDialEnabled: Boolean(provider && outboundUrl),
    providerConfigured: Boolean(provider),
    crmDialEnabled: true,
    recordingSupported: Boolean(provider),
    mode: provider && outboundUrl ? "CLOUD" : "DEVICE_DIAL",
  };
}

async function triggerProviderCall({ call, lead, user }) {
  const url = String(process.env.TELEPHONY_OUTBOUND_URL || "").trim();
  if (!url) return null;

  const headers = { "Content-Type": "application/json" };
  const apiKey = String(process.env.TELEPHONY_API_KEY || "").trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      callRecordId: call.id,
      companyId: call.companyId,
      leadId: call.leadId,
      leadName: call.leadName,
      to: call.phone,
      requestedByUserId: user.userId,
      requestedByName: user.name || null,
      provider: process.env.TELEPHONY_PROVIDER || null,
      lead: lead
        ? { id: lead.id, name: lead.name, phone: lead.phone, email: lead.email }
        : null,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Telephony provider call failed (${response.status})`);
  }
  return data;
}

router.get("/status", (_req, res) => {
  return res.json({ success: true, ...telephonyStatus() });
});

router.get("/history", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const leadId = String(req.query.leadId || "").trim();
    const phone = digits(req.query.phone);
    const take = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const calls = await prisma.callRecord.findMany({
      where: {
        companyId,
        ...(leadId ? { leadId } : {}),
        ...(!leadId && phone ? { phone } : {}),
      },
      orderBy: { startedAt: "desc" },
      take,
    });

    return res.json({ success: true, calls });
  } catch (error) {
    console.error("Load call history failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load call history" });
  }
});

router.post("/calls", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const leadId = String(req.body?.leadId || "").trim() || null;
    let phone = digits(req.body?.phone);
    let leadName = String(req.body?.leadName || "").trim() || null;
    let lead = null;

    if (leadId) {
      lead = await prisma.lead.findFirst({
        where: { id: leadId, companyId },
        select: { id: true, name: true, phone: true, email: true },
      });
      if (!lead) return res.status(404).json({ success: false, message: "Lead not found." });
      phone = digits(lead.phone) || phone;
      leadName = lead.name || leadName;
    }

    if (!phone || phone.length < 7) {
      return res.status(400).json({ success: false, message: "A valid phone number is required." });
    }

    const status = telephonyStatus();
    const call = await prisma.callRecord.create({
      data: {
        companyId,
        leadId,
        leadName,
        userId: req.clientUser.userId,
        phone,
        direction: "OUTBOUND",
        status: "DIALLED",
        provider: status.cloudDialEnabled ? status.provider : "CRM_DIAL",
      },
    });

    await syncCallCommunication(call).catch(() => {});

    if (!status.cloudDialEnabled) {
      return res.status(201).json({
        success: true,
        call,
        dialMode: "DEVICE",
        dialUrl: `tel:${phone}`,
        message: "Call opened in the device dialer. Update the outcome after the call.",
      });
    }

    try {
      const result = await triggerProviderCall({ call, lead, user: req.clientUser });
      const providerCallId = String(result?.callId || result?.id || result?.providerCallId || "").trim() || null;
      const updated = await prisma.callRecord.update({
        where: { id: call.id },
        data: {
          providerCallId,
          status: normalizeStatus(result?.status, "RINGING"),
        },
      });
      await syncCallCommunication(updated).catch(() => {});
      return res.status(201).json({
        success: true,
        call: updated,
        dialMode: "CLOUD",
        message: "Cloud call initiated.",
      });
    } catch (providerError) {
      const reason = String(providerError?.message || "Cloud call failed").slice(0, 500);
      const updated = await prisma.callRecord.update({
        where: { id: call.id },
        data: { status: "FAILED", notes: reason, endedAt: new Date() },
      });
      await syncCallCommunication(updated).catch(() => {});
      return res.status(502).json({ success: false, message: reason, call: updated });
    }
  } catch (error) {
    console.error("Start call failed:", error);
    return res.status(500).json({ success: false, message: "Unable to start call" });
  }
});

router.patch("/calls/:id", async (req, res) => {
  try {
    const existing = await prisma.callRecord.findFirst({
      where: { id: req.params.id, companyId: req.clientUser.companyId },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Call record not found." });

    const durationRaw = req.body?.durationSeconds;
    const durationSeconds = durationRaw === "" || durationRaw == null
      ? existing.durationSeconds
      : Math.min(Math.max(Math.round(Number(durationRaw) || 0), 0), 60 * 60 * 12);
    const status = req.body?.status ? normalizeStatus(req.body.status, existing.status) : existing.status;
    const now = new Date();

    const call = await prisma.callRecord.update({
      where: { id: existing.id },
      data: {
        status,
        outcome: String(req.body?.outcome || "").trim().slice(0, 160) || null,
        notes: String(req.body?.notes || "").trim().slice(0, 3000) || null,
        durationSeconds,
        ...(status === "CONNECTED" && !existing.answeredAt ? { answeredAt: now } : {}),
        ...(["COMPLETED", "NOT_CONNECTED", "MISSED", "FAILED"].includes(status)
          ? { endedAt: existing.endedAt || now }
          : {}),
      },
    });

    await syncCallCommunication(call).catch(() => {});

    return res.json({ success: true, call });
  } catch (error) {
    console.error("Update call failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update call" });
  }
});

export default router;

// Generic provider callback. A provider adapter/middleware can POST a normalized
// payload here. Secure it with TELEPHONY_WEBHOOK_SECRET.
export const telephonyWebhookRouter = Router();

telephonyWebhookRouter.post("/", async (req, res) => {
  const expected = String(process.env.TELEPHONY_WEBHOOK_SECRET || "").trim();
  const supplied = String(
    req.headers["x-telephony-secret"] || req.query.secret || req.body?.secret || ""
  ).trim();
  if (!expected || supplied !== expected) return res.sendStatus(403);

  try {
    const companyId = String(req.body?.companyId || "").trim();
    const providerCallId = String(req.body?.providerCallId || req.body?.callId || "").trim();
    const callRecordId = String(req.body?.callRecordId || "").trim();
    const phone = digits(req.body?.phone || req.body?.from || req.body?.to);
    const direction = normalizeDirection(req.body?.direction, "INBOUND");
    const status = normalizeStatus(req.body?.status, direction === "MISSED" ? "MISSED" : "RINGING");

    let call = null;
    if (callRecordId) {
      call = await prisma.callRecord.findUnique({ where: { id: callRecordId } });
    }
    if (!call && providerCallId) {
      call = await prisma.callRecord.findFirst({ where: { providerCallId } });
    }

    if (!call && companyId && phone) {
      const lead = await prisma.lead.findFirst({
        where: { companyId, phone: { contains: phone.slice(-10) } },
        select: { id: true, name: true },
      }).catch(() => null);
      call = await prisma.callRecord.create({
        data: {
          companyId,
          leadId: lead?.id || null,
          leadName: lead?.name || null,
          phone,
          direction,
          status,
          provider: String(process.env.TELEPHONY_PROVIDER || req.body?.provider || "CLOUD").slice(0, 80),
          providerCallId: providerCallId || null,
        },
      });
    }

    if (!call) return res.status(404).json({ success: false, message: "Call record not found." });

    const durationSeconds = req.body?.durationSeconds == null
      ? call.durationSeconds
      : Math.min(Math.max(Math.round(Number(req.body.durationSeconds) || 0), 0), 60 * 60 * 12);
    const ended = ["COMPLETED", "NOT_CONNECTED", "MISSED", "FAILED"].includes(status);

    const updated = await prisma.callRecord.update({
      where: { id: call.id },
      data: {
        direction,
        status,
        providerCallId: providerCallId || call.providerCallId,
        durationSeconds,
        outcome: String(req.body?.outcome || call.outcome || "").trim().slice(0, 160) || null,
        recordingUrl: String(req.body?.recordingUrl || call.recordingUrl || "").trim().slice(0, 2000) || null,
        ...(status === "CONNECTED" && !call.answeredAt ? { answeredAt: new Date() } : {}),
        ...(ended ? { endedAt: call.endedAt || new Date() } : {}),
      },
    });

    await syncCallCommunication(updated).catch(() => {});

    return res.json({ success: true, call: updated });
  } catch (error) {
    console.error("Telephony webhook failed:", error);
    return res.status(500).json({ success: false, message: "Unable to process telephony callback" });
  }
});