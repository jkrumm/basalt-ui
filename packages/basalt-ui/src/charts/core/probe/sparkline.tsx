// oxlint-disable basalt/chart-host-single -- byte probe: measures the bare engine mount, never shipped
/** Sparkline-shaped: the shipped Sparkline's mark set (line, last-point dot, reference rule and
 * label, band rect) on the bare engine host, no basalt chrome. */
import { Chart } from '@tanstack/charts/react'
import { dot } from '@tanstack/charts/dot'
import { lineY } from '@tanstack/charts/line'
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import { ruleY } from '@tanstack/charts/rule'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { text } from '@tanstack/charts/text'
import { createRoot } from 'react-dom/client'

const rows = Array.from({ length: 30 }, (_, i) => ({ i, v: Math.sin(i / 4) * 10 }))
const last = rows.at(-1)

const definition = {
  chart: () => ({
    marks: [
      decorative(
        rect([{ from: -4, to: 4 }], {
          id: 'band',
          x1: () => 0,
          x2: () => 1,
          xScale: 'zx',
          y1: 'from',
          y2: 'to',
          fill: 'currentColor',
          inset: 0,
        }),
      ),
      ruleY([0], { id: 'reference', stroke: 'currentColor', strokeDasharray: '2 2' }),
      decorative(
        text([0], {
          id: 'reference-label',
          x: () => 0,
          y: (v: number) => v,
          text: () => 'avg',
          fill: 'currentColor',
          anchor: 'start',
        }),
      ),
      lineY(rows, { id: 'line', x: 'i', y: 'v', stroke: 'currentColor', strokeWidth: 1.5 }),
      ...(last
        ? [decorative(dot([last], { id: 'last', x: 'i', y: 'v', r: 3, fill: 'currentColor' }))]
        : []),
    ],
    scales: {
      x: { scale: scaleLinear().domain([0, 29]), axis: false as const },
      zx: { channel: 'x' as const, scale: scaleLinear().domain([0, 1]), axis: false as const },
      y: { scale: scaleLinear().domain([-12, 12]), axis: false as const },
    },
    guides: false,
    margin: 2,
  }),
}

const el = document.getElementById('root')
if (el) createRoot(el).render(<Chart definition={definition} ariaLabel="probe" idPrefix="p" />)
