// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:seam-bar
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
            className="flex items-center justify-center truncate text-xs"
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
// #endregion
