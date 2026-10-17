import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Shuffle, BookOpen, ShieldCheck, Share2, Link2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  OPTIMAL: "text-success border-success/50 bg-success/10",
  MODERATE: "text-warning border-warning/50 bg-warning/10",
  FRAGILE: "text-warning border-warning/50 bg-warning/10",
  OVERLOADED: "text-danger border-danger/50 bg-danger/10",
};
let uid = 0;
const newId = () => `leg-${Date.now().toString(36)}-${uid++}`;

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

function Index() {
  const [legs, setLegs] = useState<Leg[]>(() => PRESETS[0].legs.map((l) => ({ ...l })));
  const [deps, setDeps] = useState<Dependency[]>(() => PRESETS[0].dependencies.map((d) => ({ ...d })));
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0].id);
  const [cap, setCap] = useState(50);
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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">PL</div>
          <div>
            <h1 className="text-lg font-bold leading-none">ParlayLife</h1>
            <p className="text-xs text-muted-foreground">Life-Sim Monte Carlo · decision analysis, not gambling</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {computing ? "SIMULATING…" : `N=10,000 · ${elapsed.toFixed(0)} ms (incl. sensitivity)`}
          </span>
          <Button size="sm" variant="outline" onClick={() => setDialogs((d) => ({ ...d, method: true }))}><BookOpen /> Methodology</Button>
          <Button size="sm" variant="outline" onClick={() => setDialogs((d) => ({ ...d, verify: true }))}><ShieldCheck /> Verify engine</Button>
        </div>
      </header>

      <main className="grid gap-4 p-4 lg:grid-cols-[280px_1fr_360px]">
        {/* LEFT */}
        <div className="space-y-4">
          <Panel title="Preset templates">
            <p className="mb-3 rounded border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-warning">
              Illustrative Demo Assumptions — Calibrate to your own baseline
            </p>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => loadPreset(p.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-accent ${activePreset === p.id ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.blurb}</div>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Event market">
            <Button className="mb-3 w-full" onClick={() => addLeg()}><Plus /> Add Custom Leg</Button>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Button key={c} size="sm" variant="secondary" onClick={() => addLeg(c)}>+ {c}</Button>
              ))}
            </div>
          </Panel>
          <Panel title="Global model parameters">
            <div className="space-y-4 text-sm">
              <label className="block">
                <div className="mb-2 flex justify-between"><span>Weekly energy cap</span><span className="font-mono">{cap}h</span></div>
                <Slider min={10} max={100} step={1} value={[cap]} onValueChange={([v]) => setCap(v)} />
              </label>
              <label className="block">
                <div className="mb-2 flex justify-between"><span>Chaos / shock factor</span><span className="font-mono">{Math.round(chaos * 100)}%</span></div>
                <Slider min={0} max={30} step={1} value={[chaos * 100]} onValueChange={([v]) => setChaos(v / 100)} />
              </label>
              <div>
                <div className="mb-2">PRNG seed</div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    className="font-mono"
                    value={seed}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v)) setSeed(v);
                    }}
                  />
                  <Button size="icon" variant="outline" aria-label="Randomize seed" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}><Shuffle /></Button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">A fixed seed gives reproducibility, not predictive validity.</p>
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
              <p className="text-[11px] text-muted-foreground">
                Estimates conditional on your inputs. CIs reflect simulation noise only, not uncertainty in your probabilities. Implied odds are not a betting market.
              </p>
              <Panel title="Distribution of 10,000 simulated universes" right={<span className="font-mono text-xs text-muted-foreground">Σ = {view.histogram.reduce((a, b) => a + b.count, 0).toLocaleString()}</span>}>
                <OutcomeHistogram view={view} />
              </Panel>
              <Panel title="16-week fatigue & workload trajectory">
                <FatigueChart view={view} cap={cap} threshold={DEFAULT_COEFFICIENTS.burnoutThreshold} />
              </Panel>
              <Panel title="Bottleneck analysis (counterfactual sensitivity)">
                <p className="mb-3 text-[11px] text-muted-foreground">Change in full-survival rate if each leg is removed, using the same random numbers. Model-based estimate, not proof of cause.</p>
                {view.sensitivity && view.sensitivity.length > 0 ? (
                  <div className="space-y-2">
                    {view.sensitivity.map((s, i) => {
                      const max = Math.max(...view.sensitivity!.map((x) => Math.abs(x.deltaPP)), 0.01);
                      return (
                        <div key={s.legId} className="grid grid-cols-[24px_1fr_80px] items-center gap-2 text-sm">
                          <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                          <div>
                            <div className="truncate">{s.legName}</div>
                            <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-warning" style={{ width: `${(Math.abs(s.deltaPP) / max) * 100}%` }} /></div>
                          </div>
                          <span className={`text-right font-mono ${s.deltaPP >= 0 ? "text-success" : "text-danger"}`}>{s.deltaPP >= 0 ? "+" : ""}{s.deltaPP.toFixed(1)} pp</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Add legs to see bottlenecks.</p>
                )}
              </Panel>
            </>
          )}
        </div>

        {/* RIGHT: SLIP */}
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <h3 className="font-semibold">Active Plan Slip</h3>
                <p className="font-mono text-xs text-muted-foreground">{legs.length} legs · {deps.length} links</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {sportsbook ? "Sportsbook" : "Quant"} <Switch checked={sportsbook} onCheckedChange={setSportsbook} aria-label="Toggle sportsbook labels" />
              </label>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
              {legs.length === 0 && <p className="text-sm text-muted-foreground">Empty slip. Add a leg or load a preset.</p>}
              {legs.map((l) => (
                <LegEditor key={l.id} leg={l} simRate={view?.legSuccessRate[l.id]} onChange={(p) => updateLeg(l.id, p)} onRemove={() => removeLegUI(l.id)} />
              ))}
            </div>
            <DependencyEditor legs={legs} deps={deps} setDeps={(d) => { setDeps(d); setActivePreset(null); }} legName={legName} />
            <div className="space-y-3 border-t border-border p-4">
              {view && (
                <>
                  <div className={`rounded border px-3 py-2 text-center font-mono text-sm font-bold ${riskColor[view.risk]}`}>
                    {RISK_LABELS[view.risk][sportsbook ? "sportsbook" : "quant"]}
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-xs text-muted-foreground">Modeled payout multiplier</span>
                    <span className="font-mono text-2xl font-bold text-primary">{view.kpis.decimalOdds}</span>
                  </div>
                </>
              )}
              <Button className="w-full" disabled={!view} onClick={() => setDialogs((d) => ({ ...d, share: true }))}><Share2 /> Share Plan Ticket</Button>
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

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "success" | "danger" }) {
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function LegEditor({ leg, simRate, onChange, onRemove }: { leg: Leg; simRate?: number; onChange: (p: Partial<Leg>) => void; onRemove: () => void }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <Input className="h-8 text-sm" value={leg.name} onChange={(e) => onChange({ name: e.target.value })} aria-label="Leg name" />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRemove} aria-label={`Remove ${leg.name}`}><Trash2 /></Button>
      </div>
      <div className="mb-2 flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>{leg.category}</span>
        <span>sim win <span className={simRate !== undefined && simRate >= 0.5 ? "text-success" : "text-warning"}>{simRate !== undefined ? pct(simRate) : "—"}</span></span>
      </div>
      <Row label="Base prob" val={pct(leg.baseProbability, 0)}>
        <Slider min={1} max={99} step={1} value={[Math.round(leg.baseProbability * 100)]} onValueChange={([v]) => onChange({ baseProbability: v / 100 })} />
      </Row>
      <Row label="Hours/wk" val={`${leg.weeklyHoursCost}h`}>
        <Slider min={1} max={40} step={1} value={[leg.weeklyHoursCost]} onValueChange={([v]) => onChange({ weeklyHoursCost: v })} />
      </Row>
      <Row label="Stress" val={`${leg.stressImpact}/10`}>
        <Slider min={1} max={10} step={1} value={[leg.stressImpact]} onValueChange={([v]) => onChange({ stressImpact: v })} />
      </Row>
      <Row label="Weeks" val={`W${leg.startWeek}–W${leg.endWeek}`}>
        <Slider min={1} max={HORIZON_WEEKS} step={1} minStepsBetweenThumbs={0} value={[leg.startWeek, leg.endWeek]} onValueChange={([a, b]) => onChange({ startWeek: a, endWeek: b })} />
      </Row>
    </div>
  );
}

