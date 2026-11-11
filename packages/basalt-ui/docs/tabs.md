---
name: Tabs
use when: ''
never when: ''
subpath: basalt-ui/ui/tabs
peers: ['@base-ui/react']
slots: [tabs, tabs-list, tabs-trigger, tabs-content]
---

# Tabs

Tabs on Base UI: roving focus (ArrowLeft and ArrowRight in DOM order, Home and End), Enter or
Space activates, and the panel is linked by `aria-controls`. Works with no provider and renders
no indicator script, so it is safe on a static page.

## `tabsVariants`

Part `tabs`.

- `size`: `md`, `sm` (default `md`)

## Slots

- `tabs`
- `tabs-list`
- `tabs-trigger`
- `tabs-content`
