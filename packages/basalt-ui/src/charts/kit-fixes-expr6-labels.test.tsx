/**
 * Expression cycle 6, reference-line captions: a caption with no free spot at one end of its rule
 * takes the other end before it drops, and the drawn rule is an obstacle to `chartLabels.place`.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { chartLabels } from './chart-labels'
import { hostObstacles } from './label-obstacles'
import { CartesianChart } from './parts/cartesian'
import type { ChartPlot } from './contract'
import { placeRefLabel } from './ref-label'

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

const base = {
  pinned: undefined,
  startFirst: false,
  value: 50,
  domain: [0, 100] as const,
  plotWidth: 400,
  plotHeight: 200,
  label: 'Median',
  fontSize: 11,
  series: [],
}

describe('refLines caption, other end', () => {
  test('both spots at the anchor end blocked: the caption takes the rule other end', () => {
    // Every end spot (above and below the rule) meets a claimed box at the right edge.
    const claimed = [{ fx0: 0.7, fx1: 1, y0: 0, y1: 100 }]
    const placed = placeRefLabel({ ...base, claimed })
    expect(placed?.position.startsWith('start')).toBe(true)
  })

  test('a pinned end that is blocked yields to the other end, not to a drop', () => {
    const claimed = [{ fx0: 0, fx1: 0.3, y0: 0, y1: 100 }]
    const placed = placeRefLabel({ ...base, pinned: 'start-above', claimed })
    expect(placed?.position.startsWith('end')).toBe(true)
  })

  test('both ends blocked: dropped', () => {
    const claimed = [{ fx0: 0, fx1: 1, y0: 0, y1: 100 }]
    expect(placeRefLabel({ ...base, claimed })).toBeNull()
  })
})

describe('the drawn rule is an obstacle to place', () => {
  const DATA = [1, 2, 3, 4]
  test('a label centred on the rule is dropped and one off it lands', async () => {
    const seen: {
      plot: ChartPlot<number>
      obstacles: ReturnType<typeof hostObstacles>
      inside: ReturnType<typeof chartLabels.place>
      off: ReturnType<typeof chartLabels.place>
    }[] = []
    const marks = CartesianChart.custom<number>((plot) => {
      const frame = { width: plot.plotWidth, height: plot.plotHeight }
      const y = plot.y(50)
      seen.push({
        plot,
        obstacles: [...hostObstacles()],
        // Both spots of `spots: ['right']` are centred on the anchor: the rule runs through them.
        inside: chartLabels.place(
          [{ key: 'on', text: 'Limit', x: plot.plotWidth / 2, y, spots: ['right'] }],
          frame,
        ),
        off: chartLabels.place(
          [{ key: 'off', text: 'Limit', x: plot.plotWidth / 2, y, spots: ['above'] }],
          frame,
        ),
      })
      return []
    })
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () =>
      root?.render(
        <CartesianChart<number>
          label="Rule"
          data={DATA}
          x={{ value: (d) => d }}
          series={[
            {
              key: 'v',
              label: 'V',
              color: { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' },
              mark: 'line',
              y: (d) => d * 10 + 100,
            },
          ]}
          y={{ domain: [0, 200] }}
          refLines={[
            {
              value: 50,
              label: 'Limit',
              axis: 'left',
              color: { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' },
            },
          ]}
          marks={marks}
        />,
      ),
    )
    await act(async () => new Promise((r) => setTimeout(r, 20)))
    const last = seen.at(-1)
    if (last === undefined) throw new Error('the builder never ran')
    const y = last.plot.y(50)
    expect(
      last.obstacles.some(
        (b) => b.left === 0 && b.width === last.plot.plotWidth && b.top < y && b.top + b.height > y,
      ),
    ).toBe(true)
    expect(last.inside.dropped.map((l) => l.key)).toEqual(['on'])
    expect(last.off.placed.map((l) => l.key)).toEqual(['off'])
  })
})
