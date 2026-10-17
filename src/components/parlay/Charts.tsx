import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import type { DashboardView } from "@/engine/dashboard";

const axis = { stroke: "var(--color-muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" };
const tip = {
  contentStyle: {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 6,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  },
  labelStyle: { color: "var(--color-foreground)" },
};

export function OutcomeHistogram({ view }: { view: DashboardView }) {
  const data = view.histogram.map((h) => ({ ...h }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={axis} stroke="var(--color-border)" interval={0} />
        <YAxis tick={axis} stroke="var(--color-border)" width={48} />
        <Tooltip {...tip} cursor={{ fill: "var(--color-accent)" }} formatter={(v: number) => [`${v} universes`, "Count"]} />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {data.map((d) => (
            <Cell
              key={d.label}
              fill={
                d.kind === "burnout"
                  ? "var(--color-danger)"
                  : d.kind === "full"
                    ? "var(--color-success)"
                    : "var(--color-chart-4)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function FatigueChart({ view, cap, threshold }: { view: DashboardView; cap: number; threshold: number }) {
  const data = view.weekly.map((w) => ({
    ...w,
    band: [w.meanWorkload, w.p90Workload] as [number, number],
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="week" tick={axis} stroke="var(--color-border)" tickFormatter={(w) => `W${w}`} />
        <YAxis yAxisId="h" tick={axis} stroke="var(--color-border)" width={40} />
        <YAxis yAxisId="f" orientation="right" tick={axis} stroke="var(--color-border)" width={36} />
        <Tooltip {...tip} formatter={(v: number | number[]) => (Array.isArray(v) ? v.map((x) => x.toFixed(1)).join(" – ") : v.toFixed(2))} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
        <Area yAxisId="h" dataKey="band" name="P90 workload band (h)" fill="var(--color-warning)" fillOpacity={0.15} stroke="none" />
        <Line yAxisId="h" dataKey="meanWorkload" name="Mean workload (h)" stroke="var(--color-chart-4)" dot={false} strokeWidth={2} />
        <Line yAxisId="f" dataKey="meanFatigue" name="Mean fatigue" stroke="var(--color-warning)" dot={false} strokeWidth={2} />
        <Line yAxisId="f" dataKey="p90Fatigue" name="P90 fatigue" stroke="var(--color-danger)" dot={false} strokeDasharray="4 3" />
        <ReferenceLine yAxisId="h" y={cap} stroke="var(--color-success)" strokeDasharray="6 4" label={{ value: "Safe capacity", fill: "var(--color-success)", fontSize: 10, position: "insideTopLeft" }} />
        <ReferenceLine yAxisId="f" y={threshold} stroke="var(--color-danger)" strokeDasharray="2 4" label={{ value: "Burnout", fill: "var(--color-danger)", fontSize: 10, position: "insideTopRight" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
