# persisted

`persisted` is one keyed store for a value that belongs to this device: a rail state, a density, a draft. It reads and writes a `StorageLike`, works on the server, and wakes every component on the same key.

```ts
import { persisted } from 'basalt-ui'

const rail = persisted('shell:rail', { version: 1, initial: false })

function Toggle() {
  const [collapsed, setCollapsed] = rail.use()
  return <button onClick={() => setCollapsed((c) => !c)}>{String(collapsed)}</button>
}
```

## Stored identity

The identity is frozen. Changing it resets every saved value.

- Raw key: `basalt:<key>`.
- Raw value: `{"v":<version>,"value":<value>}`, in that key order.
- `basalt:scheme` belongs to the theme script. `persisted` never touches it.

## API

`persisted(key, { version, initial, schema?, migrate?, storage? })` returns:

| Member          | Does                                                        |
| --------------- | ----------------------------------------------------------- |
| `use()`         | Hook. Returns `[value, set]`.                               |
| `get()`         | The current value.                                          |
| `set(next)`     | Writes a value, or `set((prev) => next)`.                   |
| `subscribe(cb)` | Calls `cb` on every change. Returns an unsubscribe.         |
| `isSet()`       | True once a value was written or an accepted one is stored. |
| `reset()`       | Removes the key. The value is `initial` again.              |

A key is defined once. A second `persisted(key, ...)` with the same version returns the first store. With another version it throws in development. In production the first definition wins.

## Storage

The default backend is `window.localStorage`. Every access is guarded, so a blocked or throwing storage never breaks a render. If a write fails, the choice stays in memory for the session. The next successful write clears it.

`persisted.setStorage(storage)` replaces the backend for every store. Call it once, before the first read. It drops cached reads and wakes every store.

The `storage` option on one store wins over `setStorage`.

A `StorageLike` is synchronous. If it has `subscribe(cb)`, `cb(key)` wakes the store on that key, and `cb(null)` wakes all of them. Without `subscribe` there is no cross-tab path. The default backend uses the window `storage` event.

## clearOwner

`persisted.clearOwner(owner)` removes `basalt:<owner>:*` and `basalt:form:<owner>:*`. Other keys stay, including `basalt:ab:x` for owner `a`. Subscribers re-render with `initial`.

It can only remove keys it can list. A backend with the Storage-style `length` and `key(i)` is listed in full. Any other backend is cleared for the stores defined in this process, so keys from an earlier session that nothing has defined yet survive.

## SSR

The server renders `initial`. The first client render during hydration reads the same `initial`, so the HTML matches. React then switches to the stored value. Expect one frame of `initial` before a stored value shows.

## Versions, migrate, schema

An envelope with another version is ignored and the store reads `initial`. With `migrate(old, from)` it is carried forward and counts as set.

`schema` validates the value after migration. It follows Standard Schema and must be synchronous. A rejected value, or an async schema, falls back to `initial` and `isSet()` is false.

## When not to use it

State that a link should carry belongs in the URL. Filters, tabs and ranges are the controls' job, through a store field. Use `persisted` for what only this device should remember.
