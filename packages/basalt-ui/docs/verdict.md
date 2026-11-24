---
name: Verdict
use when: 'a card states a state in one word with a tone (`status` on a stat card)'
never when: 'the state is a count or a sentence, or the row is a table cell (use `Status` from `basalt-ui/ui/status`)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# Verdict

The verdict a card shows: a tone and a word, the type of `StatCard status`.

## Signature

```ts
type Verdict = { tone: Tone; label: string }
```

`Tone` import from `basalt-ui/cards`: `import type { Tone } from 'basalt-ui/cards'`.

## Example

```tsx
status={{ tone: 'warn', label: 'Degraded' }}
```
