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

function formatRupees(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

// PDF 11.8: when Super Admin marks a referral reward as credited, the referring
// Client Admin/user receives an "Amount credited" notification. Routed to the
// referrals module so clicking it opens the referral history.
export async function createReferralCreditedNotification({
  companyId,
  userId,
  amount,
}) {
  return createClientNotification({
    companyId,
    userId,
    title: "Amount credited",
    message: `Your referral reward of ${formatRupees(
      amount
    )} has been marked as credited. View your referral history for details.`,
    type: "REFERRAL",
    actionModule: "my-referrals",
    actionLabel: "View referrals",
  });
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