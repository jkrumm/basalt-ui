/**
 * Stub of `basalt-ui/charts`. `src/charts` still exports the 2.x `Sparkline`
 * (`data`/`mark`/`color`), so the contract shape (`SparklineProps` of `charts/contract.ts`:
 * `series`, `form`, `reference`, required `height`) is declared here and drawn with a small SVG,
 * enough to render the route. The engine host (`@tanstack/charts`) is not exercised: that is the
 * charts concept's own proof, not this spike's.
 */
import type { ReactElement } from 'react'
import type { SparkPoint, SparklineProps } from '../../../../packages/basalt-ui/src/charts/contract'

export type { SparklineProps }

const valueOf = (p: SparkPoint): number | null =>
  p === null || typeof p === 'number' ? p : p.value

export function Sparkline({
  series,
  ariaLabel,
  height,
  width = 96,
  form = 'line',
  reference,
  format,
  summary,
}: SparklineProps): ReactElement {
  const h = height === 'fill' ? 28 : height
  const values = series.map(valueOf)
  const finite = values.filter((v): v is number => v !== null)
  if (finite.length === 0) {
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an empty span stands in for an image; svg has no img tag
    return <span role="img" aria-label={ariaLabel} style={{ width, height: h }} />
  }
  const mean = finite.reduce((a, b) => a + b, 0) / finite.length
  const ref = reference === 'mean' ? mean : reference
  const lo = Math.min(...finite, ref ?? Infinity)
  const hi = Math.max(...finite, ref ?? -Infinity)
  const span = hi - lo || 1
  const x = (i: number) =>
    values.length === 1 ? width / 2 : (i / (values.length - 1)) * (width - 4) + 2
  const y = (v: number) => h - 3 - ((v - lo) / span) * (h - 6)
  const pts = values.flatMap((v, i) => (v === null ? [] : [[x(i), y(v)] as const]))
  const d = pts
    .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join('')
  const last = pts.at(-1)
  const lastValue = finite.at(-1)
  return (
    <svg
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- svg has no img tag; the role names the chart
      role="img"
      aria-label={ariaLabel}
      width={width}
      height={h}
      viewBox={`0 0 ${width} ${h}`}
      className="shrink-0 overflow-visible text-line"
    >
      {summary === undefined ? null : <title>{summary}</title>}
      {ref === undefined ? null : (
        <line
          x1={0}
          x2={width}
          y1={y(ref)}
          y2={y(ref)}
          stroke="currentColor"
          strokeOpacity={0.4}
          strokeDasharray="2 3"
        />
      )}
      {form === 'area' && pts[0] !== undefined && last !== undefined ? (
        <path
          d={`${d}L${last[0]} ${h}L${pts[0][0]} ${h}Z`}
          fill="currentColor"
          fillOpacity={0.12}
        />
      ) : null}
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
      {last === undefined ? null : (
        <circle cx={last[0]} cy={last[1]} r={2.5} fill="currentColor">
          {format === undefined || lastValue === undefined ? null : (
            <title>{format(lastValue)}</title>
          )}
        </circle>
      )}
    </svg>
  )
}
