# Risk Champ

Build "ParlayLife" (Life-Sim Monte Carlo), a high-speed quantitative risk simulator for real-life decisions, academic semesters, and startup projects, disguised with the sleek, addictive UX of a modern sportsbook and quantitative terminal.

### 1. Aesthetic & Design System
- **Vibe:** Modern dark-mode Sportsbook (Stake / DraftKings / Polymarket) meets Quantitative Terminal (Linear / Bloomberg).
- **Colors:** Deep carbon background (#08090C), card surfaces (#11141C), crisp borders (#1E2330).
- **Semantic Accents:** 
  - Emerald Neon (#10B981) for high-probability survival universes.
  - Electric Amber (#F59E0B) for high-variance / fatigue overload warnings.
  - Crimson Rose (#F43F5E) for "Burnout / System Collapse" zones.
- **Typography:** Inter for UI, JetBrains Mono for all odds, probabilities, multipliers, confidence intervals, and simulation counters.

### 2. Core Mathematical Engine (True Correlated Monte Carlo - 10,000 Runs)
Do NOT just multiply static probabilities. Implement a client-side TypeScript Monte Carlo simulation engine that runs 10,000 iterations:
- Each "Leg" (event) in the user's parlay has:
  1. `id` (string)
  2. `name` (string)
  3. `baseProbability` (0.01 to 0.99)
  4. `weeklyHoursCost` (1 to 40 hours of cognitive/physical effort)
  5. `stressImpact` (1 to 10 scale)
  6. `startWeek` and `endWeek` (1 to 16, default 1 to 16)
  7. `dependency` (optional: `triggerLegId`, `affectedLegId`, `dependencyType`, and `penaltyStrength` in `[0, 1]`).
- **Global Model Parameters (Configurable Sliders):**
  - `Weekly Energy Cap` (default 50 productive hours/week).
  - `Chaos / Exogenous Shock Factor` (0% to 30%: random external disruptions like getting sick, server crash, or surprise exam).
  - `PRNG Seed` (integer input + "Randomize Seed" button for reproducible runs).

### 3. Layout & Interactive Features (3-Column Quantitative Sportsbook Layout)

#### Left Column: Preset Templates & Event Market ("Add Legs")
- Include 3 instant-load Pre-built Templates clearly badged as *"Illustrative Demo Assumptions — Calibrate to your own baseline"*:
  1. **"Ingeniería + Side-Project + Gym"** (5 legs: Pasar Cálculo/Física estudiando 6h/sem [55%], Lanzar MVP funcional [65%], Mantener rutina de fuerza 4x/sem [75%], Conseguir primeros usuarios [35%], Dormir 7h diarias [40%]).
  2. **"Bootstrapper / Indie Hacker Launch"** (4 legs: Terminar desarrollo a tiempo [70%], 0 caídas de servidor en el lanzamiento [80%], Conversión a pago > 3% [30%], No quemar el presupuesto de API [85%]).
  3. **"All-In Semestre Crítico"** (4 legs pesados con alta carga horaria y dependencias encadenadas).
- Allow users to click "+ Add Custom Leg" or pick from quick categories (Career, Academic, Tech/Infra, Health, Finance).

#### Center Stage: Live Monte Carlo Telemetry & Multiverse Charts
- **Top KPI Strip:**
  - **Naive Probability** (independent product of base probabilities) vs. **Full Parlay Survival Rate** (with 95% Monte Carlo confidence interval).
  - **Implied Decimal Odds & American Odds** (e.g., `6.85x` / `+585`).
  - **Burnout Probability (%)**: Percentage of the 10,000 universes reaching the burnout threshold.
- **Chart 1 (Recharts Bar Histogram): "Distribution of 10,000 Simulated Universes".**
  - X-axis: Mutually exclusive outcome categories (`Burnout / Collapse`, `0 Legs`, `1 Leg` ... `Full Parlay Success`).
  - Y-axis: Exact universe count out of 10,000.
- **Chart 2 (Recharts Composed Line Chart): "16-Week Fatigue & Workload Trajectory".**
  - Plot weekly mean workload, accumulated fatigue, the "Safe Capacity Threshold", and the "90th Percentile Stress Band" across weeks 1 to 16.
- **Counterfactual Sensitivity Diagnostic Card ("Bottleneck Analysis"):** Automatically rank legs by their counterfactual impact (showing how many percentage points the Full Parlay Survival Rate changes if that specific leg is removed).

#### Right Column: "The Active Plan Slip" (Interactive Parlay Ticket)
- Styled like a clean sportsbook Bet Slip / Quant Ticket.
- List all active legs with inline sliders to tweak `baseProbability (%)`, `weeklyHoursCost`, `startWeek/endWeek`, and dependency links.
- Display analytical Risk Diagnostic Badges: `OPTIMAL LOAD`, `MODERATE FRICTION`, `FRAGILE PLAN`, or `OVERLOADED` (with an optional UI toggle to switch between "Quant Mode" and playful "Sportsbook Mode" labels).
- **"Share Plan Ticket" Modal:** Renders a high-contrast visual receipt with implied odds, survival rate, 95% CI, active assumptions, and risk rating ready to copy to clipboard.

### 4. Mathematical Integrity, Simulation Rules & Engineering Constraints
The simulation engine is the core product. A visually impressive dashboard with fake or hardcoded calculations is unacceptable.

#### A. Real Monte Carlo Engine (`src/engine/monteCarlo.ts`)
- Implement a real, deterministic-testable client-side TypeScript simulation engine completely independent from React components and UI state.
- Run 10,000 simulated universes using actual random sampling. Support an optional fixed seed (e.g., Mulberry32 PRNG) for reproducible results during testing.
- Every chart, KPI, odds value, and diagnostic must derive from the same simulation results object.
- Never use hardcoded outcome distributions or fabricated telemetry.

#### B. Explicit Probability Model
For each leg, define a documented success-probability calculation:
- Start from `baseProbability`.
- Apply a bounded fatigue penalty based on cumulative workload and stress.
- Apply the configured chaos model.
- Apply dependency effects only when their triggering conditions occur.
- Clamp final probabilities to a valid range `[0.001, 0.999]` and handle edge cases safely.
- Use conditional Bernoulli sampling for dependent events. Do not assume that multiplying the base probabilities produces the actual survival rate.
- Represent dependencies explicitly, including the triggering leg, affected leg, dependency type, and penalty strength. Prevent invalid dependency cycles (via DAG topological validation) or define and test their behavior.
- Important: dependencies and correlations are not interchangeable. A dependency should have a clear causal rule, while any additional shared random factors should be explicitly modeled.

#### C. Weekly Fatigue Model
Simulate the 16-week horizon week by week. For each universe:
1. Generate external disruptions and workload variation.
2. Calculate weekly workload relative to the energy cap (counting only legs active during that specific week: `startWeek <= week <= endWeek`).
3. Update accumulated fatigue and recovery.
4. Calculate each active leg's adjusted probability at its resolution point.
5. Sample success or failure according to the documented event model.
6. Track burnout, completed objectives, and the week in which failure or burnout occurred.
Avoid counting the full duration of every objective as a simultaneous weekly workload unless the user explicitly configures it that way. Use transparent, configurable assumptions for fatigue accumulation, recovery, and burnout thresholds. Clearly label these as model assumptions rather than empirically validated predictions.

#### D. Define the Metrics Precisely
- **Naive Probability:** Product of the base probabilities of all selected legs, assuming independence and ignoring fatigue and chaos.
- **Full Parlay Survival Rate:** Percentage of simulated universes in which every required leg succeeds within the modeled horizon without burnout.
- **Burnout Probability:** Percentage of universes reaching the explicitly defined burnout threshold.
- **Implied Decimal Odds:** Reciprocal of the modeled full-success probability, when that probability is greater than zero (if zero, safely format as `N/A (>10,000x)` without division by zero).
- **American Odds:** Derive from the same probability using the correct positive or negative odds formula.
- Clearly distinguish implied odds from real betting odds and expected monetary value. This product models decisions, not an actual bookmaker market.
- The histogram must include mutually exclusive outcome categories. Define whether burnout universes are included in the leg-count bins or displayed separately (e.g., a dedicated `Burnout` bin + non-burnout leg-count bins), and ensure the counts sum to exactly 10,000.

#### E. Sensitivity Analysis
For each leg, calculate a counterfactual scenario that removes or simplifies that leg while keeping other assumptions unchanged. Show the absolute change in full-success probability in percentage points. Label this as a model-based sensitivity estimate, not proof that the leg is objectively responsible for failure.

#### F. Performance and UI Reliability
- Use React, TypeScript, and the existing project stack. Use Recharts if compatible with the project.
- Keep controls responsive during simulation. Debounce or schedule slider-driven recalculations appropriately. Move computation into a Web Worker if profiling shows main-thread blocking.
- Handle empty scenarios, zero success probability, invalid inputs, and extreme workloads. Do not claim guaranteed 60 FPS without measurement.

#### G. Product Integrity
- Display a small, accessible explanation of assumptions and limitations ("Model Methodology & Assumptions" drawer).
- Label probabilities as estimates conditional on user-provided assumptions. Make it clear that the model does not know the user's true probabilities and cannot reliably predict real-life outcomes without calibrated data.
- Preserve the sportsbook-inspired aesthetic, but treat the product as a decision-analysis tool rather than encouraging real-money gambling.

### 5. Implementation Priority
Build in this order:
1. Complete the visual layout with a working preset selector (presets labeled as illustrative demo values).
2. Implement and test the simulation engine.
3. Connect all controls, KPIs, charts, and sensitivity analysis to real outputs.
4. Add the share-ticket modal and clipboard functionality.
5. Verify responsive behavior and performance.
Do not sacrifice mathematical correctness to make the initial demo look more impressive. If a feature cannot be implemented correctly in the first pass, label it as unavailable rather than faking its output.

### 6. Final Mathematical Clarifications & Acceptance Tests

#### Explicit Model Equations
Document the following model parameters and formulas in the code and methodology drawer:
- Let weekly overload be $\max(0, \text{workload} / \text{energyCap} - 1)$.
- Increase fatigue nonlinearly during overload and apply bounded recovery when workload is below capacity. Use explicit configurable coefficients and prevent negative fatigue.
- Define how fatigue maps to a probability penalty, ensuring the final probability remains within `[0.001, 0.999]`.
- Define whether a burnout event prevents subsequent leg resolutions. Use the same rule consistently across the simulation, metrics, histogram, and charts.
- Treat `penaltyStrength` as an absolute probability reduction in `[0, 1]`, unless a different interpretation is explicitly selected and documented.
These coefficients are illustrative model assumptions, not validated human-performance laws.

#### Reproducibility and Counterfactuals
- Use deterministic random streams for exogenous weekly shocks and workload variance. Ensure a counterfactual run uses the same underlying exogenous random samples as the baseline run (Common Random Numbers), while recalculating fatigue, dependencies, and outcomes from the modified plan.
- Removing a leg must not leave dangling dependencies. Apply a documented policy to remove, redirect, or invalidate affected dependency edges.

#### Statistical Reporting
- Report estimated rates as counts divided by the number of simulations.
- Display a 95% Monte Carlo confidence interval for estimated success and burnout rates ($\hat{p} \pm 1.96 \sqrt{\hat{p}(1-\hat{p})/N}$).
- Distinguish simulation uncertainty from uncertainty about the real-world input probabilities.
- Explain that a fixed seed provides reproducibility, not predictive validity.

#### Required Automated Tests (`src/engine/__tests__/monteCarlo.test.ts` + In-App Self-Test Suite Runner)
Create automated tests (and an accessible "Run Engine Verification Suite" modal in the UI so the user can verify all 10 invariants live) verifying that:
1. The same seed and configuration produce identical results.
2. Histogram bins are mutually exclusive and sum to exactly the number of simulated universes (10,000).
3. With zero legs, success is 100%, burnout is 0% under a zero-load configuration, and implied odds are `1.00x`.
4. A dependency cycle is rejected with a clear validation error.
5. Probabilities remain bounded within `[0.001, 0.999]` for extreme stress, chaos, and workload inputs.
6. A zero estimated success rate does not cause division by zero or infinite numeric values in the UI.
7. Every displayed KPI and chart is derived from the same simulation result object.
8. Counterfactual sensitivity results are reproducible and use common exogenous random samples.
9. Removing a leg recalculates workload, fatigue, dependencies, and burnout across the entire horizon without dangling dependency edges.
10. No simulation-dependent UI displays fabricated fallback data when an error occurs.
Do not mark a feature complete until its tests pass.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://risk-champ.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/111b6e25-f2f4-4f99-a435-d51d961b51eb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
