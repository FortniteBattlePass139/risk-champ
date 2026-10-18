import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2, Shuffle, BookOpen, ShieldCheck, Share2, Link2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { OutcomeHistogram, FatigueChart } from "@/components/parlay/Charts";
import { MethodologySheet, ShareDialog, VerificationDialog } from "@/components/parlay/Modals";
import {
  HORIZON_WEEKS,
  DEFAULT_COEFFICIENTS,
  runSimulation,
  validateConfig,
  type Category,
  type Dependency,
  type DependencyType,
  type Leg,
} from "@/engine/monteCarlo";
import { buildDashboard, pct, RISK_LABELS, type DashboardState, type RiskLevel } from "@/engine/dashboard";
import { PRESETS, QUICK_LEGS } from "@/engine/presets";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ParlayLife — Life-Sim Monte Carlo Risk Terminal" },
      { name: "description", content: "Simulate 10,000 universes of your semester, startup or life plan. Survival rates, implied odds, burnout risk and bottlenecks." },
      { property: "og:title", content: "ParlayLife — Life-Sim Monte Carlo" },
      { property: "og:description", content: "A quantitative risk simulator for real-life decisions with sportsbook-style UX." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const CATEGORIES: Category[] = ["Career", "Academic", "Tech/Infra", "Health", "Finance"];
const riskColor: Record<RiskLevel, string> = {
  OPTIMAL: "text-teal-400 border-teal-500/40 bg-teal-500/10",
  MODERATE: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  FRAGILE: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  OVERLOADED: "text-rose-400 border-rose-500/40 bg-rose-500/10",
};
let uid = 0;
const newId = () => `leg-${Date.now().toString(36)}-${uid++}`;

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-sm backdrop-blur-sm">
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Index() {
  const [legs, setLegs] = useState<Leg[]>(() => PRESETS[0]!.legs.map((l) => ({ ...l })));
  const [deps, setDeps] = useState<Dependency[]>(() => PRESETS[0]!.dependencies.map((d) => ({ ...d })));
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0]!.id);
  const [cap, setCap] = useState(46);
  const [chaos, setChaos] = useState(0.1);
  const [seed, setSeed] = useState(1234);
  const [sportsbook, setSportsbook] = useState(false);
  const [state, setState] = useState<DashboardState | null>(null);
  const [computing, setComputing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dialogs, setDialogs] = useState({ method: false, verify: false, share: false });

  // Debounced, scheduled recomputation: every KPI/chart below reads from `state` only.
  useEffect(() => {
    setComputing(true);
    const t = setTimeout(() => {
      const t0 = performance.now();
      const outcome = runSimulation(
        { legs, dependencies: deps, energyCap: cap, chaos, seed, iterations: 10000 },
        { sensitivity: true },
      );
      setState(buildDashboard(outcome));
      setElapsed(performance.now() - t0);
      setComputing(false);
    }, 180);
    return () => clearTimeout(t);
  }, [legs, deps, cap, chaos, seed]);

  const view = state?.status === "ok" ? state : null;
  const loadPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setLegs(p.legs.map((l) => ({ ...l })));
    setDeps(p.dependencies.map((d) => ({ ...d })));
    setActivePreset(id);
  };
  const updateLeg = (id: string, patch: Partial<Leg>) => {
    setLegs((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    setActivePreset(null);
  };
  const addLeg = (cat?: Category) => {
    const tmpl = QUICK_LEGS[cat ?? "Career"];
    setLegs((ls) => [...ls, { ...tmpl, name: cat ? tmpl.name : "Custom objective", id: newId() }]);
    setActivePreset(null);
  };
  const removeLegUI = (id: string) => {
    setLegs((ls) => ls.filter((l) => l.id !== id));
    setDeps((ds) => ds.filter((d) => d.triggerLegId !== id && d.affectedLegId !== id));
    setActivePreset(null);
  };
  const legName = (id: string) => legs.find((l) => l.id === id)?.name ?? "?";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-950/80 px-5 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 font-mono text-xs font-bold text-white shadow-md shadow-indigo-500/20">PL</div>
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight text-slate-100">ParlayLife</h1>
            <p className="text-xs text-slate-400">Life-Sim Monte Carlo · decision analysis, not gambling</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-mono text-xs text-slate-400 mr-2">
            {computing ? "SIMULATING…" : `N=10,000 · ${elapsed.toFixed(0)} ms (incl. sensitivity)`}
          </span>
          <Button size="sm" variant="outline" className="border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => setDialogs((d) => ({ ...d, method: true }))}>
            <BookOpen className="h-3.5 w-3.5 mr-1 text-slate-400" /> Methodology
          </Button>
          <Button size="sm" variant="outline" className="border-slate-800 bg-slate-900/60 text-slate-300 hover:text-white hover:bg-slate-800" onClick={() => setDialogs((d) => ({ ...d, verify: true }))}>
            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-slate-400" /> Verify engine
          </Button>
        </div>
      </header>

      <main className="grid gap-4 p-4 lg:grid-cols-[280px_1fr_360px]">
        {/* LEFT */}
        <div className="space-y-4">
          <Panel title="Preset templates">
            <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-300">
              Illustrative Demo Assumptions — Calibrate to your own baseline
            </p>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadPreset(p.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-all hover:border-slate-700 hover:bg-slate-800/40 ${activePreset === p.id ? "border-indigo-500/80 bg-indigo-500/10 shadow-sm" : "border-slate-800/80 bg-slate-900/40"}`}
                >
                  <div className="text-sm font-semibold text-slate-100">{p.name}</div>
                  <div className="text-xs text-slate-400">{p.blurb}</div>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Event market">
            <Button className="mb-3 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm shadow-indigo-600/20" onClick={() => addLeg()}><Plus className="h-4 w-4 mr-1" /> Add Custom Leg</Button>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Button key={c} size="sm" variant="secondary" className="rounded-full border border-slate-800/80 bg-slate-900/60 text-xs text-slate-300 hover:border-indigo-500/40 hover:bg-slate-800 hover:text-white" onClick={() => addLeg(c)}>+ {c}</Button>
              ))}
            </div>
          </Panel>
          <Panel title="Global model parameters">
            <div className="space-y-4 text-sm">
              <label className="block">
                <div className="mb-2 flex justify-between"><span className="text-slate-400">Weekly energy cap</span><span className="font-mono text-slate-200">{cap}h</span></div>
                <Slider min={10} max={100} step={1} value={[cap]} onValueChange={([v]) => setCap(v ?? 46)} />
              </label>
              <label className="block">
                <div className="mb-2 flex justify-between"><span className="text-slate-400">Chaos / shock factor</span><span className="font-mono text-slate-200">{Math.round(chaos * 100)}%</span></div>
                <Slider min={0} max={30} step={1} value={[chaos * 100]} onValueChange={([v]) => setChaos((v ?? 0) / 100)} />
              </label>
              <div>
                <div className="mb-2 text-slate-400">PRNG seed</div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    className="font-mono bg-slate-950/60 border-slate-800 text-slate-200"
                    value={seed}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v)) setSeed(v);
                    }}
                  />
                  <Button size="icon" variant="outline" className="border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300" aria-label="Randomize seed" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}><Shuffle className="h-4 w-4" /></Button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">A fixed seed gives reproducibility, not predictive validity.</p>
              </div>
            </div>
          </Panel>
        </div>

        {/* CENTER */}
        <div className="min-w-0 space-y-4">
          {state?.status === "error" && (
            <div role="alert" className="rounded-lg border border-danger/60 bg-danger/10 p-4 text-sm">
              <div className="mb-1 font-semibold text-danger">Simulation unavailable — fix the plan to continue</div>
              <ul className="list-disc pl-4">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          {!state && <div className="rounded-lg border border-border bg-card p-8 text-center font-mono text-sm text-muted-foreground">Running first simulation…</div>}
          {view && (
            <>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <Kpi label="Naive probability" value={pct(view.kpis.naive)} sub="independent product" />
                <Kpi label="Full parlay survival" value={pct(view.kpis.success)} sub={`95% CI ${pct(view.kpis.successCI[0])}–${pct(view.kpis.successCI[1])}`} tone="success" />
                <Kpi label="Implied odds" value={view.kpis.decimalOdds} sub={view.kpis.americanOdds} />
                <Kpi label="Burnout probability" value={pct(view.kpis.burnout)} sub={`95% CI ${pct(view.kpis.burnoutCI[0])}–${pct(view.kpis.burnoutCI[1])}`} tone="danger" />
              </div>
              {view.primaryBottleneck && view.primaryBottleneck.deltaPP > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⚡</span>
                    <span className="font-semibold uppercase tracking-wider text-amber-400">Primary Bottleneck:</span>
                    <span className="font-semibold text-slate-100">{view.primaryBottleneck.legName}</span>
                  </div>
                  <span className="font-mono font-semibold text-teal-400">
                    +{view.primaryBottleneck.deltaPP.toFixed(1)} pp survival rate if simplified or removed
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                Estimates conditional on your inputs. CIs reflect simulation noise only, not uncertainty in your probabilities. Implied odds are not a betting market.
              </p>
              <Panel title="Distribution of 10,000 simulated universes" right={<span className="font-mono text-xs text-slate-400">Σ = {view.histogram.reduce((a, b) => a + b.count, 0).toLocaleString()}</span>}>
                <OutcomeHistogram view={view} />
              </Panel>
              <Panel title="16-week fatigue & workload trajectory">
                <FatigueChart view={view} cap={cap} threshold={DEFAULT_COEFFICIENTS.burnoutThreshold} />
              </Panel>
              <Panel title="Bottleneck analysis (counterfactual sensitivity)">
                <p className="mb-3 text-[11px] text-slate-400">Change in full-survival rate if each leg is removed, using the same random numbers. Model-based estimate, not proof of cause.</p>
                {view.sensitivity && view.sensitivity.length > 0 ? (
                  <div className="space-y-2.5">
                    {view.sensitivity.map((s, i) => {
                      const max = Math.max(...view.sensitivity!.map((x) => Math.abs(x.deltaPP)), 0.01);
                      return (
                        <div key={s.legId} className="grid grid-cols-[24px_1fr_80px] items-center gap-3 text-xs">
                          <span className="font-mono text-xs text-slate-400">#{i + 1}</span>
                          <div className="min-w-0">
                            <div className="truncate text-slate-200 mb-1">{s.legName}</div>
                            <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${s.deltaPP >= 0 ? "bg-amber-400" : "bg-indigo-500"}`}
                                style={{ width: `${(Math.abs(s.deltaPP) / max) * 100}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-right font-mono font-semibold ${s.deltaPP >= 0 ? "text-teal-400" : "text-rose-400"}`}>{s.deltaPP >= 0 ? "+" : ""}{s.deltaPP.toFixed(1)} pp</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Add legs to see bottlenecks.</p>
                )}
              </Panel>
            </>
          )}
        </div>

        {/* RIGHT: SLIP */}
        <div className="space-y-4">
          <section className="flex flex-col rounded-xl border border-slate-800/80 bg-slate-900/60 shadow-sm backdrop-blur-sm overflow-hidden">
            <Tabs defaultValue="legs" className="w-full flex flex-col">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 px-4 py-3 bg-slate-900/90 gap-2">
                <TabsList className="bg-slate-950/80 p-1 border border-slate-800/60">
                  <TabsTrigger
                    value="legs"
                    className="text-xs font-semibold px-3 py-1.5 rounded-md transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow"
                  >
                    Active Legs ({legs.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="dependencies"
                    className="text-xs font-semibold px-3 py-1.5 rounded-md transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow"
                  >
                    Dependencies ({deps.length})
                  </TabsTrigger>
                </TabsList>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    {sportsbook ? "Sportsbook" : "Quant"}
                    <Switch checked={sportsbook} onCheckedChange={setSportsbook} aria-label="Toggle sportsbook labels" />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-slate-700 bg-slate-800/60 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white cursor-pointer"
                    disabled={!view}
                    onClick={() => setDialogs((d) => ({ ...d, share: true }))}
                  >
                    <Share2 className="h-3.5 w-3.5 mr-1 text-indigo-400" /> Share Ticket
                  </Button>
                </div>
              </div>

              <TabsContent value="legs" className="m-0 focus-visible:outline-none">
                <div className="max-h-[calc(100vh-250px)] min-h-[420px] space-y-3 overflow-y-auto p-4">
                  {legs.length === 0 && <p className="text-sm text-slate-400 text-center py-12">Empty slip. Add a leg or load a preset.</p>}
                  {legs.map((l) => (
                    <LegEditor key={l.id} leg={l} simRate={view?.legSuccessRate[l.id]} onChange={(p) => updateLeg(l.id, p)} onRemove={() => removeLegUI(l.id)} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="dependencies" className="m-0 focus-visible:outline-none">
                <div className="max-h-[calc(100vh-250px)] min-h-[420px] overflow-y-auto p-4">
                  <DependencyEditor legs={legs} deps={deps} setDeps={(d) => { setDeps(d); setActivePreset(null); }} legName={legName} />
                </div>
              </TabsContent>
            </Tabs>

            <div className="border-t border-slate-800/80 p-4 bg-slate-950/40">
              {view && (
                <div className="flex items-center justify-between gap-3">
                  <div className={`rounded-md border px-3 py-1.5 text-center font-mono text-xs font-bold ${riskColor[view.risk]}`}>
                    {RISK_LABELS[view.risk][sportsbook ? "sportsbook" : "quant"]}
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 mr-2">Modeled Payout</span>
                    <span className="font-mono text-2xl font-bold text-indigo-400">{view.kpis.decimalOdds}</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      <MethodologySheet open={dialogs.method} onOpenChange={(o) => setDialogs((d) => ({ ...d, method: o }))} />
      <VerificationDialog open={dialogs.verify} onOpenChange={(o) => setDialogs((d) => ({ ...d, verify: o }))} />
      <ShareDialog open={dialogs.share} onOpenChange={(o) => setDialogs((d) => ({ ...d, share: o }))} view={view} legs={legs} cap={cap} chaos={chaos} seed={seed} sportsbook={sportsbook} />
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "success" | "danger" | "warning" }) {
  const c = tone === "success" ? "text-teal-400" : tone === "danger" ? "text-rose-400" : tone === "warning" ? "text-amber-400" : "text-slate-100";
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-sm backdrop-blur-sm">
      <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1.5 font-mono text-2xl font-bold tracking-tight ${c}`}>{value}</div>
      <div className="mt-1 font-mono text-[11px] text-slate-400 truncate">{sub}</div>
    </div>
  );
}

function LegEditor({ leg, simRate, onChange, onRemove }: { leg: Leg; simRate?: number | undefined; onChange: (p: Partial<Leg>) => void; onRemove: () => void }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3.5 transition-all hover:border-slate-700">
      <div className="mb-2.5 flex items-center gap-2">
        <Input className="h-8 text-sm bg-slate-950/50 border-slate-800 text-slate-100 font-medium" value={leg.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Leg name" />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-400 cursor-pointer" onClick={onRemove} aria-label={`Remove ${leg.name}`}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="inline-flex items-center rounded-full bg-slate-800/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
          {leg.category}
        </span>
        <span className="font-mono text-[11px] text-slate-400">
          sim win: <span className={simRate !== undefined && simRate >= 0.5 ? "text-teal-400 font-semibold" : "text-amber-400 font-semibold"}>{simRate !== undefined ? pct(simRate) : "—"}</span>
        </span>
      </div>
      <Row label="Base prob" val={pct(leg.baseProbability, 0)}>
        <Slider min={1} max={99} step={1} value={[Math.round(leg.baseProbability * 100)]} onValueChange={([v]) => onChange({ baseProbability: (v ?? 50) / 100 })} />
      </Row>
      <Row label="Hours/wk" val={`${leg.weeklyHoursCost}h`}>
        <Slider min={1} max={40} step={1} value={[leg.weeklyHoursCost]} onValueChange={([v]) => onChange({ weeklyHoursCost: v ?? leg.weeklyHoursCost })} />
      </Row>
      <Row label="Stress" val={`${leg.stressImpact}/10`}>
        <Slider min={1} max={10} step={1} value={[leg.stressImpact]} onValueChange={([v]) => onChange({ stressImpact: v ?? leg.stressImpact })} />
      </Row>
      <Row label="Weeks" val={`W${leg.startWeek}–W${leg.endWeek}`}>
        <Slider min={1} max={HORIZON_WEEKS} step={1} minStepsBetweenThumbs={0} value={[leg.startWeek, leg.endWeek]} onValueChange={(v) => onChange({ startWeek: v[0] ?? leg.startWeek, endWeek: v[1] ?? leg.endWeek })} />
      </Row>
    </div>
  );
}

function Row({ label, val, children }: { label: string; val: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 grid grid-cols-[64px_1fr_64px] items-center gap-2 text-xs">
      <span className="text-slate-400">{label}</span>
      {children}
      <span className="text-right font-mono text-slate-200">{val}</span>
    </div>
  );
}

function DependencyEditor({ legs, deps, setDeps, legName }: { legs: Leg[]; deps: Dependency[]; setDeps: (d: Dependency[]) => void; legName: (id: string) => string }) {
  const [trig, setTrig] = useState("");
  const [aff, setAff] = useState("");
  const [type, setType] = useState<DependencyType>("failure_penalty");
  const [strength, setStrength] = useState(20);
  const [err, setErr] = useState<string | null>(null);
  const sel = "h-8 w-full rounded-md border border-slate-800 bg-slate-950/70 px-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500";
  const candidate = useMemo(() => ({ id: `dep-${Date.now().toString(36)}`, triggerLegId: trig, affectedLegId: aff, dependencyType: type, penaltyStrength: strength / 100 }), [trig, aff, type, strength]);
  const add = () => {
    if (!trig || !aff) return setErr("Pick both legs.");
    const v = validateConfig({ legs, dependencies: [...deps, candidate], energyCap: 50, chaos: 0, seed: 1 });
    const depErr = v.errors.filter((e) => /cycle|depend|missing/i.test(e));
    if (depErr.length) return setErr(depErr[0] ?? "Invalid dependency");
    setErr(null);
    setDeps([...deps, candidate]);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Link2 className="h-3.5 w-3.5" /> Dependency Links
        </h4>
        <span className="font-mono text-xs text-slate-400">{deps.length} active</span>
      </div>
      <p className="text-[11px] text-slate-400">
        Cascading failure effects when a prerequisite or trigger leg fails (DAG).
      </p>
      {deps.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-800/80 p-4 text-center text-xs text-slate-400">
          No dependency links configured.
        </div>
      )}
      {deps.map((d) => (
        <div key={d.id} className="flex items-center gap-2 rounded-lg border border-slate-800/80 bg-slate-900/50 px-3 py-2 text-xs">
          <span className="flex-1 text-slate-300">
            If <b className="text-slate-100">{legName(d.triggerLegId)}</b> fails → <b className="text-slate-100">{legName(d.affectedLegId)}</b>{" "}
            <span className="font-mono text-amber-400">{d.dependencyType === "hard_prerequisite" ? "auto-fail" : `−${Math.round(d.penaltyStrength * 100)}pp`}</span>
          </span>
          <button className="text-slate-400 hover:text-rose-400 cursor-pointer p-1" aria-label="Remove dependency" onClick={() => setDeps(deps.filter((x) => x.id !== d.id))}><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      {legs.length >= 2 ? (
        <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-800/80">
          <div className="col-span-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Add Dependency Link</div>
          <select className={sel} value={trig} onChange={(e) => setTrig(e.target.value)} aria-label="Trigger leg">
            <option value="">If this fails…</option>
            {legs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className={sel} value={aff} onChange={(e) => setAff(e.target.value)} aria-label="Affected leg">
            <option value="">…this is hurt</option>
            {legs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className={sel} value={type} onChange={(e) => setType(e.target.value as DependencyType)} aria-label="Dependency type">
            <option value="failure_penalty">Penalty (−pp)</option>
            <option value="hard_prerequisite">Hard prerequisite</option>
          </select>
          <Input type="number" min={0} max={100} className="h-8 font-mono text-xs bg-slate-950/70 border-slate-800 text-slate-200" value={strength} disabled={type === "hard_prerequisite"} onChange={(e) => setStrength(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} aria-label="Penalty strength in percentage points" />
          <Button size="sm" variant="secondary" className="col-span-2 cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-200" onClick={add}>+ Link legs</Button>
          {err && <p className="col-span-2 text-xs text-rose-400">{err}</p>}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Add at least 2 legs to configure dependency links.</p>
      )}
    </div>
  );
}
