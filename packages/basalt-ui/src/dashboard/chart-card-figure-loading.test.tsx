/**
 * A pending `ChartCard` whose body is ONE figure (`BarList`, `EventList`, `Meter`) loads as that
 * figure's own skeleton, the same rule a pending `Section` follows; the real figure never shows.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ComponentProps, ReactElement } from 'react'
import { BarList } from './bar-list'
import { EventList } from './event-list'
import { Meter } from './meter'
import { ChartCard } from '../charts/ChartCard'
import { Lines } from '../charts/Lines'
import type { ChartState } from '../charts/types'

afterEach(cleanup)

const mount = (
  node: ReactElement,
  state: ChartState = { pending: true },
  placeholderHeight: ComponentProps<typeof ChartCard>['placeholderHeight'] | null = 'content',
) =>
  render(
    <MantineProvider>
      <ChartCard title="T" state={state} {...(placeholderHeight !== null && { placeholderHeight })}>
        {node}
      </ChartCard>
    </MantineProvider>,
  ).container

describe('ChartCard pending body shaped like its figure', () => {
  test('a BarList body loads as row skeletons at its loadingRows, never its items', () => {
    const c = mount(
      <BarList label="Spend" items={[{ label: 'Real row', value: 5 }]} loadingRows={7} />,
    )
    expect(c.querySelectorAll('[data-bar-skeleton]')).toHaveLength(7)
    expect(c.textContent).not.toContain('Real row')
  })

  test('an EventList body loads as its row skeletons', () => {
    const c = mount(
      <EventList
        label="Events"
        items={[{ id: 'e1', at: new Date(0), actor: 'Ada', title: 'Real event' }]}
        loadingRows={9}
      />,
    )
    expect(c.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(c.textContent).not.toContain('Real event')
    expect(c.textContent).toContain('Loading Events')
  })

  test('a Meter body loads as the Meter loading tree, not its reading', () => {
    const c = mount(<Meter label="Low" value={42} max={100} />)
    expect(c.querySelector('[data-meter-loading]')).not.toBeNull()
  })

  test('a resolved card draws the real figure', () => {
    const c = mount(<Meter label="Low" value={42} max={100} />, {})
    expect(c.querySelector('[data-meter-loading]')).toBeNull()
  })

  describe('without placeholderHeight', () => {
    const meter = <Meter label="Low" value={42} max={100} />

    test('a pending Meter body loads as the Meter skeleton, not the bar ghost', () => {
      const c = mount(meter, { pending: true }, null)
      expect(c.querySelector('[data-meter-loading]')).not.toBeNull()
      expect(c.querySelector('[aria-label="Loading chart"]')).toBeNull()
    })

    test('a numeric placeholderHeight still gives the ghost box', () => {
      const c = mount(meter, { pending: true }, 120)
      expect(c.querySelector('[aria-label="Loading chart"]')).not.toBeNull()
      expect(c.querySelector('[data-meter-loading]')).toBeNull()
    })

    test('a figure found through plain elements counts', () => {
      const c = mount(<div>{meter}</div>, { pending: true }, null)
      expect(c.querySelector('[data-meter-loading]')).not.toBeNull()
    })

    test.each([
      ['empty', { empty: 'Nothing' }],
      ['error', { error: new Error('boom') }],
    ] as const)('an %s figure card reserves no chart height', (_, state) => {
      const figure = mount(meter, state, null)
      const stated = mount(meter, state, 120)
      expect(figure.querySelector('[data-basalt-box]')).toBeNull()
      expect(stated.querySelector('[data-basalt-box]')).not.toBeNull()
    })

    test('a Lines body beside a Meter keeps the chart ghost, not the Meter skeleton', () => {
      const mixed = (
        <>
          <Lines
            ariaLabel="L"
            data={[{ t: 1, v: 2 }]}
            x={(d) => d.t}
            series={[{ key: 'v', label: 'V', color: 'var(--vx-line)', getValue: (d) => d.v }]}
          />
          {meter}
        </>
      )
      expect(
        mount(mixed, { pending: true }, null).querySelector('[aria-label="Loading chart"]'),
      ).not.toBeNull()
    })

    test('a Lines body keeps the chart box and line ghost', () => {
      const lines = (
        <Lines
          ariaLabel="L"
          data={[{ t: 1, v: 2 }]}
          x={(d) => d.t}
          series={[{ key: 'v', label: 'V', color: 'var(--vx-line)', getValue: (d) => d.v }]}
        />
      )
      const c = mount(lines, { pending: true }, null)
      expect(c.querySelector('[aria-label="Loading chart"]')).not.toBeNull()
      const e = mount(lines, { empty: 'Nothing' }, null)
      expect(e.querySelector('[data-basalt-chart-state="empty"]')).not.toBeNull()
    })
  })
})
