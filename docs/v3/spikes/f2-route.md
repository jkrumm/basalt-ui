# Spike: one argo dashboard route ported against the frozen contract (F2)

F2 is refuted. Porting argo's `strength-tracker` route needed five things the contract does not give an app: four amendments (`ControlHandle.options`, the port types' specifier, a table sheet, a collapsible `Section`) and one wiring gap between `PageBar` and `FilterSet`. Everything else the route uses (`./table`, `./cards`, the router controls, `./data`, `./page`) fit as filed, and no port (new seam) is needed. The shots also show three defects in `src` that are not contract questions (n4, n13, n14); n4 was already recorded in `table-fit.md`.

Harness: `bun tools/spikes/f2-route/run.ts` (one JSON object on stdout, exit 0 means the harness ran, not that the hypothesis held). Concept: `docs/v3/ARCHITECTURE.md` section 11 F2, sections 1 and 3, both frozen; amendments are the orchestrator's. This spike records and fixes nothing in the contract.

## Question

Does a real argo route, ported with only the published subpaths and no eject, need an edge that section 1's `app` row or a `Must not` column forbids? Refuted if the route needs one: amend the contract or add a port, while that is still cheap at G1.

## Method

**Route.** argo `apps/dashboard/src/routes/strength-tracker.tsx` (371 lines), the brief's default: it uses all five layers (`./table`, `Sparkline`, `StatGroup`, `FilterSet`, the query client) and no other route uses fewer. Read only; argo is untouched.

**Port.** `tools/spikes/f2-route/src/`, a scratch Vite app with a fake `{ data, error }` transport and seeded synthetic data (`synthetic.ts`; nothing copied from a consumer). It keeps argo's behaviour at the level the five layers reach: the page store with a seven-preset range (four presets resolved to `from` and `to` by the field's own `window:` map) and a multi over four lifts; the loader's `ensureQueryData`; a `StatGroup` strip of four `StatCell`s with a chart slot; the per-lift trend table with two sparkline columns and a delta column; the workouts table with row actions and a delete confirm; the rail; the empty state. Not ported: the workout logger, the rest timer, the nine chart cards (`CartesianChart`, a sixth layer).

**Contract only.** The port imports `basalt-ui/{router,data,page,cards,controls,table,charts}` and `basalt-ui/ui/{button,card,collapsible}`. `tsconfig` `paths` map those to `packages/basalt-ui/src`, as `apps/playground/vite.config.ts` does, with one change: four subpaths point at `stubs/` because their `src` barrel is still the 2.x shape.

