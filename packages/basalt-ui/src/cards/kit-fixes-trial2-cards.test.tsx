/**
 * Trial 2 kit defects on the cards: a StatCell follows ChartCard's `empty` rule (26) and takes a
 * predicate (22), its meter takes the cell's unit and digits (17), `rows` is a plain readonly array (30),
 * and a group's failure is one message and one Retry, never the raw error text (27).
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { StatCell } from './stat-cell'
import { StatGroup } from './stat-group'
import type { StatRow } from './contract'

afterEach(cleanup)

const settled = (data: unknown) => ({ isPending: false, isError: false, error: null, data })
const failed = (message: string, refetch: () => unknown) => ({
  isPending: false,
  isError: true,
  error: new Error(message),
  refetch,
  data: undefined,
})

const phaseOf = (container: HTMLElement): string | null | undefined =>
  container.querySelector('[data-slot="stat-cell"]')?.getAttribute('data-phase')

describe('StatCell empty with a query', () => {
  const empty = { cause: 'No readings yet' }

  test('rows loaded: the figure shows and the empty text does not', () => {
    const { container } = render(
      <StatCell title="Readings" value={42} phase={settled([1, 2, 3])} empty={empty} />,
    )
    expect(phaseOf(container)).toBe('ready')
    expect(container.textContent).toContain('42')
    expect(container.textContent).not.toContain('No readings yet')
  })

  test('an empty array: the cause shows', () => {
    const { container } = render(
      <StatCell title="Readings" value={42} phase={settled([])} empty={empty} />,
    )
    expect(phaseOf(container)).toBe('empty')
    expect(container.textContent).toContain('No readings yet')
  })

  test('an object result: `when` reads the settled data', () => {
    const none = { cause: 'No readings yet', when: (d: unknown) => (d as { n: number }).n === 0 }
    const full = render(<StatCell title="R" value={1} phase={settled({ n: 3 })} empty={none} />)
    expect(phaseOf(full.container)).toBe('ready')
    cleanup()
    const zero = render(<StatCell title="R" value={1} phase={settled({ n: 0 })} empty={none} />)
    expect(phaseOf(zero.container)).toBe('empty')
  })

  test('a Phase keeps its rule: empty applies whenever it is set', () => {
    const { container } = render(<StatCell title="R" value={1} phase="ready" empty={empty} />)
    expect(phaseOf(container)).toBe('empty')
  })
})

const readout = (container: HTMLElement): string | null | undefined =>
  container.querySelector('[data-readout]')?.textContent

describe('StatCell meter', () => {
  test('takes the cell unit and as many digits as the figure shows', () => {
    const { container } = render(
      <StatCell
        title="Win rate"
        value={92.5}
        unit="%"
        meter={{ label: 'Win rate', value: 92.52912, max: 100 }}
      />,
    )
    expect(readout(container)).toContain('92.5 %')
    expect(readout(container)).not.toContain('92.529')
  })

  test('a meter with its own format keeps it', () => {
    const { container } = render(
      <StatCell
        title="Win rate"
        value={92.5}
        unit="%"
        meter={{ label: 'Win rate', value: 92.52912, max: 100, format: (v) => `~${Math.round(v)}` }}
      />,
    )
    expect(readout(container)).toContain('~93')
  })

  test('a figure that is no number never prints more than two digits', () => {
    const { container } = render(
      <StatCell title="Sleep" value="7h 20m" meter={{ label: 'Sleep', value: 0.123456, max: 1 }} />,
    )
    expect(readout(container)).toContain('0.12')
    expect(readout(container)).not.toContain('0.123')
  })
})

describe('StatCell rows', () => {
  test('a mapped readonly array of rows draws, at most four', () => {
    const rows: readonly StatRow[] = ['a', 'b', 'c', 'd', 'e'].map((label) => ({ label, value: 1 }))
    const { container } = render(<StatCell title="Sleep" value={1} rows={rows} />)
    expect(container.querySelectorAll('[data-slot="stat-row"]').length).toBe(4)
  })
})

describe('StatGroup error', () => {
  const LABELS = ['Downstream', 'Upstream', 'Latency', 'Loss'] as const

  test('cells failing with different texts draw one message and one Retry', () => {
    let retried = 0
    const refetch = (): void => {
      retried += 1
    }
    const { container, getAllByRole } = render(
      <StatGroup variant="strip" label="Link health">
        {LABELS.map((label, i) => (
          <StatCell
            key={label}
            title={label}
            value={1}
            phase={failed(`TypeError: raw ${i}`, refetch)}
          />
        ))}
      </StatGroup>,
    )
    expect(container.querySelectorAll('[role="alert"]').length).toBe(1)
    expect(container.textContent).toContain('Could not load link health.')
    expect(container.textContent).not.toContain('TypeError')
    const retry = getAllByRole('button', { name: 'Retry' })
    expect(retry.length).toBe(1)
    retry[0]?.click()
    expect(retried).toBe(1)
  })

  test('a failed cell beside a ready one names itself, never the raw error', () => {
    const { container } = render(
      <StatGroup variant="strip" label="Link health">
        <StatCell title="Downstream" value={1} phase={failed('TypeError: raw', () => undefined)} />
        <StatCell title="Upstream" value={44} />
      </StatGroup>,
    )
    expect(container.textContent).toContain('Could not load downstream.')
    expect(container.textContent).not.toContain('TypeError')
  })
})
