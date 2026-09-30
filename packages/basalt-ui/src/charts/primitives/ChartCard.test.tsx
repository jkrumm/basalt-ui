/**
 * `ChartCard`'s header — the `''`-as-hidden-header sentinel is gone (docs/CONTROLS-SPEC.md §2.2):
 * the header now renders only when at least one of title/info/value/actions/icon/count is set.
 * Mantine-free (`src/charts/**`), so no `MantineProvider` wrapper is needed — mirrors
 * `ChartFrame.test.tsx`'s rationale.
 */
import { render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { StrictMode } from 'react'
import { resetValidatedProps } from '../../common/validate'
import type { SeriesStyle } from '../series'
import { ChartCard } from './ChartCard'
import { ChartFrame } from './ChartFrame'

describe('the header renders only when it has something to show', () => {
  test('nothing set — no heading at all', () => {
    render(
      <ChartCard>
        <svg />
      </ChartCard>,
    )
    expect(screen.queryByRole('heading')).toBeNull()
  })

  test('title alone renders the h3', () => {
    render(
      <ChartCard title="Revenue over time">
        <svg />
      </ChartCard>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Revenue over time' })).toBeDefined()
  })

  test('count alone (no title) still renders the header, with an empty title', () => {
    render(
      <ChartCard count={4}>
        <svg />
      </ChartCard>,
    )
    expect(screen.getByText('4')).toBeDefined()
  })

  test('value alone renders the header', () => {
    render(
      <ChartCard value="$12,483">
        <svg />
      </ChartCard>,
    )
    expect(screen.getByText('$12,483')).toBeDefined()
  })

  test('actions alone renders the header, carrying data-basalt-tier="widget"', () => {
    const { container } = render(
      <ChartCard actions={<button type="button">Export</button>}>
        <svg />
      </ChartCard>,
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeDefined()
    expect(container.querySelector('[data-basalt-tier="widget"]')).not.toBeNull()
  })

  test('subtitle alone does NOT render the header', () => {
    render(
      <ChartCard subtitle="Net revenue per day">
        <svg />
      </ChartCard>,
    )
    expect(screen.queryByText('Net revenue per day')).toBeNull()
  })
})

describe('the card chrome', () => {
  test('root is a `basalt-card` inline-size container and a flex column; the body takes spare height', () => {
    const { container } = render(
      <ChartCard title="Revenue">
        <svg />
      </ChartCard>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.style.containerType).toBe('inline-size')
    expect(root.style.containerName).toBe('basalt-card')
    expect(root.style.display).toBe('flex')
    expect(root.style.flexDirection).toBe('column')
    const body = root.lastElementChild as HTMLElement
    expect(body.style.flex).toBe('1 1 auto')
    expect(body.style.minHeight).toBe('0')
    expect(body.style.display).toBe('flex')
    expect(body.style.flexDirection).toBe('column')
  })

  test('an empty legend slot sits in the header band only when there is a header', () => {
    const withHeader = render(
      <ChartCard title="Revenue">
        <svg />
      </ChartCard>,
    )
    expect(withHeader.container.querySelectorAll('[data-basalt-legend-slot]')).toHaveLength(1)
    withHeader.unmount()
    const bare = render(
      <ChartCard>
        <svg />
      </ChartCard>,
    )
    expect(bare.container.querySelector('[data-basalt-legend-slot]')).toBeNull()
  })
})

describe('state replaces the body with a placeholder, header stays put', () => {
  const BODY = 'CHART_BODY_MARKER'

  test('pending: no children, header stays, aria-busy on the root', () => {
    const { container } = render(
      <ChartCard title="Revenue over time" state={{ pending: true }} placeholderHeight={320} />,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Revenue over time' })).toBeDefined()
    expect(screen.queryByText(BODY)).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  test('a title-less pending card is a valid Suspense fallback', () => {
    render(<ChartCard state={{ pending: true }} placeholderHeight={320} />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  test('empty with a string label renders that copy, not the "No data" default', () => {
    render(
      <ChartCard title="Strength Scan" state={{ empty: 'No data — start logging workouts.' }}>
        {BODY}
      </ChartCard>,
    )
    expect(screen.getByText('No data — start logging workouts.')).toBeDefined()
    expect(screen.queryByText(BODY)).toBeNull()
  })

  test('error renders the thrown message and is not aria-busy', () => {
    const { container } = render(
      <ChartCard title="Revenue over time" state={{ error: new Error('boom') }}>
        {BODY}
      </ChartCard>,
    )
    expect(screen.getByText('boom')).toBeDefined()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  test('state={{}} (all-falsy) renders children unchanged, same as omitting the prop', () => {
    render(
      <ChartCard title="Revenue over time" state={{}}>
        {BODY}
      </ChartCard>,
    )
    expect(screen.getByText(BODY)).toBeDefined()
  })

  test('stateAction renders under the empty placeholder', () => {
    render(
      <ChartCard state={{ empty: true }} stateAction={<button type="button">Clear filters</button>}>
        {BODY}
      </ChartCard>,
    )
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeDefined()
  })
})

/**
 * The wave-5 legend slot now has its consumer: a frame inside a headed card portals its legend into
 * `[data-basalt-legend-slot]` once the slot is measured. Needs a shim that reports a box on
 * `observe()` (the shared preload's observer is inert) — restored afterwards.
 */
describe('the legend portals into the header slot', () => {
  const originalResizeObserver = window.ResizeObserver
  const many: SeriesStyle[] = Array.from({ length: 8 }, (_, i) => ({
    key: `s${i}`,
    label: `Series number ${i}`,
    color: '#000',
    mark: 'line',
  }))

  function installObserver(width: number): void {
    class FixedBoxResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback(
          [{ contentRect: { width, height: 240, top: 0, left: 0 } }] as never,
          this as never,
        )
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = FixedBoxResizeObserver as unknown as typeof ResizeObserver
  }

  beforeAll(() => installObserver(600))
  afterAll(() => {
    window.ResizeObserver = originalResizeObserver
  })

  test('a headed card hosts the legend in its slot; dots mode fits by pitch, so all 8 fit with no All N chip (R2C-9)', async () => {
    const { container } = render(
      <ChartCard title="Revenue">
        <ChartFrame series={many} height={240}>
          {() => <svg />}
        </ChartFrame>
      </ChartCard>,
    )
    const slot = container.querySelector('[data-basalt-legend-slot]') as HTMLElement
    await waitFor(() => expect(slot.querySelector('[data-legend-key]')).not.toBeNull())
    // The card is short (the ResizeObserver shim reports 240px < 280), so the header legend folds to
    // dots — measured at the dot's own pitch (R2C-9), not a chip's swatch+label width, which is
    // narrow enough that all 8 series fit in one 600px row with nothing left to roll up.
    expect(screen.queryByRole('button', { name: 'All 8' })).toBeNull()
    expect(slot.querySelectorAll('[data-legend-key]').length).toBe(8)
    // The band under the plot is gone — the legend exists once.
    expect(container.querySelectorAll('[data-legend-key]').length).toBe(
      slot.querySelectorAll('[data-legend-key]').length,
    )
  })

  test('once a header slot genuinely cannot fit every dot, the overflow folds into All N', async () => {
    const twenty: SeriesStyle[] = Array.from({ length: 20 }, (_, i) => ({
      key: `s${i}`,
      label: `Series number ${i}`,
      color: '#000',
      mark: 'line',
    }))
    const { container } = render(
      <ChartCard title="Revenue">
        <ChartFrame series={twenty} height={240}>
          {() => <svg />}
        </ChartFrame>
      </ChartCard>,
    )
    const slot = container.querySelector('[data-basalt-legend-slot]') as HTMLElement
    await waitFor(() => expect(slot.querySelector('[data-legend-key]')).not.toBeNull())
    expect(within(slot).getByRole('button', { name: 'All 20' })).not.toBeNull()
    expect(slot.querySelectorAll('[data-legend-key]').length).toBeLessThan(20)
  })

  test('a headless card has no slot, so the legend keeps its band under the plot', async () => {
    const { container } = render(
      <ChartCard>
        <ChartFrame series={many} height={240}>
          {() => <svg />}
        </ChartFrame>
      </ChartCard>,
    )
    await waitFor(() => expect(container.querySelector('[data-legend-key]')).not.toBeNull())
    expect(container.querySelector('[data-basalt-legend-slot]')).toBeNull()
  })

  test('two frames in one card: only the first claims the slot, the second falls back to its own band (P2-9)', async () => {
    const seriesA: SeriesStyle[] = [
      { key: 's1', label: 'First chart', color: '#000', mark: 'line' },
    ]
    const seriesB: SeriesStyle[] = [
      { key: 's2', label: 'Second chart', color: '#000', mark: 'line' },
    ]
    const originalError = console.error
    const messages: string[] = []
    console.error = (...args: unknown[]) => messages.push(args.map(String).join(' '))
    try {
      const { container } = render(
        <ChartCard title="Two charts">
          <ChartFrame series={seriesA} height={120}>
            {() => <svg />}
          </ChartFrame>
          <ChartFrame series={seriesB} height={120}>
            {() => <svg />}
          </ChartFrame>
        </ChartCard>,
      )
      const slot = container.querySelector('[data-basalt-legend-slot]') as HTMLElement
      await waitFor(() => expect(slot.querySelector('[data-legend-key]')).not.toBeNull())
      // Only the FIRST frame's legend lives in the shared slot...
      expect([...slot.querySelectorAll('[data-legend-key]')].map((e) => e.textContent)).toEqual([
        'First chart',
      ])
      // ...the second frame's legend still rendered, just in its own band outside the slot.
      const allLabels = [...container.querySelectorAll('[data-legend-key]')].map(
        (e) => e.textContent,
      )
      expect(allLabels).toEqual(['First chart', 'Second chart'])
      expect(messages.some((m) => m.includes('header legend slot'))).toBe(true)
    } finally {
      console.error = originalError
    }
  })

  test('once the owner releases the slot, the previously-denied sibling frame re-claims it', async () => {
    const seriesA: SeriesStyle[] = [
      { key: 's1', label: 'First chart', color: '#000', mark: 'line' },
    ]
    const seriesB: SeriesStyle[] = [
      { key: 's2', label: 'Second chart', color: '#000', mark: 'line' },
    ]
    const originalError = console.error
    console.error = () => {}
    try {
      function Frames({ showFirst }: { showFirst: boolean }) {
        return (
          <ChartCard title="Two charts">
            {showFirst && (
              <ChartFrame series={seriesA} height={120}>
                {() => <svg />}
              </ChartFrame>
            )}
            <ChartFrame series={seriesB} height={120}>
              {() => <svg />}
            </ChartFrame>
          </ChartCard>
        )
      }
      const { container, rerender } = render(<Frames showFirst />)
      const slot = container.querySelector('[data-basalt-legend-slot]') as HTMLElement
      await waitFor(() => expect(slot.querySelector('[data-legend-key]')).not.toBeNull())
      // The first frame owns the slot, exactly like the two-mounted-at-once case above...
      expect([...slot.querySelectorAll('[data-legend-key]')].map((e) => e.textContent)).toEqual([
        'First chart',
      ])

      // ...unmounting it releases the claim, and the second frame — told "no" on its own first
      // mount — gets a chance to re-claim the now-empty slot instead of staying denied forever.
      rerender(<Frames showFirst={false} />)
      await waitFor(() =>
        expect([...slot.querySelectorAll('[data-legend-key]')].map((e) => e.textContent)).toEqual([
          'Second chart',
        ]),
      )
    } finally {
      console.error = originalError
    }
  })
})

/**
 * Regression (round 2): the old claim/retry protocol keyed the owner's effect on a release-version
 * counter its own cleanup bumped — an infinite release → bump → re-run loop ("Maximum update depth
 * exceeded") under StrictMode replay or a `legendVisible` flip. Ownership is now derived from one
 * claimant queue (`legendSlotReducer`); these pin that neither trigger loops.
 */
describe('legend-slot ownership effect does not loop (round 2 regression)', () => {
  // Same stub as "the legend portals into the header slot" above — a real width is what makes the
  // legend resolve into the header slot at all, which the last test here needs in order to observe
  // the handoff.
  const originalResizeObserver = window.ResizeObserver

  function installObserver(width: number): void {
    class FixedBoxResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback(
          [{ contentRect: { width, height: 240, top: 0, left: 0 } }] as never,
          this as never,
        )
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = FixedBoxResizeObserver as unknown as typeof ResizeObserver
  }

  beforeAll(() => installObserver(600))
  afterAll(() => {
    window.ResizeObserver = originalResizeObserver
  })

  test('StrictMode replay of two frames sharing one card never throws "Maximum update depth exceeded"', () => {
    const seriesA: SeriesStyle[] = [
      { key: 's1', label: 'First chart', color: '#000', mark: 'line' },
    ]
    const seriesB: SeriesStyle[] = [
      { key: 's2', label: 'Second chart', color: '#000', mark: 'line' },
    ]
    const originalError = console.error
    const messages: string[] = []
    console.error = (...args: unknown[]) => messages.push(args.map(String).join(' '))
    try {
      render(
        <StrictMode>
          <ChartCard title="Two charts">
            <ChartFrame series={seriesA} height={120}>
              {() => <svg />}
            </ChartFrame>
            <ChartFrame series={seriesB} height={120}>
              {() => <svg />}
            </ChartFrame>
          </ChartCard>
        </StrictMode>,
      )
    } finally {
      console.error = originalError
    }
    expect(messages.some((m) => m.includes('Maximum update depth exceeded'))).toBe(false)
  })

  test("toggling the owner's isPending (a legendVisible flip) repeatedly never loops", () => {
    const series: SeriesStyle[] = [{ key: 's1', label: 'Only chart', color: '#000', mark: 'line' }]
    const originalError = console.error
    const messages: string[] = []
    console.error = (...args: unknown[]) => messages.push(args.map(String).join(' '))
    try {
      function Owner({ pending }: { pending: boolean }) {
        return (
          <ChartCard title="One chart">
            <ChartFrame series={series} height={120} isPending={pending}>
              {() => <svg />}
            </ChartFrame>
          </ChartCard>
        )
      }
      const { rerender } = render(<Owner pending={false} />)
      rerender(<Owner pending />)
      rerender(<Owner pending={false} />)
      rerender(<Owner pending />)
      rerender(<Owner pending={false} />)
    } finally {
      console.error = originalError
    }
    expect(messages.some((m) => m.includes('Maximum update depth exceeded'))).toBe(false)
  })

  test('owner unmount still hands the slot to the denied sibling (no regression from the split)', async () => {
    const seriesA: SeriesStyle[] = [
      { key: 's1', label: 'First chart', color: '#000', mark: 'line' },
    ]
    const seriesB: SeriesStyle[] = [
      { key: 's2', label: 'Second chart', color: '#000', mark: 'line' },
    ]
    const originalError = console.error
    console.error = () => {}
    try {
      function Frames({ showFirst }: { showFirst: boolean }) {
        return (
          <ChartCard title="Two charts">
            {showFirst && (
              <ChartFrame series={seriesA} height={120}>
                {() => <svg />}
              </ChartFrame>
            )}
            <ChartFrame series={seriesB} height={120}>
              {() => <svg />}
            </ChartFrame>
          </ChartCard>
        )
      }
      const { container, rerender } = render(<Frames showFirst />)
      const slot = container.querySelector('[data-basalt-legend-slot]') as HTMLElement
      await waitFor(() => expect(slot.querySelector('[data-legend-key]')).not.toBeNull())
      expect([...slot.querySelectorAll('[data-legend-key]')].map((e) => e.textContent)).toEqual([
        'First chart',
      ])
      rerender(<Frames showFirst={false} />)
      await waitFor(() =>
        expect([...slot.querySelectorAll('[data-legend-key]')].map((e) => e.textContent)).toEqual([
          'Second chart',
        ]),
      )
    } finally {
      console.error = originalError
    }
  })
})

/**
 * r1 review regression: the owner unmounting in the SAME commit a new frame mounts (a tab switch —
 * a different `useId`) is a hand-off, not contention. The new frame's first render still sees the
 * outgoing owner, so a denial read off that render warned about a frame that goes on to own the
 * slot. Only a denial of a claim this frame has actually made may warn.
 */
test('an owner swapped for a new frame in one commit hands the slot over without a contention warning', async () => {
  const seriesA: SeriesStyle[] = [{ key: 's1', label: 'Tab A', color: '#000', mark: 'line' }]
  const seriesB: SeriesStyle[] = [{ key: 's2', label: 'Tab B', color: '#000', mark: 'line' }]
  resetValidatedProps()
  const originalError = console.error
  const messages: string[] = []
  console.error = (...args: unknown[]) => messages.push(args.map(String).join(' '))
  try {
    function Tabs({ tab }: { tab: 'a' | 'b' }) {
      return (
        <ChartCard title="Tabbed">
          <ChartFrame key={tab} series={tab === 'a' ? seriesA : seriesB} height={120}>
            {() => <svg />}
          </ChartFrame>
        </ChartCard>
      )
    }
    const { rerender } = render(<Tabs tab="a" />)
    rerender(<Tabs tab="b" />)
    rerender(<Tabs tab="a" />)
  } finally {
    console.error = originalError
  }
  expect(messages.some((m) => m.includes('header legend slot'))).toBe(false)
})
