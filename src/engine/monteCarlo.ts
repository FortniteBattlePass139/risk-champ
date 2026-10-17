/**
 * ParlayLife — correlated Monte Carlo engine (framework-independent).
 *
 * MODEL (all coefficients are illustrative assumptions, NOT validated
 * human-performance laws):
 *
 * Horizon: weeks 1..H (H = 16). For every universe u and week w:
 *  1. Exogenous stream (Common Random Numbers, seeded by (seed, u)):
 *       4 uniforms per week are ALWAYS drawn: uShock, uSeverity, n1, n2.
 *       shock_w      = uShock < chaos
 *       shockHours_w = shock ? shockHoursMin + uSeverity*(shockHoursMax-shockHoursMin) : 0
 *       z_w          = BoxMuller(n1, n2)
 *       mult_w       = clamp(1 + workloadVariance * z_w, 0.5, 2)
 *  2. workload_w = mult_w * Σ_{legs active in w} hours_i + shockHours_w
 *       (a leg is active only while startWeek <= w <= endWeek)
 *     util_w     = workload_w / energyCap
 *     overload_w = max(0, util_w - 1)
 *     stress_w   = hours-weighted mean stressImpact of active legs / 10   ∈ [0,1]
 *  3. F_w = max(0, F_{w-1} + a·overload_w^γ + b·stress_w·util_w − r·max(0, 1 − util_w))
 *  4. Burnout if F_w >= burnoutThreshold. BURNOUT RULE: the universe collapses;
 *     every unresolved leg fails, no later legs resolve, and later weeks record
 *     workload 0 and the frozen fatigue level. Burnout universes are counted in
 *     the dedicated "Burnout" histogram bin only.
 *  5. Legs resolve at their resolution week = max(endWeek, resolution week of
 *     every trigger) in topological order. Adjusted probability:
 *       p = base
 *         − maxFatiguePenalty·(1 − e^(−F_w/fatigueScale))·(0.5 + 0.5·stress_i/10)
 *         − (shock_w ? shockPenalty : 0)
 *         − Σ_{deps where trigger FAILED} penaltyStrength   (absolute reduction)
 *       hard_prerequisite deps force p to the floor when the trigger failed.
 *       p = clamp(p, 0.001, 0.999)
 *     Outcome: Bernoulli(p) using a per-(seed, universe, legId) uniform, so
 *     removing a leg never shifts other legs' random numbers.
 *
 * Correlation between legs arises ONLY through explicitly modeled shared
 * drivers: fatigue, weekly shocks/variance, and causal dependency edges.
 */

export const HORIZON_WEEKS = 16;
export const P_MIN = 0.001;
export const P_MAX = 0.999;

export type Category = "Career" | "Academic" | "Tech/Infra" | "Health" | "Finance";
export type DependencyType = "failure_penalty" | "hard_prerequisite";

export interface Leg {
  id: string;
  name: string;
  category: Category;
  baseProbability: number;
  weeklyHoursCost: number;
  stressImpact: number;
  startWeek: number;
  endWeek: number;
}

export interface Dependency {
  id: string;
  triggerLegId: string;
  affectedLegId: string;
  dependencyType: DependencyType;
  penaltyStrength: number;
}

export interface ModelCoefficients {
  overloadCoef: number; // a
  overloadExponent: number; // γ
  stressCoef: number; // b
  recoveryRate: number; // r
  burnoutThreshold: number;
  maxFatiguePenalty: number;
  fatigueScale: number;
  shockPenalty: number;
  shockHoursMin: number;
  shockHoursMax: number;
  workloadVariance: number;
}

export const DEFAULT_COEFFICIENTS: ModelCoefficients = {
  overloadCoef: 1.2,
  overloadExponent: 1.5,
  stressCoef: 0.08,
  recoveryRate: 0.35,
  burnoutThreshold: 2.0,
  maxFatiguePenalty: 0.35,
  fatigueScale: 1.0,
  shockPenalty: 0.1,
  shockHoursMin: 6,
  shockHoursMax: 18,
  workloadVariance: 0.15,
};

export interface SimulationConfig {
  legs: Leg[];
  dependencies: Dependency[];
  energyCap: number;
  chaos: number; // 0..0.3
  seed: number;
  iterations?: number;
  coefficients?: Partial<ModelCoefficients>;
}

export interface SensitivityEntry {
  legId: string;
  legName: string;
  counterfactualSuccessRate: number;
  deltaPP: number; // (counterfactual − baseline) * 100
}

