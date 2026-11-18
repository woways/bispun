// Center-label total for the "Leads by Source" donut chart.
//
// The number shown in the middle of the donut (and announced to screen
// readers) MUST equal the sum of the visible slices. The backend provides
// `leadsBySourceTotal` as the single source of truth for exactly this — it is
// defined as the sum of all source buckets (see server/lib/leadsBySource.js,
// with the invariant enforced in server/lib/leadsBySource.test.js:
// "center total MUST equal the sum of the slices").
//
// Do NOT use `summary.totalLeads` here: that is the grand count of ALL leads
// (leads.length), which includes leads with no recognised source and therefore
// diverges from the slice sum whenever any lead is sourceless — producing a
// center label that contradicts the chart it sits in.
//
// We fall back to summing the slices locally ONLY when `leadsBySourceTotal`
// is missing (null/undefined), so the label still renders. Nullish (`??`) is
// deliberate: a legitimate total of 0 must be preserved, whereas `||` would
// treat 0 as falsy and wrongly fall through to the fallback.
export function donutCenterTotal(data) {
  const grouped = data?.leadsBySourceTotal;
  if (grouped !== null && grouped !== undefined) return grouped;
  const slices = Array.isArray(data?.leadsBySource) ? data.leadsBySource : [];
  return slices.reduce((sum, item) => sum + Number(item?.value || 0), 0);
}
