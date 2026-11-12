// Loading placeholder for a lazily-loaded recharts chart.
//
// Accessibility (reviewed by accessibility-lead, pre-impl checklist items 1-6):
//   - SILENT and aria-hidden: a sub-second lazy-chunk swap is not worth a live
//     announcement; it would be screen-reader chatter with no task value. The
//     chart it replaces is visual, and its accessible data alternative (legend /
//     table) lives outside this boundary, so nothing is hidden from AT here.
//   - Reserves the EXACT pixel height of the chart it stands in for, so there is
//     zero layout shift (CLS) when the real ResponsiveContainer mounts.
//   - Shimmer honours reduced motion (motion-reduce:animate-none, and the global
//     prefers-reduced-motion reset in index.css); frozen, it is a flat slate box
//     with clear shape/contrast — an acceptable static appearance.
//   - Contains no focusable elements, so it never steals or traps focus.
export default function ChartSkeleton({ height = 280 }) {
  return (
    <div
      aria-hidden="true"
      className="relative w-full overflow-hidden rounded-lg bg-slate-100"
      style={{ height }}
    >
      <div className="absolute inset-0 -translate-x-full animate-[skeletonShimmer_1.7s_infinite] motion-reduce:animate-none bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </div>
  );
}
