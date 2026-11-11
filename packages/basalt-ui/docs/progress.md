---
name: Progress
use when: ''
never when: ''
subpath: basalt-ui/ui/progress
peers: ['@base-ui/react']
slots: [progress, ring]
---

# Progress

A bar for work that has a measure. `value` runs from `min` (0) to `max` (100); `null` is
indeterminate. The percentage read out to assistive tech is formatted in the page locale
(`useFormat`), so it matches the digits elsewhere on the page.

## `progressVariants`

Part `progress`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `accent`)

## `ringVariants`

Part `ring`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `accent`)

## Slots

- `progress`
- `ring`
