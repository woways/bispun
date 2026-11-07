import prisma from "./prisma.js";

export const CALENDAR_REMINDER_MINUTES = 10;
const REMINDER_WINDOW_MS = CALENDAR_REMINDER_MINUTES * 60 * 1000;
const WORKER_INTERVAL_MS = 20 * 1000;
let workerTimer = null;
let workerRunning = false;

function reminderMarker(eventId) {
  return `CALENDAR_REMINDER:${eventId}`;
}

function formatEventTime(value) {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function createReminderIfMissing(event) {
  if (!event?.id || !event?.companyId || !event?.assignedToUserId) return false;

  const marker = reminderMarker(event.id);
  const exists = await prisma.notification.findFirst({
    where: {
      companyId: event.companyId,
      userId: event.assignedToUserId,
      message: { contains: marker },
    },
    select: { id: true },
  });

  if (exists) return false;

  await prisma.notification.create({
    data: {
      companyId: event.companyId,
      userId: event.assignedToUserId,
      title: "Calendar event in 10 minutes",
      message: `${event.title} starts at ${formatEventTime(event.startAt)}. ${marker}`,
      type: "REMINDER",
      actionModule: "dashboard",
      actionLabel: "Open calendar",
    },
  });

  return true;
}

export async function ensureCalendarRemindersForUser(companyId, userId) {
  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const events = await prisma.calendarEvent.findMany({
    where: {
      companyId,
      assignedToUserId: userId,
      status: "SCHEDULED",
      allDay: false,
      startAt: { gt: now, lte: soon },
    },
    select: {
      id: true,
      companyId: true,
      assignedToUserId: true,
      title: true,
      startAt: true,
    },
    orderBy: { startAt: "asc" },
  });

  let created = 0;
  for (const event of events) {
    if (await createReminderIfMissing(event)) created += 1;
  }
  return created;
}

export async function processCalendarReminders() {
  if (workerRunning) return { created: 0, skipped: true };
  workerRunning = true;

  try {
    const now = new Date();
    const soon = new Date(now.getTime() + REMINDER_WINDOW_MS);
    const events = await prisma.calendarEvent.findMany({
      where: {
        assignedToUserId: { not: null },
        status: "SCHEDULED",
        allDay: false,
        startAt: { gt: now, lte: soon },
      },
      select: {
        id: true,
        companyId: true,
        assignedToUserId: true,
        title: true,
        startAt: true,
      },
      orderBy: { startAt: "asc" },
      take: 1000,
    });

    let created = 0;
    for (const event of events) {
      if (await createReminderIfMissing(event)) created += 1;
    }

    return { created, skipped: false };
  } finally {
    workerRunning = false;
  }
}

export function startCalendarReminderWorker() {
  if (workerTimer) return workerTimer;

  processCalendarReminders().catch((error) => {
    console.error("Calendar reminder worker failed:", error);
  });

  workerTimer = setInterval(() => {
    processCalendarReminders().catch((error) => {
      console.error("Calendar reminder worker failed:", error);
    });
  }, WORKER_INTERVAL_MS);

  workerTimer.unref?.();
  return workerTimer;
}