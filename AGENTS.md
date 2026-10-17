<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## ParlayLife architecture
- Simulation math lives only in `src/engine/` (pure TS, no React); UI reads a single `buildDashboard(outcome)` view so every KPI/chart comes from one result object.
- `src/engine/verification.ts` holds the invariant checks shared by vitest and the in-app "Verify engine" dialog — add new invariants there so both stay in sync.
- Simulation runs on the main thread, debounced (~130 ms incl. sensitivity at N=10k); move to a Web Worker only if profiling shows jank.
