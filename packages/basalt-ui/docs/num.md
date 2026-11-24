---
name: Num
use when: 'a figure is printed in the page locale with tabular digits and a muted dash when it is missing'
never when: 'the text is not a number, or the figure belongs to a part that formats its own (StatCard, DataTable)'
subpath: basalt-ui/ui/num
peers: []
slots: [num]
---

# Num

A figure in the page locale (`useFormat`) with tabular numerals. A value that is absent or not
finite prints a muted dash, never `NaN`, and keeps `tone` off so a missing figure never reads
as a verdict.

## Props

### `Num`

A figure in the page locale (`useFormat`) with tabular numerals. A value that is absent or not
finite prints a muted dash, never `NaN`, and keeps `tone` off so a missing figure never reads
as a verdict.

```ts
Num({ value, format, tone, className, ...props }: NumProps): ReactElement
  tone?: "neutral" | "accent" | "good" | "warn" | "bad" | "info" | null
  value: number | null  // The figure
  format?: Intl.NumberFormatOptions  // Intl options for the text (`{ style: 'percent' }`, `{ maximumFractionDigits: 0 }`)
  className?: string  // Layout only (`ml-auto`, `text-right`)
```

## `numVariants`

Part `num`.

- `tone`: `neutral`, `accent`, `good`, `warn`, `bad`, `info` (default none)

## Slots

- `num`
