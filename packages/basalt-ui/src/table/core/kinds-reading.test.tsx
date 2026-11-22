/**
 * The reading look a monitoring table needs (docs/v3/issues/bench/bench-table-reading.json): a
 * stacked meter, a meter fraction, a duration with a trend, a number fraction, an age beside the
 * first value, a status lamp, a spark total and a header help mark. Cells go through `spec.render`
 * with a fixed env; sorting goes through a real table, by each column's value and never its text.
 */
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { createFormat } from '../../core/format'
import { DataTable } from '../parts/data-table'
import { modelOf, useDataTable } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { col, specOf } from './kinds'
import { cellAttributes, durationText } from './kinds-cells'
import type { CellEnv } from './kinds-spec'

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

const HOUR = 3_600_000
const NOW = Date.parse('2026-11-22T12:00:00Z')

type Project = {
  id: string
  name: string
  open: number
  running: number
  paused: number
  ready: number
  cycleMs: number | null
  cycleBeforeMs: number | null
  production: 'incident' | 'regressed' | 'quiet'
  productionAt: string | null
  clean: number
  probes: number
  planDone: number
  planTotal: number
  shipped: number[]
}

const ROWS: Project[] = [
  {
    id: 'a',
    name: 'argo',
    open: 5,
    running: 2,
    paused: 1,
    ready: 2,
    cycleMs: 0.5 * HOUR,
    cycleBeforeMs: 4.2 * HOUR,
    production: 'quiet',
    productionAt: null,
    clean: 11,
    probes: 12,
    planDone: 9,
    planTotal: 10,
    shipped: [1, 0, 2],
  },
  {
    id: 'b',
    name: 'basalt',
    open: 12,
    running: 4,
    paused: 0,
    ready: 8,
    cycleMs: 9 * HOUR,
    cycleBeforeMs: 3 * HOUR,
    production: 'incident',
    productionAt: new Date(NOW - 3 * HOUR).toISOString(),
    clean: 12,
    probes: 12,
    planDone: 455,
    planTotal: 472,
    shipped: [4, 3, 5],
  },
  {
    id: 'c',
    name: 'cobalt',
    open: 0,
    running: 0,
    paused: 0,
    ready: 0,
    cycleMs: 2 * HOUR,
    cycleBeforeMs: 2.1 * HOUR,
    production: 'regressed',
    productionAt: new Date(NOW - 2 * 24 * HOUR).toISOString(),
    clean: 3,
    probes: 12,
    planDone: 1,
    planTotal: 4,
    shipped: [0, 0, 0],
  },
]

const ENV: CellEnv = {
  format: createFormat(),
  now: NOW,
  zone: 'UTC',
  box: { height: 24, phase: 'ready' },
}

const c = col<Project>()

const COLUMNS = {
  name: c.entity('name', { header: 'Project' }),
  now: c.meter('open', {
    header: 'Now',
    max: 12,
    segments: [
      { label: 'Running', tone: 'accent', value: (r) => r.running },
      { label: 'Paused', tone: 'warn', value: (r) => r.paused },
      { label: 'Ready', tone: 'neutral', value: (r) => r.ready },
    ],
  }),
  cycle: c.number('cycleMs', {
    header: 'Cycle',
    duration: 'ms',
    trend: { before: (r) => r.cycleBeforeMs, better: 'lower', against: 'the 7 days before' },
    help: 'Median filed to closed over 7 days, against the 7 before.',
  }),
  production: c.status('production', {
    header: 'Production',
    options: ['incident', 'regressed', 'quiet'],
    labels: { incident: 'Incident open', regressed: 'Regressed in 7 days', quiet: 'Quiet' },
    tone: (v) => (v === 'incident' ? 'bad' : v === 'regressed' ? 'warn' : 'neutral'),
    lamp: true,
    age: { at: (r) => r.productionAt, label: 'since' },
  }),
  hygiene: c.number('clean', {
    header: 'Hygiene',
    of: (r) => r.probes,
    warnBelow: 1,
    badBelow: 0.5,
  }),
  plan: c.meter('planDone', { header: 'Plan', max: (r) => r.planTotal, fraction: true }),
  shipped: c.spark('shipped', {
    header: 'Shipped 7 d',
    label: 'Shipped per day',
    value: (r) => r.shipped.reduce((a, b) => a + b, 0),
    render: (r) => <span data-line="">{r.shipped.join(' ')}</span>,
  }),
}

