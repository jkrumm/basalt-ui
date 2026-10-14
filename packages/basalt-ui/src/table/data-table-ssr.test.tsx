/**
 * The SSR-first contract for `BasaltDataTable` (V2-SPEC § 3, W10): a table with rows renders its
 * COMPLETE markup on the server (no client-only window that paints nothing), `hydrateRoot` adopts
 * it without a mismatch warning, and the hydrated outer markup is the server's.
 */
import { MantineProvider } from '@mantine/core'
import { act } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import type { ReactElement } from 'react'
import { BasaltDataTable, planColumnFold } from './data-table'
import type { BasaltDataTableProps } from './data-table'
import { createColumnHelper } from './index'

type Row = { project: string; cost: number }
const col = createColumnHelper<Row>()
const ROWS: Row[] = Array.from({ length: 12 }, (_, i) => ({ project: `project-${i}`, cost: i * 3 }))
const COLUMNS = [
  col.accessor('project', { header: 'Project' }),
  col.accessor('cost', { header: 'Cost', meta: { align: 'right' } }),
]

const table = (props: Partial<BasaltDataTableProps<Row>> = {}): ReactElement => (
  <MantineProvider>
    <BasaltDataTable data={ROWS} columns={COLUMNS} {...props} />
  </MantineProvider>
)

/** Server HTML in a container, then `hydrateRoot`; returns what React warned about. */
async function hydrate(
  node: ReactElement,
): Promise<{ server: string; client: string; warnings: string[] }> {
  const container = document.createElement('div')
  container.innerHTML = renderToString(node)
  document.body.append(container)
  const server = container.innerHTML
  const warnings: string[] = []
  const spy = spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    warnings.push(args.map(String).join(' '))
  })
  const caught: unknown[] = []
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, node, { onRecoverableError: (error) => caught.push(error) })
  })
  spy.mockRestore()
  const client = container.innerHTML
  await act(async () => root?.unmount())
  return { server, client, warnings: [...warnings, ...caught.map(String)] }
}

/** Mantine swaps its `useId` ids for random ones after mount: attributes, never a box. */
const withoutIds = (html: string): string => html.replaceAll(/ id="mantine-[^"]*"/g, '')

afterEach(() => {
  document.body.innerHTML = ''
})

describe('BasaltDataTable SSR', () => {
  test('renders the complete table markup on the server', () => {
    const html = renderToString(table())
    expect(html).toContain('<table')
    expect(html.match(/<tbody[\s\S]*<\/tbody>/)?.[0].match(/<tr/g)).toHaveLength(ROWS.length)
    expect(html).toContain('project-11')
  })

  test('the loading state renders the header and exactly skeletonRows rows on the server', () => {
    const html = renderToString(table({ isLoading: true, skeletonRows: 7 }))
    expect(html).toContain('Project')
    expect(html.match(/<tbody[\s\S]*<\/tbody>/)?.[0].match(/<tr/g)).toHaveLength(7)
    expect(html).not.toContain('project-0')
  })

  test.each<[string, Partial<BasaltDataTableProps<Row>>]>([
    ['plain', {}],
    ['loading', { isLoading: true, skeletonRows: 4 }],
    ['search + pagination', { enableGlobalFilter: true, enablePagination: true }],
    ['row selection', { enableRowSelection: true }],
    ['empty', { data: [] }],
  ])('hydrates %s with no mismatch and the server markup', async (_name, props) => {
    const { server, client, warnings } = await hydrate(table(props))
    expect(warnings).toEqual([])
    expect(withoutIds(client)).toBe(withoutIds(server))
  })
})

describe('planColumnFold on a server-painted table', () => {
  // A table that fills its wrapper stretches its columns to sum to `room`; five rounded
  // `offsetWidth`s read 1249 against a 1248 room. Folding there moved every cell on hydration.
  const widths = new Map([
    ['a', 284],
    ['b', 227],
    ['c', 255],
    ['d', 284],
    ['e', 199],
  ])
  const order = ['e', 'd', 'c', 'b', 'a']

  test('rounding noise is not overflow', () => {
    expect(planColumnFold({ room: 1248, toggleWidth: 44, overhead: 0, order, widths }).size).toBe(0)
  })

  test('a real overflow still folds', () => {
    expect(
      planColumnFold({ room: 1248 - 60, toggleWidth: 44, overhead: 0, order, widths }).size,
    ).toBeGreaterThan(0)
  })

  // Five foldable columns: slack = (5 + 0 + 1) / 2 = 3. Their rounded sum is 1249.
  test('the boundary: exactly the slack over still fits, one pixel more folds', () => {
    expect(planColumnFold({ room: 1246, toggleWidth: 44, overhead: 0, order, widths }).size).toBe(0)
    expect(
      planColumnFold({ room: 1245, toggleWidth: 44, overhead: 0, order, widths }).size,
    ).toBeGreaterThan(0)
  })

  // The same five, plus two fixed (pinned) columns summed in `overhead` (200): 1449 in all, and
  // slack = (5 + 2 + 1) / 2 = 4, so a 1445 room fits and 1444 does not.
  test('pinned / fixed columns add their own half pixel each', () => {
    const fixed = { toggleWidth: 44, overhead: 200, order, widths }
    expect(planColumnFold({ ...fixed, room: 1445, fixedCount: 2 }).size).toBe(0)
    expect(planColumnFold({ ...fixed, room: 1444, fixedCount: 2 }).size).toBeGreaterThan(0)
    // Without `fixedCount` the same fixed columns get no slack of their own.
    expect(planColumnFold({ ...fixed, room: 1445 }).size).toBeGreaterThan(0)
  })
})
