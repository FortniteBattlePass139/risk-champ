import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { runVerificationSuite, type CheckResult } from "@/engine/verification";
import { DEFAULT_COEFFICIENTS as C, type Leg } from "@/engine/monteCarlo";
import { pct, RISK_LABELS, type DashboardView } from "@/engine/dashboard";

export function MethodologySheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Model Methodology & Assumptions</SheetTitle>
          <SheetDescription>
            Every number is an estimate conditional on the inputs you provide. The model does not know your
            true probabilities and cannot reliably predict real-life outcomes without calibrated data.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6 text-sm text-muted-foreground">
          <section>
            <h4 className="mb-1 font-semibold text-foreground">Weekly loop (16 weeks × 10,000 universes)</h4>
            <ul className="list-disc space-y-1 pl-4 font-mono text-xs">
              <li>shock ~ Bernoulli(chaos); shock hours ~ U({C.shockHoursMin}, {C.shockHoursMax})</li>
              <li>variance mult = clamp(1 + {C.workloadVariance}·z, 0.5, 2), z ~ N(0,1)</li>
              <li>workload = mult · Σ hours(active legs) + shock hours</li>
              <li>overload = max(0, workload / cap − 1)</li>
              <li>
                F ← max(0, F + {C.overloadCoef}·overload^{C.overloadExponent} + {C.stressCoef}·stress·util − {C.recoveryRate}·max(0, 1 − util))
              </li>
              <li>Burnout when F ≥ {C.burnoutThreshold}: universe collapses, all unresolved legs fail.</li>
            </ul>
          </section>
          <section>
            <h4 className="mb-1 font-semibold text-foreground">Leg resolution</h4>
            <ul className="list-disc space-y-1 pl-4 font-mono text-xs">
              <li>Resolves at endWeek (or later if a trigger leg resolves later).</li>
              <li>p = base − {C.maxFatiguePenalty}·(1 − e^(−F))·(0.5 + 0.5·stress/10) − (shock ? {C.shockPenalty} : 0) − Σ penalties</li>
              <li>Failure penalty: absolute reduction by penaltyStrength only if the trigger leg failed.</li>
              <li>Hard prerequisite: trigger failure forces p to 0.001.</li>
              <li>p clamped to [0.001, 0.999]; outcome ~ Bernoulli(p).</li>
              <li>Dependencies must form a DAG — cycles are rejected.</li>
            </ul>
          </section>
          <section>
            <h4 className="mb-1 font-semibold text-foreground">Metrics</h4>
            <ul className="list-disc space-y-1 pl-4">
              <li><b>Naive</b>: product of base probabilities (independence, no fatigue or chaos).</li>
              <li><b>Full Parlay Survival</b>: share of universes with every leg succeeding and no burnout.</li>
              <li><b>95% CI</b>: p̂ ± 1.96·√(p̂(1−p̂)/N). It measures simulation noise only — not your uncertainty about the inputs.</li>
              <li><b>Implied odds</b> = 1/p. These are decision-analysis figures, not a bookmaker market or expected monetary value. This is not a gambling product.</li>
              <li><b>Histogram</b>: Burnout universes go only in the Burnout bin; other bins count non-burnout universes by legs won. Bins sum to N.</li>
              <li><b>Sensitivity</b>: re-runs the plan without each leg (its dependency edges removed) using the same random numbers. A model-based estimate, not proof of cause.</li>
              <li>A fixed seed gives reproducibility, not predictive validity.</li>
            </ul>
          </section>
          <p className="text-xs">Coefficients are illustrative assumptions, not validated human-performance laws.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function VerificationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [ms, setMs] = useState(0);
  const [running, setRunning] = useState(false);
  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const t = performance.now();
      setResults(runVerificationSuite());
      setMs(performance.now() - t);
      setRunning(false);
    }, 20);
  };
  const passed = results?.filter((r) => r.passed).length ?? 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Engine Verification Suite</DialogTitle>
          <DialogDescription>Runs the 10 engine invariants live in your browser.</DialogDescription>
        </DialogHeader>
        <Button onClick={run} disabled={running}>{running ? "Running…" : "Run Engine Verification Suite"}</Button>
        {results && (
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">
              {passed}/{results.length} passed · {ms.toFixed(0)} ms
            </p>
            {results.map((r) => (
              <div key={r.id} className="flex items-start gap-2 rounded border border-border p-2 text-sm">
                <span className={`font-mono text-xs font-bold ${r.passed ? "text-success" : "text-danger"}`}>
                  {r.passed ? "PASS" : "FAIL"}
                </span>
                <span className="flex-1">{r.id}. {r.name}{!r.passed && <span className="block font-mono text-xs text-danger">{r.detail}</span>}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ShareDialog({
  open,
  onOpenChange,
  view,
  legs,
  cap,
  chaos,
  seed,
  sportsbook,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  view: DashboardView | null;
  legs: Leg[];
  cap: number;
  chaos: number;
  seed: number;
  sportsbook: boolean;
}) {
  if (!view) return null;
  const k = view.kpis;
  const rating = RISK_LABELS[view.risk][sportsbook ? "sportsbook" : "quant"];
  const text = [
    "PARLAYLIFE PLAN TICKET",
    ...legs.map((l, i) => `${i + 1}. ${l.name} — base ${pct(l.baseProbability, 0)}, ${l.weeklyHoursCost}h/wk, W${l.startWeek}-${l.endWeek}`),
    `Survival: ${pct(k.success)} (95% CI ${pct(k.successCI[0])}–${pct(k.successCI[1])})`,
    `Implied odds: ${k.decimalOdds} / ${k.americanOdds}`,
    `Burnout: ${pct(k.burnout)} · Naive: ${pct(k.naive)}`,
    `Risk: ${rating}`,
    `Assumptions: cap ${cap}h/wk, chaos ${Math.round(chaos * 100)}%, seed ${seed}, N=${k.iterations}`,
    "Model estimate conditional on user inputs — not a prediction or betting market.",
  ].join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Ticket copied to clipboard");
    } catch {
      toast.error("Clipboard unavailable — select the text and copy manually");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Plan Ticket</DialogTitle>
          <DialogDescription>A receipt of this simulation run.</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-dashed border-primary/60 bg-background p-4 font-mono text-xs">
          <div className="mb-2 flex justify-between text-muted-foreground"><span>PARLAYLIFE</span><span>SEED {seed}</span></div>
          {legs.map((l) => (
            <div key={l.id} className="flex justify-between gap-2 border-b border-border py-1">
              <span className="truncate">{l.name}</span><span>{pct(view.legSuccessRate[l.id] ?? 0, 0)}</span>
            </div>
          ))}
          <div className="mt-3 text-3xl font-bold text-primary">{k.decimalOdds}</div>
          <div>{k.americanOdds}</div>
          <div className="mt-2">SURVIVAL {pct(k.success)} <span className="text-muted-foreground">[{pct(k.successCI[0])}, {pct(k.successCI[1])}]</span></div>
          <div className="text-danger">BURNOUT {pct(k.burnout)}</div>
          <div className="mt-2 font-bold">{rating}</div>
          <div className="mt-2 text-muted-foreground">CAP {cap}h · CHAOS {Math.round(chaos * 100)}% · N={k.iterations}</div>
        </div>
        <Button onClick={copy}>Copy to clipboard</Button>
      </DialogContent>
    </Dialog>
  );
}
