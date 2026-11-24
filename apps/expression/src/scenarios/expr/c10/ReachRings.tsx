import { BASALT } from 'basalt-ui/tokens'
import type { ChartFocus } from 'basalt-ui/charts'
import type { Reach } from './fixture'

const SIZE = 400
const CENTRE = SIZE / 2
const INNER = 14
const OUTER = 184
const MAX_STEP = 44
const SPREAD = 0.5
const MIN_GAP = 0.3
const NODE_R = 7
const ORIGIN_R = 9

type Placed = { row: Reach; index: number; x: number; y: number }

const hopWord = (hop: number): string => `${hop} ${hop === 1 ? 'hop' : 'hops'}`

// cycle-expression-3: the kit has no node-link or radial form; the rings, positions and edges are
// hand-placed here and only focus, dimming and the one tab stop come from `useChartFocus`.
export function ReachRings({
  rows,
  focus,
  farthest,
}: {
  rows: readonly Reach[]
  focus: ChartFocus<Reach>
  farthest: number
}) {
  const step = Math.min(MAX_STEP, (OUTER - INNER) / Math.max(farthest, 1))
  const placed = new Map<string, Placed>()
  const angles = new Map<string, number>()
  for (let hop = 0; hop <= farthest; hop += 1) {
    const ring = rows.filter((r) => r.hop === hop)
    const taken: number[] = []
    ring.forEach((row, i) => {
      const parent = row.via === null ? undefined : angles.get(row.via)
      const siblings = ring.filter((r) => r.via === row.via)
      const slot = siblings.indexOf(row) - (siblings.length - 1) / 2
      // Children fan out around their parent's angle so an edge stays short; hop 1 spreads evenly.
      let angle =
        parent === undefined
          ? (2 * Math.PI * (i + 0.5)) / ring.length - Math.PI / 2
          : parent + slot * SPREAD
      while (taken.some((t) => Math.abs(t - angle) < MIN_GAP)) angle += MIN_GAP
      taken.push(angle)
      angles.set(row.id, angle)
      const radius = hop === 0 ? 0 : INNER + hop * step
      placed.set(row.id, {
        row,
        index: rows.indexOf(row),
        x: CENTRE + radius * Math.cos(angle),
        y: CENTRE + radius * Math.sin(angle),
      })
    })
  }
  const nodes = [...placed.values()]

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-label="The leaked key at the centre, each reachable resource on the ring of its hop count"
      className="size-full"
    >
      {Array.from({ length: farthest }, (_, i) => {
        const hop = i + 1
        const radius = INNER + hop * step
        const count = rows.filter((r) => r.hop === hop).length
        return (
          <g key={hop}>
            <circle cx={CENTRE} cy={CENTRE} r={radius} fill="none" stroke={BASALT.grid} />
            <text
              x={CENTRE}
              y={CENTRE - radius + 3}
              textAnchor="middle"
              fontSize={BASALT.text.nano}
              fill={BASALT.inkMuted}
              stroke={BASALT.card}
              strokeWidth={3}
              paintOrder="stroke"
            >
              {`${hop === 1 ? hopWord(hop) : hop} · ${count}`}
            </text>
          </g>
        )
      })}
      {nodes.map(({ row, x, y }) => {
        const from = row.via === null ? undefined : placed.get(row.via)
        if (from === undefined) return null
        return (
          <line
            key={row.id}
            x1={from.x}
            y1={from.y}
            x2={x}
            y2={y}
            stroke={BASALT.line}
            aria-hidden
          />
        )
      })}
      {nodes.map(({ row, index, x, y }) => (
        <circle
          key={row.id}
          {...focus.item(index)}
          cx={x}
          cy={y}
          r={row.hop === 0 ? ORIGIN_R : NODE_R}
          fill={row.hop === 0 ? BASALT.ink : row.affected ? BASALT.bad : BASALT.inkMuted}
          stroke={focus.index === index ? BASALT.ink : BASALT.card}
          strokeWidth={focus.index === index ? 3 : 1.5}
        >
          <title>{row.id}</title>
        </circle>
      ))}
    </svg>
  )
}
