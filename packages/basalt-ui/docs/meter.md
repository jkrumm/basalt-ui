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
value and the active zone's word is printed under it, so a verdict is never colour alone; every
zone must carry a `label`. Without zones it is a neutral bar. `label` names the meter for
assistive tech, `format` prints the value (default the page locale's number).

## Props

### `Meter`

A gauge for a value on a scale. With `zones` the track is tinted by zone, a marker sits at the
value and the active zone's word is printed under it, so a verdict is never colour alone; every
zone must carry a `label`. Without zones it is a neutral bar. `label` names the meter for
assistive tech, `format` prints the value (default the page locale's number).

```ts
Meter({ label, value, min, max, zones, format: formatValue, tone, className, ...props }: MeterProps): ReactElement
  label: string
  value: number | null
  min?: number
  max: number
  zones?: readonly [MeterZone, MeterZone, ...MeterZone[]]
  format?: (v: number) => string
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" | null
  className?: string  // Layout only (`max-w-xs`, `mt-2`)
```

## `meterVariants`

Part `meter`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `neutral`)

## Slots

- `meter`
