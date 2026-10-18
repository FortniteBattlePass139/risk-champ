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

const axis = { stroke: "#94A3B8", fontSize: 11, fontFamily: "var(--font-mono)" };
const tip = {
  contentStyle: {
    background: "#121620",
    border: "1px solid #1E293B",
    borderRadius: 8,
    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  },
  labelStyle: { color: "#F8FAFC" },
};

export function OutcomeHistogram({ view }: { view: DashboardView }) {
  const data = view.histogram.map((h) => ({ ...h }));
  const intermediateTotal = data.filter((d) => d.kind === "legs").length || 1;
  let intermediateIdx = 0;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axis} stroke="#1E293B" interval={0} />
        <YAxis tick={axis} stroke="#1E293B" width={48} />
        <Tooltip
          {...tip}
          cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
          formatter={(v: any) => [
            typeof v === "number" ? `${v.toLocaleString()} universes` : `${v ?? 0} universes`,
            "Count",
          ]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((d) => {
            if (d.kind === "burnout") {
              return <Cell key={d.label} fill="#F43F5E" />;
            }
            if (d.kind === "full") {
              return <Cell key={d.label} fill="#14B8A6" />;
            }
            const opacity = 0.45 + (0.5 * (intermediateIdx + 1)) / intermediateTotal;
            intermediateIdx++;
            return <Cell key={d.label} fill="#4F46E5" fillOpacity={opacity} />;
          })}
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
        <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={axis} stroke="#1E293B" tickFormatter={(w) => `W${w}`} />
        <YAxis yAxisId="h" tick={axis} stroke="#1E293B" width={40} />
        <YAxis
          yAxisId="f"
          orientation="right"
          tick={axis}
          stroke="#1E293B"
          width={40}
          domain={[0, (dataMax: number) => Math.max(threshold, Number.isFinite(dataMax) ? Math.ceil(dataMax * 10) / 10 : threshold)]}
          tickFormatter={(v: any) => (typeof v === "number" ? v.toFixed(1) : String(v ?? ""))}
        />
        <Tooltip
          {...tip}
          formatter={(v: any) => {
            if (Array.isArray(v)) {
              return v
                .map((x) => (typeof x === "number" ? x.toFixed(1) : String(x ?? "")))
                .join(" – ");
            }
            if (typeof v === "number") return v.toFixed(2);
            return String(v ?? "");
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)", paddingTop: 8 }} />
        <Area yAxisId="h" dataKey="band" name="P90 workload band (h)" fill="#F59E0B" fillOpacity={0.12} stroke="none" />
        <Line yAxisId="h" dataKey="meanWorkload" name="Mean workload (h)" stroke="#6366F1" dot={false} strokeWidth={2} />
        <Line yAxisId="f" dataKey="meanFatigue" name="Mean fatigue" stroke="#F59E0B" dot={false} strokeWidth={2} />
        <Line yAxisId="f" dataKey="p90Fatigue" name="P90 fatigue" stroke="#F43F5E" dot={false} strokeDasharray="4 3" strokeWidth={1.5} />
        <ReferenceLine yAxisId="h" y={cap} stroke="#14B8A6" strokeDasharray="6 4" label={{ value: "Safe capacity", fill: "#14B8A6", fontSize: 10, position: "insideTopLeft" }} />
        <ReferenceLine
          yAxisId="f"
          y={threshold}
          stroke="#F43F5E"
          strokeDasharray="3 3"
          strokeOpacity={0.8}
          label={{ value: `Burnout threshold (${threshold.toFixed(1)})`, fill: "#F43F5E", fontSize: 10, position: "insideTopRight" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
