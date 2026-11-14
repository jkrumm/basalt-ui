Verdict: FAIL

# Spike: two-pane chart on `CartesianChart` (S10)

Two `CartesianChart` panes under one cursor group and one `y.gutter` do not align their x on one pixel column, because the compiler does not read `y.gutter` yet. `DualPanel` stays deferred; the fix is the compiler, not the 11th symbol. Concept: `docs/v3/concepts/charts-cards-kanban.md` sections 9 (S10), 12 (E5). The argo `momentum-chart.tsx` was read, not changed.

## Question

Does a price pane over a momentum pane, as two `Lines` with `cursor="momentum"` and `y={{ gutter: 56 }}`, put one x on one pixel column, follow one cursor and let the plot-size DOM scrape (invariant 15) retire?

## Method

`apps/playground/src/recipes/two-pane.tsx` (synthetic bars: a price near 41k to 50k, a momentum in -3 to 3), mounted at 1440 by `tests/layout/two-pane.layout.test.ts`. The plot x range is the clip rect of each pane's marks group. The bundle points `basalt-ui/charts` at `src/charts/parts` because the public export still carries the 2.x chart (see Blocker).

## Result

| Criterion                         | Result  | Evidence                                                                                           |
| --------------------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| x alignment (equal within 1 px)   | fail    | price pane plot starts at x 44.96 px, momentum pane at 19.42 px: 25.5 px apart, both end at 732 px |
| tooltip follow                    | not run | `two-pane.test.tsx` is not written: it needs the contract swap (Blocker)                           |
| invariant 15 (DOM scrape) retires | no      | alignment is not proven, so the scrape stays                                                       |

## Limit

`y.gutter` is registered as the `y.gutter` seam (`src/charts/seams/y-gutter.ts`): it sets `yGutter` on the spec, and `compileCartesian` never reads it. The engine still measures each pane's margin from its own y labels (`52k` against `-3`). Honouring `yGutter` in `core/compile.ts` as a fixed left margin closes it; the layout test turns red when it does, and this verdict flips to PASS.

## Blocker

The public `basalt-ui/charts` types are the 2.x ones (`getValue`, `x` as a function, `cursorGroup`, no `y.gutter`), so a recipe written to `src/charts/contract.ts` does not typecheck in the playground until the contract swap lands.

## Next

If the compiler fix is refused, reinstate `DualPanel` (engine `composeViews` plus `alignX`), one symbol.
