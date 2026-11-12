/** Filter predicates: exact enum match (I17), `autoRemove`, the dev throw on an unknown id. */
import { describe, expect, test } from 'bun:test'
import { constructFilterFn, matchesFilter, rowMatches, toColumnFilters } from './filters'
import type { FilterRow } from './filters'

const row = (values: Record<string, unknown>): FilterRow => ({
  getValue: (id) => values[id],
})
const known = new Set(['name', 'state'])

describe('constructFilterFn', () => {
  test('anyOf matches the whole value, not a substring (I17)', () => {
    const fn = constructFilterFn('anyOf')
    expect(fn(row({ state: 'Engineering' }), 'state', ['Eng'])).toBe(false)
    expect(fn(row({ state: 'Eng' }), 'state', ['Eng'])).toBe(true)
    expect(fn(row({ state: 'Eng' }), 'state', ['Engineering', 'Eng'])).toBe(true)
  })

  test('anyOf is case sensitive and compares scalars as the text they print as', () => {
    const fn = constructFilterFn('anyOf')
    expect(fn(row({ state: 'eng' }), 'state', ['Eng'])).toBe(false)
    expect(fn(row({ state: 7 }), 'state', ['7'])).toBe(true)
    expect(fn(row({ state: true }), 'state', ['true'])).toBe(true)
  })

  test('contains is a case-insensitive substring of any value', () => {
    const fn = constructFilterFn('contains')
    expect(fn(row({ name: 'Acme GmbH' }), 'name', ['acme'])).toBe(true)
    expect(fn(row({ name: 'Acme GmbH' }), 'name', ['nope', 'GMBH'])).toBe(true)
    expect(fn(row({ name: 'Acme GmbH' }), 'name', ['nope'])).toBe(false)
  })

  test('an absent cell matches nothing, a model with no usable value matches everything', () => {
    expect(matchesFilter('anyOf', null, ['x'])).toBe(false)
    expect(matchesFilter('contains', undefined, ['x'])).toBe(false)
    expect(matchesFilter('contains', {}, ['x'])).toBe(false)
    expect(matchesFilter('anyOf', null, [])).toBe(true)
    expect(matchesFilter('anyOf', 'x', [''])).toBe(true)
  })

  test('autoRemove drops a model with no usable value from the engine state', () => {
    const { autoRemove } = constructFilterFn('anyOf')
    expect(autoRemove([])).toBe(true)
    expect(autoRemove([''])).toBe(true)
    expect(autoRemove(undefined)).toBe(true)
    expect(autoRemove('todo')).toBe(true)
    expect(autoRemove(['todo'])).toBe(false)
  })

  test('one stable function per operator: the engine compares by identity', () => {
    expect(constructFilterFn('anyOf')).toBe(constructFilterFn('anyOf'))
    expect(constructFilterFn('anyOf')).not.toBe(constructFilterFn('contains'))
  })
})

describe('toColumnFilters', () => {
  test('keeps usable models, drops empty ones', () => {
    expect(
      toColumnFilters(
        [
          { id: 'name', op: 'contains', values: ['a', ''] },
          { id: 'state', op: 'anyOf', values: [] },
        ],
        known,
      ),
    ).toEqual([{ id: 'name', value: ['a'] }])
  })

  test('an unknown column id throws in development', () => {
    expect(() => toColumnFilters([{ id: 'ghost', op: 'contains', values: ['a'] }], known)).toThrow(
      /"ghost".*columns: name, state/,
    )
  })

  test('and is dropped in production, so a stale view cannot blank the table', () => {
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(toColumnFilters([{ id: 'ghost', op: 'contains', values: ['a'] }], known)).toEqual([])
    } finally {
      process.env.NODE_ENV = env as string
    }
  })
})

describe('rowMatches', () => {
  test('filters AND across columns', () => {
    const filters = [
      { id: 'name', op: 'contains' as const, values: ['acme'] },
      { id: 'state', op: 'anyOf' as const, values: ['Eng'] },
    ]
    expect(rowMatches(filters, row({ name: 'Acme', state: 'Eng' }), known)).toBe(true)
    expect(rowMatches(filters, row({ name: 'Acme', state: 'Engineering' }), known)).toBe(false)
    expect(rowMatches([], row({}), known)).toBe(true)
  })
})
