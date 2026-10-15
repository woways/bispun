import prisma from "./prisma.js";
import { sendGmailMessage } from "./google.js";
import { decryptToken, sendTemplateMessage } from "./whatsapp.js";

let workerTimer = null;
let workerRunning = false;

function cleanSteps(value) {
  return Array.isArray(value) ? value : [];
}

function asDelayMinutes(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(Math.round(number), 60 * 24 * 90);
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + asDelayMinutes(minutes) * 60 * 1000);
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function personalize(template, lead) {
  return String(template || "")
    .replaceAll("{{name}}", lead?.name || "")
    .replaceAll("{{phone}}", lead?.phone || "")
    .replaceAll("{{email}}", lead?.email || "")
    .replaceAll("{{course}}", lead?.course || "");
}

async function createLog({ enrollment, stepIndex, stepType, status, summary, providerMessageId, errorMessage }) {
  return prisma.nurtureRunLog.create({
    data: {
      companyId: enrollment.companyId,
      enrollmentId: enrollment.id,
      leadId: enrollment.leadId,
      stepIndex,
      stepType,
      status,
      summary: summary ? String(summary).slice(0, 1000) : null,
      providerMessageId: providerMessageId || null,
      errorMessage: errorMessage ? String(errorMessage).slice(0, 1000) : null,
    },
  });
}

