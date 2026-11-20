// Recharts-backed chart body for the admin dashboard, code-split so the ~556KB
// recharts library is NOT loaded on the admin landing paint. AdminDashboard.jsx
// lazy-loads this behind a <Suspense> with a height-reserving ChartSkeleton
// fallback. Markup is unchanged from its previous inline form; load timing only.
//
// `cb-fade-in` (animation polish step 4) reveals the chart smoothly once the
// lazy chunk resolves; opacity-only and neutralised under prefers-reduced-motion.
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function ClientGrowthChart({ data }) {
  return (
    <div className="cb-fade-in">
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={data}
          margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="clientGrowthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
          />

          <Tooltip />

          <Area
            type="monotone"
            dataKey="cumulativeClients"
            name="Total Clients"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#clientGrowthGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
