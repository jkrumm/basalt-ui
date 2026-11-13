---
name: seam-bar
use-when: a part-of-whole bar you draw yourself (HTML parts in a row), with focus, dimming and a readout
file: apps/playground/src/recipes/seam-bar.tsx
---

A seam bar is a flex row of `div`s, each as wide as its share. Draw it through the geometry seam instead of wiring pointer and keyboard by hand. `useChartFocus` gives the container `focus.target` (the one tab stop and the arrow keys) and each part `focus.item(i)`. A focused part carries `data-focused`; the others carry `data-dimmed`, which the class `data-dimmed:opacity-25` styles.

The readout above the bar is `focus.readout(total, read)`: the total at rest, the focused part otherwise. Render `{focus.live}` once for the polite live region.

A part names itself only where `chartLabels.fits(label, { width })` says the label fits its pixel width. Pass the track width in px, so a server render and a client render agree. No DOM measuring.

Colours come from the app's series file as `var(--vx-*)` references, never literals.

```tsx
import { chartLabels, useChartFocus } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'

export type Part = { label: string; value: number; color: string }

/** `track` is the bar's width in px: a part names itself only where its label fits. */
export function SeamBar({ parts, track }: { parts: readonly Part[]; track: number }) {
  const total = parts.reduce((sum, p) => sum + p.value, 0)
  const focus = useChartFocus(parts, { announce: (p) => `${p.label}: ${p.value}` })
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm">
        {focus.readout(`${total} in total`, (p) => `${p.label}: ${p.value}`)}
      </div>
      <div
        {...focus.target}
        aria-label="Parts of the whole"
        className="flex h-8 overflow-hidden rounded-chip"
      >
        {parts.map((p, i) => (
          // theme-allow hidden-inline-style — a part's width and colour are data
          <div
            key={p.label}
            {...focus.item(i)}
            className="flex items-center justify-center truncate text-xs transition-opacity data-dimmed:opacity-25"
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
          >
            {chartLabels.fits(
              p.label,
              { width: (p.value / total) * track },
              { size: VX.text.xs, pad: 4 },
            )
              ? p.label
              : null}
          </div>
        ))}
      </div>
      {focus.live}
    </div>
  )
}
```