function cell(column: (typeof COLUMNS)[keyof typeof COLUMNS], row: Project): HTMLElement {
  const spec = specOf(column)
  function Cell(): ReactNode {
    return (
      <table>
        <tbody>
          <tr>
            <td {...cellAttributes(spec)}>{spec.render?.(row, ENV)}</td>
          </tr>
        </tbody>
      </table>
    )
  }
  return render(<Cell />).container.querySelector('td') as HTMLElement
}

const [ARGO, BASALT, COBALT] = ROWS as [Project, Project, Project]

describe('a stacked meter', () => {
  test('draws one part per non-zero count, names each for assistive tech, and the total beside it', () => {
    const td = cell(COLUMNS.now, ARGO)
    const track = within(td).getByRole('img')
    expect(track.getAttribute('aria-label')).toBe('Now: 5')
    expect(td.querySelector('[data-slot="table-meter-parts"]')?.textContent).toBe(
      'Running 2, Paused 1, Ready 2',
    )
    expect(td.querySelector('[data-slot="table-meter-stack"]')?.getAttribute('title')).toBe(
      'Now: 5; Running 2, Paused 1, Ready 2',
    )
    const parts = [...td.querySelectorAll('[data-part]')]
    expect(parts.map((p) => p.getAttribute('data-tone'))).toEqual(['accent', 'warn', 'neutral'])
    expect((parts[0] as HTMLElement).style.getPropertyValue('--part')).toBe(`${(2 / 12) * 100}%`)
    expect(td.textContent).toBe('5Running 2, Paused 1, Ready 2')
  })

  test('a part of zero draws nothing', () => {
    const td = cell(COLUMNS.now, BASALT)
    expect([...td.querySelectorAll('[data-part]')].map((p) => p.getAttribute('data-part'))).toEqual(
      ['Running', 'Ready'],
    )
  })
})

describe('a meter fraction', () => {
  test('writes the value of its own whole', () => {
    const td = cell(COLUMNS.plan, BASALT)
    expect(td.textContent).toContain('455/472')
  })

  test('a per-row whole sorts by the share', () => {
    const spec = specOf(COLUMNS.plan)
    expect(spec.value(ARGO)).toBe(0.9)
    expect(spec.value(COBALT)).toBe(0.25)
  })
})

describe('durationText', () => {
  test('writes the one largest unit, a decimal below ten from an hour up', () => {
    const f = ENV.format
    expect(durationText(f, 45_000)).toBe('45 sec')
    expect(durationText(f, 30 * 60_000)).toBe('30 min')
    expect(durationText(f, 59 * 60_000 + 50_000)).toBe('1 hr')
    expect(durationText(f, 1.4 * HOUR)).toBe('1.4 hr')
    expect(durationText(f, 13 * HOUR)).toBe('13 hr')
    expect(durationText(f, 2.1 * 24 * HOUR)).toBe('2.1 days')
    expect(durationText(f, 12 * 24 * HOUR)).toBe('12 days')
    expect(durationText(f, Number.NaN)).toBe('–')
  })
})

describe('a duration with a trend', () => {
  test('writes the one largest unit and an arrow toned by the rule, with the comparison in words', () => {
    const faster = cell(COLUMNS.cycle, ARGO)
    expect(faster.querySelector('[data-slot="table-figure"] > span')?.textContent).toBe('30 min')
    const arrow = faster.querySelector('[data-slot="table-trend"]')
    expect(arrow?.getAttribute('data-direction')).toBe('down')
    expect(arrow?.getAttribute('data-tone')).toBe('good')
    expect(faster.textContent).toContain('down from 4.2 hr the 7 days before')
    expect(faster.querySelector('[data-slot="table-figure"]')?.getAttribute('title')).toBe(
      '30 min, down from 4.2 hr the 7 days before',
    )

    const slower = cell(COLUMNS.cycle, BASALT)
    const up = slower.querySelector('[data-slot="table-trend"]')
    expect(up?.getAttribute('data-direction')).toBe('up')
    expect(up?.getAttribute('data-tone')).toBe('bad')
  })

  test('a change within a tenth is flat and neutral', () => {
    const td = cell(COLUMNS.cycle, COBALT)
    const arrow = td.querySelector('[data-slot="table-trend"]')
    expect(arrow?.getAttribute('data-direction')).toBe('flat')
    expect(arrow?.getAttribute('data-tone')).toBe('neutral')
    expect(td.textContent).toContain('unchanged from 2.1 hr')
  })

  test('an absent figure draws its dash in the figure place and keeps the trailing slots', () => {
    const td = cell(COLUMNS.cycle, { ...ARGO, cycleMs: null })
    const figure = td.querySelector('[data-slot="table-figure"]')
    expect(figure?.querySelector('[data-slot="table-absent"]')).not.toBeNull()
    expect(figure?.children).toHaveLength(2)
  })

  test('the header of a figure with slots ends where the figures end', () => {
    expect(specOf(COLUMNS.cycle).trail).toBe('trend')
    expect(specOf(COLUMNS.hygiene).trail).toBeUndefined()
    expect(specOf(c.number('clean', { of: (r) => r.probes, age: { at: () => null } })).trail).toBe(
      'age',
    )
  })

  test('without a value before, the arrow keeps its slot and says nothing', () => {
    const td = cell(COLUMNS.cycle, { ...ARGO, cycleBeforeMs: null })
    expect(td.querySelector('[data-slot="table-trend"]')).toBeNull()
    expect(td.textContent).toBe('30 min')
  })
})

