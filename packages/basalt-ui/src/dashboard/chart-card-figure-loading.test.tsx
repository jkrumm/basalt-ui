/**
 * A pending `ChartCard` whose body is ONE figure (`BarList`, `EventList`, `Meter`) loads as that
 * figure's own skeleton, the same rule a pending `Section` follows; the real figure never shows.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { BarList } from './bar-list'
import { EventList } from './event-list'
import { Meter } from './meter'
import { ChartCard } from '../charts/ChartCard'
import type { ChartState } from '../charts/types'

afterEach(cleanup)

const mount = (node: ReactElement, state: ChartState = { pending: true }) =>
  render(
    <MantineProvider>
      <ChartCard title="T" state={state} placeholderHeight="content">
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
})
