// Shared, pure resolver for notification deep-link targets.
//
// Used by both the web notification click handler and the mobile push tap
// handler so a lead notification opens the EXACT lead, not just the module.
//
// The lead id is carried on `actionModule` in the form "lead-store#lead:<id>"
// (a dedicated field that is never stripped). For backward compatibility we
// also fall back to the legacy "LEAD_FOLLOWUP:<id>:" marker that older
// notifications embedded in the message body.
//
// Returns { moduleKey, leadId }. `moduleKey` is the base in-app module key
// (validate it against an allowlist before navigating). `leadId` is null when
// no lead target is present.
export function parseNotificationTarget(actionModule, message) {
  const raw = String(actionModule || "");
  const hashIndex = raw.indexOf("#");
  const moduleKey = hashIndex === -1 ? raw : raw.slice(0, hashIndex);
  const encodedTarget = hashIndex === -1 ? "" : raw.slice(hashIndex + 1);

  let leadId = null;

  if (encodedTarget) {
    const m = encodedTarget.match(/^lead:(.+)$/);
    if (m) leadId = m[1];
  }

  if (!leadId && message) {
    const fm = String(message).match(/LEAD_FOLLOWUP:([^:]+):/);
    if (fm) leadId = fm[1];
  }

  return { moduleKey, leadId };
}