export interface SimulationResult {
  runId: string;
  iterations: number;
  legIds: string[];
  successCount: number;
  burnoutCount: number;
  successRate: number;
  burnoutRate: number;
  naiveProbability: number;
  /** histogram[0] = Burnout; histogram[k+1] = non-burnout universes with exactly k legs succeeded */
  histogram: { label: string; count: number; kind: "burnout" | "legs" | "full" }[];
  legSuccessRate: Record<string, number>;
  burnoutWeekCounts: number[]; // index w-1
  weekly: {
    week: number;
    meanWorkload: number;
    p90Workload: number;
    meanFatigue: number;
    p90Fatigue: number;
  }[];
  maxAdjustedProbability: number;
  minAdjustedProbability: number;
  energyCap: number;
  burnoutThreshold: number;
  sensitivity: SensitivityEntry[] | null;
}

export type SimulationOutcome =
  | { ok: true; result: SimulationResult }
  | { ok: false; errors: string[] };

/* ---------------- PRNG ---------------- */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(h: number, v: number): number {
  h = Math.imul(h ^ (v >>> 0), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function streamSeed(seed: number, universe: number, salt: number): number {
  return mix(mix(mix(0x9e3779b9, seed), universe), salt);
}

const EXO_SALT = 0x5eed;

export const clampP = (p: number) =>
  Number.isFinite(p) ? Math.min(P_MAX, Math.max(P_MIN, p)) : P_MIN;

/* ---------------- Validation ---------------- */

export function validateConfig(cfg: SimulationConfig): { errors: string[]; order: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const l of cfg.legs) {
    if (!l.id) errors.push("Leg with empty id.");
    if (ids.has(l.id)) errors.push(`Duplicate leg id "${l.id}".`);
    ids.add(l.id);
    if (!(l.baseProbability >= 0.01 && l.baseProbability <= 0.99))
      errors.push(`"${l.name}": base probability must be within 1%–99%.`);
    if (!(l.weeklyHoursCost >= 1 && l.weeklyHoursCost <= 40))
      errors.push(`"${l.name}": weekly hours must be within 1–40.`);
    if (!(l.stressImpact >= 1 && l.stressImpact <= 10))
      errors.push(`"${l.name}": stress impact must be within 1–10.`);
    if (
      !Number.isInteger(l.startWeek) ||
      !Number.isInteger(l.endWeek) ||
      l.startWeek < 1 ||
      l.endWeek > HORIZON_WEEKS ||
      l.startWeek > l.endWeek
    )
      errors.push(`"${l.name}": weeks must satisfy 1 ≤ start ≤ end ≤ ${HORIZON_WEEKS}.`);
  }
  if (!(cfg.energyCap > 0 && Number.isFinite(cfg.energyCap)))
    errors.push("Weekly energy cap must be a positive number.");
  if (!(cfg.chaos >= 0 && cfg.chaos <= 0.3)) errors.push("Chaos factor must be within 0%–30%.");
  if (!Number.isFinite(cfg.seed)) errors.push("Seed must be a finite integer.");
  const n = cfg.iterations ?? 10000;
  if (!(Number.isInteger(n) && n > 0)) errors.push("Iterations must be a positive integer.");

  for (const d of cfg.dependencies) {
    if (!ids.has(d.triggerLegId) || !ids.has(d.affectedLegId))
      errors.push(`Dependency ${d.id} references a missing leg.`);
    if (d.triggerLegId === d.affectedLegId)
      errors.push(`Dependency ${d.id}: a leg cannot depend on itself (cycle).`);
    if (!(d.penaltyStrength >= 0 && d.penaltyStrength <= 1))
      errors.push(`Dependency ${d.id}: penalty strength must be within [0, 1].`);
  }

  // Kahn topological sort (DAG validation)
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  cfg.legs.forEach((l) => {
    indeg.set(l.id, 0);
    adj.set(l.id, []);
  });
  for (const d of cfg.dependencies) {
    if (!ids.has(d.triggerLegId) || !ids.has(d.affectedLegId)) continue;
    adj.get(d.triggerLegId)!.push(d.affectedLegId);
    indeg.set(d.affectedLegId, indeg.get(d.affectedLegId)! + 1);
  }
  const queue = cfg.legs.filter((l) => indeg.get(l.id) === 0).map((l) => l.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const nxt of adj.get(id)!) {
      indeg.set(nxt, indeg.get(nxt)! - 1);
      if (indeg.get(nxt) === 0) queue.push(nxt);
    }
  }
  if (order.length !== cfg.legs.length)
    errors.push("Dependency cycle detected: dependencies must form a directed acyclic graph (DAG).");
  return { errors, order };
}

/** Counterfactual policy: removing a leg removes every dependency edge that touches it. */
export function removeLeg(cfg: SimulationConfig, legId: string): SimulationConfig {
  return {
    ...cfg,
    legs: cfg.legs.filter((l) => l.id !== legId),
    dependencies: cfg.dependencies.filter(
      (d) => d.triggerLegId !== legId && d.affectedLegId !== legId,
    ),
  };
}

/* ---------------- Core ---------------- */