describe('a number fraction', () => {
  test('writes 11/12, is heard as 11 of 12, and takes the warn ink under its threshold', () => {
    const td = cell(COLUMNS.hygiene, ARGO)
    const figure = td.querySelector('[data-slot="table-figure"]') as HTMLElement
    expect(figure.getAttribute('data-tone')).toBe('warn')
    expect(figure.querySelector('[aria-hidden="true"]')?.textContent).toBe('11/12')
    expect(figure.querySelector('.sr-only')?.textContent).toBe('11 of 12')
    expect(figure.querySelector('.text-warn')).not.toBeNull()
  })

  test('full is quiet, under the bad threshold is bad', () => {
    expect(
      cell(COLUMNS.hygiene, BASALT)
        .querySelector('[data-slot="table-figure"]')
        ?.hasAttribute('data-tone'),
    ).toBe(false)
    cleanup()
    expect(
      cell(COLUMNS.hygiene, COBALT)
        .querySelector('[data-slot="table-figure"]')
        ?.getAttribute('data-tone'),
    ).toBe('bad')
  })

  test('sorts by the share and refuses a footer', () => {
    expect(specOf(COLUMNS.hygiene).value(COBALT)).toBe(0.25)
    expect(() => c.number('clean', { of: (r) => r.probes, footer: 'sum' })).toThrow(
      /takes no "footer"/,
    )
    expect(() => c.number('clean', { warnBelow: 1 })).toThrow(/needs "of"/)
  })
})

describe('a status lamp with an age', () => {
  test('draws the toned dot alone, its word for assistive tech and on hover, and the age after it', () => {
    const td = cell(COLUMNS.production, BASALT)
    const lamp = td.querySelector('[data-slot="table-lamp"]') as HTMLElement
    expect(lamp.getAttribute('data-tone')).toBe('bad')
    expect(lamp.getAttribute('title')).toBe('Incident open')
    expect(lamp.querySelector('.sr-only')?.textContent).toBe('Incident open')
    const age = td.querySelector('[data-slot="table-age"]') as HTMLElement
    expect(age.querySelector('[aria-hidden="true"]')?.textContent).toBe('3 hr')
    expect(age.querySelector('.sr-only')?.textContent).toBe(', since 3 hours ago')
  })

  test('a row with no age keeps the slot, so the next ages line up', () => {
    const td = cell(COLUMNS.production, ARGO)
    expect(td.querySelector('[data-slot="table-age"]')).toBeNull()
    expect(td.querySelectorAll('[data-slot="table-lamp"] > span')).toHaveLength(3)
  })
})

describe('a spark total', () => {
  test('draws the line and its total, and sorts by the total', () => {
    const td = cell(COLUMNS.shipped, BASALT)
    expect(td.querySelector('[data-line]')).not.toBeNull()
    expect(td.querySelector('[data-slot="table-spark-total"]')?.textContent).toContain('12')
    const spec = specOf(COLUMNS.shipped)
    expect(spec.sort).toEqual({ fn: 'basic' })
    expect(spec.value(BASALT)).toBe(12)
  })
})

