---
name: Delta
use when: 'a figure carries its change against a period, passed as `delta` on a stat card or a chart figure'
never when: 'the change is not a number the reader can act on (state it in `sub`) or no base exists'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# Delta

A change against a base: the figure's delta pill. `polarity` names whether up is good, bad or neither,
which sets the tint; the sign of `value` sets the arrow.

## Signature

```ts
type Delta = {
  /** Printed as given, never scaled: `0.12` shows 0.12, not 12 %, so pass `'+12%'`; the sign sets the arrow. */
  value: number | string
  polarity: 'up-good' | 'up-bad' | 'neutral'
  label?: string
}
```

## Example

```tsx
delta={{ value: '+12%', polarity: 'up-good', label: 'vs last week' }}
```