function percentile(sorted: Float32Array, q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[idx]!;
}

function simulateCore(cfg: SimulationConfig, order: string[], withWeekly: boolean) {
  const N = cfg.iterations ?? 10000;
  const H = HORIZON_WEEKS;
  const c = { ...DEFAULT_COEFFICIENTS, ...(cfg.coefficients ?? {}) };
  const legIndex = new Map(cfg.legs.map((l, i) => [l.id, i]));
  const ordered = order.map((id) => cfg.legs[legIndex.get(id)!]!);
  const L = ordered.length;
  const salts = ordered.map((l) => hashString(l.id));

  // resolution weeks
  const resolveWeek = new Map<string, number>();
  for (const l of ordered) {
    let w = l.endWeek;
    for (const d of cfg.dependencies)
      if (d.affectedLegId === l.id) w = Math.max(w, resolveWeek.get(d.triggerLegId) ?? w);
    resolveWeek.set(l.id, w);
  }
  const incoming = ordered.map((l) =>
    cfg.dependencies
      .filter((d) => d.affectedLegId === l.id)
      .map((d) => ({ ...d, trigIdx: order.indexOf(d.triggerLegId) })),
  );
  const byWeek: number[][] = Array.from({ length: H + 1 }, () => []);
  ordered.forEach((l, i) => byWeek[resolveWeek.get(l.id)!]!.push(i));

  // per-week base hours + weighted stress (deterministic part)
  const baseHours = new Float64Array(H + 1);
  const stressNorm = new Float64Array(H + 1);
  for (let w = 1; w <= H; w++) {
    let h = 0;
    let s = 0;
    for (const l of ordered)
      if (l.startWeek <= w && w <= l.endWeek) {
        h += l.weeklyHoursCost;
        s += l.weeklyHoursCost * l.stressImpact;
      }
    baseHours[w] = h;
    stressNorm[w] = h > 0 ? s / h / 10 : 0;
  }

  const workloadArr = withWeekly ? new Float32Array(H * N) : null;
  const fatigueArr = withWeekly ? new Float32Array(H * N) : null;
  const histogram = new Array(L + 2).fill(0);
  const legSucc = new Array(L).fill(0);
  const burnoutWeekCounts = new Array(H).fill(0);
  let successCount = 0;
  let burnoutCount = 0;
  let maxP = 0;
  let minP = 1;
  const outcome = new Int8Array(L);

  for (let u = 0; u < N; u++) {
    const rng = mulberry32(streamSeed(cfg.seed, u, EXO_SALT));
    let F = 0;
    let burnedAt = 0;
    outcome.fill(-1);
    for (let w = 1; w <= H; w++) {
      const uShock = rng();
      const uSev = rng();
      const n1 = rng();
      const n2 = rng();
      if (burnedAt) {
        if (withWeekly) {
          workloadArr![(w - 1) * N + u] = 0;
          fatigueArr![(w - 1) * N + u] = F;
        }
        continue;
      }
      const shock = uShock < cfg.chaos;
      const shockHours = shock ? c.shockHoursMin + uSev * (c.shockHoursMax - c.shockHoursMin) : 0;
      const z = Math.sqrt(-2 * Math.log(1 - n1)) * Math.cos(2 * Math.PI * n2);
      const mult = Math.min(2, Math.max(0.5, 1 + c.workloadVariance * z));
      const workload = mult * baseHours[w]! + shockHours;
      const util = workload / cfg.energyCap;
      const overload = Math.max(0, util - 1);
      F = Math.max(
        0,
        F +
          c.overloadCoef * Math.pow(overload, c.overloadExponent) +
          c.stressCoef * stressNorm[w]! * util -
          c.recoveryRate * Math.max(0, 1 - util),
      );
      if (withWeekly) {
        workloadArr![(w - 1) * N + u] = workload;
        fatigueArr![(w - 1) * N + u] = F;
      }
      if (F >= c.burnoutThreshold) {
        burnedAt = w;
        continue;
      }
      for (const i of byWeek[w]!) {
        const leg = ordered[i]!;
        let p =
          leg.baseProbability -
          c.maxFatiguePenalty *
            (1 - Math.exp(-F / c.fatigueScale)) *
            (0.5 + (0.5 * leg.stressImpact) / 10) -
          (shock ? c.shockPenalty : 0);
        let hardFail = false;
        for (const d of incoming[i]!) {
          if (outcome[d.trigIdx] === 0) {
            if (d.dependencyType === "hard_prerequisite") hardFail = true;
            else p -= d.penaltyStrength;
          }
        }
        p = hardFail ? P_MIN : clampP(p);
        if (p > maxP) maxP = p;
        if (p < minP) minP = p;
        const r = mulberry32(streamSeed(cfg.seed, u, salts[i]!))();
        outcome[i] = r < p ? 1 : 0;
      }
    }
    let k = 0;
    for (let i = 0; i < L; i++)
      if (outcome[i] === 1) {
        k++;
        legSucc[i]++;
      }
    if (burnedAt) {
      burnoutCount++;
      burnoutWeekCounts[burnedAt - 1]++;
      histogram[0]++;
    } else {
      histogram[k + 1]++;
      if (k === L) successCount++;
    }
  }

  return {
    N,
    L,
    ordered,
    c,
    histogram,
    legSucc,
    successCount,
    burnoutCount,
    burnoutWeekCounts,
    workloadArr,
    fatigueArr,
    maxP: L ? maxP : P_MIN,
    minP: L ? minP : P_MIN,
  };
}

