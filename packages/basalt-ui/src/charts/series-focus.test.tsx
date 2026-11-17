/**
 * A list row that stands for a chart series (`v3-expr-7-contract` (a)): `focus.seriesItem(key)` on a
 * hand-drawn row and `DataTable focusSeries` on a table. Pointing at a row emphasises its series
 * across every x and dims the other lines, as the legend does; a series emphasised from the legend
 * marks its row; leaving clears it.
 */
import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { col } from '../table/core/kinds'
import { DataTable } from '../table/parts/data-table'
import { useDataTable } from '../table/use-data-table'
import { useChartFocus } from './focus'
import { CartesianChart } from './parts/cartesian'

type Minute = { at: number; home: number; isp: number; provider: number }
const MINUTES: readonly Minute[] = [0, 1, 2, 3].map((at) => ({
  at,
  home: 2 + at,
  isp: 9 + at,
  provider: 30 + at * 4,
}))
type Hop = { id: string; name: string; median: number }
const HOPS: readonly Hop[] = [
  { id: 'hop-home', name: 'Home', median: 3 },
  { id: 'hop-isp', name: 'ISP', median: 10 },
  { id: 'hop-provider', name: 'Provider', median: 36 },
]
const KEYS = ['home', 'isp', 'provider'] as const
const COLOR = { light: '#0077bd', dark: '#5fb4f0' }
const hopKey = (h: Hop): string => h.id.slice('hop-'.length)

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: ReactElement): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root?.render(node))
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  return el
}

const fire = (target: Element, event: Event) =>
  act(async () => {
    target.dispatchEvent(event)
  })
const enter = (target: Element) => act(async () => fireEvent.pointerEnter(target))
const leave = (target: Element) =>
  act(async () => fireEvent.pointerLeave(target, { pointerType: 'mouse' }))

/** The stroke opacity of each series' line path, by series key. */
function lineOpacity(el: HTMLElement): Record<string, number> {
  const out: Record<string, number> = {}
  for (const key of KEYS) {
    const path = el.querySelector(`path[data-ts-key^="${key}"]`)
    out[key] = Number(path?.getAttribute('stroke-opacity') ?? 1)
  }
  return out
}

const marked = (el: HTMLElement, selector: string): (string | null)[] =>
  [...el.querySelectorAll(selector)].map((row) =>
    row.hasAttribute('data-focused') ? (row.getAttribute('data-key') ?? row.textContent) : null,
  )

function Chart({ focus }: { focus: ReturnType<typeof useChartFocus<Minute>> }) {
  return (
    <CartesianChart
      label="Round trip by hop"
      data={MINUTES}
      x={{ value: (d) => d.at }}
      series={KEYS.map((key) => ({
        key,
        label: key,
        color: COLOR,
        mark: 'line' as const,
        y: (d: Minute) => d[key],
      }))}
      cursor="series-focus"
      focus={focus}
    />
  )
}

function WithList() {
  const focus = useChartFocus(MINUTES, { announce: (d) => `minute ${d.at}` })
  return (
    <div>
      <output data-series="">{focus.series ?? ''}</output>
      <Chart focus={focus} />
      <ul>
        {KEYS.map((key) => (
          <li key={key} data-key={key} data-row="" {...focus.seriesItem(key)}>
            {key}
          </li>
        ))}
      </ul>
    </div>
  )
}

const hop = col<Hop>()

function WithTable() {
  const focus = useChartFocus(MINUTES, { announce: (d) => `minute ${d.at}` })
  const table = useDataTable<Hop>({
    id: 'hops',
    label: 'Hops',
    columns: [hop.entity('name', { header: 'Hop' }), hop.number('median', { header: 'Median' })],
    data: HOPS,
    getRowId: (h) => h.id,
    mode: { kind: 'client' },
  })
  return (
    <div>
      <output data-series="">{focus.series ?? ''}</output>
      <Chart focus={focus} />
      <DataTable table={table} focusSeries={{ focus, key: hopKey }} />
    </div>
  )
}

const series = (el: HTMLElement) => el.querySelector('[data-series]')?.textContent
const bodyRows = (el: HTMLElement) => [
  ...el.querySelectorAll<HTMLElement>('[data-slot="table-body"] [role="row"]'),
]

describe('a list row stands for a chart series', () => {
  test('at rest no line dims and no row is marked', async () => {
    const el = await mount(<WithList />)
    expect(Object.values(lineOpacity(el))).toEqual([1, 1, 1])
    expect(marked(el, '[data-row]')).toEqual([null, null, null])
  })

  test('pointing at a row emphasises its series and dims the other lines', async () => {
    const el = await mount(<WithList />)
    await enter(el.querySelector('[data-key="isp"]') as Element)
    expect(series(el)).toBe('isp')
    const opacity = lineOpacity(el)
    expect(opacity['isp']).toBe(1)
    expect(opacity['home']).toBeLessThan(1)
    expect(opacity['provider']).toBeLessThan(1)
    expect(marked(el, '[data-row]')).toEqual([null, 'isp', null])
  })

  test('the legend emphasising a series marks its row, and clears it on leave', async () => {
    const el = await mount(<WithList />)
    const entry = el.querySelector('[data-legend-key="provider"]') as Element
    expect(entry).not.toBeNull()
    await fire(entry, new MouseEvent('mouseover', { bubbles: true }))
    expect(series(el)).toBe('provider')
    expect(marked(el, '[data-row]')).toEqual([null, null, 'provider'])
    await fire(entry, new MouseEvent('mouseout', { bubbles: true }))
    expect(series(el)).toBe('')
    expect(marked(el, '[data-row]')).toEqual([null, null, null])
  })
})

describe('DataTable focusSeries', () => {
  test('pointing at a row emphasises the series its key names; leaving the rows clears it', async () => {
    const el = await mount(<WithTable />)
    const rows = bodyRows(el)
    expect(rows).toHaveLength(3)
    await enter(rows[2] as Element)
    expect(series(el)).toBe('provider')
    expect(lineOpacity(el)['home']).toBeLessThan(1)
    expect(lineOpacity(el)['provider']).toBe(1)
    await leave(rows[2] as Element)
    await leave(el.querySelector('tbody') as Element)
    expect(series(el)).toBe('')
  })

  test("the table's own row focus emphasises the series, and the legend marks the row", async () => {
    const el = await mount(<WithTable />)
    await act(async () => bodyRows(el)[0]?.focus())
    expect(series(el)).toBe('home')
    const entry = el.querySelector('[data-legend-key="isp"]') as Element
    await fire(entry, new MouseEvent('mouseover', { bubbles: true }))
    expect(bodyRows(el).map((r) => r.hasAttribute('data-focused'))).toEqual([false, true, false])
  })
})
