---
name: SLOTS
use when: 'a test or a browser-lane assertion selects a part, or checks that a module renders the parts it declares'
never when: 'the selector should be a role or an accessible name (prefer `getByRole`), or the code runs in an app bundle'
subpath: basalt-ui/testing
peers: []
slots: []
---

# SLOTS

Every `data-slot` each `basalt-ui/ui/*` module renders, keyed by module name: the selectors a
test uses instead of class names. It is the table `src/ui/slots.ts` generates, re-exported by
value (the same object, never a copy), so a new part shows up here with no edit.

## Signature

```ts
SLOTS: { full key list below }
  accordion, alert, badge, button, card, checkbox, collapsible, combobox, dialog, field, input, kbd, menu, meter, num, number-field, popover, progress, radio-group, scroll-area, segmented, select, separator, sheet, skeleton, slider, status, switch, table, tabs, textarea, toast, toolbar, tooltip, virtual-list
```
