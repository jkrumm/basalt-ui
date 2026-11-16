// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:seam-linked
import { CartesianChart, useChartFocus } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'

export type Sample = { day: number; version: string; value: number }

const color = { light: VX.brand, dark: VX.brand }

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
      <CartesianChart<Sample>
        data={samples}
        ariaLabel="Daily samples, one value per day"
        x={{ value: (s) => s.day }}
        series={[{ mark: 'dot', key: 'value', label: 'Value', color, y: (s) => s.value }]}
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