async function hasReply(enrollment) {
  const inbound = await prisma.leadCommunication.findFirst({
    where: {
      companyId: enrollment.companyId,
      leadId: enrollment.leadId,
      createdAt: { gte: enrollment.startedAt },
      OR: [
        { channel: "WHATSAPP_INBOUND" },
        { status: { in: ["INBOUND", "RECEIVED", "REPLIED"] } },
      ],
    },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return inbound || null;
}

async function sendEmailStep({ enrollment, lead, step }) {
  const recipient = String(lead.email || "").trim();
  if (!validEmail(recipient)) throw new Error("Lead has no valid email address.");

  const subject = personalize(step.subject || "Follow-up", lead);
  const message = personalize(step.message || "", lead);
  if (!message.trim()) throw new Error("Email step has no message.");

  const result = await sendGmailMessage(enrollment.createdByUserId, {
    to: recipient,
    subject,
    text: message,
  });

  await prisma.leadCommunication.create({
    data: {
      companyId: enrollment.companyId,
      userId: enrollment.createdByUserId,
      leadId: lead.id,
      channel: "EMAIL",
      status: "SENT",
      sender: result.from,
      recipient,
      subject,
      message,
      providerMessageId: result.id,
    },
  });

  return {
    status: "SENT",
    summary: `Email sent to ${recipient}`,
    providerMessageId: result.id,
  };
}

async function sendWhatsAppStep({ enrollment, lead, step }) {
  const to = digits(lead.phone);
  if (!to) throw new Error("Lead has no valid phone number.");
  const templateName = String(step.templateName || "").trim();
  if (!templateName) throw new Error("WhatsApp step needs an approved template name.");

  const conn = await prisma.whatsAppConnection.findUnique({
    where: { companyId: enrollment.companyId },
  });
  if (!conn || conn.status !== "CONNECTED" || !conn.phoneNumberId) {
    throw new Error("WhatsApp is not connected for this company.");
  }
  const token = decryptToken(conn.accessToken);
  if (!token) throw new Error("WhatsApp token is invalid. Reconnect WhatsApp.");

  const result = await sendTemplateMessage({
    phoneNumberId: conn.phoneNumberId,
    token,
    to,
    templateName,
    languageCode: step.languageCode || "en_US",
    components: Array.isArray(step.components) ? step.components : [],
  });
  const messageId = result?.messages?.[0]?.id || null;

  await prisma.leadCommunication.create({
    data: {
      companyId: enrollment.companyId,
      userId: enrollment.createdByUserId,
      leadId: lead.id,
      channel: "WHATSAPP",
      status: "SENT",
      sender: conn.displayNumber || conn.phoneNumberId || null,
      recipient: to,
      subject: "Smart Nurture",
      message: `Template: ${templateName}`,
      providerMessageId: messageId,
    },
  });

  return {
    status: "SENT",
    summary: `WhatsApp template ${templateName} sent to ${to}`,
    providerMessageId: messageId,
  };
}

async function createFollowUpTask({ enrollment, lead, step }) {
  const assignedUser = lead.assignedToName
    ? await prisma.user.findFirst({
        where: {
          companyId: enrollment.companyId,
          active: true,
          name: { equals: lead.assignedToName, mode: "insensitive" },
        },
        select: { id: true },
      })
    : null;

  const now = new Date();
  const durationMinutes = Math.max(15, Number(step.durationMinutes || 30));
  const endAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const event = await prisma.calendarEvent.create({
    data: {
      companyId: enrollment.companyId,
      title: `Follow up with ${lead.name}`,
      description: personalize(
        step.message || `Smart Nurture follow-up for ${lead.name}. Review the communication history before contacting the lead.`,
        lead
      ),
      type: "FOLLOW_UP",
      status: "SCHEDULED",
      startAt: now,
      endAt,
      createdByUserId: enrollment.createdByUserId,
      assignedToUserId: assignedUser?.id || null,
    },
  });

  return {
    status: "CREATED",
    summary: `Follow-up task created${assignedUser ? " for the assigned counsellor" : ""}`,
    providerMessageId: event.id,
  };
}

async function notifyManager({ enrollment, lead, step }) {
  const assignedUser = lead.assignedToName
    ? await prisma.user.findFirst({
        where: {
          companyId: enrollment.companyId,
          active: true,
          name: { equals: lead.assignedToName, mode: "insensitive" },
        },
        select: { id: true, managerId: true },
      })
    : null;

  let managerId = assignedUser?.managerId || null;
  if (!managerId) {
    const fallback = await prisma.user.findFirst({
      where: {
        companyId: enrollment.companyId,
        active: true,
        role: { in: ["CLIENT_ADMIN", "MANAGER"] },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    managerId = fallback?.id || null;
  }

  const message = personalize(
    step.message || `${lead.name} has not replied to the nurture sequence. Please review and intervene.`,
    lead
  );

  const notification = await prisma.notification.create({
    data: {
      companyId: enrollment.companyId,
      userId: managerId,
      title: "Lead needs manager attention",
      message,
      type: "WARNING",
      actionModule: "lead-store",
      actionLabel: "Open Lead Store",
    },
  });

  return {
    status: "NOTIFIED",
    summary: managerId ? "Manager notified" : "Company notification created",
    providerMessageId: notification.id,
  };
}

async function executeStep({ enrollment, sequence, lead, stepIndex, step }) {
  const type = String(step?.type || "").trim().toUpperCase();
  if (type === "EMAIL") return sendEmailStep({ enrollment, lead, step });
  if (type === "WHATSAPP_TEMPLATE") return sendWhatsAppStep({ enrollment, lead, step });
  if (type === "FOLLOW_UP_TASK") return createFollowUpTask({ enrollment, lead, step });
  if (type === "MANAGER_NOTIFICATION") return notifyManager({ enrollment, lead, step });
  throw new Error(`Unsupported nurture step: ${type || "unknown"}`);
}

export async function processNurtureEnrollment(enrollmentId) {
  const enrollment = await prisma.nurtureEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { sequence: true },
  });
  if (!enrollment || enrollment.status !== "ACTIVE") return null;
  if (enrollment.sequence.status !== "ACTIVE") return null;

  const steps = cleanSteps(enrollment.sequence.steps);
  if (!steps.length || enrollment.nextStepIndex >= steps.length) {
    return prisma.nurtureEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null },
    });
  }

  const reply = await hasReply(enrollment);
  if (reply) {
    await createLog({
      enrollment,
      stepIndex: enrollment.nextStepIndex,
      stepType: "RESPONSE_CHECK",
      status: "REPLIED",
      summary: "Sequence stopped because the lead replied.",
    });
    return prisma.nurtureEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "REPLIED", completedAt: new Date(), nextRunAt: null, lastError: null },
    });
  }

  const lead = await prisma.lead.findFirst({
    where: { id: enrollment.leadId, companyId: enrollment.companyId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      course: true,
      stage: true,
      assignedToName: true,
    },
  });

  if (!lead) {
    return prisma.nurtureEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "FAILED", completedAt: new Date(), nextRunAt: null, lastError: "Lead no longer exists." },
    });
  }

  if (lead.stage === "ADMITTED" || lead.stage === "LOST") {
    await createLog({
      enrollment,
      stepIndex: enrollment.nextStepIndex,
      stepType: "LEAD_STATE_CHECK",
      status: "SKIPPED",
      summary: `Sequence stopped because the lead is ${lead.stage.toLowerCase()}.`,
    });
    return prisma.nurtureEnrollment.update({
      where: { id: enrollment.id },
      data: { status: "COMPLETED", completedAt: new Date(), nextRunAt: null, lastError: null },
    });
  }

  const stepIndex = enrollment.nextStepIndex;
  const step = steps[stepIndex] || {};
  const stepType = String(step.type || "UNKNOWN").toUpperCase();

  try {
    const result = await executeStep({ enrollment, sequence: enrollment.sequence, lead, stepIndex, step });
    await createLog({
      enrollment,
      stepIndex,
      stepType,
      status: result.status || "SENT",
      summary: result.summary,
      providerMessageId: result.providerMessageId,
    });

    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) {
      await prisma.nurtureSequence.update({
        where: { id: enrollment.sequenceId },
        data: { lastRunAt: new Date() },
      });
      return prisma.nurtureEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: "COMPLETED",
          nextStepIndex: nextIndex,
          nextRunAt: null,
          completedAt: new Date(),
          lastError: null,
        },
      });
    }

    const nextStep = steps[nextIndex] || {};
    const nextRunAt = addMinutes(new Date(), nextStep.delayMinutes);
    await prisma.nurtureSequence.update({
      where: { id: enrollment.sequenceId },
      data: { lastRunAt: new Date() },
    });
    return prisma.nurtureEnrollment.update({
      where: { id: enrollment.id },
      data: {
        nextStepIndex: nextIndex,
        nextRunAt,
        lastError: null,
      },
    });
  } catch (error) {
    const reason = String(error?.message || "Nurture step failed").slice(0, 1000);
    await createLog({
      enrollment,
      stepIndex,
      stepType,
      status: "FAILED",
      errorMessage: reason,
      summary: `Step failed: ${reason}`,
    });
    return prisma.nurtureEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "FAILED",
        nextRunAt: null,
        completedAt: new Date(),
        lastError: reason,
      },
    });
  }
}

