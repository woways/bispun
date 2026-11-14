// Shared, pure resolver for notification deep-link targets.
//
// Used by both the web notification click handler and the mobile push tap
// handler so a notification opens the EXACT record (lead, calendar event,
// support ticket, …), not just the module.
//
// The target is carried on `actionModule` in the form "<moduleKey>#<type>:<id>"
// (a dedicated field that is never stripped), e.g.
//   "lead-store#lead:<id>"   -> a specific lead
//   "calendar#event:<id>"    -> a specific calendar event
//   "help#ticket:<id>"       -> a specific support ticket
// For backward compatibility we also fall back to the legacy
// "LEAD_FOLLOWUP:<id>:" marker that older notifications embedded in the message
// body.
//
// Returns { moduleKey, targetType, targetId, leadId }.
//   moduleKey  – the base in-app module key (validate against an allowlist
//                before navigating).
//   targetType – the kind of record ("lead" | "event" | "ticket" | …) or null.
//   targetId   – the record id, or null.
//   leadId     – kept for backward compatibility; equals targetId when the
//                target is a lead, otherwise null.
//
// `targetType` is restricted to a short lowercase token so a malformed or
// hostile `actionModule` can never smuggle arbitrary data through the suffix.
const TARGET_RE = /^([a-z][a-z0-9-]{0,31}):(.+)$/;

export function parseNotificationTarget(actionModule, message) {
  const raw = String(actionModule || "");
  const hashIndex = raw.indexOf("#");
  const moduleKey = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const encodedTarget = hashIndex === -1 ? "" : raw.slice(hashIndex + 1);

  let targetType = null;
  let targetId = null;

  if (encodedTarget) {
    const m = encodedTarget.match(TARGET_RE);
    if (m) {
      targetType = m[1];
      targetId = m[2];
    }
  }

  // Legacy fallback: a lead id embedded in the message marker.
  if (!targetId && message) {
    const fm = String(message).match(/LEAD_FOLLOWUP:([^:]+):/);
    if (fm) {
      targetType = "lead";
      targetId = fm[1];
    }
  }

  const leadId = targetType === "lead" ? targetId : null;

  return { moduleKey, targetType, targetId, leadId };
}
