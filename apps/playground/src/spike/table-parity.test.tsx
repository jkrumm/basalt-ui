// Spike (W1 ledger): v8 and both v9 variants render the same rows for the same initial state.
import { MantineProvider } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { SPIKE_ROWS } from './rows'
import { SpikeTableV8 } from './table-v8'
import { SpikeTableV9 } from './table-v9-use'
import { SpikeTableV9Hook } from './table-v9-hook'

const cells = (node: ReactNode): string[] =>
  [
    ...renderToString(<MantineProvider>{node}</MantineProvider>).matchAll(/<td[^>]*>(.*?)<\/td>/g),
  ].map((m) => m[1] ?? '')

describe('table v8 → v9 parity (sorted by revenue desc, page 1 of 25)', () => {
  const v8 = cells(<SpikeTableV8 data={SPIKE_ROWS} />)
  test('v8 renders one page', () => {
    expect(v8.length).toBe(25 * 5)
  })
  test('v9 useTable matches v8', () => {
    expect(cells(<SpikeTableV9 data={SPIKE_ROWS} />).filter((c) => !c.includes('input'))).toEqual(
      v8.filter((c) => !c.includes('input')),
    )
  })
  test('v9 createTableHook matches v8', () => {
    expect(
      cells(<SpikeTableV9Hook data={SPIKE_ROWS} />).filter((c) => !c.includes('input')),
    ).toEqual(v8.filter((c) => !c.includes('input')))
  })
})

describe('alphanumeric string sort parity (name asc — "Project 2" before "Project 10")', () => {
  const sort = [{ id: 'name', desc: false }]
  const names = (node: ReactNode): string[] => cells(node).filter((c) => c.startsWith('Project'))
  const v8 = names(<SpikeTableV8 data={SPIKE_ROWS} sort={sort} />)
  test('v8 sorts alphanumerically', () => {
    expect(v8.slice(0, 3)).toEqual(['Project 0', 'Project 1', 'Project 2'])
  })
  test('v9 matches v8 once sortFns are registered', () => {
    expect(names(<SpikeTableV9 data={SPIKE_ROWS} sort={sort} />)).toEqual(v8)
    expect(names(<SpikeTableV9Hook data={SPIKE_ROWS} sort={sort} />)).toEqual(v8)
  })
})
