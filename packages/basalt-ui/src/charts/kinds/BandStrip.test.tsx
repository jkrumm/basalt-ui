/**
 * `BandStrip` — the four properties that make it a KIND rather than a rect loop: no left axis at
 * all (the reason `CartesianChart` cannot host it), the absence split a fold owes the reader, the
 * derived tooltip row, and the fold arithmetic itself.
 *
 * Under this DOM harness there is no ResizeObserver, so `ChartFrame` falls back to its `minWidth`
 * floor — `plot.width` is a fixed 200, which is what makes the fold/geometry assertions below
 * deterministic.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { ChartCursorScope } from '../cursor/scope'
import { BandStrip } from './BandStrip'
import type { BandStripSeries } from './BandStrip'

type Slot = { key: string; loss: number | null; folded: number; unmeasured: number }

const slot = (key: string, loss: number | null): Slot => ({
  key,
  loss,
  folded: 1,
  unmeasured: loss === null ? 1 : 0,
})

const SERIES: BandStripSeries<Slot>[] = [
  { key: 'clean', label: 'No loss', color: '#0a0', mark: 'bar', fillOpacity: 0.14 },
  {
    key: 'loss',
    label: 'Packet loss',
    color: '#a00',
    mark: 'bar',
    formatValue: (d) => `${d.loss?.toFixed(1)}%`,
  },
  { key: 'absent', label: 'Not measured', color: '#888', mark: 'bar', fillOpacity: 0.5 },
]

const getBand = (d: Slot) => ({
  state: d.loss === null ? 'absent' : d.loss > 0 ? 'loss' : 'clean',
  ...(d.unmeasured > 0 && d.loss !== null && { absentFraction: d.unmeasured / d.folded }),
})

function renderStrip(props: Partial<Parameters<typeof BandStrip<Slot>>[0]> = {}) {
  const data = props.data ?? [
    slot('2026-08-01', 0),
    slot('2026-08-02', 2.5),
    slot('2026-08-03', null),
  ]
  return render(
    <ChartCursorScope>
      <BandStrip<Slot>
        data={data}
        chartId="strip"
        getX={(d) => d.key}
        series={SERIES}
        getBand={getBand}
        height={120}
        {...props}
      />
    </ChartCursorScope>,
  )
}

describe('BandStrip — no numeric y axis', () => {
  test('renders a bottom axis and NO left axis — the one thing CartesianChart cannot express', () => {
    const { container } = renderStrip()
    expect(container.querySelector('.visx-axis-bottom')).not.toBeNull()
    expect(container.querySelector('.visx-axis-left')).toBeNull()
    expect(container.querySelector('.visx-axis-right')).toBeNull()
  })
})

describe('BandStrip — fills derive from series', () => {
  test('a band takes its state entry colour + fillOpacity; an explicit fill overrides only that band', () => {
    const { container } = renderStrip({
      getBand: (d: Slot) =>
        d.loss !== null && d.loss > 0
          ? { state: 'loss', fill: 'color-mix(in srgb, #a00 62%, transparent)' }
          : getBand(d),
    })
    const fills = [...container.querySelectorAll('rect[fill]')]
      .map((r) => r.getAttribute('fill'))
      .filter((f): f is string => f !== null && f !== 'transparent')

    // Derived: `alpha(color, fillOpacity)` for clean (0.14) and absent (0.5).
    expect(fills).toContain('color-mix(in srgb, #0a0 14%, transparent)')
    expect(fills).toContain('color-mix(in srgb, #888 50%, transparent)')
    // Overridden: the ramp value, not the series default.
    expect(fills).toContain('color-mix(in srgb, #a00 62%, transparent)')
  })
})

/**
 * The old contract here was "a state key absent from `series` draws nothing". On a strip whose
 * whole vocabulary is measured/not-measured, a missing band is not "unknown" — it is a coverage
 * gap, so a typo'd key silently asserted an absence nobody measured. These pin the replacement:
 * loud where it is a bug being written, honest where it is a feed that grew a state.
 */