| Subpath      | Stub                | Why                                                                                                                                                                                                                                               |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`          | `stubs/root.ts`     | `src/index.ts` is the Mantine barrel; the stub re-exports the v3 pieces under `src/core` and declares `useNow`, which has no implementation yet. The route imports nothing from `.`, so this stub is unused and the root subpath is not exercised |
| `./charts`   | `stubs/charts.tsx`  | `src` `Sparkline` takes `data` and `mark`; the contract's `SparklineProps` takes `series` and `form`; the stub draws a small SVG                                                                                                                  |
| `./controls` | `stubs/controls.ts` | the barrel exports Mantine `RangeFilter` and a `FilterSet` with a legacy `children` form; the stub binds the contract's `{ specs }` form from `filter-set-spec.tsx`                                                                               |
| `./table`    | `stubs/table.ts`    | the barrel exports Mantine `BasaltDataTable`; the stub exports `col`, `DataTable`, `useDataTable`                                                                                                                                                 |

`tsc` follows a stubbed or `src` file's own imports into the harness `node_modules` through a `"*"` path, so the exact pins of the harness's own `package.json` are the only dependencies.

**Detection**, as the brief fixes it. `run.ts` (1) runs `tsc --noEmit -p .`, (2) scans every import of `src/` and every CSS `@import` against the section 3 subpath list (`deepImports`), (3) reads `results/needs.json`, the hand list: each entry has a file, a line and an anchor string that must sit on that line (`needsDrift` reports any that moved), and a `forbidden` field that is empty when an in-contract port exists. `edgesForbidden` is the entries with a non-empty `forbidden`. `ejects` counts `basalt:ejected` headers under `src/`.

**Proof.** The route shot at 1800x1200 and 390x844, light and dark, on the charts and history tabs, full page, Chrome through `playwright-core`: `shots/r5/`. Five shoot runs, two more than the three the brief allows: the first three found the missing table sheet (n3) and the row-height defect (n4), and the fourth moved `FilterSet` into the page bar (n12). Runs 1 to 4 are discarded. The last run shows two defects (n13, n14) that are recorded and not fixed.

## Measurements

From `bun tools/spikes/f2-route/run.ts` (the key is in brackets).

| Number                                | Value                                                          |
| ------------------------------------- | -------------------------------------------------------------- |
| `tsc --noEmit -p .` exit [`tsc.exit`] | 0, with one cast (`asControl`, n1)                             |
| Layers reached [`layers`]             | table, Sparkline, StatGroup, FilterSet, query client: all true |
| `deepImports`                         | 1 (CSS: `src/table/table.css`, n3)                             |
| `ejects`                              | 0                                                              |
| `needs`                               | 14                                                             |
| `edgesForbidden`                      | 5 (n1, n2, n3, n5, n12)                                        |

**The five edges.** Each has the shape that settles it. None needs a port.

| Id  | Where                          | What the route needed                                                                                                                                                                                                                                                                                            | Decision and smallest shape                                                                                                                                                                                               |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| n1  | `src/contract-gaps.ts:12`      | `spec(handle, ...)` over a `multi` or `range` handle does not type-check. `ControlHandle<T>.options` is `{ value: T }[]`, but the handle lists members (`FieldHandle.options` is `FieldOption<Member<V>>[]`). Argo's runtime option catalogue on a multi cannot be typed either (`SpecOptions.options`).         | **amend** `ports.ts` and `controls/contract.ts`: `options?: readonly { value: OptionOf<T>; label: string }[]` with `OptionOf<T> = T extends readonly (infer M)[] ? M : T extends { preset: infer P } ? P : T`. Types only |
| n2  | `src/contract-gaps.ts:4`       | Naming `ControlHandle<V>` for the n1 cast. No published specifier carries the port types; the port reads it off `spec`'s last overload instead of importing `core/ports`.                                                                                                                                        | **amend** section 3, row `.`: it also exports the types of `src/core/ports.ts`. Value symbols are what the count holds, so 95 stays                                                                                       |
| n3  | `src/app.css:10`               | The table tier sheet (container queries: reduced, card, scroll) is not a published CSS entry and `tailwind.css` does not import it. Without it the 390 table is crushed, with it the sheet is a relative path into the package.                                                                                  | **amend** section 3 CSS entries: add `./table.css` (an app that imports `./table` imports it). Alternative: `tailwind.css` imports it and the 12 KB full-scan fixture is re-measured                                      |
| n5  | `src/strength-tracker.tsx:118` | Two collapsible `Section`s with a summary line. `SectionProps` has `title`, `controls`, `children`; the port wraps `Section` in `ui/collapsible` and the trigger floats apart from the heading (`shots/r5/charts.desktop.light.png`). Section 8 asks the page kit for a controlled `Section`.                    | **amend** `page/contract.ts`: `collapsible?: { defaultOpen?: boolean; state?: ControlHandle<boolean> }` and `summary?: string`; the heading is the trigger                                                                |
| n12 | `src/strength-tracker.tsx:81`  | Argo puts `FilterSet` in `PageBar`. `PageBar.controls` takes a `ControlsSlot`, `filterSlot(specs)` draws one pill per spec with no fold, and `FilterSet` returns an element, so no contract path connects them. The port builds the slot object by hand; the type allows it, the contract calls the slot opaque. | **amend** `filterSlot`: in a pill home (`page-bar`, `section-header`) it renders `SpecFilterSet`, so the fold and the phone's `Filters (n)` sheet apply by construction. No new symbol                                    |

**Nine more needs, none an edge** (an in-contract port exists):

| Id  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| n4  | **Defect.** Already recorded in `table-fit.md` (S3, the 32 px card row; its fix is `!important` on `height: auto`, this one zeroes the custom property: either settles it). Card tier: `table.css` sets `height: auto` on a row, the row's `h-(--table-row-h)` utility is in a higher layer and wins, so cards are 32 px tall and overlap at 390 (measured: `display: grid`, `height: 32px`). The port patches it in `app.css`, a restyle of a library part. Fix: the card tier sets `--table-row-h: auto` on the row |
| n13 | **Defect.** With the folding `FilterSet` in `PageBar`, the band (title, three-segment tab strip, `Filters` button) does not wrap at 390: `scrollWidth` 435 against 390 on both tabs, light and dark. With `filterSlot`'s pill rows the same band wrapped. Fix: the controls cell wraps below `@regular`                                                                                                                                                                                                               |
| n14 | **Defect.** The same `FilterSet` collapses to its `Filters` button at 1800x1200 too, because the page-bar controls cell is narrower than the fold threshold, and the button overlaps the `PageAside` heading (only "ing" of "Training" shows, `shots/r5/charts.desktop.*.png`). Fix: the fold measures the bar, not its cell                                                                                                                                                                                          |
| n6  | `RowAction` has no `danger` flag; the confirm overlay carries it                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| n7  | A stale lift's trend prints a dash, not argo's "no session in 28 d"; `col.delta` has no reason text                                                                                                                                                                                                                                                                                                                                                                                                                   |
| n8  | The phone-only Train tab (`ViewTabs` `only: 'sm-down'`) has no field in the contract; the port filters the option catalogue by `useSizeClass()`, which the server renders as `compact`, so the CSS-only swap (law C9) is given up for this tab                                                                                                                                                                                                                                                                        |
| n9  | `ViewTabs({ handle })` is a component and `PageBar.tabs` takes a `ControlsSlot`; the port uses `spec(handle, 'View', { as: 'segmented' })`, where `as` is an untyped string                                                                                                                                                                                                                                                                                                                                           |
| n10 | `DataPanel` holds the body at the height `skeleton` declares in every phase; a 32-row table in it must scroll in the box (`DataTable height="fill"`). Without it the first render clipped 9 of 32 rows without a sign                                                                                                                                                                                                                                                                                                 |
| n11 | Argo's 8/4 main-plus-rail grid is an asymmetric split `CardGrid` refuses; the rail is a `PageAside`, the shell's inspector region                                                                                                                                                                                                                                                                                                                                                                                     |

**Left as the contract has it.** `CONTAINER_KEYS` and `CONTAINER_GRID_BREAKPOINTS` are not needed: the route lays out by container tier and `PageAside`. `useNow` is the one contract symbol with no implementation, stubbed. The custom date range (`customPicker={DateRangePicker}`, the dropped `./controls-dates`) is declared (`field.range({ custom: true })`) and not exercised in a browser, so whether the range pill opens a picker is untested.

**Limits.**

- One route and one set of shots on synthetic data: the edges are the ones this route reaches. argo's other routes (`finance.*`, `usage-tracking`, `models`) reach layers this one does not and may need more.
- The charts stub draws its own SVG, so nothing here says the `@tanstack/charts` host fits a table cell at 28 px.
- Whether a need is an edge is a reading: "an in-contract port exists" kept n6 to n11 off the list. The three defects (n4, n13, n14) are in `src`, outside this spike's owned folders, and are recorded rather than fixed.

## Verdict

F2: REFUTED

Verdict: REFUTED

By the rule: `tsc` exits 0 and `ejects` is 0, but `edgesForbidden` has 5 entries and `deepImports` is 1. The refute line (the route needs an edge section 1 forbids) holds on five counts. Every one is settled by an amendment of text or types; none adds a symbol, so section 3's 95 of 100 stands.

- n1: `amend`. `OptionOf<T>` in `ports.ts` and `FilterOption`.
- n2: `amend`. Section 3 row `.`: port types are exported as types.
- n3: `amend`. Section 3 CSS entries: `./table.css`.
- n5: `amend`. `SectionProps`: `collapsible`, `summary`.
- n12: `amend`. `filterSlot` renders the fold in a pill home.

## Then

- The orchestrator applies the five rows as one `chore: contract amendment` commit (the contract files are `check-contract-frozen` pinned) and records them in section 14. n3 needs the budget fixture re-measured if the sheet goes into `tailwind.css`.
- File the three defects against the table and page-kit Issues: n4 (one line in `table.css`), n13 and n14 (`page-bar.tsx`). Re-run `bun tools/spikes/f2-route/run.ts shot` after both; the 390 shots are the test.
- Re-run the harness after the amendments: n1, n2, n3, n5 and n12 have anchors in `results/needs.json`; once a row lands, delete the workaround and its entry, and the verdict flips to PASS when `edgesForbidden` and `deepImports` are empty.
- The route's `FilterSet` only counts as rendered once n12 is in: until then the port holds a hand-built slot.

## Affects

- `docs/v3/ARCHITECTURE.md` sections 3 (rows `.`, CSS entries) and 11 (F2: refuted), and section 14 (one amendment row per edge): the orchestrator's.
- `src/core/ports.ts`, `src/controls/contract.ts`, `src/page/contract.ts`: three frozen contract files, amended by the orchestrator only.
- `src/controls/filter-slot.tsx`, `src/page/section.tsx`, `src/table/table.css`, `src/page/page-bar.tsx`: the implementations the amendments and the three defects land in.
- Gate G1: unchanged, no symbol or budget moves.
