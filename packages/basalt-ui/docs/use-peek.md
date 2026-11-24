---
name: usePeek
use when: 'records are listed on many pages and a plain click on any link to one should open it in a side panel beside the list'
never when: 'one page owns the record and its panel (use `PageAside` with a string field), or the click must always navigate'
subpath: basalt-ui/router
peers: ['@tanstack/react-router']
slots: []
---

# usePeek

The peek's address and behaviour. `field` holds `kind/id` (`?peek=issue/12`) on any page, so a
reload or a shared link restores it; `kinds` names each record kind's page (`/issues/$id`).

## Signature

```ts
usePeek<const K extends PeekKinds>({ field, kinds, dockField, }: PeekOptions<K>): PeekState<keyof K & string>
  field: PeekField
  kinds: K
  dockField?: PeekField  // A second URL field (`?dock=kind/id`) for the shell's `Dock`: the record kept open beside the screen
```

`PeekKinds`, `PeekState` import from `basalt-ui/router`: `import type { PeekKinds, PeekState } from 'basalt-ui/router'`.

## Example

```tsx
const peek = usePeek({ field: globals.field.peek, kinds: { issue: '/issues/$id' } })
// peek.open is { kind: 'issue', id: '12' } for ?peek=issue/12, else null
```
