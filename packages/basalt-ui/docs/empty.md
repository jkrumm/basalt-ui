---
name: Empty
use when: 'a frame''s query settled with no rows and the card must say why and what to do next'
never when: 'the query is pending or failed (pass the phase) or the card is merely short of data'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# Empty

The measured-empty state. It cannot lack a cause. `filtered` is the no-results case under active
filters: it renders Clear filters instead of `action`.

## Signature

```ts
type Empty = {
  cause: string
  action?: CardAction
  filtered?: { reset: () => void }
  when?(data: unknown): boolean
}
```

`CardAction` import from `basalt-ui/cards`: `import type { CardAction } from 'basalt-ui/cards'`.

## Example

```tsx
empty={{ cause: 'No deploys in this range', action: { label: 'Widen range', onClick: widen } }}
```
