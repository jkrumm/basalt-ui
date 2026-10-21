/**
 * `BasaltDataTable` state chrome and column sizing (SPEC § 6.6, Wave 42): a count or a range is a
 * figure read from rows, so none shows while rows are loading or failed; the skeleton is as tall as
 * what it stands in for; and a kinded column sizes to its content with the slack on one column.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { BasaltDataTable } from './data-table'
import type { BasaltDataTableProps } from './data-table'
import { createColumnHelper } from './index'

type Row = { name: string; when: number; cost: number; note: string }
const col = createColumnHelper<Row>()

const ROWS: Row[] = Array.from({ length: 7 }, (_, index) => ({
  name: `row ${index}`,
  when: index,
  cost: index * 10,
  note: 'n',
}))

const KINDED = [
  col.accessor('name', { header: 'Name', meta: { kind: 'entity' } }),
  col.accessor('when', { header: 'When', meta: { kind: 'relative-time' } }),
  col.accessor('cost', { header: 'Cost', meta: { kind: 'money' } }),
]

function mount(props: Partial<BasaltDataTableProps<Row>> = {}) {
  return render(
    <MantineProvider>
      <BasaltDataTable data={ROWS} columns={KINDED} title="Rows" {...props} />
    </MantineProvider>,
  )
}

/** The header row's text: the title, then the count chip when there is one (`Rows7`). */
const header = (root: HTMLElement) => root.querySelector('.mantine-Group-root')?.textContent
const bodyRows = (root: HTMLElement) => root.querySelectorAll('tbody tr')

afterEach(cleanup)

describe('state chrome', () => {
  test('the count and the range are read from rows, so loading hides them and keeps the footer', () => {
    const loaded = mount({ enablePagination: true })
    expect(header(loaded.container)).toBe('Rows7')
    expect(loaded.container.textContent).toContain('Showing 1–7')
    cleanup()
    const loading = mount({ enablePagination: true, data: [], isLoading: true })
    expect(header(loading.container)).toBe('Rows')
    const range = [...loading.container.querySelectorAll('p')].find((p) =>
      p.textContent.startsWith('Showing'),
    )
    expect(range?.getAttribute('style')).toContain('visibility: hidden')
  })

  test('an error hides them too', () => {
    const { container } = mount({
      enablePagination: true,
      data: [],
      query: {
        data: undefined,
        isError: true,
        error: new Error('boom'),
        fetchStatus: 'idle',
        refetch: () => Promise.resolve(),
      },
    })
    expect(header(container)).toBe('Rows')
  })
})

describe('skeleton rows', () => {
  test('a paginated table loads one page of rows', () => {
    const { container } = mount({
      data: [],
      isLoading: true,
      enablePagination: true,
      initialPagination: { pageIndex: 0, pageSize: 6 },
      skeletonRows: 2,
    })
    expect(bodyRows(container)).toHaveLength(6)
  })

  test('a reload is as tall as the last loaded table; the first load takes skeletonRows', () => {
    const first = mount({ data: [], isLoading: true, skeletonRows: 3 })
    expect(bodyRows(first.container)).toHaveLength(3)
    first.rerender(
      <MantineProvider>
        <BasaltDataTable data={ROWS} columns={KINDED} title="Rows" />
      </MantineProvider>,
    )
    first.rerender(
      <MantineProvider>
        <BasaltDataTable data={[]} columns={KINDED} title="Rows" isLoading skeletonRows={3} />
      </MantineProvider>,
    )
    expect(bodyRows(first.container)).toHaveLength(ROWS.length)
  })

  test('a skeleton bar is shaped like its kind: a figure short and flush right', () => {
    const { container } = mount({ data: [], isLoading: true })
    const money = container.querySelector('tbody tr td:nth-child(3) .mantine-Skeleton-root')
    expect(money?.getAttribute('style')).toContain('margin-left: auto')
  })
})

describe('column sizing', () => {
  test('with an entity column the slack is its own: the others fit, no spacer', () => {
    const { container } = mount()
    const fit = [...container.querySelectorAll('thead th')].map((th) => th.hasAttribute('data-fit'))
    expect(fit).toEqual([false, true, true])
    expect(container.querySelectorAll('thead th')).toHaveLength(3)
  })

  test('without an entity or text column a trailing spacer takes the slack', () => {
    const { container } = mount({
      columns: [
        col.accessor('when', { header: 'When', meta: { kind: 'relative-time' } }),
        col.accessor('cost', { header: 'Cost', meta: { kind: 'money' } }),
      ],
    })
    const heads = [...container.querySelectorAll('thead th')]
    expect(heads).toHaveLength(3)
    expect(heads.map((th) => th.hasAttribute('data-fit'))).toEqual([true, true, false])
    expect(heads[2]?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(3)
  })

  test('a kindless column keeps its auto share: no fit marks, no spacer', () => {
    const { container } = mount({ columns: [col.accessor('note', { header: 'Note' })] })
    expect(container.querySelectorAll('[data-fit]')).toHaveLength(0)
    expect(container.querySelectorAll('thead th')).toHaveLength(1)
  })
})
