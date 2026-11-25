---
name: Meter
use when: 'a value sits on a scale with named zones (a training load, a quota) and the zone is the message'
never when: 'the value is progress toward a goal (use Progress) or a trend (use Sparkline)'
subpath: basalt-ui/ui/meter
peers: ['@base-ui/react']
slots: [meter]
---

# Meter

A gauge for a value on a scale. With `zones` the track is tinted by zone, a marker sits at the
value and the active zone's word is printed under it, so a verdict is never color alone; every
zone must carry a `label`. Without zones it is a neutral bar. `label` names the meter for
assistive tech, `format` prints the value (default the page locale's number) and `caption` the
words after it that name it on screen ("US$13.89 spent", "of 150 listed"). `ticks` mark a range's
ends or a limit on the track, `cause` says why in a line under the readout. The track is 8 px and
the readout line 16 px under a 4 px gap, so a meter is 28 px (a tick row adds 20, a `cause` its
lines); a `StatCard` `height` below that clips the readout, so a meter in its chart slot sets
`height={28}` at least. A list of meters
joins one `useChartFocus` through the seam: the list spreads `focus.target`, each meter
`focus.item(i)`, and the page renders `focus.live` once.

## Props

### `Meter`

```ts
Meter({ label, value, min, max, zones, format: formatValue, caption, ticks, cause, tone, className, ...props }: MeterProps): ReactElement
  label: string
  value: number | null
  min?: number
  max: number
  zones?: readonly [MeterZone, MeterZone, ...MeterZone[]]
  format?: (v: number) => string
  caption?: string  // Words after the value that name it on screen: "spent", "of 150 listed"
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" | null
  className?: string  // Layout only (`max-w-xs`, `mt-2`)
  ticks?: readonly [number] | readonly [number, number]  // One or two values marked across the track, each with its `format`ted number under it: a range's two ends or one limit
  cause?: string  // Why the meter reads as it does, one muted line under the readout ("70 % under 0.40")
```

## `meterVariants`

Part `meter`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `neutral`)

## Slots

- `meter`
