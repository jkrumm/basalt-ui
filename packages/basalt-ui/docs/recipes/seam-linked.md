---
name: seam-linked
use-when: a chart and a scrolling list of groups (versions, releases) beside it that share one focus
file: apps/playground/src/recipes/seam-linked.tsx
---

One `useChartFocus(samples, { announce, group })` drives both. `group` names a sample's group: PageUp and PageDown step by group, and the live region names the group when the focus enters it.

Each list row spreads `focus.groupItem(name)`. It is not a tab stop. Pointing at the row focuses the group's first sample, and the row carries `data-focused` while any sample of its group is focused, which `data-focused:bg-selected` styles. The chart takes `focus={focus}`.

A list of the same grain as the samples spreads `focus.item(i)` on its rows instead, and needs no `group`.

Keep a long list in the `ScrollArea` primitive: the keyboard step scrolls the focused group's row into view. The kit dims, so the page sets no opacity.

```tsx
import { dot } from '@tanstack/charts/dot'
import { CartesianChart, useChartFocus } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'

export type Sample = { day: number; version: string; value: number }

export function SeamLinked({ samples }: { samples: readonly Sample[] }) {
  const focus = useChartFocus(samples, {
    announce: (s) => `Day ${s.day}, ${s.version}: ${s.value}`,
    group: (s) => s.version,
  })
  const versions = [...new Set(samples.map((s) => s.version))]
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm">
        {focus.readout('Daily samples', (s) => `${s.version}, day ${s.day}: ${s.value}`)}
      </div>
      <CartesianChart<Sample, number>
        data={samples}
        ariaLabel="Daily samples, one value per day"
        x={(s) => s.day}
        series={[{ key: 'value', label: 'Value', color: VX.accent, getValue: (s) => s.value }]}
        marks={(plot) => [dot(plot.rows('value'), { x: 'x', y: 'y', r: VX.dotR, fill: VX.accent })]}
        focus={focus}
      />
      <ScrollArea aria-label="Versions" className="max-h-32">
        {versions.map((version) => (
          <div
            key={version}
            {...focus.groupItem(version)}
            className="px-2 py-1 text-sm data-focused:bg-selected"
          >
            {version}
          </div>
        ))}
      </ScrollArea>
      {focus.live}
    </div>
  )
}
```
