---
name: defineControls
use when: 'a page or the whole app has filters, tabs, a range or pagination that belong in the URL or on the device'
never when: 'the state is the draft of a form (use a form) or owned by another store (use externalField)'
subpath: basalt-ui/router
peers: []
slots: []
---

# defineControls

Defines one store of typed fields: `scope: 'global'` on the root route, `'page'` on a page or a
layout route. Fields come from `field`: `enum(values, fallback, { aliases })`, `multi(values,
fallback)` (empty is "all" unless the fallback is the full list), `string(fallback, { max })`,
`number({ fallback, min, max, int, step })`, `boolean(fallback)`, `range({ presets, fallback,
custom, params, window })` with `toWindow(value)`, `composite(codec)`; options labels via
`.labels()`. Lanes are declared once: `{ history: 'push' }` on a URL field, `{ url: false,
persist }` for a device (`basalt:<id>`) or memory field; only those may take a thunk fallback.
Mount `validateSearch` (or `extend(schema)` for foreign params; never a hand wrapper, which loses
the brand) with `search: { middlewares }`. A handle's `use()` gives `[value, set]`, `clear()`
unsets (explicit `undefined`), `link(v)` spreads into a typed `Link`; `resets` unsets sibling
params in the same navigate. Defaults stay out of the URL while the validated search is
complete. A global's params are exclusive (a second store naming one throws at definition), a
page store refuses a write from a route that does not run it, and a global mounted below the
root throws in development. `retain: [keys]` on a page store keeps those params across the
subtree of the layout route that mounts it; `widgets: { card: { field: handle } }` binds a card to a
scalar handle (a global or page field): it inherits the value and writes only its own
`w.<card>.<field>` key (`store.widget`, `store.useOverrides()`; see `docs/widgets.md`).

## Signature

```ts
defineControls<const Id extends string, const Scp extends Scope, const F extends Record<string, AnyFieldSpec>, const W extends WidgetsInput = {}>(config: DefineControlsConfig<Id, Scp, F, W>): Controls<Id, Scp, F, W>
  id: Id
  scope: Scp
  fields: F
  resets?: readonly string[]
  retain?: readonly string[]
  widgets?: W & ValidWidgets<W>
```
