---
name: createSyncedState
use when: 'a preference object follows the person across devices and the server stores it whole or per field'
never when: 'the value is device-local (`persisted`), a form draft, or a record list (`optimistic` on a mutation)'
subpath: basalt-ui/data
peers: ['@tanstack/react-query']
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
yet sent when the page crashes or reloads is lost. Needs a client from `createQueryClient`.

## Signature

```ts
createSyncedState<T extends object>(o: SyncedStateOptions<T>): SyncedState<T>
  key: string  // Mirror key `basalt:<owner>:<key>`; the Query key and the mutation scope derive from it
  version: number  // Mirror envelope version
  schema: PersistedSchema<T>  // Validates the mirror
  initial: T
  owner: () => string | null  // The signed-in person
  transport: SyncedTransport<T>
  freshness?: Freshness  // Default `'standard'`
  editing?: () => boolean  // True while a field of this state has focus: a remote value waits until it is false
  storage?: StorageLike  // Mirror backend
  debounceMs?: number
```

`Freshness` import from `basalt-ui/data`: `import type { Freshness } from 'basalt-ui/data'`.

`PersistedSchema`, `StorageLike` import from `basalt-ui`: `import type { PersistedSchema, StorageLike } from 'basalt-ui'`.

## Example

```tsx
export const gymPrefs = createSyncedState({
  key: 'gym', version: 1, schema: GymPrefs, initial: { unit: 'kg', rest: 90 },
  owner: () => session.userId, freshness: { class: 'ticker', every: 5_000 },
  transport: {
    load: async () => {
      const row = unwrap(await api.gym.get())
      return { value: row.state, rev: row.updated_at }
    },
    save: async (patch, base, init) => {
      const row = unwrap(await api.gym.put({ ...base.value, ...patch }, init))
      return { value: row.state, rev: row.updated_at }
    },
  },
})
```
