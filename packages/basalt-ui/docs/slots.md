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
  accordion, alert, avatar, badge, button, calendar, card, checkbox-matrix, checkbox, choice-card, collapsible, combobox, control-group, copy-button, date-picker, dialog, entity, field, file-upload, info-hint, input, kbd, menu, meter, num, number-field, one-time-code, password-input, popover, preview-card, progress, quick-picks, radio-group, resizable, scroll-area, segmented, select, separator, sheet, skeleton, slider, sortable-list, status, swatch-picker, switch, table, tabs, tag-input, textarea, toast, toolbar, tooltip, virtual-list
```

## Example

```tsx
document.querySelector(`[data-slot="${SLOTS.dialog[1]}"]`) // the dialog's content part
```
