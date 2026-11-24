# Linked parts

Every chart, table and list that shows the page's items takes the one `useChartFocus`, with or without a chart on the page: pointing at or stepping to an item in one focuses it in the others, both ways, and the rest dims in all of them.

## Layout

- A chart and the list of its items sit side by side at a wide container, the list scrolling in its own region at the chart's height, and stack at a narrow one. A form laid out along time or a chain (`IntervalTrack`, `ChainView`) takes the row's full width with its list below ([chart-view](../../basalt-design/references/chart-view.md)).
- A container query reads an ancestor, never the element itself: `@container` sits on a parent of the grid that carries `@wide:grid-cols-2`. The columns are a named container size with a plain track count, never an arbitrary template such as `grid-cols-[3fr_2fr]`; a ratio is a [CardGrid](node_modules/basalt-ui/docs/card-grid.md) `min` tier or a [SplitPage](node_modules/basalt-ui/docs/split-page.md).
- The list's container spreads `focus.target` (or its `onPointerLeave`), so leaving clears the focus and the gap between rows never flashes the unfocused state. The kit dims; the page sets no opacity.
- Every readout in the list and the card takes tabular numerals, so a value changing on focus does not shift its neighbours.

## Which arm joins

- The focus is built over the whole array the chart draws (`data`): a row the focus lacks matches nothing. A list that shows a subset maps its rows to that focus by id. Pass the list in the focus's order; a row with no entry clears the focus.
- Draw the chart at the list's grain where you can (one bar per ticket), so a row and a mark are one item.
- A table of the chart's items is `DataTable focus={focus}` (it maps a row by `getRowId` and keeps the link through its own sort and filter), never a plain `Table`. A `BarList` takes `focus` the same way; hand-drawn rows spread `focus.item(i)`.
- A table whose rows are not the chart's items still joins: `DataTable focusItems={{ focus, holds: (row, item) => … }}` names every item a row stands for. A window of hours holds its run (`holds: (w, h) => h.at >= w.from && h.at <= w.to`), never an equality on one minute; a row under a parent holds its parent (`holds: (f, p) => p.id === f.probe`).
- `BarList` rows that stand for the chart's series take `focusSeries={{ focus, key: (row) => … }}`; rows of another grain take `focusItems`. Either arm makes the list one tab stop; never hand-write a list adapter over `setSeries`.
- A list of groups beside samples of those groups spreads `focus.groupItem(name)` on each row, a list of series `focus.seriesItem(key)` ([seam-linked](node_modules/basalt-ui/docs/recipes/seam-linked.md)). Stacked panes on one x each take the one `focus`.
- A chart of a parent's children joins the parent's focus through `focus.hold(indexes)`, so one cursor lights the week and its days.
- A card sparkline drawn on the chart's x joins its focus or is folded into the chart: a `Sparkline` draws its own points and leaves the chart's focus untouched.
- A part at a grain no arm reaches is folded into a part that joins (`focus.hold`, a `BarList` on `focusItems`) or dropped, never drawn without `focus`. `DataTable` takes one of `focus`, `focusSeries` and `focusItems`.
- Never bridge two `useChartFocus` handles with an effect, and never redraw the chart per row so the grains match.
- A grid of another grain that draws the focused item's frame (a map of places beside five-minute bars) follows the focus one way: it reads `focus.datum` to pick its frame and names the step in its figure `period`, with its own `useChartFocus` over its cells for the cell focus. A grid whose cells are the chart's items shares the one focus through `Heatmap focus`.
- A page with no chart still has one focus: a `DataTable` or `BarList` of the page's items takes it, and the page renders `{focus.live}` once. `CartesianChart` renders `focus.live` itself, so a second one repeats every announcement. A hover tint with no focus is not a link.

## What the readout says

- The figure's `value` and `delta` are the answer and never follow focus (`basalt/primitive-bypass` refuses `focus.readout` there). The focused reading goes in `period` and `status` through `focus.readout(rest, read)`, which takes any value and carries the focused item's own number beside its name ("Push day 23 Oct, 85").
- The readout carries every measure the parts draw: list the measures each part draws and check the focus writes each one. A strip or figure that shows the focused item's breakdown reads `focus.readout` or `plot.focused`, so it never keeps the last item.
- The readout fits one line at 390: short value forms, one measure each ("7,372 steps", "40 min mod."), the window and the name in `period` and the measures in `status`. Shoot the 390 frame on a focused datum and read both lines.
- A held run reads `focus.span` (every held item in order: its best or its sum); `focus.readout` reads only its first. The live region says the run (`announceSpan`).
- When the period follows focus the tooltip is off (`tooltip={false}`), so one pointer opens one readout.
- The announcement names the values a viewer compares, in the tooltip's order and with their units (`${hour}: ${a} kt, ${b} kt`), never only their difference or a verdict.
- Charts share one cursor by default, so two cards whose readouts differ each take their own `cursorGroup`.

## Example

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
