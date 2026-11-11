---
name: Meter
use when: ''
never when: ''
subpath: basalt-ui/ui/meter
peers: ['@base-ui/react']
slots: [meter]
---

# Meter

A gauge for a value on a scale. With `zones` the track is tinted by zone, a marker sits at the
value and the active zone's word is printed under it, so a verdict is never colour alone; every
zone must carry a `label`. Without zones it is a neutral bar. `label` names the meter for
assistive tech, `format` prints the value (default the page locale's number).

## `meterVariants`

Part `meter`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `neutral`)

## Slots

- `meter`
