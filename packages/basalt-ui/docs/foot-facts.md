---
name: FootFacts
use when: 'a card''s `footer` prop takes one or two facts'
never when: 'a card needs three facts or a node in the footer (cut a fact: the footer holds two)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# FootFacts

Capped at 2; `null` or `undefined` drops one, so a conditional fact type-checks without a hole.

## Signature

```ts
type FootFacts = readonly [Fact | null | undefined, (Fact | null | undefined)?]
```

`Fact` import from `basalt-ui/cards`: `import type { Fact } from 'basalt-ui/cards'`.

## Example

```tsx
footer={[{ label: 'Source', value: 'CI' }, stale ? { label: 'Age', value: '2 h' } : null]}
```
