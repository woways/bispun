import { Router } from "express";

import prisma from "../lib/prisma.js";
import {
  firstRunAtForSteps,
  nurtureStopReason,
  processDueNurtureEnrollments,
} from "../lib/nurtureEngine.js";
import {
  requireClientUser,
  requireClientPermission,
} from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);
router.use(
  requireClientPermission(
    "canManageLeads",
    "You do not have permission to manage nurture sequences"
  )
);

const VALID_STEP_TYPES = new Set([
  "EMAIL",
  "WHATSAPP_TEMPLATE",
  "FOLLOW_UP_TASK",
  "MANAGER_NOTIFICATION",
]);

function normalizePreferredTime(value, index) {
  const preferredTime = String(value || "").trim();
  if (!preferredTime) return "";
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(preferredTime)) {
    throw new Error(`Step ${index + 1}: preferred time must use HH:mm format.`);
  }
  return preferredTime;
}

function normalizeStep(step, index) {
  const type = String(step?.type || "").trim().toUpperCase();
  if (!VALID_STEP_TYPES.has(type)) {
    throw new Error(`Step ${index + 1} has an unsupported type.`);
  }

  const delayMinutes = Math.min(
    Math.max(Math.round(Number(step?.delayMinutes || 0)), 0),
    60 * 24 * 90
  );

  const normalized = {
    type,
    delayMinutes,
  };

  const preferredTime = normalizePreferredTime(step?.preferredTime, index);
  if (preferredTime) normalized.preferredTime = preferredTime;

  if (type === "EMAIL") {
    const subject = String(step?.subject || "").trim();
    const message = String(step?.message || "").trim();
    if (!subject || !message) {
      throw new Error(`Step ${index + 1}: email subject and message are required.`);
    }
    normalized.subject = subject.slice(0, 300);
    normalized.message = message.slice(0, 12000);
  }

  if (type === "WHATSAPP_TEMPLATE") {
    const templateName = String(step?.templateName || "").trim();
    if (!templateName) {
      throw new Error(`Step ${index + 1}: WhatsApp approved template name is required.`);
    }
    normalized.templateName = templateName.slice(0, 200);
    normalized.languageCode = String(step?.languageCode || "en_US").trim().slice(0, 30) || "en_US";
  }

  if (type === "FOLLOW_UP_TASK" || type === "MANAGER_NOTIFICATION") {
    const message = String(step?.message || "").trim();
    if (message) normalized.message = message.slice(0, 5000);
  }

  if (type === "FOLLOW_UP_TASK") {
    normalized.durationMinutes = Math.min(
      Math.max(Math.round(Number(step?.durationMinutes || 30)), 15),
      240
    );
  }

  return normalized;
}

function normalizeSteps(value) {
  if (!Array.isArray(value) || !value.length) {
    throw new Error("Add at least one nurture step.");
  }
  if (value.length > 10) throw new Error("Use a maximum of 10 steps per sequence.");
  return value.map(normalizeStep);
}

function serializeSequence(sequence) {
  const counts = Object.fromEntries(
    (sequence?._countByStatus || []).map((row) => [row.status, row.count])
  );
  return {
    id: sequence.id,
    name: sequence.name,
    description: sequence.description,
    status: sequence.status,
    steps: Array.isArray(sequence.steps) ? sequence.steps : [],
    createdByUserId: sequence.createdByUserId,
    lastRunAt: sequence.lastRunAt,
    createdAt: sequence.createdAt,
    updatedAt: sequence.updatedAt,
    counts,
  };
}

router.get("/sequences", async (req, res) => {
  try {
    await processDueNurtureEnrollments({ limit: 15 }).catch(() => {});
    const companyId = req.clientUser.companyId;
    const sequences = await prisma.nurtureSequence.findMany({
      where: { companyId, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
    });

    const ids = sequences.map((item) => item.id);
    const grouped = ids.length
      ? await prisma.nurtureEnrollment.groupBy({
          by: ["sequenceId", "status"],
          where: { companyId, sequenceId: { in: ids } },
          _count: { _all: true },
        })
      : [];

    const bySequence = new Map();
    for (const row of grouped) {
      if (!bySequence.has(row.sequenceId)) bySequence.set(row.sequenceId, []);
      bySequence.get(row.sequenceId).push({
        status: row.status,
        count: row._count?._all || 0,
      });
    }

    return res.json({
      success: true,
      sequences: sequences.map((sequence) =>
        serializeSequence({
          ...sequence,
          _countByStatus: bySequence.get(sequence.id) || [],
        })
      ),
    });
  } catch (error) {
    console.error("Load nurture sequences failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load nurture sequences" });
  }
});

router.post("/sequences", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();
    if (!name) return res.status(400).json({ success: false, message: "Sequence name is required." });

    const steps = normalizeSteps(req.body?.steps);
    const sequence = await prisma.nurtureSequence.create({
      data: {
        companyId: req.clientUser.companyId,
        name: name.slice(0, 160),
        description: description ? description.slice(0, 1000) : null,
        status: "ACTIVE",
        steps,
        createdByUserId: req.clientUser.userId,
      },
    });

    return res.status(201).json({ success: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    const message = String(error?.message || "Unable to create nurture sequence");
    const isValidation = /step|sequence|required|maximum|unsupported/i.test(message);
    if (!isValidation) console.error("Create nurture sequence failed:", error);
    return res.status(isValidation ? 400 : 500).json({ success: false, message });
  }
});

