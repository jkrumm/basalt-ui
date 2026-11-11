---
name: StatCell
use when: 'a status bar or KPI row shows one figure with its qualifier, meter, trend and a few rows'
never when: 'the figure stands alone as a card (use a stat card) or the rows are the content (use a list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [stat-caption, stat-cell, stat-chart, stat-empty, stat-foot, stat-meter, stat-row]
---

# StatCell

One cell of a `StatGroup`, or a lone cell on its own tracks: a caption (label, qualifier,
definition glyph), the figure with its delta and verdict, then the meter, chart, rows and foot
line it declares. Inside a group its tracks are shared with its neighbours; a track a cell does
not declare is left empty, and one nobody declares collapses. It owns its height at every phase
and its loading skeleton draws the declared shape; `chart` is called only in `ready` and `stale`,
in a 28 px box.

## Signature

```ts
StatCell(props: StatCellProps): ReactElement
  href: string
  onSelect: () => void
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  label: string
  qualifier?: string
  info?: string
  value?: string | number | null
  unit?: string
  delta?: Delta
  status?: Status
  sub?: string
  srText?: string
  meter?: MeterSpec
  chart?: BoxSlot
  rows?: readonly StatRow[] & readonly [StatRow?, StatRow?, StatRow?…
```
