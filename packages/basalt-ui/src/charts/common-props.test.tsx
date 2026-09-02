/**
 * `BasaltProps` across the chart layer, plus the two other `common` adoptions that have no natural
 * home in a per-kind test.
 *
 * Covers the components with no test file of their own (`Donut`, `Heatmap`, the sparklines, the
 * primitives); the seven kinds that DO have one assert their own `className` there, next to their
 * own fixtures.
 */
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { Donut } from './kinds/Donut'
import { Heatmap } from './kinds/Heatmap'
import { Bars } from './kinds/Bars'
import type { BarsProps } from './kinds/Bars'
import { BandStrip } from './kinds/BandStrip'
import { DualPanel } from './kinds/DualPanel'
import { MirroredBars } from './kinds/MirroredBars'
import { MultiLine } from './kinds/MultiLine'
import type { MultiLineProps } from './kinds/MultiLine'
import { StackedArea } from './kinds/StackedArea'
import { ZonedLine } from './kinds/ZonedLine'
import { ChartCard } from './primitives/ChartCard'
import { ChartEmpty, ChartError, ChartPending } from './primitives/ChartPending'
import { ChartFrame } from './primitives/ChartFrame'
import { ChartLegend } from './primitives/ChartLegend'
import { BarSparkline, LineSparkline } from './sparklines'
import type { SeriesStyle } from './series'

const CLASS = 'consumer-class'

/** The root element a `className` must reach: the FIRST node under the render container. */
function rootOf(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild
  expect(root).not.toBeNull()
  return root as HTMLElement
}

function expectAdoption(container: HTMLElement): void {
  const root = rootOf(container)
  expect(root.classList.contains(CLASS)).toBe(true)
  expect(root.style.opacity).toBe('0.5')
}

const basalt = { className: CLASS, style: { opacity: 0.5 } } as const

const series: SeriesStyle[] = [{ key: 'a', label: 'A', color: '#111', mark: 'line' }]

describe('primitives take BasaltProps on their root element', () => {
  test('ChartFrame', () => {
    const { container } = render(
      <ChartFrame series={series} {...basalt}>
        {() => <svg />}
      </ChartFrame>,
    )
    expectAdoption(container)
  })

  test('ChartLegend', () => {
    const { container } = render(
      <ChartLegend items={[{ key: 'a', label: 'A', color: '#111' }]} {...basalt} />,
    )
    expectAdoption(container)
  })

  test('ChartPending', () => {
    const { container } = render(<ChartPending width={100} height={50} {...basalt} />)
    expectAdoption(container)
  })

  test('ChartEmpty', () => {
    const { container } = render(<ChartEmpty width={100} height={50} {...basalt} />)
    expectAdoption(container)
  })

  test('ChartError', () => {
    const { container } = render(<ChartError width={100} height={50} {...basalt} />)
    expectAdoption(container)
  })

  test('LineSparkline', () => {
    const { container } = render(
      <LineSparkline data={[1, 2, 3]} width={60} height={20} {...basalt} />,
    )
    expectAdoption(container)
  })

  test('BarSparkline', () => {
    const { container } = render(
      <BarSparkline data={[1, 2, 3]} width={60} height={20} {...basalt} />,
    )
    expectAdoption(container)
  })
})

describe('ChartCard — BasaltProps plus a documented slot set', () => {
  test('className and style land on the card box', () => {
    const { container } = render(
      <ChartCard title="Revenue" {...basalt}>
        <svg />
      </ChartCard>,
    )
    expectAdoption(container)
  })

  test('every declared slot is reachable — root, header, body', () => {
    const { container } = render(
      <ChartCard
        title="Revenue"
        classNames={{ root: 'slot-root', header: 'slot-header', body: 'slot-body' }}
      >
        <svg />
      </ChartCard>,
    )
    expect(container.querySelector('.slot-root')).not.toBeNull()
    expect(container.querySelector('.slot-header')).not.toBeNull()
    expect(container.querySelector('.slot-body')).not.toBeNull()
  })

  test('a slot class never REPLACES the root className — both land', () => {
    const { container } = render(
      <ChartCard title="Revenue" className="mine" classNames={{ root: 'theirs' }}>
        <svg />
      </ChartCard>,
    )
    const root = rootOf(container)
    expect(root.classList.contains('mine')).toBe(true)
    expect(root.classList.contains('theirs')).toBe(true)
  })
})

// ── the two kinds with no test file of their own ──────────────────────────────

describe('Donut and Heatmap take BasaltProps', () => {
  test('Donut', () => {
    const { container } = render(
      <Donut<'a' | 'b'>
        data={[
          { key: 'a', value: 3 },
          { key: 'b', value: 5 },
        ]}
        colorForKey={() => '#111'}
        formatValue={(v) => String(v)}
        {...basalt}
      />,
    )
    expectAdoption(container)
  })

  test('Heatmap', () => {
    const { container } = render(
      <Heatmap
        data={[{ row: 'r', col: 'c', v: 1 }]}
        chartId="hm"
        getRow={(d) => d.row}
        getCol={(d) => d.col}
        getValue={(d) => d.v}
        {...basalt}
      />,
    )
    expectAdoption(container)
  })
})

// ── the other two `common` adoptions ──────────────────────────────────────────

const KINDS = {
  Bars,
  BandStrip,
  Donut,
  DualPanel,
  Heatmap,
  MirroredBars,
  MultiLine,
  StackedArea,
  ZonedLine,
} as const

describe('every memo-wrapped kind names itself in DevTools (audit A16)', () => {
  for (const [name, Kind] of Object.entries(KINDS)) {
    test(`${name} carries its own displayName, not 'Memo'`, () => {
      expect((Kind as { displayName?: string }).displayName).toBe(name)
    })
  }
})

describe('a missing required prop throws a message naming the component (F-ERR-1)', () => {
  test('the message names the kind and the prop, not `undefined is not a function`', () => {
    expect(() =>
      // A `props` object built at runtime is exactly the case the type system cannot police.
      render(
        <MultiLine {...({ chartId: 'x', getX: () => '' } as unknown as MultiLineProps<never>)} />,
      ),
    ).toThrow(/\[basalt\] MultiLine: prop "data" is required/)
  })

  test('each kind names ITSELF — the whole point of the guard', () => {
    expect(() => render(<Bars {...({ chartId: 'x' } as unknown as BarsProps<never>)} />)).toThrow(
      /\[basalt\] Bars: prop "data" is required/,
    )
  })
})
