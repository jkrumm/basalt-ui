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

## Charts — the contract does NOT hold today (not fixed in this PR)

Measured with throwaway probes (not committed) on `Lines` (two series, default height):

| Viewport | Server box   | Hydrated box | CLS   | Hydration warnings |
| -------- | ------------ | ------------ | ----- | ------------------ |
| 1280 px  | 1248 × 346.2 | 1248 × 446.2 | 0.090 | none               |
| 390 px   | 358 × 346.2  | 358 × 248.2  | 0.141 | none               |

Cause (source): `useChartSize` starts at width 0 and resolves the 640 px regular class
(`sizing.ts:11,37`: height 320, chips legend). The real class and height arrive from a layout
effect after hydration, so the server-painted box (320 + legend) changes to `width × ratio`
(clamped 160–420) and the legend mode changes (`CartesianChart.tsx`, none/dots/chips by class).
The SVG itself scales (`viewBox 0 0 640 320`, `width/height 100%`), so only the box moves.

The fix needs the box to be fixed by CSS before JS (container-query height law on a Mantine-free
CSS module, the engine measuring the box instead of being handed `height`, the legend picked by
CSS). That touches files outside this PR's owned list: `CartesianChart.tsx` (`ChartShell`),
`state.tsx` (`ChartPlaceholder`), `Donut.tsx`, `Heatmap.tsx`. Left for the lead's call.

`legend.placement: 'header'` is a separate gap: the legend reaches the `ChartCard` header from an
effect (`CartesianChart.tsx`, `card-context.ts`), so it is absent from the server HTML and grows the
header after hydration.
