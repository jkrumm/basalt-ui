/**
 * Kinds decide alignment, numerals, width, sort, filter, card slot and priority (concept section
 * 5); options carry data only. Rendering goes through `spec.render` with a fixed env, the way the
 * parts call it.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { createFormat } from '../../core/format'
import { checkSchema, col, specOf } from './kinds'
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
  c.actions([{ key: 'edit', label: 'Edit', onClick: () => {} }]),
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
