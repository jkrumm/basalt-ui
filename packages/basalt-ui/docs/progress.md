---
name: Progress
use when: 'a task has a measure (an upload, an import) or is running with an unknown end (`value={null}`)'
never when: 'a value sits on a scale of zones, not a task (use Meter), or the wait is one action (use a Spinner)'
subpath: basalt-ui/ui/progress
peers: ['@base-ui/react']
slots: [progress, ring]
---

# Progress

A bar for work that has a measure. `value` runs from `min` (0) to `max` (100); `null` is
indeterminate. The percentage read out to assistive tech is formatted in the page locale
(`useFormat`), so it matches the digits elsewhere on the page.

## Props

### `Progress`

```ts
Progress({ tone, className, value, min, max, ...props }: ProgressProps): ReactElement
  // either aria-label or aria-labelledby
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" | null
  aria-label?: string
  aria-labelledby?: string
  className?: string  // Layout only (`max-w-xs`, `mt-2`)
```

### `Ring`

A circular gauge with its percentage printed in the middle, in the page locale (`useFormat`):
`42.5%` in `en`, `42,5 %` in `de-DE`.

```ts
Ring({ tone, className, value, min, max, digits, ...props }: RingProps): ReactElement
  // either aria-label or aria-labelledby
  aria-label?: string
  aria-labelledby?: string
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" | null
  className?: string  // Layout only (`ml-auto`)
  value: number  // The measure, `min` (0) to `max` (100)
  min?: number
  max?: number
  digits?: number  // Decimal places printed in the middle, default 1 (`42,5 %` in `de-DE`)
```

## `progressVariants`

Part `progress`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `accent`)

## `ringVariants`

Part `ring`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default `accent`)

## Slots

- `progress`
- `ring`
