---
name: Waterfall
use when: 'a total is explained by signed contributions in order: a budget''s line items, a quarter''s income bridge, a release''s size by package'
never when: 'the parts are a share of one whole with no order (use a one-row stacked BarList), or the values form a series over time (use Lines or Bars)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# Waterfall

A bridge from a start to an end through signed steps.

## Signature

```ts
Waterfall<D>(props: WaterfallProps<D>): ReactElement
  label: string
  summary?: string
  table?: boolean
  height?: number | "fill"
  phase?: Phase | QueryStateLike
  cursor?: string
  data: readonly D[]
  step: (d: D) => string  // The step's name, a band on the x axis
  value: (d: D) => number | null  // The step's signed change; `null` skips the step
  start?: { label: string; value: number; }  // Where the run starts, as its own first bar (an opening balance)
  total?: string  // A closing bar for the running total, with its name
  format?: ((v: number) => string)  // Writes every value: the labels, the tooltip and the y ticks
  polarity?: "up-good" | "up-bad"  // `up-good` (default): a rise is good
  valueLabel?: string  // The name of a bar's value in the tooltip
  y?: Pick<YConfig, "gutter" | "title">
  ticks?: "all"  // `'all'` names every bar on the axis (labels that overlap still thin): a bridge of a few named steps
```

`Phase`, `QueryStateLike` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike } from 'basalt-ui/cards'`.

`WaterfallProps`, `YConfig` import from `basalt-ui/charts`: `import type { WaterfallProps, YConfig } from 'basalt-ui/charts'`.

## Example

```tsx
<Waterfall
  label="Operating income, Q3 bridge"
  data={items}
  step={(d) => d.name}
  value={(d) => d.amount}
  start={{ label: 'Q2', value: 1240 }}
  total="Q3"
  format={(v) => `$${v}k`}
/>
```
