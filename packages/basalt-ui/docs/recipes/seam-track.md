---
name: seam-track
use-when: marks on a time or value track you draw yourself (a waterfall of spans, a lane), with an axis, row labels and focus
file: apps/playground/src/recipes/seam-track.tsx
---

`chartLabels.axis({ domain, format, share })` gives `at(v)`, a value's share of the track, and ticks that each carry a `label` and a `line` to spread; tick density follows the container classes, so the track sits under an `@container` and `share` is its fraction of that width. `chartLabels.row(labels, { share, grid: axis.ticks })` tries each label after the mark, inside its end, before its start, else drops it; an `inside` label takes `data-[spot=inside]:text-on-brand`, and `lines` is the gridlines minus those under a label, drawn per row under the bar. `focus.item(i)` goes on each row and the kit dims the rest. Bind the readout to the card figure or facts above the body; a long body scrolls in its own region and the keyboard step keeps the focused row in view.

```tsx
import { chartLabels, useChartFocus } from 'basalt-ui/charts'
export type Span = { name: string; startMs: number; durationMs: number }
const seconds = (ms: number): string => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`
const read = (s: Span): string => `${s.name}: ${seconds(s.durationMs)}`
const INK = 'data-[spot=inside]:text-on-brand'
const SHARE = 0.7 // three of four grid columns, less the gap
export function SeamTrack({ spans }: { spans: readonly Span[] }) {
  const domain = [0, Math.max(...spans.map((s) => s.startMs + s.durationMs))] as const
  const axis = chartLabels.axis({ domain, format: seconds, share: SHARE })
  const focus = useChartFocus(spans, { announce: read })
  return (
    <div className="@container flex flex-col gap-2">
      <p className="text-sm">{focus.readout(`${spans.length} spans`, read)}</p>
      <div className="grid grid-cols-4 gap-x-2">
        <div className="relative col-span-3 col-start-2 h-4">
          {axis.ticks.map((t) => (
            <span key={t.at} {...t.label}>
              {t.text}
            </span>
          ))}
        </div>
      </div>
      <div {...focus.target} aria-label="Spans on a time axis" className="flex flex-col gap-1">
        {spans.map((s, i) => {
          const [from, to] = [axis.at(s.startMs), axis.at(s.startMs + s.durationMs)]
          const label = { key: s.name, text: seconds(s.durationMs), from, to }
          const row = chartLabels.row([label], { share: SHARE, grid: axis.ticks })
          const bar = { left: `${from * 100}%`, width: `${(to - from) * 100}%` }
          return (
            <div key={s.name} {...focus.item(i)} className="grid grid-cols-4 items-center gap-x-2">
              <div className="truncate text-sm">{s.name}</div>
              <div className="relative col-span-3 h-5">
                {row.lines.map((t) => (
                  <span key={t.at} {...t.line} />
                ))}
                <div className="absolute inset-y-0 rounded-sm bg-brand-fill" style={bar} />
                {row.placed.map((l) => (
                  <span key={l.key} {...l.props} className={`${l.props.className} ${INK}`}>
                    {l.text}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {focus.live}
    </div>
  )
}
```
