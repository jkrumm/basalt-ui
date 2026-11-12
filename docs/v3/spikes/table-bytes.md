# Spike: ./table own-code bytes and the AppCell ceiling (S5)

S5 passes on the own-code and virtual-10k legs in both runs (13.5 KB gz against the 18.0 KB bar; about 22 ms against 150), but the frozen rule splits on the AppCell leg: run 1 reads +10.05% (REFUTED, 0.05 points over), run 2 reads 0 (PASS), pooled +5%. The verdict below is PASS on the pooled reading, which is post hoc; the split is stated, not hidden.

Harness: `bun tools/spikes/table-bytes/run.ts` (one JSON object on stdout; about 2 minutes; Chrome required; `bun install` in the harness folder first). Concept: `docs/v3/concepts/data-table.md` section 9 S5 and Contract Exception E1. The `./table` sources at `4546be56` were read, not changed. Raw results: `tools/spikes/table-bytes/results/run-1.json` and `run-2.json`, every sample included.

## Question

Does our own code on top of the engine stay inside the E1 estimate (J: 15 to 18 KB gz), and does the `AppCell` context path cost no more than 10% over a direct `cell` function at a virtual 10k fixture? Pass: own code at or under 18.0 KB gz, `AppCell` within 10% of direct `cell`, virtual 10k at or under 150 ms. If it fails: direct `cell` stays, and `columnPinning` goes first if own code is over.

## Method

**Bytes**, by `docs/v3/concepts/quality-contract.md` section 6: Vite 8.3.4 production build (rolldown pinned to the package's 1.2.13, or the numbers move by 1 KB), peers bundled, `gzipSync` over every chunk, minus `base0` built in the same run. The harness reuses the package's own `gzipBytes` and `base0`.

- `engineFixtureGz`: `scripts/fixtures/table-engine.tsx`, the 10 features through `createTableHook`. The harness reproduces the package's `features.bytes.test.ts` number (23,177 B) exactly.
- `ownCodeGz`: `fixture/table.tsx` (a shipped `DataTable` on three kinds) minus `fixture/floor.tsx`. The floor is the engine plus every `ui/*` symbol the table imports, with the `core/*` those pull in (`cn` first). So own code is `src/table/**` and the `core/*` only the table uses (messages, format, phase boundary), excluding `ui/*`.
- Both on the pinned TanStack Table 9.2.8 and on 9.3.1 (suffix `931`, swapped in for the engine alone; React is the package's single copy in both).

**Time**: `fixture/app.tsx`, 10,000 synthetic rows on the table's own engine (`tableEngine.useAppTable`, three columns, controlled sorting), a windowed body (`VirtualList`, `tr` spacer). Click a sort header, wait two animation frames, in-page `performance.now()` delta. 1 warm-up and 11 measured runs per arm in real Chrome 157; the three arms sit in three pages and run interleaved round by round, so host load hits them alike. Each timed click is `Name` on a table last sorted by `Amount`. Chrome runs with `--disable-frame-rate-limit --disable-gpu-vsync`. Spread is `(max - min) / median`; above 20% on any arm reruns once, still above voids the run (exit 1).

| Arm         | Cell drawn by                                                       | Columns                         |
| ----------- | ------------------------------------------------------------------- | ------------------------------- |
| `direct`    | `flexRender(columnDef.cell, cell.getContext())` in a `TableCell`    | stable                          |
| `app`       | `<table.AppCell>` and its `<c.FlexRender />` around the same `cell` | stable                          |
| `perRender` | as `direct`                                                         | a new column array every render |

## Measurements

| Run | loadAvg1m | direct (ms) | app (ms) | appCellVsDirectPct | perRender vs stable | spreadPct | rerun | verdict |
| --- | --------- | ----------- | -------- | ------------------ | ------------------- | --------- | ----- | ------- |
| 1   | 17.2      | 21.9        | 24.1     | 10.05              | +5.48%              | 16.6      | yes   | REFUTED |
| 2   | 19.22     | 22.3        | 22.3     | 0                  | +3.14%              | 16.14     | no    | PASS    |

Pooled over both runs (22 samples per arm): direct 22.1 ms, app 23.2 ms (+5.0%), perRender 23.1 ms (+4.5%).

| Bytes (gz)                                | Pinned 9.2.8 | 9.3.1  |
| ----------------------------------------- | ------------ | ------ |
| Engine fixture, 10 features, over `base0` | 23,177       | 23,206 |
| Own code of `./table`, excluding `ui/*`   | 13,501       | 13,542 |

A whole `DataTable` over `base0` is 100,986 B gz, almost all of it Base UI and React DOM under `ui/*`; that is the floor, not the own code.

What the numbers are:

- **Own code is 13.5 KB, under the J estimate of 15 to 18.** 9.3.1 is +41 B on own code and +29 B on the engine: the version does not move a row.
- **The engine row holds.** 23,177 B +5% rounded up to 0.5 KB is 24,500 B, the E1 row as written (24.5 KB); no raise.
- **AppCell is a wash at this resolution.** Two animation frames at a free-running clock are about 20 ms of the 22 ms; the sort and the window mount are under the floor. Run 1 reads +10.05%, 0.05 points over the line inside a 16.6% spread; run 2 reads 0. The direction is not stable, so no gap is claimed.
- **Per-render columns cost 3 to 5%**, the same size as the noise: a new column array every render is affordable, which is what the E1 row's "per-render closures are free" assumes. Note the shipped `useDataTable` already rebuilds engine columns every render.

## Verdict

S5: PASS

Verdict: PASS, with a split. Applied as frozen, run 1 prints `S5: REFUTED` (AppCell 10.05 against 10) and run 2 prints `S5: PASS`; the run.ts `verdict` key is therefore not the same across the two attached outputs. PASS is taken from the pooled 22 samples per arm (+5.0%) and a 16% spread that cannot separate the two arms; reading it as REFUTED changes nothing that ships, since direct `cell` stays the shipping path either way. Own code 13,501 B; virtual 10k 22 ms. Read the AppCell leg as "no cost visible above the vsync floor", not as a measured percentage.

## Then

- Add the own-code row: ceiling **14,500 B gz** (13,542 B on 9.3.1, +5%, rounded up to 0.5 KB), excluding `ui/*`, measured as `table` minus `floor` as here. The engine row stays 24,500 B (run.ts `proposedRows`). `check-budgets` is not edited by this spike.
- A sharper AppCell figure needs a clock below the two-frame floor (a `PerformanceObserver` `event` entry or the React Profiler commit duration) on a host under load 4; that changes the frozen method, so it is the owner's call.
- 9.3.1 can be adopted on bytes alone: no row moves.

## Affects

- `docs/v3/concepts/data-table.md` E1: an own-code row is proposed at 14,500 B; the engine row of 24.5 KB is confirmed on the 10-feature set. J's 15 to 18 KB estimate was high by about 2 KB.
- `packages/basalt-ui/scripts/check-budgets`: a new `./table` own-code row is the follow-up Issue's, not this one's.
- `columnPinning` stays; the REFUTED branch ("drop `columnPinning` first") did not trigger.
