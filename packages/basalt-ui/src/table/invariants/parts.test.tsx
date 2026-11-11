/**
 * Pinned 2.x invariants that the v3 parts flip (Issue t2, docs/v3/concepts/data-table.md section
 * 8; evidence: docs/v3/evidence/self-table-data.md). Each is `test.failing` until the flipper
 * lands; the flipper turns it into a plain `test`.
 *
 *   I2   checkbox and actions cells never activate the row                    t2
 *   I9   aria-colcount, aria-colindex, aria-sort, scroller focusable only while it scrolls   t2
 *   I11  cards follow the table's own width; SSR and first paint are the table   t2
 *   I12  a card is not role=button (nested links and actions stay reachable)    t2
 *   I13  sticky head needs a native scroll node                                 t2
 *   I14  a table contains itself (min-width 0 toolbar, no page overflow)        t2
 *   I20  error with no data is a row inside tbody; refetch error keeps rows     t2
 *   I21  footer: page size always an option, no range for an out-of-range page   t2
 *   I23  row actions: a stable array, state via disabled(row)/loading(row)       t2
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { api } from './api'
import { renderTable, ROWS } from './harness'
import type { Row } from './harness'

afterEach(cleanup)

describe('parts invariants', () => {
  // 2.x: data-table.tsx:355-366,418-430
  test.failing('I2 ticking a box or pressing an action does not activate the row', () => {
    const onRowActivate = mock((_row: Row) => undefined)
    const { container } = renderTable({ onRowActivate })
    fireEvent.click(container.querySelector('tbody input[type="checkbox"]') as HTMLElement)
    expect(onRowActivate).not.toHaveBeenCalled()
  })

  // 2.x: data-table.tsx:1633,1816, data-table-containment.test.tsx:105-221
  test.failing(
    'I9 aria-colcount counts every column, headers carry aria-sort, cells their slot',
    () => {
      const { container } = renderTable()
      const table = container.querySelector('table') as HTMLElement
      expect(Number(table.getAttribute('aria-colcount'))).toBeGreaterThanOrEqual(3)
      expect(screen.getAllByRole('columnheader')[0]?.getAttribute('aria-sort')).toBeTruthy()
      expect(container.querySelector('tbody td')?.getAttribute('aria-colindex')).toBeTruthy()
      const scroller = container.querySelector('[data-slot="table-scroller"]') as HTMLElement
      expect(scroller.getAttribute('tabindex')).toBeNull()
    },
  )

  // 2.x: data-table-state.ts:198-209, tests :618-737
  test.failing('I11 first paint is the table; cards never appear from viewport width alone', () => {
    const { container } = renderTable({ phone: 'cards' })
    expect(container.querySelector('[data-slot="table-card"]')).toBeNull()
    expect(container.querySelector('table')).not.toBeNull()
  })

  // 2.x: data-table.tsx:761-767
  test.failing('I12 a card is not a button', () => {
    const { container } = renderTable({ phone: 'cards', cardsBelow: 'always' })
    const card = container.querySelector('[data-slot="table-card"]') as HTMLElement
    expect(card).not.toBeNull()
    expect(card.getAttribute('role')).not.toBe('button')
  })

  // 2.x: data-table.tsx:1215-1230,1655-1690, data-table.module.css:55-86
  test.failing('I13 the scroller is a native scroll node, not a ScrollArea viewport', () => {
    const { container } = renderTable({}, { height: 'fill' })
    const scroller = container.querySelector('[data-slot="table-scroller"]') as HTMLElement
    expect(
      scroller.querySelector('[data-radix-scroll-area-viewport], [data-scrollarea-viewport]'),
    ).toBeNull()
    expect(scroller.contains(container.querySelector('thead'))).toBe(true)
  })

  // 2.x: data-table.tsx:1070-1110
  test.failing('I14 the toolbar and search can shrink: the root contains itself', () => {
    const { container } = renderTable()
    const root = container.querySelector('[data-slot="table-root"]') as HTMLElement
    expect(root.getAttribute('data-contained')).not.toBeNull()
    const search = container.querySelector('[data-slot="table-search"]') as HTMLElement
    expect(search).not.toBeNull()
  })

  // 2.x: data-table.tsx:638-650,1338-1345, query-branch.ts
  test.failing('I20 an error with no data is a row inside tbody; header stays', () => {
    const { container } = renderTable({
      data: undefined,
      phase: { tag: 'error', message: 'boom' },
    })
    expect(container.querySelector('tbody [data-slot="table-error"]')).not.toBeNull()
    expect(container.querySelector('thead')).not.toBeNull()
    expect(container.querySelector('[data-slot="table-root"]')?.getAttribute('data-phase')).toBe(
      'error',
    )
  })

  // 2.x: data-table.tsx:1993-2020,2160-2180
  test.failing('I21 an out-of-range page states no range; page size is always an option', () => {
    const { container } = renderTable({
      pager: 'pages',
      state: {
        use: () =>
          [
            {
              v: 1,
              request: { q: '', filters: [], sort: [], page: 9, pageSize: 7 },
              display: { visibility: {} },
            },
            () => undefined,
          ] as never,
      },
    })
    const pager = container.querySelector('[data-slot="table-pager"]') as HTMLElement
    expect(pager.textContent).not.toMatch(/\d+\s*[–-]\s*\d+\s+of/)
    expect(screen.getByRole('option', { name: '7' })).toBeTruthy()
  })

  // 2.x: data-table.tsx:828-838
  test.failing('I23 row actions render per row and honour disabled(row)', () => {
    const c = api.col<Row>()
    const { container } = renderTable({
      columns: [c.text('name'), c.actions([{ key: 'go', label: 'Go', onClick: () => undefined }])],
      data: ROWS,
    })
    expect(container.querySelectorAll('tbody [data-slot="table-actions"]')).toHaveLength(
      ROWS.length,
    )
  })
})
