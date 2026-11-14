Verdict: PASS

# Spike: two-pane chart on `CartesianChart` (S10)

Two `Lines` panes under one cursor group and one `y.gutter` put one x on one pixel column, because `compileCartesian` locks `y.gutter` as the left margin. `DualPanel` stays deferred. Concept: `docs/v3/concepts/charts-cards-kanban.md` sections 9 (S10), 12 (E5). The argo `momentum-chart.tsx` was read, not changed.

## Question

Does a price pane over a momentum pane, as two `Lines` with `cursor="momentum"` and `y={{ gutter: 56 }}`, put one x on one pixel column, follow one cursor and let the plot-size DOM scrape (invariant 15) retire?

## Method

`tests/layout/fixture/two-pane-recipe.tsx` (synthetic bars: a price near 41k to 50k, a momentum in -3 to 3), mounted at 1440 by `tests/layout/two-pane.layout.test.ts`. The plot x range is the clip rect of each pane's marks group. The recipe imports the v3 parts directly, because the public `basalt-ui/charts` still carries the 2.x chart (see Blocker).

## Result

| Criterion                         | Result  | Evidence                                                                                               |
| --------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| x alignment (equal within 1 px)   | pass    | both panes' plots start at the same x and end at the same x; before the fix they started 25.5 px apart |
| tooltip follow                    | not run | needs the contract swap (Blocker): a recipe in the playground cannot typecheck before it               |
| invariant 15 (DOM scrape) retires | open    | alignment holds; the scrape retires once argo is on the v3 contract                                    |

## Limit

The gutter is a lock, not a minimum: a tick label wider than the gutter is clipped. The consumer sizes it to the widest label (`52k` fits 56 px).

## Blocker

The public `basalt-ui/charts` types are the 2.x ones (`getValue`, `x` as a function, `cursorGroup`, no `y.gutter`), so a recipe written to `src/charts/contract.ts` does not typecheck in the playground until the public surface carries the v3 kinds. The recipe stays in the layout fixture until then.

## Next

Move the recipe to `apps/playground/src/recipes` and `docs/recipes` with the public swap, and add the tooltip-follow test then.
