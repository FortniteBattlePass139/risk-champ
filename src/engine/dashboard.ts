import {
  confidenceInterval95,
  formatAmericanOdds,
  formatDecimalOdds,
  type SensitivityEntry,
  type SimulationOutcome,
  type SimulationResult,
} from "./monteCarlo";

export type RiskLevel = "OPTIMAL" | "MODERATE" | "FRAGILE" | "OVERLOADED";

export const RISK_LABELS: Record<RiskLevel, { quant: string; sportsbook: string }> = {
  OPTIMAL: { quant: "OPTIMAL LOAD", sportsbook: "LOCK OF THE WEEK" },
  MODERATE: { quant: "MODERATE FRICTION", sportsbook: "SOLID PICK" },
  FRAGILE: { quant: "FRAGILE PLAN", sportsbook: "LONGSHOT" },
  OVERLOADED: { quant: "OVERLOADED", sportsbook: "BAD BEAT INCOMING" },
};

/** Documented risk rule, derived only from the simulation result. */
export function riskLevel(r: SimulationResult): RiskLevel {
  const peak = Math.max(0, ...r.weekly.map((w) => w.meanWorkload));
  if (r.burnoutRate >= 0.25 || peak > r.energyCap * 1.1) return "OVERLOADED";
  if (r.successRate < 0.15) return "FRAGILE";
  if (r.successRate < 0.4 || r.burnoutRate >= 0.05) return "MODERATE";
  return "OPTIMAL";
}

export interface DashboardView {
  status: "ok";
  sourceRunId: string;
  kpis: {
    naive: number;
    success: number;
    successCI: [number, number];
    burnout: number;
    burnoutCI: [number, number];
    decimalOdds: string;
    americanOdds: string;
    iterations: number;
    successCount: number;
    burnoutCount: number;
  };
  histogram: SimulationResult["histogram"];
  weekly: SimulationResult["weekly"];
  sensitivity: SimulationResult["sensitivity"];
  primaryBottleneck: SensitivityEntry | null;
  risk: RiskLevel;
  legSuccessRate: Record<string, number>;
}

export type DashboardState = DashboardView | { status: "error"; errors: string[] };

/** Every KPI, chart and diagnostic is derived here from ONE result object. */
export function buildDashboard(outcome: SimulationOutcome): DashboardState {
  if (!outcome.ok) return { status: "error", errors: outcome.errors };
  const r = outcome.result;
  const n = r.iterations;
  const primaryBottleneck =
    r.sensitivity && r.sensitivity.length > 0
      ? [...r.sensitivity].sort((a, b) => b.deltaPP - a.deltaPP)[0] ?? null
      : null;
  return {
    status: "ok",
    sourceRunId: r.runId,
    kpis: {
      naive: r.naiveProbability,
      success: r.successRate,
      successCI: confidenceInterval95(r.successRate, n),
      burnout: r.burnoutRate,
      burnoutCI: confidenceInterval95(r.burnoutRate, n),
      decimalOdds: formatDecimalOdds(r.successRate, n),
      americanOdds: formatAmericanOdds(r.successRate, n),
      iterations: n,
      successCount: r.successCount,
      burnoutCount: r.burnoutCount,
    },
    histogram: r.histogram,
    weekly: r.weekly,
    sensitivity: r.sensitivity,
    primaryBottleneck,
    risk: riskLevel(r),
    legSuccessRate: r.legSuccessRate,
  };
}

export const pct = (p: number, d = 1) => `${(p * 100).toFixed(d)}%`;
