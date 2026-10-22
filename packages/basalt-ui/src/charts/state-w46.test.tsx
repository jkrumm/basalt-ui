/** Wave 46 r1: the chart empty tile (SPEC § 6.11) and the pending ghost following the chart kind. */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Bars } from './Bars'
import { BandStrip } from './BandStrip'
import { ChartCard } from './ChartCard'
import { Lines } from './Lines'
import { StackedArea } from './StackedArea'
import { ChartPlaceholder } from './state'

afterEach(cleanup)

type Row = { t: Date; v: number }
const rows: Row[] = [{ t: new Date('2026-10-01'), v: 1 }]
const line = (
  <Lines
    ariaLabel="L"
    data={rows}
    x={(d: Row) => d.t}
    series={[{ key: 'v', label: 'V', getValue: (d: Row) => d.v, color: 'red' }]}
  />
)

describe('chart empty tile', () => {
  test('the first sentence is the title, the rest the muted line, the action after it', () => {
    const { container } = render(
      <ChartPlaceholder
        state={{ empty: 'No hourly readings in the window. Check that the probe is reporting.' }}
        action={<button>Reset</button>}
      />,
    )
    const tile = container.querySelector('[data-basalt-empty-tile]')
    expect(tile).not.toBeNull()
    const spans = tile?.querySelectorAll('span') ?? []
    expect(spans[0]?.textContent).toBe('No hourly readings in the window')
    expect(spans[1]?.textContent).toBe('Check that the probe is reporting.')
    // The live region is the copy; the action is its sibling, not announced with it.
    const live = tile?.querySelector('output')
    expect(live?.textContent).toBe(
      'No hourly readings in the windowCheck that the probe is reporting.',
    )
    expect(live?.querySelector('button')).toBeNull()
    expect(tile?.querySelector('button')?.textContent).toBe('Reset')
  })

  test('one sentence is a title alone; a compact box keeps the dash, no tile', () => {
    const one = render(<ChartPlaceholder state={{ empty: 'No weigh-ins yet' }} />)
    expect(one.container.querySelectorAll('[data-basalt-empty-tile] span')).toHaveLength(1)
    one.unmount()
    const compact = render(<ChartPlaceholder state={{ empty: true }} compact />)
    expect(compact.container.querySelector('[data-basalt-empty-tile]')).toBeNull()
    expect(compact.container.textContent).toBe('—')
  })

  test('inside a ChartCard the tile replaces the body and the header stays', () => {
    const { container } = render(
      <ChartCard title="Spend" state={{ empty: 'No spend yet. Run a job.' }}>
        {line}
      </ChartCard>,
    )
    expect(container.querySelector('[data-basalt-empty-tile]')).not.toBeNull()
    expect(container.textContent).toContain('Spend')
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('pending ghost follows the chart kind', () => {
  const ghost = (
    node: React.ReactNode,
    over: { ghost?: 'bars' | 'line' } = {},
  ): string | null | undefined => {
    const { container, unmount } = render(
      <ChartCard title="T" state={{ pending: true }} {...over}>
        {node}
      </ChartCard>,
    )
    const kind = container
      .querySelector('[data-basalt-plot-ghost]')
      ?.getAttribute('data-basalt-plot-ghost')
    unmount()
    return kind
  }

  test('a Lines body, bare or inside a wrapper, loads as a line', () => {
    expect(ghost(line)).toBe('line')
    expect(ghost(<div>{line}</div>)).toBe('line')
  })

  test('a StackedArea body loads as a line; a Bars body keeps bars', () => {
    expect(
      ghost(
        <StackedArea
          ariaLabel="A"
          data={rows}
          x={(d: Row) => d.t}
          series={[{ key: 'v', label: 'V', getValue: (d: Row) => d.v, color: 'red' }]}
        />,
      ),
    ).toBe('line')
    expect(
      ghost(
        <Bars
          ariaLabel="B"
          data={[{ k: 'a', v: 1 }]}
          x={(d) => d.k}
          bars={[{ key: 'v', label: 'V', getValue: (d) => d.v, color: 'red' }]}
        />,
      ),
    ).toBe('bars')
  })

  test('no children and a body with no chart load as bars', () => {
    expect(ghost(null)).toBe('bars')
    expect(ghost(<p>text</p>)).toBe('bars')
    expect(ghost(<div>{null}</div>)).toBe('bars')
  })

  test('a Lines body nested several elements deep, or beside other nodes, loads as a line', () => {
    expect(
      ghost(
        <div>
          <section>
            <span>{line}</span>
          </section>
        </div>,
      ),
    ).toBe('line')
    expect(
      ghost(
        <>
          <p>caption</p>
          {line}
        </>,
      ),
    ).toBe('line')
  })

  test('a Bars body beside a Lines body: any line body makes the ghost a line', () => {
    const bars = (
      <Bars
        ariaLabel="B"
        data={[{ k: 'a', v: 1 }]}
        x={(d) => d.k}
        bars={[{ key: 'v', label: 'V', getValue: (d) => d.v, color: 'red' }]}
      />
    )
    expect(
      ghost(
        <div>
          {bars}
          {line}
        </div>,
      ),
    ).toBe('line')
  })

  test('a body wrapped in a component hides its kind: bars unless ghost is passed', () => {
    const Wrapped = (): React.ReactElement => line
    expect(ghost(<Wrapped />)).toBe('bars')
    expect(ghost(<Wrapped />, { ghost: 'line' })).toBe('line')
  })

  const STATES = [
    { key: 'up', label: 'Up', color: 'green' },
    { key: 'down', label: 'Down', color: 'red' },
  ]
  const strip = (over: Partial<React.ComponentProps<typeof BandStrip<Row>>> = {}) => (
    <BandStrip
      ariaLabel="Band"
      data={rows}
      x={(d: Row) => d.t}
      states={STATES}
      getBand={() => ({ state: 'up' })}
      height={90}
      {...over}
    />
  )
  const pending = (body: React.ReactNode, over: { ghost?: 'bars' | 'line' | 'band' } = {}) => {
    const { container } = render(
      <ChartCard title="T" state={{ pending: true }} {...over}>
        <div>{body}</div>
      </ChartCard>,
    )
    const box = container.querySelector('output[aria-busy]')?.parentElement
    return {
      ghost: container
        .querySelector('[data-basalt-plot-ghost]')
        ?.getAttribute('data-basalt-plot-ghost'),
      boxStyle: box?.getAttribute('style') ?? '',
      reserve: container.querySelector('[data-basalt-legend-reserve]') !== null,
    }
  }

  test('a BandStrip body loads as one band row at its own height, legend room kept', () => {
    const got = pending(strip())
    expect(got.ghost).toBe('band')
    expect(got.boxStyle).toContain('90px')
    expect(got.reserve).toBe(true)
  })

  test('an explicit ghost changes the shape only: the strip height still sizes the box', () => {
    const got = pending(strip(), { ghost: 'bars' })
    expect(got.ghost).toBe('bars')
    expect(got.boxStyle).toContain('90px')
  })

  test('a per-class strip height is forwarded, not only a number', () => {
    const got = pending(strip({ height: { base: 80, regular: 120 } }))
    expect(got.boxStyle).toContain('80px')
    expect(got.boxStyle).toContain('120px')
  })

  test('no legend room for legend={false}, a single-state strip, or another kind', () => {
    expect(pending(strip({ legend: false })).reserve).toBe(false)
    expect(pending(strip({ states: STATES.slice(0, 1) })).reserve).toBe(false)
    expect(pending(line).reserve).toBe(false)
  })

  test('an explicit ghost wins over the body', () => {
    expect(ghost(line, { ghost: 'bars' })).toBe('bars')
  })
})
