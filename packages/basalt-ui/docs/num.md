---
name: Num
use when: ''
never when: ''
subpath: basalt-ui/ui/num
peers: ['@base-ui/react']
slots: [num]
---

# Num

A figure in the page locale (`useFormat`) with tabular numerals. A value that is absent or not
finite prints a muted dash, never `NaN`, and keeps `tone` off so a missing figure never reads
as a verdict.

## `numVariants`

Part `num`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default none)

## Slots

- `num`
