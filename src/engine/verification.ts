import { buildDashboard } from "./dashboard";
import {
  P_MAX,
  P_MIN,
  removeLeg,
  runSimulation,
  validateConfig,
  type SimulationConfig,
} from "./monteCarlo";
import { PRESETS } from "./presets";

export interface CheckResult {
  id: number;
  name: string;
  passed: boolean;
  detail: string;
}

const base = (): SimulationConfig => ({
  legs: PRESETS[0].legs.map((l) => ({ ...l })),
  dependencies: PRESETS[0].dependencies.map((d) => ({ ...d })),
  energyCap: 50,
  chaos: 0.1,
  seed: 1234,
  iterations: 10000,
});

function check(id: number, name: string, fn: () => string | true): CheckResult {
  try {
    const r = fn();
    return { id, name, passed: r === true, detail: r === true ? "pass" : r };
  } catch (e) {
    return { id, name, passed: false, detail: `threw: ${(e as Error).message}` };
  }
}

export function runVerificationSuite(): CheckResult[] {
  return [
    check(1, "Same seed + config ⇒ identical results", () => {
      const a = runSimulation(base(), { sensitivity: true });
      const b = runSimulation(base(), { sensitivity: true });
      if (!a.ok || !b.ok) return "run failed";
      const strip = (r: typeof a.result) => JSON.stringify({ ...r, runId: "" });
      return strip(a.result) === strip(b.result) || "results differ";
    }),
    check(2, "Histogram bins mutually exclusive & sum to N", () => {
      const o = runSimulation(base());
      if (!o.ok) return "run failed";
      const s = o.result.histogram.reduce((a, b) => a + b.count, 0);
      const fullBin = o.result.histogram.find((h) => h.kind === "full")!.count;
      const burnBin = o.result.histogram[0].count;
      if (s !== 10000) return `sum = ${s}`;
      if (fullBin !== o.result.successCount) return "full bin ≠ success count";
      if (burnBin !== o.result.burnoutCount) return "burnout bin ≠ burnout count";
      return true;
    }),
    check(3, "Zero legs ⇒ 100% success, 0% burnout, 1.00x", () => {
      const o = runSimulation({ ...base(), legs: [], dependencies: [], chaos: 0 });
      const d = buildDashboard(o);
      if (d.status !== "ok") return "error";
      return (
        (d.kpis.success === 1 && d.kpis.burnout === 0 && d.kpis.decimalOdds === "1.00x") ||
        `success=${d.kpis.success} burnout=${d.kpis.burnout} odds=${d.kpis.decimalOdds}`
      );
    }),
    check(4, "Dependency cycle rejected with clear error", () => {
      const c = base();
      c.dependencies.push({
        id: "cyc",
        triggerLegId: "users",
        affectedLegId: "mvp",
        dependencyType: "failure_penalty",
        penaltyStrength: 0.1,
      });
      const o = runSimulation(c);
      return (!o.ok && o.errors.some((e) => /cycle/i.test(e))) || "cycle not rejected";
    }),
    check(5, "Probabilities bounded in [0.001, 0.999] under extremes", () => {
      const c = base();
      c.legs = c.legs.map((l) => ({ ...l, weeklyHoursCost: 40, stressImpact: 10, baseProbability: 0.99 }));
      c.chaos = 0.3;
      c.energyCap = 5;
      c.coefficients = { burnoutThreshold: 1e9 };
      const o = runSimulation(c);
      if (!o.ok) return "run failed";
      const { minAdjustedProbability: lo, maxAdjustedProbability: hi } = o.result;
      const c2 = base();
      c2.legs = c2.legs.map((l) => ({ ...l, baseProbability: 0.99, weeklyHoursCost: 1, stressImpact: 1 }));
      c2.chaos = 0;
      c2.dependencies = [];
      const o2 = runSimulation(c2);
      if (!o2.ok) return "run2 failed";
      const hi2 = o2.result.maxAdjustedProbability;
      return (lo >= P_MIN && hi <= P_MAX && hi2 <= P_MAX) || `range [${lo}, ${Math.max(hi, hi2)}]`;
    }),
    check(6, "Zero success ⇒ no division by zero / Infinity", () => {
      const c = base();
      c.energyCap = 1;
      const d = buildDashboard(runSimulation(c));
      if (d.status !== "ok") return "error";
      const txt = JSON.stringify(d.kpis);
      if (d.kpis.success !== 0) return `success not zero (${d.kpis.success})`;
      return (!/Infinity|NaN/.test(txt) && d.kpis.decimalOdds.startsWith("N/A")) || txt;
    }),
    check(7, "All KPIs & charts derive from one result object", () => {
      const o = runSimulation(base(), { sensitivity: true });
      if (!o.ok) return "run failed";
      const d = buildDashboard(o);
      if (d.status !== "ok") return "error";
      const r = o.result;
      return (
        (d.sourceRunId === r.runId &&
          d.histogram === r.histogram &&
          d.weekly === r.weekly &&
          d.sensitivity === r.sensitivity &&
          d.kpis.success === r.successCount / r.iterations &&
          d.kpis.burnout === r.burnoutCount / r.iterations) ||
        "view diverges from result"
      );
    }),
    check(8, "Counterfactuals reproducible with common random numbers", () => {
      const cfg = base();
      const a = runSimulation(cfg, { sensitivity: true });
      const b = runSimulation(cfg, { sensitivity: true });
      if (!a.ok || !b.ok) return "run failed";
      if (JSON.stringify(a.result.sensitivity) !== JSON.stringify(b.result.sensitivity))
        return "sensitivity not reproducible";
      // CRN: the counterfactual equals an independent run of the reduced plan with the same seed
      const s = a.result.sensitivity!.find((x) => x.legId === "gym")!;
      const direct = runSimulation(removeLeg(cfg, "gym"));
      if (!direct.ok) return "direct failed";
      return s.counterfactualSuccessRate === direct.result.successRate || "CRN mismatch";
    }),
    check(9, "Removing a leg recomputes horizon, no dangling edges", () => {
      const cfg = base();
      const reduced = removeLeg(cfg, "mvp");
      const v = validateConfig(reduced);
      if (v.errors.length) return v.errors.join("; ");
      if (reduced.dependencies.some((d) => d.triggerLegId === "mvp" || d.affectedLegId === "mvp"))
        return "dangling edge";
      const a = runSimulation(cfg);
      const b = runSimulation(reduced);
      if (!a.ok || !b.ok) return "run failed";
      // MVP (15h, weeks 1-10) removed ⇒ mean workload in week 1 must drop
      const drop = a.result.weekly[0].meanWorkload - b.result.weekly[0].meanWorkload;
      return (drop > 10 && b.result.legIds.length === 4) || `workload drop ${drop.toFixed(2)}`;
    }),
    check(10, "Errors produce no fabricated fallback data", () => {
      const c = base();
      c.legs[0] = { ...c.legs[0], baseProbability: 5 };
      const d = buildDashboard(runSimulation(c));
      return (
        (d.status === "error" && !("kpis" in d) && !("histogram" in d) && d.errors.length > 0) ||
        "error state carried data"
      );
    }),
  ];
}
