/* =========================================================
   CALENDAR EVENT AUTHORIZATION (edit / delete)

   CalendarEvent has no visibility/private flag yet, so this
   enforces the minimum safe rule without a schema change:
   only the event's creator, its assignee, or a CLIENT_ADMIN
   may edit or delete it. Previously any authenticated company
   user could modify any event.

   Viewing (GET) is intentionally left company-wide here so
   shared/company meetings stay visible; a proper private-vs-
   shared visibility model requires a schema column and is
   tracked as a migration-gated follow-up.
========================================================= */

/**
 * @param {{userId?: string, role?: string}|null} clientUser  req.clientUser
 * @param {{createdByUserId?: string|null, assignedToUserId?: string|null}|null} event
 * @returns {boolean}
 */
export function canModifyCalendarEvent(clientUser, event) {
  if (!clientUser || !event) return false;
  if (clientUser.role === "CLIENT_ADMIN") return true;
  if (event.createdByUserId && event.createdByUserId === clientUser.userId) {
    return true;
  }
  if (event.assignedToUserId && event.assignedToUserId === clientUser.userId) {
    return true;
  }
  return false;
}
