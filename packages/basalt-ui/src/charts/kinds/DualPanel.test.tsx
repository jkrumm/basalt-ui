/**
 * `DualPanel` — the bottom-pane domain seam (`bottomYDomain`/`bottomMaxAbsFloor`) and `formatBar`
 * (tooltip-row-only override, `formatBottom` keeps owning the ticks). Same SSR harness as
 * `ChartFrame.test.tsx` for the axis-only assertions (no hover needed); the `formatBar` case needs
 * a live cursor, so it uses the real DOM harness + the overlay's keyboard path (parity with
 * `Bars.test.tsx`) — DualPanel has two `HoverOverlay`s sharing one cursor, but only the TOP one is
 * keyboard-focusable, so `getByRole('slider')` is unambiguous.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { DualPanel } from './DualPanel'
import type { ChartSeries } from '../series'

type Row = { date: string; v: number; bar: number }

const rows: Row[] = [{ date: '2026-08-01', v: 10, bar: 0.02 }]

const series: ChartSeries<Row>[] = [
  { key: 'v', label: 'V', color: '#111', mark: 'line', getValue: (d) => d.v },
]

function renderStatic(bottomMaxAbsFloor?: number, bottomYDomain?: [number, number]): string {
  return renderToStaticMarkup(
    <DualPanel<Row>
      data={rows}
      chartId="dp-floor"
      getX={(d) => d.date}
      series={series}
      getBar={(d) => d.bar}
      barLabel="Bar"
      barColorPositive="#0a0"
      barColorNegative="#a00"
      formatTop={(v) => String(v)}
      formatBottom={(v) => v.toFixed(2)}
      {...(bottomMaxAbsFloor !== undefined && { bottomMaxAbsFloor })}
      {...(bottomYDomain !== undefined && { bottomYDomain })}
    />,
  )
}

describe('DualPanel — bottomMaxAbsFloor', () => {
  test('floors the symmetric max-abs so a near-zero plateau does not amplify to full height', () => {
    // The raw data's max abs is 0.02 — nowhere near the 0.5 floor, so "0.50" can only appear on
    // the bottom axis once the floor widens the domain.
    expect(renderStatic()).not.toContain('>0.50<')
    expect(renderStatic(0.5)).toContain('>0.50<')
  })
})

describe('DualPanel — per-point getMarker rendering', () => {
  test('renders exactly one circle per non-null marker, honouring color/r overrides', () => {
    const markerRows: Row[] = [
      { date: '2026-08-01', v: 10, bar: 0.02 },
      { date: '2026-08-02', v: 12, bar: 0.03 },
      { date: '2026-08-03', v: 9, bar: 0.01 },
    ]
    const markerSeries: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#111',
        mark: 'line',
        getValue: (d) => d.v,
        getMarker: (d) =>
          d.date === '2026-08-01'
            ? { color: '#f00', r: 9 }
            : d.date === '2026-08-03'
              ? { r: 3 }
              : null,
      },
    ]

    const { container } = render(
      <DualPanel<Row>
        data={markerRows}
        chartId="dp-markers"
        getX={(d) => d.date}
        series={markerSeries}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
      />,
    )

    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(2)
    expect(circles[0]?.getAttribute('fill')).toBe('#f00')
    expect(circles[0]?.getAttribute('r')).toBe('9')
    // No color override on the second marker — falls back to the series color.
    expect(circles[1]?.getAttribute('fill')).toBe('#111')
    expect(circles[1]?.getAttribute('r')).toBe('3')
  })
})

describe('DualPanel — fixed bottomYDomain ships verbatim (un-niced)', () => {
  test('bottom axis ticks come from the pinned domain, not the computed max-abs', () => {
    // Data's max abs is 0.02 — an auto domain would never produce a "5.00" tick. Pinning
    // bottomYDomain to [-5, 5] must still paint it.
    expect(renderStatic(undefined, [-5, 5])).toContain('>5.00<')
    expect(renderStatic()).not.toContain('>5.00<')
  })
})

describe('DualPanel — formatBar overrides only the tooltip row', () => {
  test('the bar tooltip row reads formatBar, not formatBottom', async () => {
    render(
      <DualPanel<Row>
        data={rows}
        chartId="dp-formatbar"
        getX={(d) => d.date}
        series={series}
        getBar={(d) => d.bar}
        barLabel="Bar"
        barColorPositive="#0a0"
        barColorNegative="#a00"
        formatTop={(v) => String(v)}
        formatBottom={(v) => v.toFixed(2)}
        formatBar={(v, d) => `${v.toFixed(3)} m/s (${d.date})`}
      />,
    )

    const slider = screen.getByRole('slider')
    fireEvent.keyDown(slider, { key: 'ArrowRight' })

    expect(await screen.findByText('0.020 m/s (2026-08-01)')).toBeTruthy()
  })
})
