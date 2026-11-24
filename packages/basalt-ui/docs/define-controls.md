---
name: defineControls
use when: 'a page or the whole app has filters, tabs, a range or pagination that belong in the URL or on the device'
never when: 'the state is the draft of a form (use a form) or owned by another store (use externalField)'
subpath: basalt-ui/router
peers: ['@tanstack/react-router']
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
unsets (explicit `undefined`; a push field unsets as a push, `clear({ replace: true })` or a `batchWrites` reset replaces), `link(v)` spreads into a typed `Link`; `resets` unsets sibling
params in the same navigate. Defaults stay out of the URL while the validated search is
complete. A global's params are exclusive (a second store naming one throws at definition), a
page store refuses a write from a route that does not run it, and a global mounted below the
root throws in development. `retain: [keys]` on a page store keeps those params across the
subtree of the layout route that mounts it; `widgets: { card: { field: handle } }` binds a card to a
scalar handle (a global or page field): it inherits the value and writes only its own
`w.<card>.<field>` key (`store.widget`, `store.useOverrides()`; see `docs/widgets.md`).
The store reads whole: `useValues()` gives every URL field's value in one call, as its `use()` returns it
(a range as its `RangeValue`, so `toWindow(values.opened)` compiles), instead of one `use()` per field; `useActiveCount()` counts the fields that differ from their fallback (the `n` of
`Filters (n)`); `useReset()` returns the callback that unsets every field, the view tab and the open
record with the filters; `useReset({ only: [list.field.q, list.field.status] })` unsets just those
in one navigate and keeps the rest: the Clear filters of a table's or chart card's `empty.filtered`
(`FilterSet`'s Reset all is the same call); `only` also takes the `filterSlot([...])` the page draws, so the fields are named once. A push enum set back to its fallback (`ViewTabs` on its
default) leaves the URL and still pushes; `InnerNav` keeps the fallback pane via `choose(v)`. A `range` with `window:
{ '7d': (now) => ({ from, to }) }` makes `toWindow(value)` return `{ from, to }` ISO days for that
preset, resolved at call time (a preset without a resolver gives `{ window: preset }`; with every preset resolved the type has no `{ window }` member), so the
result goes straight into a query key.

## Signature

```ts
defineControls<const Id extends string, const Scp extends Scope, const F extends Record<string, AnyFieldSpec>, const W extends WidgetsInput = {}>(config: DefineControlsConfig<Id, Scp, F, W>): Controls<Id, Scp, F, W>
  id: Id  // App-unique; the device lane stores under `basalt:<id>`
  scope: Scp  // `global` mounts on the root route only; `page` on a page or a layout route
  fields: F  // The fields; each key is the field's URL param (a range's preset param)
  resets?: readonly string[]  // Params unset in the same navigate as any URL write of this store: `['page']` on a list, so a narrowed filter lands on the first page and Back restores both together
  retain?: readonly string[]  // Page stores only: URL params kept across navigations inside the subtree of the layout route that mounts the store, and dropped on leaving it
  widgets?: W & ValidWidgets<W>  // Page stores only: cards bound to a scalar handle, or owning a scalar `field.*` spec
```

`Controls` import from `basalt-ui/router`: `import type { Controls } from 'basalt-ui/router'`.

## Example

```tsx
export const globals = defineControls({
  id: 'globals',
  scope: 'global',
  fields: { range: field.enum(['1h', '24h', '7d'], '24h', { aliases: { day: '24h' } }) },
})
export const list = defineControls({
  id: 'list',
  scope: 'page',
  resets: ['page'],
  fields: { q: field.string(''), status: field.multi(['open', 'closed'], []) },
})

createRootRoute({ validateSearch: globals.validateSearch, search: { middlewares: globals.middlewares } })
createFileRoute('/list')({
  validateSearch: list.extend(z.object({ item: z.string().optional() })),
  search: { middlewares: list.middlewares },
})

const [q, setQ] = list.field.q.use()
<Link to="/list" {...list.field.status.link(['open'])} />
// beside `empty: { filtered: { reset } }`: clear the filters, keep the view and the open record
const reset = list.useReset({ only: [list.field.q, list.field.status] }) // or `{ only: slot }`, the page's filterSlot([...])
```