function Row({ label, val, children }: { label: string; val: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 grid grid-cols-[64px_1fr_64px] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
      <span className="text-right font-mono">{val}</span>
    </div>
  );
}

function DependencyEditor({ legs, deps, setDeps, legName }: { legs: Leg[]; deps: Dependency[]; setDeps: (d: Dependency[]) => void; legName: (id: string) => string }) {
  const [trig, setTrig] = useState("");
  const [aff, setAff] = useState("");
  const [type, setType] = useState<DependencyType>("failure_penalty");
  const [strength, setStrength] = useState(20);
  const [err, setErr] = useState<string | null>(null);
  const sel = "h-8 w-full rounded-md border border-input bg-background px-2 text-xs";
  const candidate = useMemo(() => ({ id: `dep-${Date.now().toString(36)}`, triggerLegId: trig, affectedLegId: aff, dependencyType: type, penaltyStrength: strength / 100 }), [trig, aff, type, strength]);
  const add = () => {
    if (!trig || !aff) return setErr("Pick both legs.");
    const v = validateConfig({ legs, dependencies: [...deps, candidate], energyCap: 50, chaos: 0, seed: 1 });
    const depErr = v.errors.filter((e) => /cycle|depend|missing/i.test(e));
    if (depErr.length) return setErr(depErr[0]);
    setErr(null);
    setDeps([...deps, candidate]);
  };
  return (
    <div className="space-y-2 border-t border-border p-4">
      <h4 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Link2 className="h-3 w-3" /> Dependency links</h4>
      {deps.map((d) => (
        <div key={d.id} className="flex items-center gap-2 rounded border border-border px-2 py-1 text-xs">
          <span className="flex-1">
            If <b>{legName(d.triggerLegId)}</b> fails → <b>{legName(d.affectedLegId)}</b>{" "}
            <span className="font-mono text-warning">{d.dependencyType === "hard_prerequisite" ? "auto-fail" : `−${Math.round(d.penaltyStrength * 100)}pp`}</span>
          </span>
          <button className="text-muted-foreground hover:text-danger" aria-label="Remove dependency" onClick={() => setDeps(deps.filter((x) => x.id !== d.id))}><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
      {legs.length >= 2 && (
        <div className="grid grid-cols-2 gap-2">
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
          <Input type="number" min={0} max={100} className="h-8 font-mono text-xs" value={strength} disabled={type === "hard_prerequisite"} onChange={(e) => setStrength(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} aria-label="Penalty strength in percentage points" />
          <Button size="sm" variant="secondary" className="col-span-2" onClick={add}>+ Link legs</Button>
          {err && <p className="col-span-2 text-xs text-danger">{err}</p>}
        </div>
      )}
    </div>
  );
}
