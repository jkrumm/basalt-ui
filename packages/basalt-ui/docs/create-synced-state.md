---
name: createSyncedState
use when: 'a preference object follows the person across devices and the server stores it whole or per field'
never when: 'the value is device-local (`persisted`), a form draft, or a record list (`optimistic` on a mutation)'
subpath: basalt-ui/data
peers: []
slots: []
---

# createSyncedState

A preference object the server stores per person and every device edits. `set` shows the value
at once, writes a local mirror and saves after `debounceMs` through one serial writer; a 409 or
412 loads, re-applies the unsent patch and retries once; a failed save retries three times, then
`status` is `'error'` (`'offline'` without a network) with the patch kept for the next `set`. A
hidden tab flushes with `keepalive` when the value fits 64 KiB. A remote value replaces a field
only when nothing is pending, `editing()` is false and 2 s passed since that field's last edit.
An un-seeded server (`load` answers `value: null`) is seeded once from the mirror. An edit not
yet sent when the page crashes or reloads is lost. Needs a client from `makeQueryClient`.

## Signature

```ts
createSyncedState<T extends object>(o: SyncedStateOptions<T>): SyncedState<T>
  key: string
  version: number
  schema: PersistedSchema<T>
  initial: T
  owner: () => string | null
  transport: SyncedTransport<T>
  freshness?: Freshness
  editing?: () => boolean
  storage?: StorageLike
  debounceMs?: number
```
