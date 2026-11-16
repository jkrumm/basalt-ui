# Linked parts

A chart and the list of the same items beside it, one focus. The list scrolls in its own region at the chart's height at a wide container and stacks under the chart at a narrow one; its `onPointerLeave` clears the focus, so the gap between rows never flashes the unfocused state; the kit dims, so the page sets no opacity.

The two columns are a named container size with a plain track count (`@wide:grid-cols-2`), never an arbitrary template such as `grid-cols-[3fr_2fr]`: a ratio the page needs is a [CardGrid](node_modules/basalt-ui/docs/card-grid.md) `min` tier or a [SplitPage](node_modules/basalt-ui/docs/split-page.md), the parent's job. Every readout in the list and the card (`tabular-nums`) takes tabular numerals, so a value changing on focus does not shift its neighbours.

A strip or figure that shows the focused item's breakdown (a night's stages, a release's errors by service) follows `focus` like the list does: it reads `focus.readout(rest, (d) => ...)` or `plot.focused`, so it never keeps showing the last item while the chart focuses another (a night's stage strip left on last night while the chart focused another; a cut-off written by the slider and not by a click on a bar).

```tsx
// @check
import { CartesianChart, useChartFocus } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'

type Release = { day: number; tag: string; errors: number }

const color = { light: VX.brand, dark: VX.brand }

export function ErrorsByRelease({ releases }: { releases: readonly Release[] }) {
  const focus = useChartFocus(releases, { announce: (r) => `${r.tag}: ${r.errors} errors` })
  return (
    <div className="@container grid gap-3 @wide:grid-cols-2">
      <CartesianChart
        ariaLabel="Errors per release"
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
      {focus.live}
    </div>
  )
}
```
