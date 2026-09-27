/**
 * `useChartCursor`'s touch model (`docs/waves/RESPONSIVE-SPEC.md` §5): a coarse-pointer
 * `pointerdown` resolves + shows the readout immediately (no preceding `pointermove`) but is
 * PROVISIONAL — `pointerup` for the same pointer commits the pin, a `pointercancel` before commit
 * (a scroll winning the gesture) clears it, and a fresh tap elsewhere moves the pin. A committed
 * pin clears only via a `document` tap outside `boundaryRef`, a `document` scroll, or Escape.
 * Fine-pointer hover (mouse) stays byte-identical to the pre-existing behavior — the last case here
 * is the regression guard for that.
 *
 * A real DOM harness is required (not SSR): pointer events need a mounted element to dispatch on.
 * `HoverOverlay`'s transparent `<rect role="slider">` is reused verbatim as the wiring surface
 * rather than reimplementing it, so this exercises the same event plumbing every chart kind does.
 * happy-dom's `SVGSVGElement.getScreenCTM()` returns a point with no `matrixTransform`, so
 * `@visx/event`'s `localPoint` throws taking its real (CTM) branch — this file stubs
 * `getScreenCTM` to `null` for its own duration (restored after), which is what every OTHER chart
 * test's coordinate-blind assertions sidestep by only exercising the keyboard scrub path instead.
 * With the stub, `localPoint` falls back to its bounding-box branch: `coords.x - rect.left -
 * node.clientLeft`. happy-dom zeroes `getBoundingClientRect` (see `CartesianChart.test.tsx`) but
 * leaves `clientLeft`/`clientTop` `undefined` on an `SVGElement` (unlike a real browser's `0`),
 * which turns every resolved x into `NaN` — also stubbed here, to 0, for the same reason. With both
 * stubs `event.clientX` reaches `useChartCursor` as the plot-local x untouched, which is what lets
 * `clientX` alone select a different point below.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { useRef } from 'react'
import type { RefObject } from 'react'
import { ChartCursorScope } from '../cursor/scope'
import { HoverOverlay } from '../primitives/HoverOverlay'
import { useChartCursor } from './useChartCursor'

let nativeGetScreenCTM: typeof SVGSVGElement.prototype.getScreenCTM

beforeAll(() => {
  nativeGetScreenCTM = SVGSVGElement.prototype.getScreenCTM
  SVGSVGElement.prototype.getScreenCTM = () => null
  Object.defineProperty(SVGElement.prototype, 'clientLeft', { configurable: true, value: 0 })
  Object.defineProperty(SVGElement.prototype, 'clientTop', { configurable: true, value: 0 })
})

afterAll(() => {
  SVGSVGElement.prototype.getScreenCTM = nativeGetScreenCTM
  delete (SVGElement.prototype as { clientLeft?: number }).clientLeft
  delete (SVGElement.prototype as { clientTop?: number }).clientTop
})

type Row = { date: string; x: number }

const rows: Row[] = [
  { date: '2026-08-01', x: 0 },
  { date: '2026-08-02', x: 100 },
  { date: '2026-08-03', x: 200 },
]

/** Minimal harness: one chart wired the same way every kind wires `useChartCursor` + `HoverOverlay`,
 * with the resolved point and `isTouch` read back through plain text nodes for assertions. */
function TestChart({
  chartId,
  boundary,
}: {
  chartId: string
  /** Renders an outer boundary element and passes its ref as `boundaryRef` — opt-in per test so the
   * no-`boundaryRef` call sites (BandStrip/MirroredBars-style) stay covered too. */
  boundary?: boolean
}) {
  const boundaryRef = useRef<HTMLDivElement>(null)
  const cursor = useChartCursor<Row>({
    data: rows,
    chartId,
    getKey: (d) => d.date,
    xScale: (key) => rows.find((r) => r.date === key)?.x,
    marginLeft: 0,
    ...(boundary === true && { boundaryRef: boundaryRef as RefObject<Element | null> }),
  })

  return (
    <div ref={boundaryRef}>
      <svg>
        <HoverOverlay
          width={200}
          height={100}
          onMove={cursor.onPointerMove}
          onDown={cursor.onPointerDown}
          onUp={cursor.onPointerUp}
          onLeave={cursor.onPointerLeave}
          onKeyDown={cursor.onKeyDown}
          onBlur={cursor.onBlur}
          ariaLabel={chartId}
        />
      </svg>
      <output data-testid={`point-${chartId}`}>{cursor.point?.date ?? 'none'}</output>
      <output data-testid={`touch-${chartId}`}>{String(cursor.isTouch)}</output>
    </div>
  )
}

function renderChart(chartId: string, boundary?: boolean) {
  render(
    <ChartCursorScope>
      <TestChart chartId={chartId} {...(boundary !== undefined && { boundary })} />
    </ChartCursorScope>,
  )
  return screen.getByRole('slider', { name: chartId })
}

