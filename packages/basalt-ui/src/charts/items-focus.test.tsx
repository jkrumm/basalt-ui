/**
 * A list row that stands for chart items of another grain (`v3-expr-9-contract` (a)): `focus.hold`
 * on the focus handle and `DataTable focusItems` on a table. A window row holds a run of hours
 * (expression cycle 9, n34): pointing at it holds every hour, the chart draws the run as one x
 * band, and the live region says the run. A finding row holds its probe (n33): pointing at it
 * focuses the probe, and a focused probe marks every finding under it.
 */
import { fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { act, useEffect } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { col } from '../table/core/kinds'
import { DataTable } from '../table/parts/data-table'
import { useDataTable } from '../table/use-data-table'
import { useChartFocus } from './focus'
import type { ChartFocus } from './focus'
import { CartesianChart } from './parts/cartesian'

type Hour = { h: number; tide: number }
const HOURS: readonly Hour[] = Array.from({ length: 12 }, (_, h) => ({ h, tide: 1 + (h % 5) / 2 }))
type Window = { id: string; from: number; to: number }
const WINDOWS: readonly Window[] = [
  { id: 'w-2', from: 2, to: 5 },
  { id: 'w-8', from: 8, to: 9 },
  { id: 'w-11', from: 11, to: 11 },
  // Past the last hour: a row that holds nothing.
  { id: 'w-30', from: 30, to: 33 },
]
const inWindow = (w: Window, d: Hour): boolean => d.h >= w.from && d.h <= w.to
const COLOR = { light: '#0077bd', dark: '#5fb4f0' }

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

const enter = (target: Element) => act(async () => fireEvent.pointerEnter(target))
const leave = (target: Element) =>
  act(async () => fireEvent.pointerLeave(target, { pointerType: 'mouse' }))
const bodyRows = (el: HTMLElement) => [
  ...el.querySelectorAll<HTMLElement>('[data-slot="table-body"] [role="row"]'),
]
const state = (rows: readonly HTMLElement[]) =>
  rows.map((r) =>
    r.hasAttribute('data-focused') ? 'focused' : r.hasAttribute('data-dimmed') ? 'dimmed' : '-',
  )
const held = (el: HTMLElement) => el.querySelector('[data-held]')?.textContent
const live = (el: HTMLElement) => el.querySelector('[data-chart-focus-live]')?.textContent

let handle: ChartFocus<Hour> | undefined

const win = col<Window>()

function Harbour({ announceSpan }: { announceSpan?: (items: readonly Hour[]) => string }) {
  const focus = useChartFocus(HOURS, {
    announce: (d) => `hour ${d.h}`,
    ...(announceSpan !== undefined && { announceSpan }),
  })
  useEffect(() => {
    handle = focus
  })
  const table = useDataTable<Window>({
    id: 'windows',
    label: 'Go windows',
    columns: [win.entity('id', { header: 'Window' })],
    data: WINDOWS,
    getRowId: (w) => w.id,
    mode: { kind: 'client' },
  })
  return (
    <div>
      <output data-held="">{focus.span.map((d) => d.h).join(',')}</output>
      <CartesianChart
        label="Tide by hour"
        data={HOURS}
        x={{ value: (d) => d.h }}
        series={[{ key: 'tide', label: 'Tide', color: COLOR, mark: 'line', y: (d) => d.tide }]}
        cursor="items-focus"
        focus={focus}
      />
      <DataTable table={table} focusItems={{ focus, holds: inWindow }} />
    </div>
  )
}

describe('DataTable focusItems: a row that stands for a run of items', () => {
  test('pointing at a window row holds every hour in it and draws the run as one x band', async () => {
    const el = await mount(<Harbour />)
    expect(el.querySelector('[data-ts-key="xzone-0"]')).toBeNull()
    await enter(bodyRows(el)[0] as Element)
    expect(held(el)).toBe('2,3,4,5')
    expect(handle?.index).toBe(2)
    expect(state(bodyRows(el))).toEqual(['focused', 'dimmed', 'dimmed', 'dimmed'])
    expect(el.querySelector('[data-ts-key="xzone-0"]')).not.toBeNull()
    expect(live(el)).toBe('hour 2 to hour 5')
  })

  test('a held run reads every held item as focused and dims only the rest', async () => {
    const el = await mount(<Harbour />)
    await enter(bodyRows(el)[1] as Element)
    expect(held(el)).toBe('8,9')
    expect(handle?.dimmed(HOURS[8] as Hour)).toBe(false)
    expect(handle?.dimmed(HOURS[9] as Hour)).toBe(false)
    expect(handle?.dimmed(HOURS[7] as Hour)).toBe(true)
    expect(handle?.item(9)['data-focused']).toBe('')
    expect(handle?.item(10)['data-dimmed']).toBe('')
  })

  test('a row of one item focuses it as `focus` does, with no band', async () => {
    const el = await mount(<Harbour />)
    await enter(bodyRows(el)[2] as Element)
    expect(held(el)).toBe('11')
    expect(el.querySelector('[data-ts-key="xzone-0"]')).toBeNull()
    expect(live(el)).toBe('hour 11')
  })

  test('an hour focused elsewhere marks the window row that holds it', async () => {
    const el = await mount(<Harbour />)
    await act(async () => handle?.set(9))
    expect(state(bodyRows(el))).toEqual(['dimmed', 'focused', 'dimmed', 'dimmed'])
    await act(async () => handle?.set(0))
    expect(state(bodyRows(el))).toEqual(['dimmed', 'dimmed', 'dimmed', 'dimmed'])
  })

  test("the table's own row focus holds the run, and the page's announceSpan says it", async () => {
    const el = await mount(
      <Harbour announceSpan={(run) => `Go ${run[0]?.h}:00 to ${run.at(-1)?.h}:00`} />,
    )
    await act(async () => bodyRows(el)[0]?.focus())
    expect(held(el)).toBe('2,3,4,5')
    expect(live(el)).toBe('Go 2:00 to 5:00')
  })

  test('leaving the rows clears the run', async () => {
    const el = await mount(<Harbour />)
    await enter(bodyRows(el)[0] as Element)
    await leave(el.querySelector('tbody') as Element)
    expect(held(el)).toBe('')
    expect(el.querySelector('[data-ts-key="xzone-0"]')).toBeNull()
  })

  test('pointing at or stepping onto a row that holds nothing clears the run', async () => {
    const el = await mount(<Harbour />)
    await enter(bodyRows(el)[0] as Element)
    await enter(bodyRows(el)[3] as Element)
    expect(held(el)).toBe('')
    await act(async () => bodyRows(el)[0]?.focus())
    expect(held(el)).toBe('2,3,4,5')
    await act(async () => bodyRows(el)[3]?.focus())
    expect(held(el)).toBe('')
    expect(live(el)).toBe('')
  })
})

type Probe = { id: string; name: string }
type Finding = { id: string; probe: string }
const PROBES: readonly Probe[] = [
  { id: 'p-ci', name: 'CI runtime' },
  { id: 'p-tls', name: 'TLS expiry' },
  { id: 'p-deps', name: 'Dependencies' },
]
const FINDINGS: readonly Finding[] = [
  { id: 'F-1', probe: 'TLS expiry' },
  { id: 'F-2', probe: 'CI runtime' },
  { id: 'F-3', probe: 'TLS expiry' },
  { id: 'F-4', probe: 'Dependencies' },
]
const finding = col<Finding>()

function Hygiene() {
  const focus = useChartFocus(PROBES, { announce: (p) => p.name })
  const table = useDataTable<Finding>({
    id: 'findings',
    label: 'Findings',
    columns: [finding.entity('id', { header: 'Finding' })],
    data: FINDINGS,
    getRowId: (f) => f.id,
    mode: { kind: 'client' },
  })
  return (
    <div>
      <ul>
        {PROBES.map((p, i) => (
          <li key={p.id} data-probe="" {...focus.item(i)}>
            {p.name}
          </li>
        ))}
      </ul>
      <DataTable table={table} focusItems={{ focus, holds: (f, p) => p.name === f.probe }} />
      {focus.live}
    </div>
  )
}

describe('DataTable focusItems: a row under a parent item', () => {
  test('pointing at a finding focuses its probe and marks every finding under it', async () => {
    const el = await mount(<Hygiene />)
    await enter(bodyRows(el)[0] as Element)
    const probes = [...el.querySelectorAll<HTMLElement>('[data-probe]')]
    expect(state(probes)).toEqual(['dimmed', 'focused', 'dimmed'])
    expect(state(bodyRows(el))).toEqual(['focused', 'dimmed', 'focused', 'dimmed'])
    expect(live(el)).toBe('TLS expiry')
  })

  test('pointing at a probe marks every finding under it', async () => {
    const el = await mount(<Hygiene />)
    await enter(el.querySelectorAll('[data-probe]')[0] as Element)
    expect(state(bodyRows(el))).toEqual(['dimmed', 'focused', 'dimmed', 'dimmed'])
  })
})

describe('focus.hold', () => {
  test('one index is set of it, none clears, and the order is the items order', async () => {
    const el = await mount(<Harbour />)
    await act(async () => handle?.hold([5, 3, 4, 3]))
    expect(held(el)).toBe('3,4,5')
    expect(handle?.datum).toBe(HOURS[3] as Hour)
    await act(async () => handle?.hold([7]))
    expect(held(el)).toBe('7')
    await act(async () => handle?.hold([-1, 99]))
    expect(held(el)).toBe('')
    expect(handle?.index).toBeNull()
  })
})
