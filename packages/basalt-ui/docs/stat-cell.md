---
name: StatCell
use when: 'a status bar or KPI row shows one figure with its qualifier, meter, trend and a few rows'
never when: 'the figure stands alone as a card (use a stat card) or the rows are the content (use a list)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [stat-base, stat-caption, stat-cell, stat-chart, stat-empty, stat-foot, stat-meter, stat-row, stat-swatch]
---

# StatCell

One cell of a `StatGroup`, or a lone cell on its own tracks: a caption (icon, label, qualifier,
definition glyph), the figure with its verdict, the delta pill on the line under it beside the base
it names ("vs prior 7 days", from `delta.label`), then the meter, chart, rows and foot line it
declares. Inside a group its tracks are shared with its neighbours; a track a cell does
not declare is left empty, and one nobody declares collapses. It owns its height at every phase
and its loading skeleton draws the declared shape; `chart` is called only in `ready` and `stale`,
in a 28 px box.

## Signature

```ts
StatCell(props: StatCellProps): ReactElement
  // either href, onClick or neither
  href?: string | NavTarget
  onClick?: () => void
  phase?: Phase | QueryStateLike
  empty?: Empty | null
  label: string
  icon?: IconComponent  // A glyph before the label, drawn in the caption's muted ink
  swatch?: { light: string; dark: string; }  // The series colour of the mark this figure reads, drawn as a dot before the label
  qualifier?: string
  info?: string
  value?: string | number | null
  unit?: string
  delta?: Delta
  status?: Verdict
  sub?: string
  subMono?: boolean  // The sub line is a time or an id: drawn in the mono face with tabular numerals
  srText?: string
  meter?: MeterSpec
  chart?: BoxSlot  // Called in a 28 px box
  rows?: readonly StatRow[]
```

`Phase`, `QueryStateLike`, `Empty`, `Delta`, `Verdict` import from `basalt-ui/cards`: `import type { Phase, QueryStateLike, Empty, Delta, Verdict } from 'basalt-ui/cards'`.

## Example

```tsx
<StatCell
  label="Recovery"
  qualifier="7 day"
  value={82}
  unit="%"
  status={{ tone: 'good', label: 'Optimal' }}
  meter={{ label: 'Recovery', value: 82, max: 100 }}
  rows={[{ label: 'HRV', value: '64 ms' }, { label: 'Resting', value: '48 bpm' }]}
  phase={query}
/>
```
