---
name: Badge
use when: 'a state, a count or a change needs a small chip beside a label: `Lozenge` for a word, `CountBadge` for a number, `DeltaBadge` for a change against a period'
never when: 'the verdict is a dot and a word on one entity (use Status), or the chip would carry color alone'
subpath: basalt-ui/ui/badge
peers: []
slots: [lozenge, count-badge, delta-badge]
---

# Badge

A tinted word chip for a state: `Draft`, `Overdue`.

## Props

### `Lozenge`

A tinted word chip for a state: `Draft`, `Overdue`.

```ts
Lozenge({ tone, className, ...props }: LozengeProps): ReactElement
  className?: string  // Layout only (`ml-auto`, `absolute -top-1 -right-1`)
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" | null
  children: string  // The word
```

### `CountBadge`

A number in a chip. Neutral unless `attention`. A dot is this badge positioned by `className`.

```ts
CountBadge({ count, max, attention, className, ...props }: CountBadgeProps): ReactElement
  className?: string  // Layout only (`ml-auto`, `absolute -top-1 -right-1`)
  attention?: boolean | null
  count: number
  max?: number  // Counts above it read `99+`
```

### `DeltaBadge`

A change against a period. The arrow is the direction, the tint is the verdict; a zero change is
a neutral chip with a minus glyph, a `neutral` polarity never takes a verdict color, and a string
with no sign (`2 of 3 scheduled`, `53 % of all`) is a neutral chip with no arrow.

```ts
DeltaBadge({ value, polarity, label, className, ...props }: DeltaBadgeProps): ReactElement
  className?: string  // Layout only (`ml-auto`, `absolute -top-1 -right-1`)
  value: string | number
  polarity: "neutral" | "up-good" | "up-bad"  // Required: which direction is good
  label?: string  // The period the change is against (`vs last week`)
```

## `lozengeVariants`

Part `lozenge`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `neutral`)

## `countBadgeVariants`

Part `count-badge`.

- `attention`: `true`, `false` (default `false`)

## `deltaBadgeVariants`

Part `delta-badge`.

- `tone`: `good`, `bad`, `neutral` (default `neutral`); not a prop of `DeltaBadge`, which resolves it itself

## Slots

- `lozenge`
- `count-badge`
- `delta-badge`
