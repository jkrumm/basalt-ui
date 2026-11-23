import { describe, expect, test } from 'bun:test'
import { CREATE_ROW, buildRows } from './options'
import type { ListItems } from './options'
import { defaultRank } from './rank'

const ITEMS: ListItems = [
  { value: 'home', label: 'Home' },
  {
    label: 'Europe',
    options: [
      { value: 'de', label: 'Germany' },
      { value: 'fr', label: 'France' },
    ],
  },
  {
    label: 'Americas',
    options: [
      { value: 'ar', label: 'Argentina' },
      { value: 'br', label: 'Brazil', keywords: ['brasil'] },
    ],
  },
]

const shape = (items: ListItems, query: string, creatable = false): string[] =>
  buildRows({ items, query, rank: defaultRank, creatable }).rows.map((row) =>
    row.kind === 'header'
      ? `# ${row.label}`
      : row.kind === 'create'
        ? `+ ${row.text}`
        : String(row.option.label),
  )

describe('buildRows', () => {
  test('an empty query keeps the declared order with a header per group', () => {
    expect(shape(ITEMS, '')).toEqual([
      'Home',
      '# Europe',
      'Germany',
      'France',
      '# Americas',
      'Argentina',
      'Brazil',
    ])
  })

  test('a query ranks across groups: the group of the best hit leads, empty groups drop', () => {
    expect(shape(ITEMS, 'bra')).toEqual(['# Americas', 'Brazil'])
    expect(shape(ITEMS, 'a')).toEqual([
      '# Americas',
      'Argentina',
      'Brazil',
      '# Europe',
      'Germany',
      'France',
    ])
  })

  test('keywords match one tier below the label', () => {
    expect(shape(ITEMS, 'brasil')).toEqual(['# Americas', 'Brazil'])
  })

  test('the values follow the rows, so Base UI indexes what is drawn', () => {
    const model = buildRows({ items: ITEMS, query: 'a', rank: defaultRank })
    expect(model.values).toEqual(['ar', 'br', 'de', 'fr'])
    const indexes = model.rows.flatMap((row) => (row.kind === 'option' ? [row.index] : []))
    expect(indexes).toEqual([0, 1, 2, 3])
  })

  test('a creatable list ends with the create row for text no option names, outside the groups', () => {
    expect(shape(ITEMS, 'Spain', true)).toEqual(['+ Spain'])
    expect(shape(ITEMS, 'fra', true)).toEqual(['# Europe', 'France', '+ fra'])
    expect(shape(ITEMS, ' france ', true)).toEqual(['# Europe', 'France'])
    const model = buildRows({ items: ITEMS, query: 'Spain', rank: defaultRank, creatable: true })
    expect(model.values).toEqual([CREATE_ROW])
  })

  test('created options join an ungrouped run and are ranked with the rest', () => {
    const model = buildRows({
      items: ITEMS,
      query: 'sp',
      rank: defaultRank,
      created: [{ value: 'es', label: 'Spain' }],
    })
    expect(model.rows.map((row) => row.kind)).toEqual(['option'])
  })

  test('a created option is drawn once, and with a loader only while the query finds it', () => {
    const oslo = { value: 'oslo', label: 'Oslo' }
    const answered = buildRows({ items: [oslo], query: 'os', created: [oslo] })
    expect(answered.values).toEqual(['oslo'])
    const missed = buildRows({ items: [], query: 'zzz', created: [oslo] })
    expect(missed.values).toEqual([])
    const found = buildRows({ items: [], query: 'os', created: [oslo] })
    expect(found.values).toEqual(['oslo'])
  })
})
