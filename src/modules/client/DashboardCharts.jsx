// Recharts-backed chart bodies for the client Dashboard, split into their own
// chunk so the ~556KB recharts library is NOT pulled onto the initial
// authenticated paint. Dashboard.jsx lazy-loads these behind <Suspense> with a
// height-reserving ChartSkeleton fallback, so recharts streams in AFTER the
// dashboard shell (KPIs, tables) has painted.
//
// The chart markup here is byte-for-byte the same as it was inline in
// Dashboard.jsx — only its load timing changed. All data/styling comes in as
// props so there is no logic drift from the parent. Empty-state handling stays
// in the parent (it decides chart vs. empty vs. skeleton).
//
// Each chart root carries `cb-fade-in` (animation polish step 4): once the lazy
// chunk resolves the chart reveals smoothly instead of popping in. The class is
// opacity-only and is neutralised under prefers-reduced-motion (index.css).
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function RevenueTrendChart({ data, accentColor, money, axisMoney }) {
  return (
    <div className="cb-fade-in">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ left: 4, right: 8, top: 8, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#eef2f7" />

          <XAxis
            dataKey="m"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
          />

          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            tickFormatter={axisMoney}
          />

          <Tooltip
            formatter={(value) => money(value)}
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 30px rgba(15,23,42,.08)",
            }}
          />

          <Line
            type="monotone"
            dataKey="potential"
            name="Potential"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />

          <Line
            type="monotone"
            dataKey="received"
            name="Received"
            stroke={accentColor}
            strokeWidth={2.75}
            dot={false}
            activeDot={{
              r: 5,
              fill: accentColor,
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Decorative donut — the parent wraps this (and its skeleton) in an
// aria-hidden="true" container; the accessible data is the legend below it.
export function LeadsBySourceChart({ data, pieColors }) {
  return (
    <div className="cb-fade-in">
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={1}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={pieColors[index % pieColors.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AdmissionsByMonthChart({ data, accentColor }) {
  const xKey =
    data[0]?.m !== undefined
      ? "m"
      : data[0]?.month !== undefined
      ? "month"
      : "name";
  const barKey =
    data[0]?.value !== undefined
      ? "value"
      : data[0]?.count !== undefined
      ? "count"
      : "admissions";

  return (
    <div className="cb-fade-in">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="#eef2f7" />
          <XAxis
            dataKey={xKey}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 30px rgba(15,23,42,.08)",
            }}
          />
          <Bar dataKey={barKey} fill={accentColor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
