/**
 * A pending `Section` body that is ONE figure (`BarList`, `EventList`, `Meter`) loads as that
 * figure's own skeleton; a declared `loadingHeight` or any other body keeps the generic skeleton.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { BarList } from './bar-list'
import { EventList } from './event-list'
import { Meter } from './meter'
import { Section } from './section'
import type { QueryStateLike } from './query-state'

afterEach(cleanup)

const pending: QueryStateLike<unknown> = {
  data: undefined,
  isError: false,
  error: null,
  fetchStatus: 'fetching',
  refetch: () => undefined,
}

const mount = (node: ReactElement) =>
  render(
    <MantineProvider>
      <Section title="T" query={pending}>
        {node}
      </Section>
    </MantineProvider>,
  ).container

describe('Section pending body shaped like its figure', () => {
  test('a BarList child loads as its own row skeletons, at its loadingRows', () => {
    const c = mount(<BarList label="Spend" items={[]} loadingRows={10} />)
    expect(c.querySelectorAll('[data-bar-skeleton]')).toHaveLength(10)
  })

  test('an EventList child loads as its row skeletons', () => {
    const c = mount(<EventList label="Events" items={[]} loadingRows={9} />)
    expect(c.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(c.querySelectorAll('[aria-hidden]').length).toBeGreaterThanOrEqual(9)
  })

  test('a Meter child loads as the Meter loading tree', () => {
    const c = mount(<Meter label="Low" value={null} />)
    expect(c.querySelector('[data-meter-loading]')).not.toBeNull()
  })

  test('a declared loadingHeight keeps the generic skeleton', () => {
    const c = render(
      <MantineProvider>
        <Section title="T" query={pending} loadingHeight={200}>
          <BarList label="Spend" items={[]} loadingRows={10} />
        </Section>
      </MantineProvider>,
    ).container
    expect(c.querySelector('[data-bar-skeleton]')).toBeNull()
    expect(c.querySelector('output')).not.toBeNull()
  })

  test('any other child keeps the generic skeleton', () => {
    const c = render(
      <MantineProvider>
        <Section title="T" query={pending}>
          <div data-testid="body" />
        </Section>
      </MantineProvider>,
    ).container
    expect(c.querySelector('[data-testid="body"]')).toBeNull()
    expect(c.querySelector('output')).not.toBeNull()
  })
})
