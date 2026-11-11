// oxlint-disable basalt/chart-host-single -- byte probe: measures the bare engine mount, never shipped
import { Chart } from '@tanstack/charts/react'
import { lineY } from '@tanstack/charts/line'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { createRoot } from 'react-dom/client'

const rows = Array.from({ length: 30 }, (_, i) => ({ i, v: Math.sin(i / 4) * 10 }))

const definition = {
  chart: () => ({
    marks: [lineY(rows, { id: 'line', x: 'i', y: 'v', stroke: 'currentColor' })],
    scales: {
      x: { scale: scaleLinear().domain([0, 29]), axis: false as const },
      y: { scale: scaleLinear().domain([-10, 10]), axis: false as const },
    },
    guides: false,
    margin: 0,
  }),
}

const el = document.getElementById('root')
if (el) createRoot(el).render(<Chart definition={definition} ariaLabel="probe" idPrefix="p" />)
