# Linked parts

A chart and the list of the same items beside it, one focus (a form laid out along time or a chain, `IntervalTrack` or `ChainView`, takes the row's full width with the list below it on the same focus: see [charts](../../basalt-design/references/charts.md) § One view). The list scrolls in its own region at the chart's height at a wide container and stacks under the chart at a narrow one; its `onPointerLeave` clears the focus, so the gap between rows never flashes the unfocused state; the kit dims, so the page sets no opacity.

A container query reads an ancestor, never the element itself: `@container` sits on a parent of the grid that carries `@wide:grid-cols-2`, so the two columns form (n18 found `@container` and `@wide:` on one element and wrapped the grid; every page that copies the snippet inherits the order it shows).

The two columns are a named container size with a plain track count (`@wide:grid-cols-2`), never an arbitrary template such as `grid-cols-[3fr_2fr]`: a ratio the page needs is a [CardGrid](node_modules/basalt-ui/docs/card-grid.md) `min` tier or a [SplitPage](node_modules/basalt-ui/docs/split-page.md), the parent's job. `CartesianChart` renders `focus.live` itself, so a page renders the region itself only where no chart takes the focus (a seam-only list or bar): a second `{focus.live}` repeats every announcement (c15, n13: the shoot log read "X | X"). The focus is built over the array the chart draws (`data`), the whole of it: a pointer on a row the focus lacks matches nothing, and neither the hero nor the dim follows (n16 built it over the weigh-in days while the chart drew every day). A list that shows a subset maps its rows to that focus by id (c15 built an id map). Every readout in the list and the card (`tabular-nums`) takes tabular numerals, so a value changing on focus does not shift its neighbours.

A table that shows the chart's items is `DataTable` with `focus={focus}`, never a plain `Table`: it maps a row to its item by `getRowId` and keeps the link through its own sort and filter (n10 fell back to `Table` when sorted rows tripped `primitive-bypass`, and the table drove nothing). A list that only repeats the chart's numbers is folded into the chart card or dropped; it stays only where it adds what the marks cannot (a name, a reason, a second attribute), and then it carries the chart's encoding of a state, never a second one (n07 and n14 drew list dots that differed from the bars). The announcement names the values a viewer compares, not only their difference: `${hour}: ${a} kt, ${b} kt, ${c} kt, ${d} kt`, where "19.4 kt apart" leaves the four models out (n10).

A table whose rows are not the chart's items still joins it: `DataTable focusItems={{ focus, holds: (row, item) => … }}` names every item a row stands for. A row that is a window of hours beside an hourly chart holds the run (`holds: (w, h) => h.at >= w.from && h.at <= w.to`): pointing at it holds every hour, the chart draws the run as one x band and dims the rest, and the live region says the run (`announceSpan` on `useChartFocus`, else the first and the last hour joined by "to"). A row under a parent holds its parent (`holds: (f, p) => p.id === f.probe`): pointing at a finding focuses its probe, and a focused probe marks every finding under it. Never bridge two `useChartFocus` handles with an effect (n33 copied one index into the other in 25 lines and lit only a probe's first finding), and never redraw the chart per row so the grains match (n34 joined nothing: a window is not an hour). A readout of a held run reads `focus.span`, every held item in order; `focus.readout` reads its first.

A `BarList` whose rows are not the chart's items joins it with the same two arms. Rows that stand for the chart's series take `focusSeries={{ focus, key: (row) => MODEL[row.key] }}`: n41 listed request kinds beside hourly bars stacked by the model tried first, and pointing at a kind emphasises its model across every hour and dims the rest, while the legend marks the kind. Rows that hold items of another grain take `focusItems={{ focus, holds }}`, as the table does. Either arm makes the list one tab stop whose keys step its own rows and whose live region names the row; never hand-write a `ListFocus` adapter over `setSeries` (n41 round 1 wrote 25 lines of one, .36).

A grid of another grain that draws the focused item's frame follows the focus one way, by design. n44's rain map of places sat beside five-minute bars: a place holds every step, so it has nothing to focus back. The map reads `focus.datum` (the latest step without one) to pick its frame and names the step in its figure `period`; its own `useChartFocus(frame.cells)` passed as `Heatmap focus` focuses a cell, dims the rest and drives the map card's figure. A grid whose cells are the chart's items (a weekday by hour grid beside the hourly chart) shares the one focus through `Heatmap focus` instead.

Every list of the page's items joins the one focus, with or without a chart on the page. Worked case, n23: a `BarList` of monitors by downtime and a `DataTable` of the same monitors, no chart. It built neither a focus nor a link (LIST NOT LINKED in all four frames); one `useChartFocus(monitors, { announce })` passed as `BarList focus={focus}` and `DataTable focus={focus}` linked both in round 1, the figure reads `focus.readout(restTotal, (d) => d.downMinutes)` and names the focused monitor, and the page renders `{focus.live}` because no chart takes it. Pass the list in the focus's order; a row with no entry in the focus clears it, never keeps the last one. A table that joins no focus when `DataTable focus` and `BarList focus` exist costs the case X3 (n11 .7, n23 .35 and .42).

A strip or figure that shows the focused item's breakdown (a night's stages, a release's errors by service) follows `focus` like the list does: it reads `focus.readout(rest, (d) => ...)` or `plot.focused`, so it never keeps showing the last item while the chart focuses another (a night's stage strip left on last night while the chart focused another; a cut-off written by the slider and not by a click on a bar).

```tsx
// @check
import { CartesianChart, useChartFocus } from 'basalt-ui/charts'
import { BASALT } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'

type Release = { day: number; tag: string; errors: number }

const color = { light: BASALT.brand, dark: BASALT.brand }

export function ErrorsByRelease({ releases }: { releases: readonly Release[] }) {
  const focus = useChartFocus(releases, { announce: (r) => `${r.tag}: ${r.errors} errors` })
  return (
    <div className="@container">
      <div className="grid gap-3 @wide:grid-cols-2">
        <CartesianChart
          label="Errors per release"
          data={releases}
          focus={focus}
          x={{ value: (r) => r.day }}
          series={[{ mark: 'dot', key: 'errors', label: 'Errors', color, y: (r) => r.errors }]}
        />
        <ScrollArea
          aria-label="Releases"
          className="max-h-64"
          onPointerLeave={focus.target.onPointerLeave}
        >
          {releases.map((r, i) => (
            <div
              key={r.tag}
              {...focus.item(i)}
              className="flex justify-between px-2 py-1 text-sm data-focused:bg-selected"
            >
              <span className="font-mono">{r.tag}</span>
              <span className="tabular-nums">{r.errors}</span>
            </div>
          ))}
        </ScrollArea>
      </div>
    </div>
  )
}
```
