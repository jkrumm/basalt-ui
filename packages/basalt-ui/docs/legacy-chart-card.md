---
name: LegacyChartCard
use when: 'an app on the 2.x card API has not moved its call sites to the v3 `ChartCard` yet'
never when: 'new code draws a chart card (use `ChartCard`)'
subpath: basalt-ui/charts
peers: ['@tanstack/charts', d3-scale]
slots: []
---

# LegacyChartCard

The 2.x chart card (`state`, `facts`, children), exported as `LegacyChartCard` until the 2.x view
layer is deleted. `ChartCard` is the v3 card with `phase`, `figure` and a `chart` slot.

## Signature

```ts
LegacyChartCard({ actions, state, placeholderHeight, stateAction, stale, stateNoun, ghost, onRetry, retrying, className, classNames, style, children, facts, ...headerAndData }: ChartCardProps): ReactElement
  className?: string
  style?: CSSProperties
  classNames?: Partial<Record<ChartCardSlot, string>>
  title?: string
  icon?: ReactNode
  subtitle?: string
  info?: string
  value?: string
  delta?: number
  deltaPeriod?: string
  deltaPolarity?: DeltaPolarity
  count?: number
  actions?: ReactNode
  state?: ChartState
  placeholderHeight?: number | ResponsiveChartHeight | "content"
  ghost?: number | "grid" | "line" | "bars" | "band"
  stale?: boolean
  stateNoun?: string
  onRetry?: (() => void)
  retrying?: boolean
  stateAction?: ReactNode
  children?: ReactNode
  facts: ChartFact | readonly ChartFact[]
```