describe('header help', () => {
  test('every kind carries it, a custom column too', () => {
    const plain = specOf(
      c.custom('note', { render: () => null, sortValue: () => 0, card: 'meta', priority: 2 }),
    )
    const helped = specOf(
      c.custom('note', {
        help: 'What the note says',
        render: () => null,
        sortValue: () => 0,
        card: 'meta',
        priority: 2,
      }),
    )
    expect(helped.help).toBe('What the note says')
    expect(plain.help).toBeUndefined()
    expect(specOf(c.number('cycleMs', { help: 'Median cycle' })).help).toBe('Median cycle')
  })
})

type Spaced = { id: string; name: string; space: string }
const SPACED: Spaced[] = [
  { id: 'a', name: 'argo', space: 'Apps' },
  { id: 'b', name: 'basalt', space: 'Tooling' },
]
const s = col<Spaced>()
let spaced: TableModel<Spaced> | undefined

function Folded({ fold }: { fold: boolean }): ReactElement {
  const t = useDataTable<Spaced>({
    id: 'folded',
    label: 'Projects',
    columns: [s.entity('name', { header: 'Project' }), s.text('space', { header: 'Space' })],
    data: SPACED,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    group: { by: 'space', fold },
  })
  const built = modelOf(t)
  useEffect(() => {
    spaced = built
  })
  return <DataTable table={t} />
}

const spaceHead = (): HTMLElement | null => screen.queryByRole('columnheader', { name: 'Space' })

describe('a folded grouping', () => {
  test('draws its column in the group rows only, and shows it again when the rows are flat', () => {
    render(<Folded fold />)
    expect(spaceHead()).toBeNull()
    // every part, the columns menu too, reads the folded column as hidden
    expect(spaced?.state.display.visibility['space']).toBe(false)
    expect(document.querySelectorAll('tbody tr[data-group]')).toHaveLength(2)
    act(() => spaced?.setGroupBy(null))
    expect(spaceHead()).not.toBeNull()
  })

  test('without fold the column stays in every row', () => {
    render(<Folded fold={false} />)
    expect(spaceHead()).not.toBeNull()
  })

  test("a reader's choice in the columns menu wins", () => {
    render(<Folded fold />)
    act(() => spaced?.state.setDisplay({ visibility: { space: true } }))
    expect(spaceHead()).not.toBeNull()
    expect(spaced?.state.display.visibility['space']).toBe(true)
  })

  test("writing back the visibility it read does not store the fold's hide", () => {
    render(<Folded fold />)
    const read = spaced?.state.display.visibility ?? {}
    act(() => spaced?.state.setDisplay({ visibility: { ...read, other: false } }))
    act(() => spaced?.setGroupBy(null))
    expect(spaceHead()).not.toBeNull()
    expect(spaced?.state.display.visibility).toEqual({ other: false })
  })
})

let latest: TableModel<Project> | undefined

function Subject(): ReactElement {
  const t = useDataTable<Project>({
    id: 'reading',
    label: 'Projects',
    columns: Object.values(COLUMNS),
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    now: NOW,
  })
  const built = modelOf(t)
  useEffect(() => {
    latest = built
  })
  return <DataTable table={t} />
}

const order = (): string[] =>
  [...document.querySelectorAll('tbody tr[data-row-id], tbody tr')]
    .map((tr) => tr.querySelector('td[data-col="name"]')?.textContent ?? '')
    .filter((name) => name !== '')

describe('in a table', () => {
  test('a header with help carries one mark that names the column', () => {
    render(<Subject />)
    const cycle = screen.getByRole('columnheader', { name: 'Cycle' })
    const marks = cycle.querySelectorAll('[data-slot="info-hint"]')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.getAttribute('aria-label')).toContain('Cycle')
    expect(
      screen.getByRole('columnheader', { name: 'Plan' }).querySelector('[data-slot="info-hint"]'),
    ).toBeNull()
  })

  const SORTS: [string, boolean, string[]][] = [
    ['open', false, ['cobalt', 'argo', 'basalt']],
    ['cycleMs', false, ['argo', 'cobalt', 'basalt']],
    ['production', false, ['basalt', 'cobalt', 'argo']],
    ['clean', false, ['cobalt', 'argo', 'basalt']],
    ['planDone', true, ['basalt', 'argo', 'cobalt']],
    ['shipped', true, ['basalt', 'argo', 'cobalt']],
  ]
  for (const [id, desc, expected] of SORTS) {
    test(`sorts ${id} by its value, ${desc ? 'descending' : 'ascending'}`, () => {
      render(<Subject />)
      act(() => latest?.state.setRequest({ sort: [{ id, desc }] }))
      expect(order()).toEqual(expected)
    })
  }
})