describe('useChartCursor — coarse pointer (touch)', () => {
  test('pointerdown resolves + shows the tooltip immediately, with no prior pointermove', () => {
    const overlay = renderChart('touch-down')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    expect(screen.getByTestId('point-touch-down').textContent).toBe('2026-08-01')
  })

  test('a completed tap (pointerdown + pointerup) leaves the cursor PINNED', () => {
    const overlay = renderChart('touch-lift')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-lift').textContent).toBe('2026-08-01')
  })

  test('pointercancel for the SAME uncommitted pointer (a scroll) clears the readout', () => {
    const overlay = renderChart('touch-cancel')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    expect(screen.getByTestId('point-touch-cancel').textContent).toBe('2026-08-01')
    fireEvent.pointerCancel(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-cancel').textContent).toBe('none')
  })

  test('pointercancel AFTER commit is a no-op', () => {
    const overlay = renderChart('touch-cancel-after')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerCancel(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-cancel-after').textContent).toBe('2026-08-01')
  })

  test('pointerleave while pinned by touch is a no-op, but clears an uncommitted press', () => {
    const overlay = renderChart('touch-leave')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerLeave(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-leave').textContent).toBe('2026-08-01')

    const fresh = renderChart('touch-leave-uncommitted')
    fireEvent.pointerDown(fresh, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerLeave(fresh, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-leave-uncommitted').textContent).toBe('none')
  })

  test('a second pointerdown elsewhere in the chart moves the pin', () => {
    const overlay = renderChart('touch-move-pin')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-move-pin').textContent).toBe('2026-08-01')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 0 })
    expect(screen.getByTestId('point-touch-move-pin').textContent).toBe('2026-08-03')
  })

  test('a document pointerdown outside boundaryRef clears the pin', () => {
    const overlay = renderChart('touch-outside', true)
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-outside').textContent).toBe('2026-08-01')

    fireEvent.pointerDown(document.body)
    expect(screen.getByTestId('point-touch-outside').textContent).toBe('none')
  })

  test('a document scroll clears a committed pin', () => {
    const overlay = renderChart('touch-scroll', true)
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-scroll').textContent).toBe('2026-08-01')

    fireEvent.scroll(document)
    expect(screen.getByTestId('point-touch-scroll').textContent).toBe('none')
  })

  test('a document Escape keydown clears a committed pin without overlay focus', () => {
    const overlay = renderChart('touch-doc-escape', true)
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-doc-escape').textContent).toBe('2026-08-01')

    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getByTestId('point-touch-doc-escape').textContent).toBe('none')
  })

  test('with no boundaryRef, outside-dismiss is skipped rather than throwing', () => {
    const overlay = renderChart('touch-no-boundary', false)
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    expect(screen.getByTestId('point-touch-no-boundary').textContent).toBe('2026-08-01')

    fireEvent.pointerDown(document.body)
    expect(screen.getByTestId('point-touch-no-boundary').textContent).toBe('2026-08-01')
  })

  test('Escape clears the pin regardless of pointer type', () => {
    const overlay = renderChart('touch-escape')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    expect(screen.getByTestId('point-touch-escape').textContent).toBe('2026-08-01')

    fireEvent.keyDown(overlay, { key: 'Escape' })
    expect(screen.getByTestId('point-touch-escape').textContent).toBe('none')
  })

  test('exposes isTouch true after a touch interaction', () => {
    const overlay = renderChart('touch-flag')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    expect(screen.getByTestId('touch-touch-flag').textContent).toBe('true')
  })
})

describe('useChartCursor — fine pointer (mouse), regression', () => {
  test('hover shows and moves the tooltip; leave clears it', () => {
    const overlay = renderChart('mouse-hover')
    fireEvent.pointerMove(overlay, { pointerType: 'mouse', clientX: 0, clientY: 0 })
    expect(screen.getByTestId('point-mouse-hover').textContent).toBe('2026-08-01')
    expect(screen.getByTestId('touch-mouse-hover').textContent).toBe('false')

    fireEvent.pointerMove(overlay, { pointerType: 'mouse', clientX: 200, clientY: 0 })
    expect(screen.getByTestId('point-mouse-hover').textContent).toBe('2026-08-03')

    fireEvent.pointerLeave(overlay)
    expect(screen.getByTestId('point-mouse-hover').textContent).toBe('none')
  })

  test('pointercancel clears a mouse-hovered cursor (no pin to protect)', () => {
    const overlay = renderChart('mouse-cancel')
    fireEvent.pointerMove(overlay, { pointerType: 'mouse', clientX: 0, clientY: 0 })
    expect(screen.getByTestId('point-mouse-cancel').textContent).toBe('2026-08-01')

    fireEvent.pointerCancel(overlay)
    expect(screen.getByTestId('point-mouse-cancel').textContent).toBe('none')
  })
})
