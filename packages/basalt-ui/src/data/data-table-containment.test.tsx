/**
 * MEASURED CONTAINMENT — `stickyHeader` with neither `maxHeight` nor `minWidth`, the one table
 * shape whose overflow mode is a measurement rather than a declaration
 * (`useMeasuredContainment` in `data-table.tsx`).
 *
 * happy-dom evaluates no layout and ships no `ResizeObserver`, so both are replaced here (the
 * width descriptors are restored in `afterEach`): every element's width is whatever the test wrote
 * to `data-test-width`, and the stub observer's callbacks are fired by hand. That is what lets the
 * FLIP be tested at all rather than only in `tests/layout/data-table.layout.test.ts` — this file
 * owns the decision, that one owns the geometry it produces.
 *
 * The reversion half is the point. `useTrackFits` (`controls/panel-row.tsx`) latches one way on
 * purpose; this hook must not, because the wrapper has to go back to bare when the space returns —
 * the window widened, the sidebar collapsed, the aside closed.
 */
import { MantineProvider } from '@mantine/core'
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { resetValidatedProps } from '../common/validate'
import { BasaltDataTable } from './data-table'
import { createColumnHelper } from './table'

type Row = { project: string; cost: number }
const col = createColumnHelper<Row>()

const ROWS: Row[] = [
  { project: 'argo', cost: 12 },
  { project: 'linewatch', cost: 3 },
]

const COLUMNS = [
  col.accessor('project', { header: 'Project' }),
  col.accessor('cost', { header: 'Cost' }),
]

/** The stubbed layout: every element's width is whatever the test wrote to `data-test-width`. */
function widthFromData(this: HTMLElement): number {
  return Number(this.dataset['testWidth'] ?? '0')
}

const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
const nativeResizeObserver = window.ResizeObserver

let observers: (() => void)[] = []

function stubLayout(): void {
  observers = []
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: widthFromData,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: widthFromData,
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
}

afterEach(() => {
  if (offsetWidth !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offsetWidth)
  }
  if (clientWidth !== undefined) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
  }
  window.ResizeObserver = nativeResizeObserver
})

function mount(props: Record<string, unknown> = {}) {
  return render(
    <MantineProvider>
      <BasaltDataTable data={ROWS} columns={COLUMNS} stickyHeader {...props} />
    </MantineProvider>,
  )
}

function wrapperOf(container: HTMLElement): HTMLElement {
  const wrapper = container.querySelector('[data-contained]')
  if (!(wrapper instanceof HTMLElement)) {
    throw new Error('expected the measured containment wrapper')
  }
  return wrapper
}

/** Writes both measured widths and fires every stub observer, the way a real resize would. */
async function resizeTo(container: HTMLElement, wrapperWidth: number, tableWidth: number) {
  const wrapper = wrapperOf(container)
  const table = container.querySelector('table')
  if (!(table instanceof HTMLElement)) throw new Error('expected a table')
  wrapper.dataset['testWidth'] = String(wrapperWidth)
  table.dataset['testWidth'] = String(tableWidth)
  await act(async () => {
    for (const notify of observers) notify()
  })
}

describe('the wrapper flips on the measurement, in both directions', () => {
  test('a table wider than its wrapper contains itself, and reverts when the space returns', async () => {
    stubLayout()
    const { container } = mount()
    // Unmeasured is BARE — the SSR-safe default, and the state the first paint renders.
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('false')

    await resizeTo(container, 390, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')

    // The reversion, and the reason the observer is never latched: a contained table's
    // `offsetWidth` is still its min-content width, so the same comparison keeps answering.
    await resizeTo(container, 1440, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('false')
  })

  test('equality counts as FITS — the boundary that stops the two states oscillating', async () => {
    stubLayout()
    const { container } = mount()
    await resizeTo(container, 448, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('false')
    await resizeTo(container, 447, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')
  })

  test('a zero-width wrapper is UNKNOWN, not overflow — the un-laid-out ancestor chain', async () => {
    stubLayout()
    const { container } = mount()
    await resizeTo(container, 390, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')
    // A `clientWidth` of 0 is evidence the chain has not been laid out (the aside animating its
    // width in from 0), not evidence the table now fits. The state must not move on it.
    await resizeTo(container, 0, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')
  })

  test('a capped table never takes the wrapper at all — it has a real scroll container', () => {
    stubLayout()
    const { container } = mount({ maxHeight: 480 })
    expect(container.querySelector('[data-contained]')).toBeNull()
    expect(container.querySelector('.mantine-TableScrollContainer-scrollContainer')).not.toBeNull()
  })
})

describe('pinning takes the same wrapper — there is no third overflow box', () => {
  test('pinned + sticky + uncapped renders no inline overflow-x anywhere', () => {
    stubLayout()
    const { container } = mount({
      enablePinning: true,
      initialColumnPinning: { left: ['project'] },
    })
    // The defect this replaces: an `overflow-x: auto` Box around a page-sticky table is the exact
    // inert-sticky shape the measurement exists to avoid. A pinned column's offsets are
    // `position: sticky` on the cells and need no overflow box of their own.
    for (const element of container.querySelectorAll('[style]')) {
      expect(element.getAttribute('style') ?? '').not.toContain('overflow-x')
    }
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('false')
  })

  test('a pinned table still contains itself once measured too wide', async () => {
    stubLayout()
    const { container } = mount({
      enablePinning: true,
      initialColumnPinning: { left: ['project'] },
    })
    await resizeTo(container, 390, 448)
    expect(wrapperOf(container).getAttribute('data-contained')).toBe('true')
  })
})

describe('the dev warning names the trade, not a defect', () => {
  test('it states that the header sticks while the table fits, and points at maxHeight', () => {
    resetValidatedProps()
    const error = spyOn(console, 'error').mockImplementation(() => {})
    mount()
    expect(error).toHaveBeenCalledTimes(1)
    const message = String(error.mock.calls[0]?.[0])
    expect(message).toContain('"stickyHeader" with neither "maxHeight" nor "minWidth" sticks only')
    expect(message).toContain('FITS its container')
    expect(message).toContain('must both scroll and stick')
    // It no longer claims the shape widens the page — measurement is what stops that.
    expect(message).not.toContain('widens the whole page')
    error.mockRestore()
  })
})
