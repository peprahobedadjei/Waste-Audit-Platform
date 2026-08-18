"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendPoint = {
  cycle: string;
  collected: number;
  satisfied: number;
  visits: number;
};

export type DistrictPoint = {
  name: string;
  collected: number;
  satisfied: number;
};

const AXIS = { fontSize: 12, fill: "var(--text-muted)" };

function tooltipStyle() {
  return {
    background: "#fff",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
  };
}

/** Collection and satisfaction across recent cycles, oldest to newest. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) {
    return (
      <p className="px-5 py-10 text-center text-sm text-ink-muted">
        A trend needs at least two cycles of data.
      </p>
    );
  }

  return (
    <div className="h-72 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="cycle" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle()} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="collected"
            name="Collection rate"
            stroke="var(--brand-primary)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="satisfied"
            name="Satisfaction rate"
            stroke="var(--pending)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistrictChart({ data }: { data: DistrictPoint[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-72 w-full px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis
            domain={[0, 100]}
            unit="%"
            tick={AXIS}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "var(--surface)" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="collected"
            name="Collection rate"
            fill="var(--brand-primary)"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="satisfied"
            name="Satisfaction rate"
            fill="var(--brand-tint)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
