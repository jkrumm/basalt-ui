# Linked parts

A chart and the list of the same items beside it, one focus. The list scrolls in its own region at the chart's height at a wide container and stacks under the chart at a narrow one; its `onPointerLeave` clears the focus, so the gap between rows never flashes the unfocused state; the kit dims, so the page sets no opacity.

```tsx
// @check
import { dot } from '@tanstack/charts/dot'
import { CartesianChart, useChartFocus } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'

type Release = { day: number; tag: string; errors: number }

export function ErrorsByRelease({ releases }: { releases: readonly Release[] }) {
  const focus = useChartFocus(releases, { announce: (r) => `${r.tag}: ${r.errors} errors` })
  return (
    <div className="@container grid gap-3 @wide:grid-cols-[3fr_2fr]">
      <CartesianChart<Release, number>
        ariaLabel="Errors per release"
        data={releases}
        focus={focus}
        x={(r) => r.day}
        series={[{ key: 'errors', label: 'Errors', color: VX.accent, getValue: (r) => r.errors }]}
        marks={(plot) => [
          dot(plot.rows('errors'), { x: 'x', y: 'y', r: VX.dotR, fill: VX.accent }),
        ]}
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