let runCounter = 0;

export function runSimulation(
  cfg: SimulationConfig,
  opts: { sensitivity?: boolean } = {},
): SimulationOutcome {
  const { errors, order } = validateConfig(cfg);
  if (errors.length) return { ok: false, errors };
  const core = simulateCore(cfg, order, true);
  const { N, L, ordered } = core;
  const H = HORIZON_WEEKS;

  const weekly: SimulationResult["weekly"] = [];
  for (let w = 0; w < H; w++) {
    const wl = core.workloadArr!.slice(w * N, (w + 1) * N);
    const fa = core.fatigueArr!.slice(w * N, (w + 1) * N);
    let sw = 0;
    let sf = 0;
    for (let i = 0; i < N; i++) {
      sw += wl[i]!;
      sf += fa[i]!;
    }
    wl.sort();
    fa.sort();
    weekly.push({
      week: w + 1,
      meanWorkload: sw / N,
      p90Workload: percentile(wl, 0.9),
      meanFatigue: sf / N,
      p90Fatigue: percentile(fa, 0.9),
    });
  }

  const histogram: SimulationResult["histogram"] = [
    { label: "Burnout", count: core.histogram[0], kind: "burnout" },
  ];
  for (let k = 0; k <= L; k++)
    histogram.push({
      label: k === L ? (L === 0 ? "Full (0 legs)" : "Full Parlay") : `${k} Leg${k === 1 ? "" : "s"}`,
      count: core.histogram[k + 1],
      kind: k === L ? "full" : "legs",
    });

  const legSuccessRate: Record<string, number> = {};
  ordered.forEach((l, i) => (legSuccessRate[l.id] = core.legSucc[i] / N));

  const successRate = core.successCount / N;
  let sensitivity: SensitivityEntry[] | null = null;
  if (opts.sensitivity) {
    sensitivity = cfg.legs.map((leg) => {
      const cf = removeLeg(cfg, leg.id);
      const v = validateConfig(cf);
      const r = simulateCore(cf, v.order, false);
      const rate = r.successCount / r.N;
      return {
        legId: leg.id,
        legName: leg.name,
        counterfactualSuccessRate: rate,
        deltaPP: (rate - successRate) * 100,
      };
    });
    sensitivity.sort((a, b) => Math.abs(b.deltaPP) - Math.abs(a.deltaPP));
  }

  runCounter++;
  return {
    ok: true,
    result: {
      runId: `run-${cfg.seed}-${runCounter}`,
      iterations: N,
      legIds: cfg.legs.map((l) => l.id),
      successCount: core.successCount,
      burnoutCount: core.burnoutCount,
      successRate,
      burnoutRate: core.burnoutCount / N,
      naiveProbability: cfg.legs.reduce((p, l) => p * l.baseProbability, 1),
      histogram,
      legSuccessRate,
      burnoutWeekCounts: core.burnoutWeekCounts,
      weekly,
      maxAdjustedProbability: core.maxP,
      minAdjustedProbability: core.minP,
      energyCap: cfg.energyCap,
      burnoutThreshold: core.c.burnoutThreshold,
      sensitivity,
    },
  };
}

/* ---------------- Statistics & odds ---------------- */

export function confidenceInterval95(p: number, n: number): [number, number] {
  if (!(n > 0)) return [0, 0];
  const half = 1.96 * Math.sqrt((p * (1 - p)) / n);
  return [Math.max(0, p - half), Math.min(1, p + half)];
}

export function formatDecimalOdds(p: number, n: number): string {
  if (!(p > 0) || !Number.isFinite(p)) return `N/A (>${n.toLocaleString("en-US")}x)`;
  return `${(1 / p).toFixed(2)}x`;
}

export function formatAmericanOdds(p: number, n: number): string {
  if (!(p > 0) || !Number.isFinite(p)) return `N/A (>+${(n * 100).toLocaleString("en-US")})`;
  if (p >= 1) return "N/A (certain)";
  if (p >= 0.5) return `${Math.round((-100 * p) / (1 - p))}`;
  return `+${Math.round((100 * (1 - p)) / p)}`;
}
