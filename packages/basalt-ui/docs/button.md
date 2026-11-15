---
name: Button
use when: ''
never when: ''
subpath: basalt-ui/ui/button
peers: ['@base-ui/react']
slots: [button, pressable]
---

# Button

A button on Base UI. Works with no provider; polymorphism only through `render`.

## `buttonVariants`

Part `button`.

- `variant`: `primary`, `secondary`, `ghost`, `danger` (default `secondary`)
- `size`: `md`, `sm` (default `md`)
- `shape`: `default`, `icon` (default `default`)

## `pressableVariants`

Part `pressable`.

- `size`: `none`, `row`, `chip` (default `none`)

## Slots

- `button`
- `pressable`
