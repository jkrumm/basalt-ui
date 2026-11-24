/**
 * A board and a gallery with no cards to show draw their own frames: skeleton lanes or cards while
 * loading, the arm's message when empty or failed, and never the table's column header above them.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import type { Phase } from '../../core/ports'
import type { BuiltinLayout } from '../contract'
import { col } from '../core/kinds'
import { DataTable } from '../parts/data-table'
import { modelOf, useDataTable } from '../use-data-table'

type Deal = { id: string; name: string; stage: string }

beforeEach(() => localStorage.clear())
afterEach(cleanup)

function Subject({
  layout,
  phase,
  data = [],
}: {
  layout: BuiltinLayout
  phase?: Phase
  data?: readonly Deal[]
}): ReactElement {
  const c = col<Deal>()
  const t = useDataTable<Deal>({
    id: 'deals',
    label: 'Deals',
    columns: [
      c.entity('name', { header: 'Deal' }),
      c.select('stage', {
        header: 'Stage',
        label: (d) => `Stage of ${d.name}`,
        options: ['new', 'won'],
        commit: () => undefined,
      }),
    ],
    data,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    layouts: ['table', 'board', 'gallery'],
    ...(phase !== undefined && { phase }),
  })
  const model = modelOf(t)
  useEffect(() => {
    if (model.layout !== layout) model.setLayout(layout)
  })
  return <DataTable table={t} />
}

const root = (): HTMLElement => document.querySelector<HTMLElement>('[data-slot="table-root"]')!

describe.each(['board', 'gallery'] as const)('a %s with no cards', (layout) => {
  test("loading is the layout's skeleton, with no table head", async () => {
    render(<Subject layout={layout} phase="loading" />)
    await waitFor(() => expect(root().getAttribute('data-layout')).toBe(layout))
    expect(root().getAttribute('data-phase')).toBe('loading')
    expect(root().getAttribute('aria-busy')).toBe('true')
    expect(document.querySelector('[data-slot="table-head"]')).toBeNull()
    expect(document.querySelector('[data-skeleton]')).toBeNull()
  })

  test('an error says what failed with a Retry, in no table', async () => {
    let retried = 0
    render(<Subject layout={layout} phase={{ tag: 'error', retry: () => void (retried += 1) }} />)
    await waitFor(() => expect(root().getAttribute('data-layout')).toBe(layout))
    const alert = document.querySelector<HTMLElement>('[data-slot="table-error"]')!
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toContain('Could not load deals.')
    expect(document.querySelector('[data-slot="table-head"]')).toBeNull()
    alert.querySelector('button')!.click()
    expect(retried).toBe(1)
  })

  test('empty says its cause', async () => {
    render(<Subject layout={layout} />)
    await waitFor(() => expect(root().getAttribute('data-layout')).toBe(layout))
    expect(document.querySelector('[data-slot="table-empty"]')?.textContent).toBe(
      'The source returned no rows.',
    )
    expect(document.querySelector('[data-slot="table-head"]')).toBeNull()
  })
})

describe('a table keeps its head over its message', () => {
  test('an empty table row is marked for the grid look to unclip', () => {
    render(<Subject layout="table" />)
    expect(document.querySelector('[data-slot="table-head"]')).not.toBeNull()
    expect(document.querySelector('td[data-message] [data-slot="table-empty"]')).not.toBeNull()
  })
})