/** Run `fn` with the production dev-gate, restoring whatever the runner had set. */
function inProd(fn: () => void): void {
  const previous = process.env['NODE_ENV']
  process.env['NODE_ENV'] = 'production'
  try {
    fn()
  } finally {
    if (previous === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = previous
  }
}

describe('BandStrip — an unresolvable state key can never read as absence', () => {
  test('a state naming no `series` entry THROWS in dev, naming the key and the known ones', () => {
    expect(() => renderStrip({ getBand: () => ({ state: 'nope' }) })).toThrow(
      /BandSpan.state "nope" names no `series` entry \(known: clean, loss, absent\)/,
    )
  })

  test('a marker naming no `series` entry throws in dev too', () => {
    expect(() =>
      renderStrip({ getBand: (d: Slot) => ({ ...getBand(d), marker: { state: 'typo' } }) }),
    ).toThrow(/BandSpan.marker.state "typo"/)
  })

  test('in production it draws a dashed neutral band — never nothing, never a state fill', () => {
    inProd(() => {
      const { container } = renderStrip({ getBand: () => ({ state: 'nope' }) })
      const painted = [...container.querySelectorAll('rect[fill]')].filter(
        (r) => r.getAttribute('fill') !== 'transparent',
      )
      expect(painted).toHaveLength(3)
      // The unknown treatment belongs to no legend entry: dashed outline, neutral fill, and none of
      // the three series colours.
      for (const rect of painted) {
        expect(rect.getAttribute('stroke-dasharray')).toBe('3 2')
        expect(rect.getAttribute('fill')).toBe(
          'color-mix(in srgb, var(--vx-neutral) 20%, transparent)',
        )
      }
    })
  })

  test('in production the tooltip names the unresolved key instead of a state the legend carries', async () => {
    process.env['NODE_ENV'] = 'production'
    try {
      renderStrip({ getBand: () => ({ state: 'nope' }), ariaLabel: 'Availability' })
      fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
      const tip = await screen.findByRole('tooltip')
      expect(tip.textContent).toContain('Unknown state')
      expect(tip.textContent).toContain('nope')
      expect(tip.textContent).not.toContain('Not measured')
    } finally {
      delete process.env['NODE_ENV']
    }
  })

  test('`absentState` naming no `series` entry throws in EVERY environment — it is a prop, not a datum', () => {
    inProd(() => {
      expect(() => renderStrip({ absentState: 'ghost' })).toThrow(
        /absentState "ghost" names no `series` entry/,
      )
    })
  })
})

describe('BandStrip — absenceFraction splits a folded band', () => {
  test('a part-measured band draws a measured rect + a hatch rect in proportion', () => {
    const partial: Slot = { key: '2026-08-01', loss: 1, folded: 4, unmeasured: 3 }
    const { container } = renderStrip({ data: [partial] })
    const painted = [...container.querySelectorAll('rect[fill]')].filter(
      (r) => r.getAttribute('fill') !== 'transparent',
    )
    expect(painted).toHaveLength(2)
    const measured = Number(painted[0]?.getAttribute('width'))
    const hatched = Number(painted[1]?.getAttribute('width'))
    // 3 of 4 members unmeasured → the hatch owns three quarters of the band.
    expect(hatched / (measured + hatched)).toBeCloseTo(0.75, 5)
    expect(painted[1]?.getAttribute('fill')).toBe('url(#strip-band-absent)')
    // The hatch starts where the measured share ends — not overlaid on it.
    expect(Number(painted[1]?.getAttribute('x'))).toBeCloseTo(
      Number(painted[0]?.getAttribute('x')) + measured,
      5,
    )
  })

  test('a non-finite share (a 0/0 fold count) draws a full band, never a NaN width', () => {
    const degenerate: Slot = { key: '2026-08-01', loss: 1, folded: 0, unmeasured: 0 }
    const { container } = renderStrip({ data: [degenerate] })
    expect(container.innerHTML).not.toContain('NaN')
    const painted = [...container.querySelectorAll('rect[fill]')].filter(
      (r) => r.getAttribute('fill') !== 'transparent',
    )
    expect(painted).toHaveLength(1)
    expect(Number(painted[0]?.getAttribute('width'))).toBeGreaterThan(0)
  })

  test('a fully absent band is all hatch and no fill', () => {
    const gone: Slot = { key: '2026-08-01', loss: 2, folded: 3, unmeasured: 3 }
    const { container } = renderStrip({ data: [gone] })
    const painted = [...container.querySelectorAll('rect[fill]')].filter(
      (r) => r.getAttribute('fill') !== 'transparent',
    )
    expect(painted).toHaveLength(1)
    expect(painted[0]?.getAttribute('fill')).toBe('url(#strip-band-absent)')
  })
})

describe('BandStrip — fold', () => {
  test('folds to the slots the measured width can draw, and the merge is the consumer’s', () => {
    const many = Array.from({ length: 240 }, (_, i) =>
      slot(`2026-08-${String((i % 28) + 1).padStart(2, '0')}T${String(i).padStart(3, '0')}`, i),
    )
    const merged: Slot[][] = []
    const { container } = renderStrip({
      data: many,
      fold: {
        merge: (group: Slot[]) => {
          merged.push(group)
          return {
            ...group[0]!,
            loss: Math.max(...group.map((g) => g.loss ?? 0)),
            folded: group.length,
            unmeasured: group.filter((g) => g.loss === null).length,
          }
        },
      },
    })
    // plot.width 200 → plotWidth ~132 → cap = floor(132 / 3) = 44 slots.
    const drawn = container.querySelectorAll('.visx-group rect[fill]:not([fill="transparent"])')
    expect(drawn.length).toBeGreaterThan(0)
    expect(drawn.length).toBeLessThan(many.length)
    expect(merged.length).toBe(drawn.length)
    // MAX, not mean — the merge the consumer wrote is the one that ran.
    expect(merged[0]!.length).toBeGreaterThan(1)
  })

  test('data that already fits is drawn unfolded and `merge` is never called', () => {
    let calls = 0
    renderStrip({ fold: { merge: (g: Slot[]) => (calls++, g[0]!) } })
    expect(calls).toBe(0)
  })
})

describe('BandStrip — the tooltip row is DERIVED from the hovered band’s state', () => {
  test('shows that state’s label + formatValue, and never a state it is not drawing', async () => {
    renderStrip({ ariaLabel: 'Availability' })
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('No loss')
    expect(tip.textContent).not.toContain('Packet loss')
    expect(tip.textContent).not.toContain('Not measured')

    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    expect(await screen.findByText('2.5%')).toBeTruthy()
    const tip2 = screen.getByRole('tooltip')
    expect(tip2.textContent).toContain('Packet loss')
    expect(tip2.textContent).not.toContain('No loss')
  })

  test('formatValue returning null renders an em dash, not an empty value', async () => {
    const series: BandStripSeries<Slot>[] = SERIES.map((entry) =>
      entry.key === 'absent'
        ? { ...entry, formatValue: (d: Slot) => (d.loss === null ? null : `${d.loss}%`) }
        : entry,
    )
    renderStrip({ series, ariaLabel: 'Availability' })
    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent).toContain('Not measured')
    // Distinct from `''`, which renders the label with no value at all.
    expect(tip.textContent).toContain('\u2014')
  })

  test('the focusable overlay carries the chart’s own aria-label, not a generic one', () => {
    renderStrip({ ariaLabel: 'Availability per bucket' })
    expect(screen.getByRole('slider').getAttribute('aria-label')).toBe('Availability per bucket')
  })
})
