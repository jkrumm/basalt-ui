# Spike: React Compiler over ./table on a 10k fixture (Q3)

No verdict: both runs are voided by the spread rule on a host at load 32 to 44. Every virtual-10k reading says the same thing (gain 0 to 7%, against the 25% bar), and the compiler also breaks `./table` at runtime until `core/state.ts` changes, so the library stays uncompiled for now.

Harness: `bun tools/spikes/compile-table/run.ts` (one JSON object on stdout; about 3 minutes; Chrome required). Concept: `docs/v3/concepts/quality-contract.md` section 10 Q3, decision 6. The 2.x perf route reference was not available in this tree.

## Question

Does precompiling `./table` (and so `./cards`) with React Compiler 1.0.0, target 19, give 25% or more on the sort of the virtual 10k table, the path that ships, with the table test suite green uncompiled? If yes, the package precompiles those two subpaths, additively; if not, it stays uncompiled.

## Method

**Build.** `lib/entry.tsx` re-exports the v3 `./table` composite (`DataTable`, `useDataTable`, `col`) and adds `VirtualDataTable`, a windowed body. The shipped `DataTable` does not consume `virtual` yet (typed in `contract.ts`, built in T4), so the body is composed from the same exports a bespoke layout would use: `DataTableHead`, `modelOf`, `visibleColumns`, `VirtualList` with a `tr` spacer. tsdown 0.23.7 builds it twice: plain, and with `@rolldown/plugin-babel` 0.3.1 running `babel-plugin-react-compiler` 1.0.0 (`target: '19'`) over `packages/basalt-ui/src` and `lib`. Compiled output is 171.9 kB against 134.9 kB (gzip 49.0 against 40.3). Sources are read, never changed.

**Fixture.** 10,000 synthetic rows, three columns (`text`, `money`, `status`), client mode, `NODE_ENV` production. One page per arm, real Chrome 157, the build bundled with `Bun.build`.

**Timing.** Click a sort header, wait two animation frames, in-page `performance.now()` delta. 1 warm-up, then the median of 11. Each timed click is `Name` on a table last sorted by `Amount` (an untimed `Amount` click resets it), so every run is the same re-sort. Chrome runs with `--disable-frame-rate-limit --disable-gpu-vsync`. Spread is `(max - min) / median` per arm; the worse arm is `spreadPct`. Either arm above 20% reruns that measurement once; still above 20% voids the run (exit 1, no verdict). `loadAvg1m` is read before the run. `gainPct` is `(off - on) / off x 100`.

**Diagnostic.** The same fixture with all 10k rows in the DOM (`DataTable`). Labelled the forbidden case, not a gate. No dev assertion exists yet to disable (the `>500 rows without virtual` check is a later Issue), so none was.

**Uncompiled lane.** `bun test packages/basalt-ui/src/table` at the repo root; no compiler in the loop.

## Measurements

Two runs, each with the one allowed rerun. Raw output: `tools/spikes/compile-table/results/run-1.json` and `run-2.json`, with every sample.

| Run | loadAvg1m | virtual on (ms) | virtual off (ms) | gainPct | spreadPct (rerun) | dom10k gainPct | uncompiledLaneGreen |
| --- | --------- | --------------- | ---------------- | ------- | ----------------- | -------------- | ------------------- |
| 1   | 32.24     | 28.0            | 30.2             | 7.28    | 40.36             | 31.23          | true                |
| 2   | 43.56     | 28.3            | 28.8             | 1.74    | 78.45             | 29.28          | true                |

Three earlier runs while building the harness (same fixture, load 20 to 36) read virtual gains of 2.2%, -14.2% and 0.35%, all voided the same way.

What the numbers are:

- **Virtual 10k: the compiler buys nothing measurable.** The median sits at 28 to 30 ms in both arms in every run, and two animation frames are the floor of the measurement. Sorting 10k rows and mounting a window of rows costs less than the frame wait. The spread (35 to 78%) is scheduler noise at load 32 to 44, so no single gain figure is trusted; the direction is the same in all five runs.
- **DOM 10k (forbidden case): 13 to 31% faster compiled** (845 against 979 ms; 756 against 1,099 ms; 753 against 1,065 ms), with spreads up to 30% on the off arm. It is the only place the compiler shows, and it is the case the product forbids.
- **Compiling everything crashes `./table`.** `core/state.ts` calls `handle.use()` and `store.use()`, hooks the compiler cannot see by name (they do not start with `use`). It memoizes them, and the second render of `useDataTable` throws React error 311 ("Should have a queue. You are likely calling Hooks conditionally"; hook 10 changes from `useSyncExternalStore` to `useRef`). The harness excludes `core/state.ts` from the compiler to get a running compiled arm. The same `field.use()` pattern is in `controls/*`, `dashboard/board.tsx` and `router/controls/widgets.ts`, so `./cards` and every filter control carry the same hazard.

## Verdict

Q3: VOID

Verdict: VOID (no verdict; the spread rule voids the run, `run.ts` exits 1 and prints no `verdict` key). Read as evidence, not as a verdict: the virtual path gains 0 to 7%, far under 25%, and a precompiled `./table` needs a source change before it runs. Stay uncompiled until a rerun on a quiet host says otherwise.

## Then

- Rerun `bun tools/spikes/compile-table/run.ts` on a host with load under about 4 (the factory host sits at 20 to 45). A different clock than two animation frames (a `PerformanceObserver` `event` entry, or the React Profiler commit duration) would take the vsync floor out; that changes the frozen method, so it is the owner's call.
- If the compiler is ever adopted: make the state port hooks recognisable (`useField(...)`) or annotate them, then re-prove with this harness that `useDataTable` renders compiled.

## Affects

- `docs/v3/concepts/quality-contract.md` section 10, Q3 row: unchanged, frozen here; the decision 6 "stay uncompiled" default stands.
- `core/state.ts`, `controls/*`: `x.use()` hook calls are invisible to the compiler (note for any compiler-clean claim in decision 6).
- Feeds the `compiler.axis` fixtures with the crash and the DOM-only gain.
