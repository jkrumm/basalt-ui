/**
 * `useChartCursor`'s touch model (`docs/CHARTS-SPEC.md` §4, Tooltip): a coarse-pointer
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  test('a cancelled SECOND press restores the previously committed pin instead of dropping it', () => {
    const overlay = renderChart('touch-cancel-restore')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-touch-cancel-restore').textContent).toBe('2026-08-01')

    // A second tap elsewhere is provisional — it moves the pin's DISPLAY immediately…
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 2, clientX: 200, clientY: 0 })
    expect(screen.getByTestId('point-touch-cancel-restore').textContent).toBe('2026-08-03')

    // …but the browser taking THIS press as a scroll must restore the FIRST point's committed pin,
    // not drop it — the R2C-1/P0-2 regression this test pins.
    fireEvent.pointerCancel(overlay, { pointerType: 'touch', pointerId: 2 })
    expect(screen.getByTestId('point-touch-cancel-restore').textContent).toBe('2026-08-01')
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
  test('hover shows and moves the tooltip; leave clears it', async () => {
    const overlay = renderChart('mouse-hover')
    // `onPointerMove`'s nearest-point search is coalesced to one per animation frame (the O(n)
    // resolve, not just the anchor `scheduleAnchor` already batched) — `waitFor` rather than a
    // synchronous assertion, matching every other `requestAnimationFrame`-coalesced read in this
    // file's siblings (`Bars.test.tsx`).
    fireEvent.pointerMove(overlay, { pointerType: 'mouse', clientX: 0, clientY: 0 })
    await waitFor(() =>
      expect(screen.getByTestId('point-mouse-hover').textContent).toBe('2026-08-01'),
    )
    expect(screen.getByTestId('touch-mouse-hover').textContent).toBe('false')

    fireEvent.pointerMove(overlay, { pointerType: 'mouse', clientX: 200, clientY: 0 })
    await waitFor(() =>
      expect(screen.getByTestId('point-mouse-hover').textContent).toBe('2026-08-03'),
    )

    fireEvent.pointerLeave(overlay)
    expect(screen.getByTestId('point-mouse-hover').textContent).toBe('none')
  })

  test('pointercancel clears a mouse-hovered cursor (no pin to protect)', async () => {
    const overlay = renderChart('mouse-cancel')
    fireEvent.pointerMove(overlay, { pointerType: 'mouse', clientX: 0, clientY: 0 })
    await waitFor(() =>
      expect(screen.getByTestId('point-mouse-cancel').textContent).toBe('2026-08-01'),
    )

    fireEvent.pointerCancel(overlay)
    expect(screen.getByTestId('point-mouse-cancel').textContent).toBe('none')
  })
})

/** Two charts sharing ONE cursor store — the handoff scenario `pinnedRef`'s ownership reset guards. */
function renderTwoCharts(a: string, b: string): { overlayA: HTMLElement; overlayB: HTMLElement } {
  render(
    <ChartCursorScope>
      <TestChart chartId={a} />
      <TestChart chartId={b} />
    </ChartCursorScope>,
  )
  return {
    overlayA: screen.getByRole('slider', { name: a }),
    overlayB: screen.getByRole('slider', { name: b }),
  }
}

describe('useChartCursor — pinnedRef stays scoped to actual ownership', () => {
  test('(a) a touch pin committed on this chart survives a later mouse pointermove on the SAME chart', () => {
    const overlay = renderChart('pin-survives-hover')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-pin-survives-hover').textContent).toBe('2026-08-01')

    // A mouse hover must not override the committed touch pin — this chart still owns the source.
    fireEvent.pointerMove(overlay, { pointerType: 'mouse', clientX: 200, clientY: 0 })
    expect(screen.getByTestId('point-pin-survives-hover').textContent).toBe('2026-08-01')
  })

  test("(b) a mouse pointerup carrying an in-flight touch press's pointerId does not commit it", () => {
    const overlay = renderChart('alias-pointer-id')
    fireEvent.pointerDown(overlay, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    expect(screen.getByTestId('point-alias-pointer-id').textContent).toBe('2026-08-01')

    // Some browsers alias a touch pointer's id to the same value (1) a mouse pointer uses — an
    // unrelated mouse pointerup carrying that id must not commit the still-provisional touch press.
    fireEvent.pointerUp(overlay, { pointerType: 'mouse', pointerId: 1 })
    // Proof it never committed: the ORIGINAL touch pointer's own cancel still finds a live,
    // uncommitted press to cancel (restoring/clearing it) — a no-op here would mean the mouse
    // pointerup had already committed it.
    fireEvent.pointerCancel(overlay, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-alias-pointer-id').textContent).toBe('none')
  })

  /**
   * (c) The regression this fix closes. `pinnedRef` used to be cleared only by this chart's own
   * `clear()`, so a sibling stealing the shared cursor source never reset it. The first mouse hover
   * on A after the steal still resolves (the guard's OTHER condition, `store.get().source ===
   * chartId`, is false while B still owns it) and reclaims `source` for A — but with `pinnedRef`
   * left stale-`true`, that reclaim makes the guard's ownership condition true again, and every
   * hover AFTER that first one is silently swallowed: the crosshair freezes at wherever that first
   * reclaim landed.
   */
  test('(c) two-chart handoff: A pins by touch, B steals the shared cursor, then mouse hovers on A keep tracking', async () => {
    const { overlayA, overlayB } = renderTwoCharts('handoff-a', 'handoff-b')

    fireEvent.pointerDown(overlayA, { pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerUp(overlayA, { pointerType: 'touch', pointerId: 1 })
    expect(screen.getByTestId('point-handoff-a').textContent).toBe('2026-08-01')

    // B steals the shared cursor source with its own touch tap.
    fireEvent.pointerDown(overlayB, {
      pointerType: 'touch',
      pointerId: 2,
      clientX: 200,
      clientY: 0,
    })
    fireEvent.pointerUp(overlayB, { pointerType: 'touch', pointerId: 2 })
    await waitFor(() =>
      expect(screen.getByTestId('point-handoff-b').textContent).toBe('2026-08-03'),
    )

    // First hover after the steal: resolves and reclaims `source` for A (this much worked even with
    // the bug, since the guard's ownership half was still false going in).
    fireEvent.pointerMove(overlayA, { pointerType: 'mouse', clientX: 0, clientY: 0 })
    await waitFor(() =>
      expect(screen.getByTestId('point-handoff-a').textContent).toBe('2026-08-01'),
    )

    // Second hover, a genuinely different position: with the bug this froze at the first reclaim's
    // point (A now "owns" source again, and the stale `pinnedRef` made the guard block it). Fixed,
    // it tracks like any ordinary mouse hover.
    fireEvent.pointerMove(overlayA, { pointerType: 'mouse', clientX: 200, clientY: 0 })
    await waitFor(() =>
      expect(screen.getByTestId('point-handoff-a').textContent).toBe('2026-08-03'),
    )
  })
})
