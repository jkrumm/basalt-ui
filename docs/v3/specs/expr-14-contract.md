# Spec: row height, panes, a phone column form and three formats (expression cycle 14)

Issue 2500, plan row `v3-expr-14-contract`. With no verdict in 24 hours I build on the defaults below.

## The problem

Expression cycle 14 (`docs/v3/cycles/expression-14.md`) lost points to four gaps that need a public field. Builders hard-coded what the kit could not say:

| Gap                                                                                                | Cases                                                                                                  | What the builder did                                        |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Two cards in one grid row end at different heights                                                 | n64 .16 (chart 611 px, panel 635 px), n65 .25 (7 px and a blank band under row 12), n63 .7 (dead band) | fixed wrapper heights (`h-240 @wide:h-225`)                 |
| Stacked panes cannot share one ChartCard box                                                       | n63 .7 and its markers, n67 marker                                                                     | a pixel height per pane per size class, or `useSizeClass()` |
| A long numeric table at 390 is either 12 cards (~1,500 px) or a sideways scroll                    | n65 .23, cycle 13 n62 .57                                                                              | folded two counts into one column, then cards               |
| `useFormat` has no duration in words, no day-and-month date, no tick format apart from the readout | n66 .29 ('12:29:51' read as a clock); n63, n64, n67 helpers that pass `{ year: undefined }`            | hand-built strings                                          |

## What I will build

**1. Cards of one row end at one height (no new field).** A grid row already stretches its items; today the card's surface does not follow. From now on `ChartCard`, `DataPanel` and `StatCard` take their grid cell's height, and the body that can grow takes the extra: the chart box of a `ChartCard` (its `auto`, `tall` or `short` height becomes the floor) and the body box of a `DataPanel` (`bodySize` becomes the floor; a `height="fill"` table shows the extra rows, the whole-row cut measures the grown box). A card outside a stretching row (a column page, a `Section` stack) keeps today's height to the pixel. Layout test: a `ChartCard` beside a taller `DataPanel`, and the reverse, end within 1 px at 1800; at 390 the stack is unchanged.

**2. `panes` on `ChartCard`.** In place of `chart`, a card takes `panes`: each pane gets its share of the chart box by weight. (Built as a prop, not the `ChartPanes` export this page first named: `docs/v3/ARCHITECTURE.md` section 3 holds `./charts` at 13 value symbols and calls a fourteenth red, so only the `ChartPane` type is new.)

```tsx
<ChartCard title="Recovery" height="tall" panes={[
  { weight: 2, chart: (pane) => <Lines height={pane.height} … /> },
  { chart: (pane) => <Lines height={pane.height} … /> },
]} />
```

Weights default to 1; panes are separated by the recipe's 4 px gap; each pane's slot is called with `height: 'fill'` in the card's phase. The two-pane recipe switches to it and drops the equal-rows grid advice. Layout test: two and three panes inside a `ChartCard` fill its box with no pixel height in the test page, at 1800 and 390, and their plots share one x column.

**3. `phone: 'columns'` on `useDataTable`.** Below the phone width the table stays a table with a visible header and drops to three columns: the identity column (wrapping to two lines, never ellipsised mid-word), the column placed in the card's `value`, and the first column placed in its `meta`. The other columns leave the row and stay reachable through the row's expand, as the reduced tier's priority-3 columns already are. It reads the existing `card` placements, so no column gains a field. Layout test: a 12-row, 5-column numeric table at 390 keeps name, answer and count inside the viewport with no horizontal overflow, and is under half the height of its cards form.

**4. Formats.** `f.duration(ms, 'words')` prints the two largest non-zero units in the locale's short unit names (`12 hr 30 min`, `2 days 4 hr`, `45 sec`), rounded at the smaller unit; the default stays the clock form. `f.date(d, 'day')` prints a day and month with no year (`Nov 12` in `en`, `12. Nov.` in `de`). `x.tickFormat` writes the x tick labels of a `CartesianChart` while `x.format` keeps writing the cursor readout and the tooltip header; without it `x.format` writes both, as today. Unit tests for each, in `en` and `de`.

Each field gets its doc page in `packages/basalt-ui/docs/`, regenerated agent text, and a kit page in the playground.

## Open choices

| #   | Choice                                                                                                                       | My default                                                                                                                                                                                                                                    | Changing it after 3.0 costs                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Row height: always on, or an opt-in prop (`height="row"`)?                                                                   | Always on. A card that ends short of its neighbour is never what a page wants, and every case asked for it; an opt-in is one more prop every builder must know.                                                                               | Turning it off later moves every mixed row of every consumer: a minor with a visible change. Adding an opt-out later is additive. |
| 2   | Duration words: `Intl.DurationFormat` or `Intl.NumberFormat` unit parts?                                                     | `NumberFormat` units joined by a space. `DurationFormat` is Baseline only since March 2025 (MDN); a fallback for an older browser would print another string than the server and break hydration. NumberFormat units are Baseline since 2020. | Moving to `DurationFormat` later changes the separator (`12 hr, 30 min`) in every app: a visible minor, no type change.           |
| 3   | Which columns a `columns` phone keeps: the existing `card` placements, or a new per-column field (`phone: { keep: [...] }`)? | The `card` placements: `value` and the first `meta` already name the answer and the count for the cards form.                                                                                                                                 | A keep list later is additive; a builder who wants another column today places it in `meta`.                                      |

## Left out on purpose

- No shared y gutter, cursor group or upper-pane tick hiding inside `panes`: the recipe keeps teaching those; folding them in is later work once a third case asks.
- No minimum pane height: no case measured a pane too short; a builder picks `height="tall"` for three panes.
- No row height across `Section`s or non-grid flex rows beyond what CSS stretch gives.
- No other rendering when a row stretches a card far past its floor: the owner's verdict (with notes) welcomes a little stretch and leaves room for a better rendering where the stretch grows large; later work once a case shows one.
- No `BarList` leader highlight or Heatmap cross-grain focus (one case each, out of scope).

## What the owner does

Read the four parts, then answer with a verdict: `approve` to build on the defaults, or `changes` with an annotation on the choice to flip. Nothing else is needed from you.
