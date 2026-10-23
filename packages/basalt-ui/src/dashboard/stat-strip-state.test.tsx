import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Sparkline } from '../charts'
import { Meter } from './meter'
import { StatGroup } from './stat-group'
import type { StatStripCell } from './stat-strip'

afterEach(cleanup)

function mount(cell: Partial<StatStripCell>) {
  const cells: StatStripCell[] = [
    { key: 'a', caption: 'Resting HR', value: '52', ...cell },
    { key: 'b', caption: 'Load', value: '410' },
  ]
  return render(
    <MantineProvider>
      <StatGroup variant="strip" label="Health" cells={cells} />
    </MantineProvider>,
  )
}

const cellOf = (c: HTMLElement) => c.querySelector('[data-strip-cell="a"]') as HTMLElement

describe('strip cell state', () => {
  test('empty with a reason: the reason in the value place, no dash, dot, word or Retry', () => {
    const { container } = mount({ state: { kind: 'empty', reason: 'No sleep logged' } })
    const cell = cellOf(container)
    expect(cell.querySelector('[data-strip-value]')).toBeNull()
    expect(cell.querySelector('[data-strip-reason]')?.textContent).toBe('No sleep logged')
    expect(cell.textContent).not.toContain('—')
    expect(cell.textContent).toContain('No sleep logged')
    expect(cell.querySelector('[data-basalt-status-dot]')).toBeNull()
    expect(cell.querySelector('button')).toBeNull()
    expect(cell.textContent).not.toContain('Could not load')
  })

  test('empty without a reason: the dash alone', () => {
    const { container } = mount({ state: { kind: 'empty' } })
    const cell = cellOf(container)
    expect(cell.querySelector('[data-strip-value]')?.textContent).toBe('—')
    expect(cell.querySelector('[data-strip-reason]')).toBeNull()
  })

  test('error: a dot, the word, the message and Retry; onRetry fires', () => {
    let retried = 0
    const { container } = mount({
      state: { kind: 'error', error: new Error('boom'), onRetry: () => (retried += 1) },
    })
    const cell = cellOf(container)
    expect(cell.querySelector('[data-basalt-status-dot]')).not.toBeNull()
    expect(cell.textContent).toContain('Could not load resting HR')
    expect(cell.textContent).toContain('boom')
    expect(cell.querySelector('[data-strip-value]')).toBeNull()
    const retry = cell.querySelector('button') as HTMLButtonElement
    expect(retry.textContent).toBe('Retry')
    fireEvent.click(retry)
    expect(retried).toBe(1)
  })

  test('error without onRetry renders no Retry; a ready sibling is untouched', () => {
    const { container } = mount({ state: { kind: 'error', error: 'x' } })
    expect(cellOf(container).querySelector('button')).toBeNull()
    const other = container.querySelector('[data-strip-cell="b"]')
    expect(other?.querySelector('[data-strip-value]')?.textContent).toBe('410')
    expect(other?.querySelector('[data-basalt-status-dot]')).toBeNull()
  })

  test('the state replaces the visual and rows', () => {
    const { container } = mount({
      visual: <i data-v />,
      rows: [{ key: 'r', label: 'R', value: '1' }],
      state: { kind: 'error', error: 'x' },
    })
    expect(cellOf(container).querySelector('[data-v]')).toBeNull()
    expect(cellOf(container).querySelector('[data-strip-row]')).toBeNull()
  })
})

describe('strip cell loading', () => {
  test('a rows-only cell loads its Meter visual too: no fill, no reading, busy', () => {
    const { container } = render(
      <MantineProvider>
        <StatGroup
          variant="strip"
          label="Health"
          cells={[
            {
              key: 'a',
              caption: 'Resting HR',
              rows: [{ key: 'r', label: 'HRV', value: '48' }],
              visual: <Meter label="Load" value={5} max={10} />,
              loading: true,
            },
            { key: 'b', caption: 'Load', value: '410' },
          ]}
        />
      </MantineProvider>,
    )
    const meter = cellOf(container).querySelector('[data-basalt-meter]')
    expect(meter?.getAttribute('aria-busy')).toBe('true')
    expect(meter?.querySelector('[data-meter-fill]')).toBeNull()
  })

  test('a loading cell keeps its Sparkline row: the slot stays in the flow under one skeleton', () => {
    const visual = <Sparkline ariaLabel="Sessions" data={[3, 5, 4, 6]} height={28} />
    const { container } = mount({ visual })
    const rest = cellOf(container).querySelector('[data-strip-visual]')
    expect(rest?.querySelector('[data-basalt-sparkline]')).not.toBeNull()
    cleanup()
    const loading = mount({ visual, loading: true })
    const slot = cellOf(loading.container).querySelector('[data-strip-visual]')
    expect(slot).not.toBeNull()
    expect(slot?.hasAttribute('inert')).toBe(true)
    // The measured sparkline is still laid out (hidden): the row keeps its loaded height.
    expect(slot?.querySelector('[data-basalt-sparkline]')).not.toBeNull()
    expect(slot?.querySelector('.mantine-Skeleton-root')).not.toBeNull()
  })
})
