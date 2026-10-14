# W10 — SSR-first contract (charts and tables)

Probe: `packages/basalt-ui/tests/layout/ssr-contract.layout.test.ts` (real Chrome, `make layout`):
server HTML is painted with no script, then the client bundle hydrates it. Boxes are measured
before and after; a `layout-shift` observer (started after fonts settle) sums the shift. Unit side:
`src/table/data-table-ssr.test.tsx` (`renderToString` → `hydrateRoot`, happy-dom).

## DataTable — the contract holds, after one fix

| Case                                   | Server box | Hydrated box | CLS       | Hydration warnings |
| -------------------------------------- | ---------- | ------------ | --------- | ------------------ |
| 1280 px, 5 columns, 8 rows, before fix | 1248 × 356 | 1248 × 356   | **0.070** | none               |
| 1280 px, after fix                     | 1248 × 356 | 1248 × 356   | 0         | none               |
| 390 px, `minWidth={720}`, after fix    | 358 × 356  | 358 × 356    | 0         | none               |

- The server renders the full table (header + every row); `DataTable` is not virtualized.
- **Defect found and fixed.** The 0.070 came from `planColumnFold`: a table that fills its wrapper
  stretches its columns to sum to `room`, five rounded `offsetWidth`s read 1249 against a 1248 room,
  and the fit check folded a column on hydration (every cell moved: x 299→60, widths 227→325).
  `planColumnFold` now forgives rounding (half a pixel per measured column) and nothing more.
- Unit tests: plain, loading, search + pagination, row selection and empty hydrate with no
  mismatch warning and the server's markup (Mantine's `useId` ids excluded: they are swapped for
  random ones after mount — an attribute, never a box).

### Sized fallback (`isLoading` + `skeletonRows`)

| Case                                        | Loaded | Fallback |
| ------------------------------------------- | ------ | -------- |
| 1280 px, rows single-line                   | 356    | 356      |
| 390 px, `minWidth={720}` (rows single-line) | 356    | 356      |
| 390 px, no `minWidth` (cells wrap)          | 650    | 356      |

The loading table is the final table's height when `skeletonRows` is the final row count and the
rows do not wrap. A table whose cells wrap on a narrow container (no `minWidth`) cannot be matched
by a fallback that does not know the content: a streamed table on mobile needs `minWidth` (rows
stay one line, the wrapper scrolls) or single-line cells. No new prop or export.

## Charts — the contract holds for every kind

Before (`Lines`, two series, throwaway probe): 1248 × 346 → 1248 × 446, CLS 0.090 at 1280 px; 358 × 346
→ 358 × 248, CLS 0.141 at 390 px. Cause: `useChartSize` started at width 0, so the server painted the
640 px regular class (height 320, chips legend) and the real class arrived from a layout effect.

Now the box is CSS-owned (`box.tsx` + `chart-box.module.css`): four per-class heights as custom
properties, picked by unnamed `@container` queries on the chart's own inline size; a coarse pointer
caps it at 45 svh. `ChartEngine` is never handed a height, so `@tanstack/charts` measures the box
(`renderer.js:184`, `observesContainerHeight`). The legend picks none / dots / chips in CSS
(`chart-legend.module.css`); a `placement: 'header'` legend is rendered by the chart under the card
header, in the server HTML; `ChartCard`'s header inset and `Donut`'s legend position are container
queries; `ChartPlaceholder` and the pending `ChartCard` fill the same box.

`tests/layout/ssr-contract.layout.test.ts`, server box → hydrated box (height, px), width = the
container's; every row is identical before and after, CLS 0, no hydration warning, no layout-shift
source, at both widths:

| Probe                                                                                  | 1280 px       | 390 px        |
| -------------------------------------------------------------------------------------- | ------------- | ------------- |
| `Lines` (2 series, legend)                                                             | 446.2         | 248.2         |
| `Lines`, no legend                                                                     | 420           | 222           |
| `Bars` / `StackedArea` / `BandStrip` / `DualPanel` / `MirroredBars` / `CartesianChart` | 446.2         | 248.2         |
| `Sparkline` (height 32)                                                                | 32            | 32            |
| `Donut` (legend beside / under the ring)                                               | 240           | 272.2         |
| `Heatmap` / `Heatmap matchHeight` in a 300 px parent                                   | 168 / 300     | 168 / 300     |
| `Lines` height 200 / `{ base: 180, regular: 240, wide: 300 }`                          | 226.2 / 326.2 | 226.2 / 206.2 |
| `ChartCard` with a header legend                                                       | 510.2         | 289           |
| `ChartCard` with title, subtitle, KPI value and delta                                  | 528.5         | 307.3         |
| CLS (sum of `layout-shift`)                                                            | 0             | 0             |

Also asserted: the painted svg's height equals its box (±1 px) for every cartesian kind, a stated
height is exact, the legend mode follows the width, the header legend sits between the title and
the plot, the donut legend moves beside / under the ring.

### Sized fallback

| Pair                                                | 1280 px   | 390 px        |
| --------------------------------------------------- | --------- | ------------- |
| `Lines` loaded / `state={{ pending: true }}`        | 420 / 420 | 222 / 222     |
| `ChartCard` loaded / `state={{ pending: true }}`    | 476 / 476 | 254.8 / 254.8 |
| `BasaltDataTable` loaded / `isLoading skeletonRows` | 356 / 356 | 356 / 356     |

`<ChartCard state={{ pending: true }}>` (no `placeholderHeight`) is the `<Suspense>` fallback: it
takes the height-law box. A chart that states `height` needs the same `placeholderHeight`. A legend
row, or a chart with a header legend, adds its own row to the loaded side that a fallback cannot
know.

### Short cards (`height={120}` in a card ≥ 480 px)

Closed. The old fold measured the card (`ResizeObserver`, < 280 px) and flipped after hydration: a
KPI card around `height={120}` shifted at 1280 px. A card height cannot be a `@container` query
(`container-type: size` collapses an auto-height card), so the decision moved into the server HTML
instead: a `ChartBox` whose stated height (the largest of a responsive one) is ≤ 180 px writes
`data-basalt-chart-short`, and `widget-header.module.css` / `chart-card.module.css` match
`[data-basalt-chart-card]:has([data-basalt-chart-short])` for the subtitle fold, the `lg` KPI
numeral and the trimmed header inset. `ChartCard` measures only a body that holds no chart box.
Probe `card-short-chart` (title, subtitle, KPI, delta, `height={120}`): the subtitle is not rendered
in the server paint at 1280 px, the box is identical after hydration, CLS 0 at both widths.

### Left open

- A card whose body is not a chart (a raw `div`) is still measured after mount; that body has no
  server-sized box to match.
- A chart whose height lands between 180 px and the measured 280 px card line (law-default compact
  charts at < 480 px) is no longer "short": the subtitle is already folded by width there, and the
  KPI numeral follows the card's `cqi` clamp.
- `Donut`'s side layout is "container ≥ 480 px"; the old extra `width > 1.5 × height` aspect rule is
  dropped (it changed the layout for a stated height above 320 px).
- `useChartSize`'s height is the CSS law's pixel mirror, used only by the unit tests; the coarse
  viewport cap is `45svh` in CSS, not the old quantised `innerHeight`.
