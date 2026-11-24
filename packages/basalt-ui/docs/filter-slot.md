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
presentation of the home around them; in a pill home (`page-bar`, `section-header`) they draw as
`FilterSet`, so the measured fold and the phone's `Filters (n)` sheet apply (three or more in the
page bar: one `Filter` trigger, its popover counting `match`); a `row` home with
several specs adds `Reset all`. No specs, nothing drawn. The slot keeps its specs' scope in its type: a card (`StatCard`, `ChartCard`,
`DataPanel`) takes widget specs only, so a global or page spec in a card slot is a type error.

## Signature

```ts
filterSlot<Scope extends FilterScope>(specs: readonly FilterSpec<any, Scope>[], options?: FilterSlotOptions): ControlsSlot<Scope> & { readonly handles: readonly { readonly key: string; }[]; }
```

`ControlsSlot`, `FilterScope`, `FilterSpec` import from `basalt-ui/controls`: `import type { ControlsSlot, FilterScope, FilterSpec } from 'basalt-ui/controls'`.

## Example

```tsx
<PageBar controls={filterSlot([spec(overview.field.q, 'Search')])} />
```
