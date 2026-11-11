---
name: Alert
use when: ''
never when: ''
subpath: basalt-ui/ui/alert
peers: ['@base-ui/react']
slots: [alert]
---

# Alert

An inline message about the page's state. `bad` and `warn` carry `role="alert"` and are announced
at once; `good`, `info`, `accent` and `neutral` carry `role="status"` and are announced politely.
The role follows the tone and cannot be passed.

## `alertVariants`

Part `alert`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `neutral`)

## Slots

- `alert`
