import prisma from "./prisma.js";

export async function createClientNotification({
  companyId,
  userId = null,
  title,
  message,
  type = "INFO",
  actionModule = null,
  actionLabel = null,
}) {
  if (!companyId || !title || !message) {
    return null;
  }

  try {
    return await prisma.notification.create({
      data: {
        companyId,
        userId,
        title: String(title).trim(),
        message: String(message).trim(),
        type: String(type || "INFO")
          .trim()
          .toUpperCase(),
        actionModule:
          actionModule
            ? String(actionModule).trim()
            : null,
        actionLabel:
          actionLabel
            ? String(actionLabel).trim()
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Failed to create client notification:",
      error
    );

    // Notification failures must not break
    // the main business operation.
    return null;
  }
}

export async function createSupportTicketCreatedNotification({
  companyId,
  userId,
  ticketNumber,
  title,
}) {
  return createClientNotification({
    companyId,
    userId,
    title: "Support ticket submitted",
    message: `${ticketNumber} · ${title} has been submitted successfully and is waiting for Bispun review.`,
    type: "SUPPORT",
    actionModule: "help",
    actionLabel: "View support ticket",
  });
}

export async function createSupportTicketUpdatedNotification({
  companyId,
  userId = null,
  ticketNumber,
  ticketTitle,
  statusLabel,
  adminRemarks,
}) {
  const remarks =
    adminRemarks
      ? ` Admin note: ${adminRemarks}`
      : "";

  return createClientNotification({
    companyId,
    userId,
    title: "Support ticket updated",
    message: `${ticketNumber} · ${ticketTitle} is now ${statusLabel}.${remarks}`,
    type: "SUPPORT",
    actionModule: "help",
    actionLabel: "Open Help & Support",
  });
}