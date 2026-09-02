/**
 * `PanelChoice`'s width gate (`panel-row.tsx`'s `useTrackFits` doc, `docs/CONTROLS-SPEC.md` §3 next
 * to `PANEL_TRACK_MAX`) — the count cap is the cheap first gate, this is the actual law: a track
 * renders only when it measurably fits the space its layout parent actually offers, and REVERTS to
 * one when that space grows enough again (`useTrackFits` is a live toggle, not a one-way latch).
 * "Fits" is TWO signals, not one (`measureMounted`'s own doc): the root not overflowing its layout
 * parent, AND no rendered LABEL overflowing its own equal-share column — the second signal is what
 * catches a `fullWidth` track whose ctl-tier label (`width: 100%`, needed for the FIRST signal to
 * even measure a real floor) makes the browser's own `min-width: max-content` on the root
 * measurably fail to grow past its available space ("Week"/"Absolute" clipped inside their column
 * with the root still reading as fitting its parent).
 *
 * happy-dom lays nothing out, so `offsetWidth`/`clientWidth`/`scrollWidth` are 0 for every element
 * by default — a `clientWidth` of `0` reads as `'unknown'` (not yet laid out, `useTrackFits`'s own
 * three-valued check), which is why every OTHER test in this folder that renders a `PanelChoice`
 * inside its count cap sees a track. The overflow case has to be driven by hand: stub the three
 * properties on `HTMLElement.prototype` (same technique `filter-set.test.tsx` uses), restored in
 * `afterEach` so no other test inherits the stub. Recovery additionally needs a REAL resize
 * notification — happy-dom's `ResizeObserver` never fires on its own (no layout engine behind it),
 * so the growth case stubs the global constructor too, capturing each hook's callback to invoke by
 * hand (`filter-set.test.tsx`'s own `ResizeObserverStub` pattern for the desktop fold).
 */
import { MantineProvider } from '@mantine/core'
import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { PanelChoice } from './panel-row'

const OPTIONS = [
  { value: 'none', label: 'No comparison' },
  { value: 'previous', label: 'Previous period' },
  { value: 'year', label: 'Same period last year' },
]

function mount(node: ReactNode): void {
  render(<MantineProvider>{node}</MantineProvider>)
}

// Saved once, restored in `afterEach` — `Reflect.deleteProperty` would remove the descriptor
// happy-dom itself installed rather than reveal it, leaving `offsetWidth`/`clientWidth` `undefined`
// for every test that runs after this file (same pattern `filter-set.test.tsx` uses).
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')

/** `offsetWidth` wider than `clientWidth` on every element — a confident, uniform "does not fit"
 *  reading regardless of which node in the tree `useTrackFits` measures (the ROOT-vs-parent
 *  signal). */
function stubOverflow(offsetWidth: number, clientWidth: number): void {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => offsetWidth,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => clientWidth,
  })
}

/**
 * The OTHER signal: the root fits its parent (a uniform, non-zero width on every element BUT a
 * rendered option label), yet a label's own `scrollWidth` exceeds its `clientWidth` — the phone-
 * tier case `measureMounted`'s doc describes, where `min-width: max-content` measurably fails to
 * grow the root past its available space. Matched by class, not by node identity, since the
 * `.label` elements do not exist until `PanelChoice` renders.
 */
function stubLabelOverflowOnly(): void {
  const LABEL_CLASS = 'mantine-SegmentedControl-label'
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 100,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains(LABEL_CLASS) ? 50 : 100
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains(LABEL_CLASS) ? 60 : 100
    },
  })
}

afterEach(() => {
  if (originalOffsetWidth !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
  }
  if (originalClientWidth !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
  }
  if (originalScrollWidth !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth)
  }
})

describe('PanelChoice — the width gate under PANEL_TRACK_MAX', () => {
  test('every label fits (the happy-dom default, 0×0 reads as unknown): renders the track', () => {
    mount(
      <PanelChoice
        nameProps={{ 'aria-label': 'Compare' }}
        value="none"
        options={OPTIONS}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('radiogroup', { name: 'Compare' })).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  test('the root overflows its layout parent: falls back to Select, never a clipped track', () => {
    stubOverflow(200, 80)
    mount(
      <PanelChoice
        nameProps={{ 'aria-label': 'Compare' }}
        value="none"
        options={OPTIONS}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Compare' })).toBeDefined()
  })

  test('a label overflows its own column while the ROOT still reads as fitting: falls back to Select too', () => {
    // The regression this pins: `min-width: max-content` on the root measurably fails to grow it
    // past its available space once the ctl-tier label carries `width: 100%` (`theme/index.ts`'s
    // own doc on `SegmentedControl.extend`) — "Week"/"Absolute" clipped inside their equal column
    // ("Wee", "Absolut") while `root.offsetWidth <= parent.clientWidth` alone would have read
    // `'fits'`. Only the per-label signal in `measureMounted` catches it.
    stubLabelOverflowOnly()
    mount(
      <PanelChoice
        nameProps={{ 'aria-label': 'Compare' }}
        value="none"
        options={OPTIONS}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Compare' })).toBeDefined()
  })

  describe('the parent widening again reverts Select back to a track', () => {
    const originalResizeObserver = window.ResizeObserver
    let observers: (() => void)[] = []

    afterEach(() => {
      window.ResizeObserver = originalResizeObserver
    })

    test('overflow degrades to Select, then a parent-width increase re-arms the track', async () => {
      observers = []
      // 200 vs 80: overflow, same as the test above — but `clientWidth` is read off a MUTABLE
      // box so the test can widen it later without remounting.
      const box = { clientWidth: 80 }
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        configurable: true,
        get: () => 200,
      })
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get: () => box.clientWidth,
      })
      class ResizeObserverStub {
        constructor(callback: () => void) {
          observers.push(callback)
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      }
      window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver

      mount(
        <PanelChoice
          nameProps={{ 'aria-label': 'Compare' }}
          value="none"
          options={OPTIONS}
          onChange={() => {}}
        />,
      )
      expect(screen.queryByRole('radiogroup')).toBeNull()
      expect(screen.getByRole('combobox', { name: 'Compare' })).toBeDefined()

      // The parent grows past the track's remembered natural width (200) — `useTrackFits` has
      // no live track to re-read `offsetWidth` from while `Select` is mounted, which is exactly
      // what `trackWidthRef` (the width remembered from before it unmounted) exists to answer.
      box.clientWidth = 250
      await act(async () => {
        for (const notify of observers) notify()
      })

      expect(screen.queryByRole('combobox', { name: 'Compare' })).toBeNull()
      expect(screen.getByRole('radiogroup', { name: 'Compare' })).toBeDefined()
    })
  })

  test('past PANEL_TRACK_MAX the count gate alone already renders Select — no measurement needed', () => {
    // 0×0 (reads as unknown, so the track would otherwise stand), yet a 4-option set still renders
    // Select: the count cap short-circuits before `useTrackFits` ever measures anything.
    mount(
      <PanelChoice
        nameProps={{ 'aria-label': 'Currency' }}
        value="usd"
        options={[
          { value: 'usd', label: 'USD' },
          { value: 'eur', label: 'EUR' },
          { value: 'gbp', label: 'GBP' },
          { value: 'jpy', label: 'JPY' },
        ]}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Currency' })).toBeDefined()
  })
})