export async function processDueNurtureEnrollments({ limit = 25 } = {}) {
  if (workerRunning) return { processed: 0, skipped: true };
  workerRunning = true;
  try {
    const due = await prisma.nurtureEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextRunAt: { lte: new Date() },
        sequence: { status: "ACTIVE" },
      },
      select: { id: true },
      orderBy: { nextRunAt: "asc" },
      take: Math.min(Math.max(Number(limit) || 25, 1), 100),
    });

    for (const item of due) {
      await processNurtureEnrollment(item.id).catch((error) => {
        console.error("Nurture enrollment processing failed:", item.id, error);
      });
    }
    return { processed: due.length, skipped: false };
  } finally {
    workerRunning = false;
  }
}

export function startNurtureWorker() {
  if (workerTimer) return workerTimer;
  const intervalMs = Math.max(60_000, Number(process.env.NURTURE_WORKER_INTERVAL_MS || 60_000));
  workerTimer = setInterval(() => {
    processDueNurtureEnrollments().catch((error) => {
      console.error("Smart Nurture worker failed:", error);
    });
  }, intervalMs);
  workerTimer.unref?.();
  return workerTimer;
}

export function firstRunAtForSteps(steps, start = new Date()) {
  const first = cleanSteps(steps)[0] || {};
  return addMinutes(start, first.delayMinutes);
}