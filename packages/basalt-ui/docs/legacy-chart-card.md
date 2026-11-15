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
  // either facts or value + delta
  className?: string  // Appended to the root element's own class — never replaces it
  style?: CSSProperties  // Merged onto the root element's own inline style, if it has one
  classNames?: Partial<Record<ChartCardSlot, string>>
  title?: string
  icon?: ReactNode
  subtitle?: string  // A muted line below the title row; does not by itself render the header
  info?: string  // `WidgetHeader`'s info glyph beside the title
  value?: string  // A pre-formatted metric value, with `delta` on the hero row
  delta?: number
  deltaPeriod?: string
  deltaPolarity?: DeltaPolarity
  count?: number  // A mono count tag after the title
  actions?: ReactNode  // Right-aligned controls
  state?: ChartState  // A resolved state replaces `children` with its placeholder; the header stays
  placeholderHeight?: number | ResponsiveChartHeight | "content"  // Body height while a placeholder shows
  ghost?: number | "grid" | "line" | "bars" | "band"  // The pending plot's ghost: `'bars'` (default), `'line'` for a line or area chart, or the bar count when the lo…
  stale?: boolean  // Placeholder data is showing: the facts row dims with the plot (a strip cell's `stale`)
  stateNoun?: string  // What an errored `state` names: "Could not load {stateNoun}"
  onRetry?: (() => void)  // An errored `state` shows the shared Retry button (the one `ErrorState` renders)
  retrying?: boolean  // A refetch is in flight: Retry is inert and marked busy
  stateAction?: ReactNode  // Any other action under the placeholder, e.g
  children?: ReactNode
  facts?: ChartFact | readonly ChartFact[]  // The headline figure(s) under the title: value, unit, comparison, period
```
