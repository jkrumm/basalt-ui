---
source: basalt-ui
description: TanStack Charts doctrine — compose CartesianChart (or the Lines/Bars kinds on it), supply `series` once and let the legend and tooltip rows derive from it, require `ariaLabel`, keep every color in `--vx-*`. Enforced by basalt/chart-engine-boundary and basalt/chart-in-raw-surface.
paths:
  - '**/charts/**'
---

<!-- basalt:coverage -->
<!-- GENERATED from src/surfaces.ts — `bun scripts/check-coverage.ts --write`. Do not hand-edit. -->
<!-- backed by: guard kinds — raw-color-fn, raw-hex · oxlint rules — basalt/chart-engine-boundary, basalt/chart-host-single, basalt/chart-in-raw-surface -->
<!-- not guarded: — -->
<!-- /basalt:coverage -->

# Basalt Charts — the composition contract

basalt-ui owns the chart doctrine on `@tanstack/charts` (exact optional peers, with `d3-scale`;
visx is gone). **This file is the contract; the API is not here** — read the shipped types and
JSDoc, and `llms.txt` at the install directory, for props.

## The one mandatory rung

**Every cartesian chart is `CartesianChart`, or a kind built on it (`Lines`, `Bars`).** It compiles
the engine definition and owns the measured margins, both y domains, the x scale (it follows the
type `x` returns: `Date` → time, `number` → linear, `string` → point/band), tick thinning, grid,
zones, the cursor, crosshair, keyboard focus, tooltip, legend and height. The caller supplies
`series` and `marks(plot)`, which returns engine marks and nothing else. **`ariaLabel` is required**
on every chart (a type error without it).

`StackedArea`, `DualPanel`, `MirroredBars`, `BandStrip`, `Donut`, `Heatmap` and `Sparkline` are not
shipped in 2.0.0 (`MIGRATING.md` § 2.0); compose `CartesianChart` with engine marks until one returns.

## `series` is the single source of truth

Legend entries and tooltip rows are compiled from `series`, so a chart cannot show a row or key it
does not draw; extra rows are `tooltip.rows(d, { visible, hidden })` data, never markup. A legend
that belongs in a card header is `legend.placement: 'header'`.

**Corollary for `marks`: draw `plot.rows(key)` / `plot.visible`, never the `series` prop.** A legend
toggle (default at two or more entries) hides the plot, the tooltip row AND the auto y-domain
together; `series` repaints the mark the reader just hid.

## Boundaries

- **`basalt/chart-engine-boundary`** (shipped AND repo-local, no escape hatch): `@visx/*` is banned
  everywhere. Outside basalt, `@tanstack/charts` is an allowlist — `/line`, `/area`, `/area-x`,
  `/bar`, `/rect`, `/rule`, `/dot`, `/tick`, `/text`, `/vector`, `/link`, `/arrow`, `/difference`,
  `/stack`, `/scales/*`, `/transform/*`, `/mark/decorative`, `/d3/shape`, `/types`. The bare root and
  every other subpath is an error. basalt re-exports no engine symbol; import marks from those.
- **`@tanstack/charts/react` lives in `src/charts/host.tsx` only** (`basalt/chart-host-single`,
  repo-local).
- **basalt's own `charts/`+`tokens/` import zero `@mantine/*`** (`basalt/token-layer-boundary`,
  repo-local — a framework invariant, not an obligation on your app's own `charts/`-named dir).
- Mantine layout primitives are unreachable in a chart file, so `inline-display`/`raw-html-layout`
  deliberately don't fire there — raw `<div>` is fine, `VX.*` tokens still mandatory.
- **Maps are not charts** — basalt ships no map kind; build one where the rest of the app's
  non-chart UI lives, styled with `--vx-*`.

## Color, scheme and sizing

- **Never a raw hex in a chart file**, never `localStorage.getItem('theme')`. Theme reactivity is
  **pure CSS**: `--vx-*` redeclares per scheme, and the engine reads it through `--ts-chart-*`.
- **Series color is consumer domain data** — one guard-exempt file per app, `defineSeries` →
  `seriesTokens`/`groupTokens` → `buildPaletteCss` (basalt-tokens.md), each entry a `{light,dark}`
  pair. Tokens come from `basalt-ui/tokens`, formatters from `basalt-ui/format`; `charts` re-exports neither.
- **Margins and ticks are MEASURED by the engine** — there is no margin prop. `y2` makes a chart
  dual-axis. Size is `height` (a number, or per container class); the host measures the width.
- **Never fake an empty dataset for a pending query** — `data ?? []` collapses "not asked yet" into
  "measured and absent". Pass `state={{ pending, error, empty }}`.

## Adding a chart

1. **Fits `Lines` or `Bars`?** Use it — declarative props (`data`, `x`, `series`, `y`/`y2`,
   zones/thresholds/refLines as plain arrays).
2. **Second instance of a shape with no kind?** Extract a kind (Rule of Three), migrating both call
   sites; prove it by porting real call sites, ship the "still cannot express" list with it.
3. **Genuinely unique?** Stay bespoke, composing `CartesianChart` with `marks` in the page's chart
   file, not in a shared kinds directory.

**Anti-pattern:** a single `<Chart type="…" config={…} />` switching by kind — add a kind, don't
loosen the rung.

## Cursor

Shared page-wide by default (group `'default'`); `cursorGroup="…"` ISOLATES a chart, opting out of
sharing, never in. Charts whose `x` value types differ never sync. App code reads it with
`chartCursor(group?)` + `useSyncExternalStore`. Only the chart under the pointer shows a tooltip;
`tooltip.onFollow` opts a follower back in.
