---
name: recordAt
use when: 'a link to a record should show that record''s summary on hover, focus or tap, and the app already declares its record kinds for `usePeek`'
never when: 'the address is not a record page, or the app has no `kinds` (a card on any link takes its content directly)'
subpath: basalt-ui/router
peers: ['@tanstack/react-router']
slots: []
---

# recordAt

The record a link points at, by the same `kinds` a `usePeek` is given: `null` for an address
that is another origin, not a kind's page or unparseable. It reads the path only, so a query or
a hash does not matter. Use it to feed a `PreviewCard` (`basalt-ui/ui/preview-card`) the summary
of what a link opens, from the one declaration the peek already uses.

## Signature

```ts
recordAt<const K extends PeekKinds>(kinds: K, href: string): PeekTarget<keyof K & string> | null
```

`PeekKinds` import from `basalt-ui/router`: `import type { PeekKinds } from 'basalt-ui/router'`.

## Example

```tsx
recordAt({ issue: '/issues/$id' }, '/issues/12?tab=notes') // { kind: 'issue', id: '12' }
recordAt({ issue: '/issues/$id' }, '/pulls/12') // null
```
