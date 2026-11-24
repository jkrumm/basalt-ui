---
name: Status
use when: 'one entity has a verdict word with a dot (Healthy, Degraded) in a row or a header'
never when: 'the word carries a count or a change (use CountBadge or DeltaBadge), or no word fits (a dot alone never ships)'
subpath: basalt-ui/ui/status
peers: []
slots: [status, swatch]
---

# Status

A dot and a word for a verdict: `Healthy`, `Degraded`. The dot is a pseudo-element and not read
out; the word is the state. A word wider than its box ends in an ellipsis.

## Props

### `Status`

A dot and a word for a verdict: `Healthy`, `Degraded`. The dot is a pseudo-element and not read
out; the word is the state. A word wider than its box ends in an ellipsis.

```ts
Status({ tone, className, children, ...props }: StatusProps): ReactElement
  className?: string  // Layout only (`ml-auto`, `shrink-0`)
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" | null
  children: string  // The word
```

### `Swatch`

A chip of one series color for a legend or a list key. Decorative: the series name sits beside
it as text.

```ts
Swatch({ color, className, ...props }: SwatchProps): ReactElement
  className?: string  // Layout only (`ml-auto`, `shrink-0`)
  color: SwatchColor  // The series color
```

## `statusVariants`

Part `status`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `neutral`)

## `swatchVariants`

Part `swatch`.

No variant axes.

## Slots

- `status`
- `swatch`
