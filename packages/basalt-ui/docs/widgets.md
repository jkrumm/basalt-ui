# widgets

A widget is a card's own state on a page store. It binds to a scalar handle (a global or a page field), inherits its value, and writes only its own `w.<widget>.<field>` URL key, so a card can override a global without ever changing it.

```ts
import { defineControls, field } from 'basalt-ui/router'

const globals = defineControls({
  id: 'globals',
  scope: 'global',
  fields: { range: field.enum(['1h', '24h', '7d', '30d'], '24h') },
})

const overview = defineControls({
  id: 'overview',
  scope: 'page',
  fields: { tab: field.enum(['all', 'errors'], 'all') },
  widgets: {
    latency: { range: globals.field.range },
    errors: { range: globals.field.range },
  },
})

const [range, setRange] = overview.widget.latency.range.use()
const { source, inherited } = overview.widget.latency.range.useSource()
const { keys, widgets, clearAll } = overview.useOverrides()
```

## Where does state live

| Scope    | Declared on                             | Lives in                 | History | Kept across routes        | Resolution                      |
| -------- | --------------------------------------- | ------------------------ | ------- | ------------------------- | ------------------------------- |
| global   | root route, `scope: 'global'`           | URL `?range=7d`          | replace | yes, all of its params    | URL > fallback                  |
| page     | page or layout route, `scope: 'page'`   | URL                      | replace | only the keys in `retain` | URL > fallback                  |
| widget   | `widgets` on a page store               | URL `w.<widget>.<field>` | replace | no                        | override > inherited > fallback |
| sub-item | page field with `history: 'push'`       | URL                      | push    | no                        | URL > fallback                  |
| device   | field with `url: false`                 | `basalt:<id>` envelope   | n/a     | n/a                       | value > fallback                |
| memory   | field with `url: false, persist: false` | module                   | n/a     | n/a                       | session                         |

## Rules

- Precedence is `override > inherited > fallback`, per key. An invalid layer drops to the next, never throws.
- An override equal to the inherited value still pins: key presence is intent. The exits are `clear()` and `useOverrides().clearAll()`.
- A deep link with an override and a global both set shows the override and rewrites nothing.
- `useSource()` returns `'override'` or `'inherited'`, and `inherited` is the value the widget shows with no override. A widget handle's `isDefault` means "no override".
- A widget field binds a scalar kind (`enum`, `string`, `number`, `boolean`); a `multi` or `range` handle is a type error. A widget has at most two fields; three is a type error.
- `w.` is a reserved param prefix, and widget ids are plain identifiers, app-unique.
- A widget write is one `replace` navigate that sets its own key and nothing else: it never resets a page's `resets` params, and an equal override is a no-op.
- `useOverrides()` reports `{ keys, widgets, clearAll }`; `clearAll()` unsets every `w.` key of the store in one navigate.

## Middleware order

A store's `middlewares` are `[strip, retain]`, in that order. Reversed, `retain` copies an array default back into every bare link before `strip` can remove it. A global retains all of its params. A page store retains only the keys named in `retain`, inside the subtree of the route that mounts its middlewares, so one store on a layout route keeps them across its children and drops them on leaving. Widget keys are never retained.

`clear()` and every write unset with an explicit `undefined`, never a `delete`: a retained key survives a delete.
