/** The clock of `useDataTable`: a fixed `now` prints ages against it; without it they tick by the minute. */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import type { ReactElement } from 'react'
import { installLayoutDoubles, restoreLayoutDoubles } from '../page/page.test-support'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

const START = Date.parse('2026-11-11T12:00:00Z')
const AT = '2026-11-11T11:18:00Z'

beforeEach(() => {
  installLayoutDoubles()
  jest.useFakeTimers({ now: START })
})
afterEach(() => {
  cleanup()
  restoreLayoutDoubles()
  jest.useRealTimers()
})

type Row = { id: string; at: string }

function Subject({ now }: { now?: number }): ReactElement {
  const c = col<Row>()
  const table = useDataTable<Row>({
    id: 'now-test',
    label: 'Rows',
    columns: [c.text('id', { header: 'Id' }), c.relativeTime('at', { header: 'Age' })],
    data: [{ id: 'a', at: AT }],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(now !== undefined && { now }),
  })
  return <DataTable table={table} />
}

const age = (): string | null => document.querySelector('tbody time')?.textContent ?? null

describe('useDataTable now', () => {
  test('a fixed clock prints ages against it and never ticks', () => {
    render(<Subject now={Date.parse('2026-11-16T11:18:00Z')} />)
    expect(age()).toBe('5 days ago')
    act(() => void jest.advanceTimersByTime(10 * 60_000))
    expect(age()).toBe('5 days ago')
  })

  test('without it the ages follow the clock once a minute', () => {
    render(<Subject />)
    expect(age()).toBe('42 minutes ago')
    act(() => {
      jest.setSystemTime(START + 60 * 60_000)
      jest.advanceTimersByTime(60_000)
    })
    expect(age()).toBe('2 hours ago')
  })
})
