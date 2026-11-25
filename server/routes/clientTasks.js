import { Router } from "express";

import prisma from "../lib/prisma.js";
import { requireClientUser } from "../middleware/clientAuth.js";

const router = Router();

router.use(requireClientUser);

const TASK_TYPES = [
  "CALL",
  "MEETING",
  "FOLLOWUP",
  "COUNSELLING",
  "PAYMENT",
  "GENERAL",
];
const TASK_PRIORITIES = ["LOW", "NORMAL", "HIGH"];

function normType(v) {
  const t = String(v || "").toUpperCase();
  return TASK_TYPES.includes(t) ? t : "GENERAL";
}

function normPriority(v) {
  const p = String(v || "").toUpperCase();
  return TASK_PRIORITIES.includes(p) ? p : "NORMAL";
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function serialize(task, userMap) {
  return {
    id: task.id,
    title: task.title,
    type: task.type,
    priority: task.priority,
    dueAt: task.dueAt,
    pinned: task.pinned,
    done: task.done,
    notes: task.notes,
    leadId: task.leadId,
    assignedToUserId: task.assignedToUserId,
    assignedToName: task.assignedToUserId
      ? userMap.get(task.assignedToUserId) || null
      : null,
    createdByUserId: task.createdByUserId,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

async function buildUserMap(companyId, tasks) {
  const ids = [
    ...new Set(tasks.map((t) => t.assignedToUserId).filter(Boolean)),
  ];
  const map = new Map();
  if (ids.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true, name: true },
    });
    users.forEach((u) => map.set(u.id, u.name));
  }
  return map;
}

// GET /api/client/tasks?scope=open|done|all — list tasks for the company
router.get("/", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const scope = String(req.query.scope || "open");

    const where = { companyId };
    if (scope === "open") where.done = false;
    else if (scope === "done") where.done = true;

    const tasks = await prisma.dashboardTask.findMany({
      where,
      orderBy: [
        { pinned: "desc" },
        { done: "asc" },
        { dueAt: "asc" },
        { createdAt: "desc" },
      ],
      take: 200,
    });

    const userMap = await buildUserMap(companyId, tasks);
    return res.json({
      success: true,
      tasks: tasks.map((t) => serialize(t, userMap)),
    });
  } catch (error) {
    console.error("GET /tasks failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to load tasks" });
  }
});

// POST /api/client/tasks — create a task
router.post("/", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const title = String(req.body?.title || "").trim();
    if (!title) {
      return res
        .status(400)
        .json({ success: false, message: "Task title is required" });
    }

    let assignedToUserId = req.body?.assignedToUserId
      ? String(req.body.assignedToUserId)
      : null;
    if (assignedToUserId) {
      const owner = await prisma.user.findFirst({
        where: { id: assignedToUserId, companyId, active: true },
        select: { id: true },
      });
      if (!owner) assignedToUserId = null;
    }

    const task = await prisma.dashboardTask.create({
      data: {
        companyId,
        title: title.slice(0, 300),
        type: normType(req.body?.type),
        priority: normPriority(req.body?.priority),
        dueAt: parseDate(req.body?.dueAt),
        pinned: Boolean(req.body?.pinned),
        notes: req.body?.notes ? String(req.body.notes).slice(0, 2000) : null,
        leadId: req.body?.leadId ? String(req.body.leadId) : null,
        assignedToUserId,
        createdByUserId: req.clientUser.userId,
      },
    });

    const userMap = await buildUserMap(companyId, [task]);
    return res
      .status(201)
      .json({ success: true, task: serialize(task, userMap) });
  } catch (error) {
    console.error("POST /tasks failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to create task" });
  }
});

// PATCH /api/client/tasks/:id — update a task
router.patch("/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const id = String(req.params.id);

    const existing = await prisma.dashboardTask.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    const data = {};
    if (req.body?.title !== undefined) {
      const title = String(req.body.title || "").trim();
      if (!title) {
        return res
          .status(400)
          .json({ success: false, message: "Task title cannot be empty" });
      }
      data.title = title.slice(0, 300);
    }
    if (req.body?.type !== undefined) data.type = normType(req.body.type);
    if (req.body?.priority !== undefined)
      data.priority = normPriority(req.body.priority);
    if (req.body?.dueAt !== undefined) data.dueAt = parseDate(req.body.dueAt);
    if (req.body?.pinned !== undefined) data.pinned = Boolean(req.body.pinned);
    if (req.body?.notes !== undefined)
      data.notes = req.body.notes ? String(req.body.notes).slice(0, 2000) : null;
    if (req.body?.leadId !== undefined)
      data.leadId = req.body.leadId ? String(req.body.leadId) : null;
    if (req.body?.assignedToUserId !== undefined) {
      let a = req.body.assignedToUserId
        ? String(req.body.assignedToUserId)
        : null;
      if (a) {
        const owner = await prisma.user.findFirst({
          where: { id: a, companyId, active: true },
          select: { id: true },
        });
        if (!owner) a = null;
      }
      data.assignedToUserId = a;
    }
    if (req.body?.done !== undefined) {
      data.done = Boolean(req.body.done);
      data.completedAt = data.done ? new Date() : null;
    }

    const task = await prisma.dashboardTask.update({ where: { id }, data });
    const userMap = await buildUserMap(companyId, [task]);
    return res.json({ success: true, task: serialize(task, userMap) });
  } catch (error) {
    console.error("PATCH /tasks/:id failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to update task" });
  }
});

// DELETE /api/client/tasks/:id — remove a task
router.delete("/:id", async (req, res) => {
  try {
    const companyId = req.clientUser.companyId;
    const id = String(req.params.id);
    const existing = await prisma.dashboardTask.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }
    await prisma.dashboardTask.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error("DELETE /tasks/:id failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Unable to delete task" });
  }
});

export default router;
