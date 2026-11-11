---
name: Menu
use when: 'a trigger or a point on the page opens a list of actions, toggles or one-of-many choices'
never when: 'the list picks a form value (use `Select`) or holds arbitrary content (use `Popover`)'
subpath: basalt-ui/ui/menu
peers: ['@base-ui/react']
slots: [menu-trigger, menu-content, menu-item, menu-group, menu-checkbox-item, menu-radio-group, menu-radio-item, menu-sub, menu-separator]
---

# Menu

A list of actions on Base UI: Enter, Space or a click opens it, arrows and typeahead move,
Enter or a click runs an item, Escape closes it and gives focus back, and it is always portalled
above the page. Open state stays with the caller (`open`/`onOpenChange`) or the trigger. Works
with no provider.

## `menuContentVariants`

Part `menu-content`.

No variant axes.

## `menuItemVariants`

Part `menu-item`.

No variant axes.

## Slots

- `menu-trigger`
- `menu-content`
- `menu-item`
- `menu-group`
- `menu-checkbox-item`
- `menu-radio-group`
- `menu-radio-item`
- `menu-sub`
- `menu-separator`
