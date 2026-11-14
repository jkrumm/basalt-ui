// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:seam-linked
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
// #endregion
