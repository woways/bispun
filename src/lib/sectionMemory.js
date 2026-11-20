// Pure helpers for per-sidebar-section navigation memory.
//
// The portal shell holds a single `module` string, so leaving a section and
// returning used to reset to that section's default page. These helpers map a
// module key to its "section" and let the shell remember the LAST page visited
// per section, restoring it on return. Admissions markets are tracked at market
// granularity so returning to "Domestic" restores the last domestic sub-tab
// (walk-ins / counselling / admissions-done), not the market default.
//
// Pure + framework-free so it is trivially unit-testable (see
// sectionMemory.test.js) and shared by the desktop sidebar and mobile nav.

// Map a module key to its section memory key.
export function getSectionKey(moduleKey) {
  const key = String(moduleKey || "");
  if (key.startsWith("domestic-")) return "admissions:domestic";
  if (key.startsWith("international-")) return "admissions:international";
  if (key === "admissions" || key === "walkins" || key === "counselling") {
    return "admissions:overall";
  }
  if (key === "revenue") return "finance";
  if (key === "analytics") return "insights";
  return key;
}

// Record a visited module into a section-memory map (mutates + returns it).
// Also records a coarse "admissions" entry so the mobile bottom-nav Admissions
// tab can restore the last admissions page regardless of market.
export function recordSectionModule(memory, moduleKey) {
  const map = memory || {};
  const key = String(moduleKey || "");
  if (!key) return map;
  const section = getSectionKey(key);
  map[section] = key;
  if (section.startsWith("admissions:")) map.admissions = key;
  return map;
}

// Resolve which module to open for a section, preferring the remembered page
// and falling back to the section's default when nothing is remembered yet.
export function resolveSectionModule(memory, sectionKey, fallback) {
  const map = memory || {};
  return map[sectionKey] || fallback;
}
