// oxlint-disable basalt/chart-host-single -- byte probe: measures the bare engine mount, never shipped
import { Chart } from '@tanstack/charts/react'
import { barY } from '@tanstack/charts/bar'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { createRoot } from 'react-dom/client'

const rows = Array.from({ length: 12 }, (_, i) => ({ i, v: (i * 7) % 11 }))

const definition = {
  chart: () => ({
    marks: [barY(rows, { id: 'bars', x: 'i', y: 'v', fill: 'currentColor' })],
    scales: {
      x: {
        scale: scaleBand<number>()
          .domain(rows.map((r) => r.i))
          .padding(0.2),
        axis: false as const,
      },
      y: { scale: scaleLinear().domain([0, 11]), axis: false as const },
    },
    guides: false,
    margin: 0,
  }),
}

const el = document.getElementById('root')
if (el) createRoot(el).render(<Chart definition={definition} ariaLabel="probe" idPrefix="p" />)
