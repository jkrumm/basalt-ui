Verdict: PASS

# Spike: two-pane chart on `CartesianChart` (S10)

Two `Lines` panes under one cursor group and one `y.gutter` put one x on one pixel column, because `compileCartesian` locks `y.gutter` as the left margin. `DualPanel` stays deferred. Concept: `docs/v3/concepts/charts-cards-kanban.md` sections 9 (S10), 12 (E5). The argo `momentum-chart.tsx` was read, not changed.

## Question

Does a price pane over a momentum pane, as two `Lines` with `cursor="momentum"` and `y={{ gutter: 56 }}`, put one x on one pixel column, follow one cursor and let the plot-size DOM scrape (invariant 15) retire?

## Method

`apps/playground/src/recipes/two-pane.tsx` (synthetic bars: a price near 41k to 50k, a momentum in -3 to 3), mounted at 1440 by `tests/layout/two-pane.layout.test.ts`. The plot x range is the clip rect of each pane's marks group.

## Result

| Criterion                         | Result | Evidence                                                                                               |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| x alignment (equal within 1 px)   | pass   | both panes' plots start at the same x and end at the same x; before the fix they started 25.5 px apart |
| tooltip follow                    | pass   | a cursor set on one pane is read from the other through `chartCursor` (`two-pane.test.tsx`)            |
| invariant 15 (DOM scrape) retires | open   | alignment holds; the scrape retires once argo is on the v3 contract                                    |

## Limit

The gutter is a lock, not a minimum: a tick label wider than the gutter is clipped. The consumer sizes it to the widest label (`52k` fits 56 px).
