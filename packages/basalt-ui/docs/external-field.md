---
name: externalField
use when: 'a filter, mode or selection lives in a store another module owns (a Zustand slice, a module singleton) and a basalt control must show and change it'
never when: 'the value should survive a reload (use `persisted`) or a shared link (use a router field)'
subpath: basalt-ui
peers: ['@tanstack/react-router-devtools', beautiful-mermaid, rehype-sanitize, remark-gfm, remend, shiki]
slots: []
---

# externalField

Binds a store basalt does not own as a `ControlHandle`: a control reads and writes only through
it, with no `value` or `onChange`. `clear()` writes `fallback` through the store, mounted or not.
The handle has no lane, so `useSource()` always reports `own`.

## Signature

```ts
externalField<T>(store: PlainStore<T>, o: FieldBase<T>): ControlHandle<T>
  get: () => T
  set: (next: T) => void
  subscribe: (onChange: () => void) => () => void
```
