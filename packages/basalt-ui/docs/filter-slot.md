---
name: filterSlot
use when: 'you give a composite (`PageBar`, `Section`, a card) its controls'
never when: 'the control needs an input the kinds do not draw: use `filterSlot.custom`, which is counted'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# filterSlot

Typed data a composite takes its controls through. Specs render with `ControlView` in the
presentation of the home around them; a `row` home with several specs adds `Reset all`. No specs,
nothing drawn.

## Signature

```ts
filterSlot(specs: readonly AnySpec[]): ControlsSlot
```