router.patch("/sequences/:id/status", async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim().toUpperCase();
    if (!["ACTIVE", "PAUSED", "ARCHIVED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid sequence status." });
    }
    const existing = await prisma.nurtureSequence.findFirst({
      where: { id: req.params.id, companyId: req.clientUser.companyId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Sequence not found." });

    const sequence = await prisma.nurtureSequence.update({
      where: { id: existing.id },
      data: { status },
    });
    return res.json({ success: true, sequence: serializeSequence(sequence) });
  } catch (error) {
    console.error("Update nurture sequence status failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update sequence" });
  }
});

router.post("/sequences/:id/enroll", async (req, res) => {
  try {
    const leadIds = Array.isArray(req.body?.leadIds)
      ? [...new Set(req.body.leadIds.map((id) => String(id || "").trim()).filter(Boolean))]
      : [];
    if (!leadIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one lead." });
    }
    if (leadIds.length > 500) {
      return res.status(400).json({ success: false, message: "Enroll a maximum of 500 leads at a time." });
    }

    const sequence = await prisma.nurtureSequence.findFirst({
      where: {
        id: req.params.id,
        companyId: req.clientUser.companyId,
        status: { not: "ARCHIVED" },
      },
    });
    if (!sequence) return res.status(404).json({ success: false, message: "Sequence not found." });

    const steps = Array.isArray(sequence.steps) ? sequence.steps : [];
    if (!steps.length) return res.status(400).json({ success: false, message: "Sequence has no steps." });

    const [leads, companySettings] = await Promise.all([
      prisma.lead.findMany({
        where: { companyId: req.clientUser.companyId, id: { in: leadIds } },
        select: { id: true, name: true, stage: true, leadStatus: true },
      }),
      prisma.companySettings.findUnique({
        where: { companyId: req.clientUser.companyId },
        select: { timezone: true },
      }),
    ]);
    if (!leads.length) return res.status(404).json({ success: false, message: "No matching leads found." });

    const now = new Date();
    let enrolled = 0;
    let skipped = 0;
    for (const lead of leads) {
      if (nurtureStopReason(lead)) {
        skipped += 1;
        continue;
      }
      await prisma.nurtureEnrollment.upsert({
        where: { sequenceId_leadId: { sequenceId: sequence.id, leadId: lead.id } },
        update: {
          leadName: lead.name,
          createdByUserId: req.clientUser.userId,
          status: "ACTIVE",
          nextStepIndex: 0,
          nextRunAt: firstRunAtForSteps(steps, now, companySettings?.timezone),
          startedAt: now,
          completedAt: null,
          lastError: null,
        },
        create: {
          companyId: req.clientUser.companyId,
          sequenceId: sequence.id,
          leadId: lead.id,
          leadName: lead.name,
          createdByUserId: req.clientUser.userId,
          status: "ACTIVE",
          nextStepIndex: 0,
          nextRunAt: firstRunAtForSteps(steps, now, companySettings?.timezone),
          startedAt: now,
        },
      });
      enrolled += 1;
    }

    // Execute zero-delay first steps immediately so the user gets instant feedback.
    await processDueNurtureEnrollments({ limit: Math.min(enrolled, 50) }).catch(() => {});

    return res.json({
      success: true,
      enrolled,
      skipped,
      message: `${enrolled} lead${enrolled === 1 ? "" : "s"} enrolled${skipped ? ` · ${skipped} skipped because they are Admitted/Lost/Closed` : ""}.`,
    });
  } catch (error) {
    console.error("Enroll nurture leads failed:", error);
    return res.status(500).json({ success: false, message: "Unable to enroll leads" });
  }
});

router.get("/enrollments", async (req, res) => {
  try {
    await processDueNurtureEnrollments({ limit: 15 }).catch(() => {});
    const companyId = req.clientUser.companyId;
    const sequenceId = String(req.query.sequenceId || "").trim();
    const leadId = String(req.query.leadId || "").trim();
    const take = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const enrollments = await prisma.nurtureEnrollment.findMany({
      where: {
        companyId,
        ...(sequenceId ? { sequenceId } : {}),
        ...(leadId ? { leadId } : {}),
      },
      include: {
        sequence: { select: { id: true, name: true, status: true, steps: true } },
        logs: { orderBy: { executedAt: "desc" }, take: 5 },
      },
      orderBy: { updatedAt: "desc" },
      take,
    });

    return res.json({ success: true, enrollments });
  } catch (error) {
    console.error("Load nurture enrollments failed:", error);
    return res.status(500).json({ success: false, message: "Unable to load nurture activity" });
  }
});

router.patch("/enrollments/:id/status", async (req, res) => {
  try {
    const status = String(req.body?.status || "").trim().toUpperCase();
    if (!["ACTIVE", "PAUSED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid enrollment status." });
    }
    const enrollment = await prisma.nurtureEnrollment.findFirst({
      where: { id: req.params.id, companyId: req.clientUser.companyId },
    });
    if (!enrollment) return res.status(404).json({ success: false, message: "Enrollment not found." });

    const updated = await prisma.nurtureEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status,
        ...(status === "ACTIVE" && !enrollment.nextRunAt ? { nextRunAt: new Date() } : {}),
        ...(status === "CANCELLED" ? { completedAt: new Date(), nextRunAt: null } : {}),
      },
    });
    return res.json({ success: true, enrollment: updated });
  } catch (error) {
    console.error("Update nurture enrollment failed:", error);
    return res.status(500).json({ success: false, message: "Unable to update nurture activity" });
  }
});

router.post("/run-now", async (_req, res) => {
  try {
    const result = await processDueNurtureEnrollments({ limit: 100 });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Run nurture worker failed:", error);
    return res.status(500).json({ success: false, message: "Unable to process nurture queue" });
  }
});

export default router;