/* =========================================================
   LEADS BY SOURCE (dashboard donut) — single counting source

   Builds the "Leads by Source" breakdown AND its authoritative
   total so the donut's center number always equals the sum of
   its slices.

   Counting definition (documented, consistent):
     - Each lead row contributes 1 to the bucket for its source
       (mapped via SOURCE_LABELS; blank/missing source => "Unspecified").
     - Direct admissions (admissions with no originating lead) are
       added as their own "Direct Admission" bucket.
     - leadsBySourceTotal = sum of all bucket values = the number
       shown in the donut center.

   Note: this is intentionally distinct from the "Total Leads" KPI,
   which counts lead records only (leads.length) and excludes direct
   admissions. The donut represents the source breakdown universe.
========================================================= */

export function buildLeadsBySource(leads, directAdmissionLeadCount = 0, sourceLabels = {}) {
  const counts = {};

  for (const lead of Array.isArray(leads) ? leads : []) {
    const rawSource = sourceLabels[lead.source] || lead.source;
    const source =
      rawSource && String(rawSource).trim() ? String(rawSource).trim() : "Unspecified";
    counts[source] = (counts[source] || 0) + 1;
  }

  if (directAdmissionLeadCount > 0) {
    counts["Direct Admission"] =
      (counts["Direct Admission"] || 0) + directAdmissionLeadCount;
  }

  const leadsBySource = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const leadsBySourceTotal = leadsBySource.reduce((sum, row) => sum + row.value, 0);

  return { leadsBySource, leadsBySourceTotal };
}
