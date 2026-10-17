import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ChartCard } from '../charts/ChartCard'
import { ErrorState } from './query-state'
import { StatGroup } from './stat-group'

afterEach(cleanup)

const retryOf = (c: HTMLElement) => c.querySelector('[data-basalt-retry]') as HTMLElement | null

describe('one Retry across the shared error anatomy', () => {
  test('ChartCard, ErrorState and a strip cell render identical Retry markup', () => {
    const card = render(
      <ChartCard title="T" state={{ error: 'x' }} onRetry={() => {}}>
        <div />
      </ChartCard>,
    )
    const chart = retryOf(card.container)
    cleanup()
    const err = render(
      <MantineProvider>
        <ErrorState error="x" tier="section" onRetry={() => {}} />
      </MantineProvider>,
    )
    const state = retryOf(err.container)
    cleanup()
    const strip = render(
      <MantineProvider>
        <StatGroup
          variant="strip"
          label="L"
          cells={[
            { key: 'a', caption: 'A', state: { kind: 'error', onRetry: () => {} } },
            { key: 'b', caption: 'B', value: '1' },
          ]}
        />
      </MantineProvider>,
    )
    const cell = retryOf(strip.container)
    expect(chart).not.toBeNull()
    expect(chart?.outerHTML).toBe(state?.outerHTML as string)
    expect(chart?.outerHTML).toBe(cell?.outerHTML as string)
  })

  test('the same holds while retrying', () => {
    const card = render(
      <ChartCard title="T" state={{ error: 'x' }} onRetry={() => {}} retrying>
        <div />
      </ChartCard>,
    )
    const chart = retryOf(card.container)
    cleanup()
    const err = render(
      <MantineProvider>
        <ErrorState error="x" tier="section" onRetry={() => {}} retrying />
      </MantineProvider>,
    )
    expect(chart?.outerHTML).toBe(retryOf(err.container)?.outerHTML as string)
    expect(chart?.hasAttribute('disabled')).toBe(true)
  })
})
