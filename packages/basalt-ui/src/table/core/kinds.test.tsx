/**
 * Kinds decide alignment, numerals, width, sort, filter, card slot and priority (concept section
 * 5); options carry data only. Rendering goes through `spec.render` with a fixed env, the way the
 * parts call it.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createFormat } from '../../core/format'
import type { DateStyle } from '../../core/format'
import type { IconComponent } from '../../core/ports'
import type { KindColumn } from '../contract'
import { matchesFilter } from './filters'
import { checkSchema, col, specOf } from './kinds'
import { engineColumn } from './kinds-engine'
import { ABSENT, DeltaCell, cellAttributes, deltaText } from './kinds-cells'
import { KIND_DEFAULTS } from './kinds-spec'
import type { CellEnv, KindName } from './kinds-spec'

afterEach(cleanup)

type Row = {
  id: string
  name: string
  note: string | null
  amount: number | null
  count: number
  at: string
  state: string
  change: number
  load: number
  active: boolean
  category: string
  owner: string
  team: string[]
  tags: string[]
  due: string
  site: string
}

const ROW: Row = {
  id: 'r1',
  name: 'Acme',
  note: 'A long note that may wrap',
  amount: 1234.5,
  count: 42,
  at: '2026-11-01',
  state: 'Open',
  change: 3,
  load: 0.4,
  active: true,
  category: 'Food',
  owner: 'Ada Lovelace',
  team: ['Ada Lovelace', 'Alan Turing'],
  tags: ['design', 'ops'],
  due: '2026-11-15',
  site: 'https://acme.example/pricing',
}

const ENV: CellEnv = {
  format: createFormat(),
  now: Date.parse('2026-11-11T12:00:00Z'),
  box: { height: 24, phase: 'ready' },
}

const c = col<Row>()

function cell(column: ReturnType<typeof c.text>, row: Row = ROW): HTMLElement {
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

const ALL = () => [
  c.entity('name'),
  c.person('owner'),
  c.tags('tags'),
  c.countdown('due'),
  c.link('site'),
  c.text('note'),
  c.number('count'),
  c.money('amount', { currency: 'EUR' }),
  c.date('at'),
  c.relativeTime('at', { id: 'ago' }),
  c.status('state', { options: ['Open', 'Done'] }),
  c.delta('change', { polarity: 'up-good' }),
  c.meter('load'),
  c.boolean('active'),
  c.spark('trend', { label: 'Trend', render: () => 'spark' }),
  c.select('category', {
    label: (r) => `Category of ${r.name}`,
    options: ['Food'],
    commit: () => {},
  }),
  c.actions([{ id: 'edit', label: 'Edit', onClick: () => {} }]),
  c.progress('count'),
  c.custom('score', { render: () => 'x', sortValue: (r) => r.count, card: 'meta', priority: 3 }),
]

const kindSpec = (kind: KindName) => {
  const column = ALL().find((k) => specOf(k).kind === kind)
  if (column === undefined) throw new Error(`no ${kind} column in ALL`)
  return specOf(column)
}

describe('kind table', () => {
  test('every kind of section 5 has a constructor and derives its defaults', () => {
    const kinds = ALL().map((k) => specOf(k).kind)
    expect(kinds.toSorted()).toEqual((Object.keys(KIND_DEFAULTS) as KindName[]).toSorted())
    for (const column of ALL()) {
      const spec = specOf(column)
      if (spec.kind === 'custom') continue
      const d = KIND_DEFAULTS[spec.kind]
      expect([spec.kind, spec.align, spec.numerals, spec.wrap]).toEqual([
        spec.kind,
        d.align,
        d.numerals,
        d.wrap,
      ])
      expect(spec.priority).toBe(d.priority)
    }
  })

  test('only text wraps', () => {
    const wrapping = ALL()
      .map(specOf)
      .filter((s) => s.wrap)
      .map((s) => s.kind)
    expect(wrapping).toEqual(['text'])
  })

  test('figures are end-aligned tabular; entity and text start; boolean centred; actions pinned end', () => {
    for (const kind of ['number', 'money', 'delta'] as const) {
      expect([kindSpec(kind).align, kindSpec(kind).numerals]).toEqual(['end', 'tabular'])
    }
    expect(kindSpec('entity').align).toBe('start')
    expect(kindSpec('boolean').align).toBe('center')
    const actions = kindSpec('actions')
    expect([actions.pin, actions.priority, actions.card]).toEqual(['end', null, ['kebab']])
  })

  test('sort per kind: natural text, datetime dates, option order for status, none for spark/select/actions', () => {
    const sort = (kind: KindName) => kindSpec(kind).sort
    expect(sort('entity')).toEqual({ fn: 'alphanumeric' })
    expect(sort('text')).toEqual({ fn: 'alphanumeric' })
    expect(sort('date')).toEqual({ fn: 'datetime' })
    expect(sort('money')).toEqual({ fn: 'basic' })
    expect([sort('spark'), sort('select'), sort('actions')]).toEqual([null, null, null])
    const status = specOf(c.status('state', { options: ['Open', 'Done'] })).sort
    expect(
      status !== null && 'compare' in status && status.compare('Done', 'Open'),
    ).toBeGreaterThan(0)
    expect(specOf(c.text('note', { sortable: false })).sort).toBeNull()
  })

  test('filters are opt-in per column: text contains, status anyOf', () => {
    expect(specOf(c.text('note')).filter).toBeNull()
    expect(specOf(c.text('note', { filter: 'text' })).filter).toBe('contains')
    expect(specOf(c.entity('name', { filter: 'text' })).filter).toBe('contains')
    expect(specOf(c.status('state', { options: ['Open'], filter: 'multi' })).filter).toBe('anyOf')
  })

  test('an explicit card or priority option leads; the kind order follows', () => {
    const spec = specOf(c.money('amount', { currency: 'EUR', card: 'meta', priority: 3 }))
    expect(spec.card).toEqual(['meta', 'value', 'meta'])
    expect(spec.priority).toBe(3)
  })
})

describe('kind cells', () => {
  test('money: unit in the header, grouped with the currency minor digits, end-aligned tabular', () => {
    const column = c.money('amount', { currency: 'EUR' })
    expect(specOf(column).header).toBe('Amount (EUR)')
    expect(specOf(c.money('amount', { currency: 'EUR', header: 'Total (EUR)' })).header).toBe(
      'Total (EUR)',
    )
    expect(specOf(c.money('amount', { currency: 'JPY', header: 'Total' })).header).toBe(
      'Total (JPY)',
    )
    const td = cell(column)
    expect(td.textContent).toBe('1,234.50')
    expect(td.getAttribute('data-align')).toBe('end')
    expect(td.getAttribute('data-numerals')).toBe('tabular')
  })

  test('number carries its unit in the header, never in the cell', () => {
    const column = c.number('count', { unit: 'kg' })
    expect(specOf(column).header).toBe('Count (kg)')
    expect(cell(column).textContent).toBe('42')
  })

  test('a null renders a muted dash, not zero', () => {
    const td = cell(c.money('amount', { currency: 'EUR' }), { ...ROW, amount: null })
    expect(td.textContent).toBe(ABSENT)
    expect(td.querySelector('[data-slot="table-absent"]')?.className).toContain(
      'text-muted-foreground',
    )
    expect(cell(c.text('note'), { ...ROW, note: null }).textContent).toBe(ABSENT)
  })

  test('date keeps a calendar date zone-less; relativeTime names the full instant', () => {
    expect(cell(c.date('at')).querySelector('time')?.getAttribute('dateTime')).toBe('2026-11-01')
    const ago = cell(c.relativeTime('at'), { ...ROW, at: '2026-11-11T09:00:00Z' }).querySelector(
      'time',
    )
    expect(ago?.textContent).toBe('3 hours ago')
    expect(ago?.getAttribute('aria-label')).toBeTruthy()
  })

  test('delta keeps its direction and verdict in a locale whose figures do not parse back', () => {
    expect(deltaText('+3', 3)).toBe('+3')
    expect(deltaText('-0,5', -0.5)).toBe('-0.5')
    expect(deltaText('؜-٠٫٥', -0.5)).toBe('-0.5')
    expect(deltaText('؜+٠٫٥', 0.5)).toBe('+0.5')
    const de = createFormat({ locale: 'de' })
    const { container } = render(
      <DeltaCell value={-0.5} polarity="up-good" format={de} unit={undefined} />,
    )
    const chip = container.querySelector('[data-slot="delta-badge"]')
    expect(chip?.getAttribute('data-direction')).toBe('down')
    expect(chip?.getAttribute('data-tone')).toBe('bad')
  })

  test('status is dot plus word; delta carries its sign; boolean a word', () => {
    expect(cell(c.status('state', { options: ['Open'], tone: () => 'good' })).textContent).toBe(
      'Open',
    )
    expect(
      cell(c.delta('change', { polarity: 'up-good' })).querySelector('[data-tone="good"]'),
    ).not.toBeNull()
    expect(cell(c.boolean('active')).textContent).toContain('Yes')
  })

  test('status labels replace the stored value in the cell and ride the spec for the filter', () => {
    const labelled = c.status('state', {
      options: ['Open', 'Done'],
      labels: { Open: 'Offen', Done: 'Erledigt' },
    })
    expect(cell(labelled).textContent).toBe('Offen')
    const toned = c.status('state', {
      options: ['Open', 'Done'],
      labels: { Open: 'Offen', Done: 'Erledigt' },
      tone: (v) => (v === 'Done' ? 'good' : 'neutral'),
    })
    const done = cell(toned, { ...ROW, state: 'Done' })
    expect(done.textContent).toBe('Erledigt')
    const bare = c.status('state', { options: ['Open', 'Done'], tone: () => 'good' })
    expect(done.querySelector('[data-slot="status"]')?.className).toBe(
      cell(bare, { ...ROW, state: 'Done' }).querySelector('[data-slot="status"]')?.className,
    )
    expect(specOf(labelled).labels).toEqual({ Open: 'Offen', Done: 'Erledigt' })
    expect(specOf(c.status('state', { options: ['Open'] })).labels).toBeUndefined()
  })

  test('text labels replace the stored value in the cell and keep it for sort and search', () => {
    const labelled = c.text('state', { labels: { Open: 'Offen' } })
    expect(cell(labelled, { ...ROW, state: 'Open' }).textContent).toBe('Offen')
    expect(cell(labelled, { ...ROW, state: 'Other' }).textContent).toBe('Other')
    expect(specOf(labelled).value({ ...ROW, state: 'Open' })).toBe('Open')
  })

  test('entity links through href; spark and custom draw their own content', () => {
    const link = cell(c.entity('name', { href: (r) => `/p/${r.id}` })).querySelector('a')
    expect(link?.getAttribute('href')).toBe('/p/r1')
    expect(
      cell(c.spark('trend', { label: 'Trend', render: (_r, box) => `h${box.height}` })).textContent,
    ).toBe('h24')
    const custom = c.custom('score', {
      render: (r) => `#${r.count}`,
      sortValue: (r) => r.count,
      card: 'meta',
      priority: 3,
    })
    expect(cell(custom).textContent).toBe('#42')
    expect(specOf(custom).value(ROW)).toBe(42)
  })

  test('the default header is the id in sentence case', () => {
    expect(specOf(c.relativeTime('at', { id: 'createdAt' })).header).toBe('Created at')
  })
})

describe('dev validation (I16)', () => {
  test('an option a kind does not take throws and names the column', () => {
    const bad = { currency: 'EUR', align: 'middle' } as unknown as { currency: string }
    expect(() => c.money('amount', bad)).toThrow(/c\.money\('amount'\).*"align"/)
  })

  test('c.date takes every DateStyle it types, day included', () => {
    const styles: DateStyle[] = ['short', 'long', 'month', 'weekday', 'day']
    for (const style of styles) expect(() => c.date('at', { style })).not.toThrow()
    const bad = { style: 'year' } as unknown as { style: 'day' }
    expect(() => c.date('at', bad)).toThrow(/c\.date\('at'\).*style/)
  })

  test('a wrong closed value throws and names the column', () => {
    const bad = { priority: 4 } as unknown as { priority: 1 }
    expect(() => c.text('note', bad)).toThrow(/c\.text\('note'\).*priority=4/)
    const filter = { options: ['Open'], filter: 'text' } as unknown as { options: string[] }
    expect(() => c.status('state', filter)).toThrow(/c\.status\('state'\).*filter/)
  })

  test('custom must declare sortValue, card and priority', () => {
    const partial = { render: () => 'x', card: 'meta', priority: 3 } as unknown as Parameters<
      typeof c.custom
    >[1]
    expect(() => c.custom('score', partial)).toThrow(/c\.custom\('score'\).*"sortValue"/)
  })

  test('production skips validation', () => {
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const bad = { currency: 'EUR', align: 'middle' } as unknown as { currency: string }
      expect(specOf(c.money('amount', bad)).align).toBe('end')
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previous
    }
  })

  test('a column not built by col<T>() has no spec and throws on read', () => {
    expect(() => specOf({ __brand: 'KindColumn', id: 'raw' })).toThrow(/"raw" was not built by col/)
  })
})

describe('c.codec', () => {
  const schema = c.codec(
    { name: 'entity', amount: 'money', state: 'status' },
    { defaults: { sort: [{ id: 'amount', desc: true }] } },
  )

  test('takes ids and kinds only and keeps the defaults', () => {
    expect(schema.kinds).toEqual({ name: 'entity', amount: 'money', state: 'status' })
    expect(schema.defaults.sort).toEqual([{ id: 'amount', desc: true }])
  })

  test('an id absent from columns throws in dev; a kind mismatch too', () => {
    const columns = [c.entity('name'), c.money('amount', { currency: 'EUR' })]
    expect(() => checkSchema(schema, columns)).toThrow(/"state", but no column has that id/)
    const mismatch = [...columns, c.text('state')]
    expect(() => checkSchema(schema, mismatch)).toThrow(/"state" as status, but the column is text/)
    expect(() =>
      checkSchema(schema, [...columns, c.status('state', { options: ['Open'] })]),
    ).not.toThrow()
  })

  test('a default sort on an id the codec does not list throws in dev', () => {
    expect(() =>
      c.codec({ name: 'entity' }, { defaults: { sort: [{ id: 'nope', desc: false }] } }),
    ).toThrow(/"nope"/)
  })
})

type Plan = { name: string; done: number | null; tags: string[] }
const Glyph: IconComponent = ({ className }) => <svg data-glyph="" className={className} />
const PLAN: Plan = { name: 'Launch', done: 0.62, tags: ['design', 'ops'] }
const p = col<Plan>()

function renderPlan(column: KindColumn<Plan>, row: Plan): HTMLElement {
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

describe('progress', () => {
  test('sorts by the share as a percent, and is absent when null', () => {
    const spec = specOf(p.progress('done'))
    expect(spec.sort).toEqual({ fn: 'basic' })
    expect(spec.value(PLAN)).toBe(62)
    expect(spec.value({ ...PLAN, done: null })).toBeNull()
  })

  test('searches its percent label', () => {
    expect(specOf(p.progress('done')).search?.(PLAN, ENV.format, ENV.now)).toContain('62%')
  })

  test('a range filter keeps the rows inside a percent range', () => {
    const spec = specOf(p.progress('done', { filter: 'range' }))
    expect(spec.filter).toBe('range')
    expect(spec.bounds).toEqual([0, 100])
    expect(matchesFilter('range', spec.value(PLAN), ['50', '70'])).toBe(true)
    expect(matchesFilter('range', spec.value({ ...PLAN, done: 0.1 }), ['50', '70'])).toBe(false)
    expect(matchesFilter('range', spec.value({ ...PLAN, done: null }), ['50', '70'])).toBe(false)
    expect(specOf(p.progress('done')).filter).toBeNull()
  })

  test('the bar clamps to the scale, the label keeps the share, and null draws the dash', () => {
    const over = renderPlan(p.progress('done'), { ...PLAN, done: 1.4 })
    expect(over.querySelector('[data-slot="meter"]')?.getAttribute('aria-valuenow')).toBe('1')
    expect(over.textContent).toContain('140%')
    const under = renderPlan(p.progress('done'), { ...PLAN, done: -0.2 })
    expect(under.querySelector('[data-slot="meter"]')?.getAttribute('aria-valuenow')).toBe('0')
    const none = renderPlan(p.progress('done'), { ...PLAN, done: null })
    expect(none.querySelector('[data-slot="table-absent"]')).not.toBeNull()
  })

  test('tone colors the fill, and footer reduces the shares', () => {
    const td = renderPlan(p.progress('done', { tone: (v) => (v > 0.5 ? 'good' : 'warn') }), PLAN)
    expect(td.querySelector('[data-slot="meter"]')?.className).toContain('bg-good')
    expect(specOf(p.progress('done', { footer: 'mean' })).footer?.fn).toBe('mean')
  })
})

describe('custom with search', () => {
  const LABEL = p.custom('label', {
    render: (row) => row.name,
    sortValue: (row) => row.done,
    search: (row) => `ref ${row.name}`,
    filter: 'text',
    card: 'meta',
    priority: 3,
  })

  test('the table search reads the search text, and the sort stays on the value', () => {
    const spec = specOf(LABEL)
    expect(spec.search?.(PLAN, ENV.format, ENV.now)).toBe('ref Launch')
    expect(spec.value(PLAN)).toBe(0.62)
  })

  test("filter 'text' matches the search text through the column's accessor", () => {
    const spec = specOf(LABEL)
    expect(spec.filter).toBe('contains')
    const def = engineColumn(spec) as { accessorFn?: (row: Plan, index: number) => unknown }
    expect(def.accessorFn?.(PLAN, 0)).toBe('ref Launch')
    expect(matchesFilter('contains', 'ref Launch', ['LAUNCH'])).toBe(true)
    expect(
      specOf(
        p.custom('x', { render: () => null, sortValue: (r) => r.name, card: 'meta', priority: 3 }),
      ).filter,
    ).toBeNull()
  })

  test("filter 'text' without search throws in development", () => {
    expect(() =>
      p.custom('x', {
        render: () => null,
        sortValue: () => 0,
        card: 'meta',
        priority: 3,
        filter: 'text',
      } as never),
    ).toThrow(/needs the option "search"/)
  })
})

describe('tags icon', () => {
  test('an icon draws before the text of its chip', () => {
    const chip = renderPlan(p.tags('tags', { icon: () => Glyph }), PLAN).querySelector(
      '[data-slot="table-tag"]',
    )
    expect(chip?.firstElementChild?.tagName.toLowerCase()).toBe('svg')
    expect(chip?.lastChild?.textContent).toBe('design')
  })

  test('a chip without an icon draws its text alone', () => {
    const chip = renderPlan(p.tags('tags'), PLAN).querySelector('[data-slot="table-tag"]')
    expect(chip?.firstElementChild).toBeNull()
  })
})
