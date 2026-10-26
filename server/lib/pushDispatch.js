// Bridges a freshly-created in-app Notification row to the user's mobile
// devices via FCM. This is the single, central, ADDITIVE hook: it runs after
// any notification.create (see server/lib/prisma.js) so every existing
// notification producer gains mobile push without touching their code.
//
// Guarantees:
//  - Best-effort: wrapped so it can never break notification creation or any
//    business operation (including when the DeviceToken table does not yet
//    exist because the migration is still pending).
//  - Tenant-isolated: tokens are looked up strictly by the notification's own
//    server-trusted companyId + userId. No cross-tenant delivery is possible.
//  - User-targeted only: company-wide notifications (userId = null) are NOT
//    pushed yet — broadcasting to every device in a company needs an explicit
//    product decision and is recorded as a follow-up.

import { sendToTokens } from "./pushService.js";

/** Pure: active, de-duplicated token strings from DeviceToken rows. */
export function selectDeliverableTokens(tokenRows) {
  return Array.from(
    new Set(
      (tokenRows || [])
        .filter((row) => row && row.active && row.token)
        .map((row) => row.token)
    )
  );
}

/**
 * @param prisma  the (unextended) Prisma client, passed in to avoid an import
 *                cycle with prisma.js
 * @param notification  the created Notification row
 */
export async function dispatchNotificationPush(prisma, notification) {
  try {
    if (!notification || !notification.companyId || !notification.userId) {
      return; // nothing to target safely
    }

    const tokenRows = await prisma.deviceToken.findMany({
      where: {
        companyId: notification.companyId,
        userId: notification.userId,
        active: true,
      },
      select: { token: true, active: true },
    });

    const tokens = selectDeliverableTokens(tokenRows);
    if (!tokens.length) return;

    const { invalidTokens } = await sendToTokens(tokens, notification);

    if (invalidTokens.length) {
      // Deactivate tokens FCM rejected — scoped to this tenant for safety.
      await prisma.deviceToken
        .updateMany({
          where: {
            token: { in: invalidTokens },
            companyId: notification.companyId,
          },
          data: { active: false },
        })
        .catch(() => {});
    }
  } catch (error) {
    // Never let push problems (incl. a missing table pre-migration) surface.
    console.error("[push] dispatch failed:", error?.message || error);
  }
}
