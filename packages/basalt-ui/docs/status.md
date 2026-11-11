---
name: Status
use when: ''
never when: ''
subpath: basalt-ui/ui/status
peers: ['@base-ui/react']
slots: [status, swatch]
---

# Status

A dot and a word for a verdict: `Healthy`, `Degraded`. The dot is a pseudo-element and not read
out; the word is the state.

## `statusVariants`

Part `status`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `neutral`)

## `swatchVariants`

Part `swatch`.

No variant axes.

## Slots

- `status`
- `swatch`
