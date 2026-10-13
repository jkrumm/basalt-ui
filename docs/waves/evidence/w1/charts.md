# W1 evidence — the 2.0 chart contract spike

**Spike:** branch `spike/w1-charts` (pushed, never PR'd), head
`f74f67123ebe76b5cda22a196d22344ee012c235`, cut from `origin/master` @ `3f6e5fc`. Engine:
`@tanstack/charts@1.1.0` + `d3-scale@4.0.2`, read from the `npm pack` tarball (README, `llms.txt`,
`docs/`, `skills/`, `dist/*.d.ts`, `dist/*.js`).

## Reproduce

From a basalt-ui clone. The output below is verbatim from a fresh detached worktree at that sha.

```sh
git fetch origin spike/w1-charts
git worktree add --detach /tmp/w1-repro f74f67123ebe76b5cda22a196d22344ee012c235
cd /tmp/w1-repro && bun install --frozen-lockfile
bun test packages/basalt-ui/src/charts-v2-spike   # repo root: the happy-dom preload lives here
cd packages/basalt-ui && bun scripts/spike-chart-gzip.ts
```

```
bun test v1.4.3 (c6da4a4d3)

 12 pass
 0 fail
 47 expect() calls
Ran 12 tests across 1 file. [511.00ms]
```

```
ZonedLine 1.x (visx): own 28358 B, total 57642 B
ZonedLine 2.0 spike (@tanstack/charts): own 2907 B, total 72114 B
```

| File (`packages/basalt-ui/`)                    | Role                                                               | LOC |
| ----------------------------------------------- | ------------------------------------------------------------------ | --- |
| `src/charts-v2-spike/cartesian.ts`              | the rung: basalt spec → `ResponsiveChartDefinition`                | 208 |
| `src/charts-v2-spike/ZonedLine.tsx`             | the kind: `marks` only (threshold lobes, area, line)               | 133 |
| `src/charts-v2-spike/BasaltChart.tsx`           | the host: the one `@tanstack/charts/react` import                  | 32  |
| `src/charts-v2-spike/theme-bridge.ts`           | `theme` object, `--ts-chart-*` map, `chartEngineCss()`             | 48  |
| `src/charts-v2-spike/cursor.ts`                 | cursor groups (client-only), the per-chart view, source-only focus | 142 |
| `src/charts-v2-spike/zoned-line.spike.test.tsx` | 12 tests, happy-dom preload                                        | 299 |
| `scripts/spike-chart-gzip.ts`                   | gzip harness (check-budgets' provider-only method)                 | 56  |

## Tests

Spike names → § 9 names: `cursorController(group)` → `chartCursor(group?)`; `chartCursorView` →
the per-chart cursor view; `sourceOnlyFocus` → the wrapped `group-x` strategy; `cartesian()` →
`compileCartesian()`; `BasaltChart` → `ChartHost`. `createChartCursor` is TanStack's own name.

| Test                                                  | Proves                                                                                                                                                                                                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SSR › React renderToString…`                         | full accessible SVG on the server: `role="img"`, `aria-label`, zone rect, threshold lobe, ref rule; a null row is a gap (2 `<path>`s)                                                                                                        |
| `SSR › framework-free renderChartSvg…`                | `createChartRuntime().render()` → `renderChartSvg()` string, no React, no DOM                                                                                                                                                                |
| `theme bridge › every paint…`                         | `stroke="var(--vx-grid)"`, tick labels `fill="var(--vx-axis)"`; no `--ts-chart-*` on the host; zero TanStack default hexes                                                                                                                   |
| `theme bridge › chartEngineCss…`                      | one `:root{…}` block with the § 9.5 values                                                                                                                                                                                                   |
| `theme bridge › y domain…`                            | a [0, 500] zone leaves the basalt-resolved domain under 100                                                                                                                                                                                  |
| `version compat…`                                     | `@tanstack/charts` resolves at `1.1.0`; the `d3-scale` basalt resolves equals the engine's own `dependencies['d3-scale']` (4.0.2)                                                                                                            |
| `SSR cursor isolation › without window…`              | with `window` deleted: `renderToString` works, `chartCursor()` (spike: `cursorController`) is inert (a write reads back `null`), the server snapshot is `null`, no map entry exists; after restoring `window` the client controller is clean |
| `dual axis…`                                          | a `y2` scale with `side: 'right'` renders `y2-axis`                                                                                                                                                                                          |
| `shared cursor › … only A shows a tooltip`            | pointer on A publishes a value-anchored state; B's crosshair x equals A's; exactly 1 `.ts-chart-tooltip` and 1 `[aria-live]` exist, and they hold A's series                                                                                 |
| `shared cursor › tooltip.onFollow opts…`              | with `onFollow` on B: 2 tooltips                                                                                                                                                                                                             |
| `shared cursor › the portal fallback reparents…`      | without Popover the tooltip is a child of `<body>`, `data-ts-chart-tooltip-portal="fallback"`, outside `.ts-chart-host`                                                                                                                      |
| `shared cursor › a weekly chart follows a daily one…` | `leading` snaps a foreign value to the Monday (the follower's tooltip title); the source's `mouseleave` clears the shared state to `null` through the view                                                                                   |

### Size and LOC

Vite/Rolldown production build, minified, gzip of the entry plus its static imports, CSS excluded.
**own** = every bare import external; **total** = only `react`/`react-dom` external.

|                       | own      | total                         | kind LOC | rung + host + bridge + cursor LOC                 |
| --------------------- | -------- | ----------------------------- | -------- | ------------------------------------------------- |
| `ZonedLine` 1.x, visx | 28 358 B | 57 642 B                      | 301      | 1 495 (`CartesianChart` 1 002 + `ChartFrame` 493) |
| `ZonedLine` 2.0 spike | 2 907 B  | 72 114 B (+14 472 B, +25.1 %) | 133      | 430                                               |

The engine dominates the 2.0 total (`@tanstack/charts` ≈ 315 KB of pre-minify module text, then
d3-time-format, d3-time, d3-color, d3-format, d3-scale). It is paid once per app; the second kind's
delta is a W4 `make evidence` row. The spike's own code still lacks the legend, state placeholders,
the container-class ladder and end labels.

## Source-only tooltips: the engine trace (1.1.0 `dist/`)

- `renderer.js` `applyCursorState`: a cursor update calls `session.resolveFocus(…, focus)` and
  `paintFocus(point, points)`. The tooltip extension paints only for a focused point
  (`tooltip.js` `paint`; its only suppression is `visibility: 'pinned'`, so there is no per-host
  predicate).
- `cursor.js` `resolveChartCursorFocus`: exact `valueKey` match, then `strategy.group(points, { point })`.
  The crosshair comes from `resolveChartCursorPresentation`, which never consults focus.
- `ChartCursorState` carries `source`, `group` and `origin` (point identity) but no host id, and
  `session.owns()` is internal. The spike's view stamps published states instead.
- SSR: the React adapter's server path is `adapter.prerender()` → scene → markup
  (`react/RendererChart.js:82`). The cursor binding is consumed only by `mountChartRenderer`
  (`renderer.js:51`, `configureCursorController` at :702), reached from `adapter.mount` in a layout
  effect, which never runs on a server. So no engine code reads a controller during SSR. The risk
  was basalt's own: compiling a definition used to create the group controller in the module map.
  The view now resolves it per call, and without `window` it is inert.
- `resolveChartFocusStrategy` is public in `@tanstack/charts/cursor/host`. basalt wraps its
  `group-x` strategy: `group` returns `[]` while the current state is foreign.

## What didn't work as first written — and changed the contract

| Finding                                                                                                                                             | Evidence                                                    | § 9 consequence                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Factory y scales widen to every scale-contributing mark: a 60–100 zone pushed the domain to 0–100                                                   | first SSR render, `y-grid:number:100`                       | basalt resolves every y domain and passes a configured instance                                                   |
| Cursor values resolve by exact match: a weekly follower painted an unsnapped rule (119.79 / 148.21 / 176.63 px for three days) and focused no point | probe before the view                                       | `cursorResolution` survives as the controller view                                                                |
| Every bound host showed a tooltip and a `role="status" aria-live="polite"` region (2 of 2 before, 1 of 2 after the strategy wrap)                   | `shared cursor` tests at `f8f8369` vs `d1f86b7`             | source-only by default, `onFollow` opt-in                                                                         |
| With `portal`, happy-dom (no Popover) took the fixed fallback: the tooltip moved under `<body>`                                                     | `portal fallback` test                                      | `--ts-chart-*` go on `:root` via the charts layer's `chartEngineCss()`, not on the host, not in `buildPaletteCss` |
| happy-dom resolves no inherited custom property (not even a class-scoped one on a parent)                                                           | a scratch probe: only `:root`'s own computed value resolved | `:root` inheritance into the tooltip is a W4 layout-suite assertion in Chrome                                     |
| TanStack's inferred definition types name internal modules and break declaration emit (TS2883, TS4058)                                              | `tsc` on the first draft                                    | the rung's return type is annotated; mark generics are erased at the rung                                         |
| The default guide paint dilutes basalt's pre-mixed tokens: grid `stroke-opacity="0.11"`, tick labels `fill-opacity="0.68"`                          | first SSR render                                            | the bridge forces opacity 1 on guides                                                                             |
| `d3-scale` is not resolvable from the package under bun's isolated linker, although TanStack depends on it                                          | `node_modules/d3-scale` absent; the spike had to add it     | `d3-scale@4.0.2` is basalt's own optional peer                                                                    |
| The DOM host clears transient focus on the container's `mouseleave`, not `pointerleave` (`dist/renderer.js:696`)                                    | cleanup test                                                | tests and the layout suite dispatch `mouseleave`                                                                  |
| happy-dom keeps the crosshair node after the clear (source and follower alike)                                                                      | cleanup test                                                | only the cursor state is asserted; paint is the layout suite's job (W4)                                           |
| happy-dom's zero geometry makes the portal mark every tooltip `hidden`                                                                              | debug dump of the tooltip attributes                        | tests count tooltip elements, not visible ones                                                                    |
| `differenceY` accepts only number or `Date` x                                                                                                       | `dist/difference.d.ts`                                      | thresholds are unavailable on a string x, and the type says so                                                    |

Not spiked (documented by TanStack, proven in W4/W5):

- `composeViews` + `alignX` for `DualPanel` and `MirroredBars`
- `polar` for `Donut`
- `cell` + `colorGradientLegend` for `Heatmap`
- y labels inside the plot at the compact class
- touch pinning with `touch-action: pan-y`
