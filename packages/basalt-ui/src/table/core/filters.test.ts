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

describe('range', () => {
  test('numbers: both ends inclusive, an open end, an absent or non-numeric cell never passes', () => {
    expect(matchesFilter('range', 10, ['10', '20'])).toBe(true)
    expect(matchesFilter('range', 20, ['10', '20'])).toBe(true)
    expect(matchesFilter('range', 21, ['10', '20'])).toBe(false)
    expect(matchesFilter('range', -5, ['', '0'])).toBe(true)
    expect(matchesFilter('range', 5, ['', '0'])).toBe(false)
    expect(matchesFilter('range', null, ['1', ''])).toBe(false)
    expect(matchesFilter('range', '7', ['1', ''])).toBe(false)
    expect(matchesFilter('range', null, ['', ''])).toBe(true)
  })

  test('days: an instant is the day it falls on in the zone, a zone-less day stays itself', () => {
    const utc = { kind: 'day', zone: 'UTC' } as const
    const ny = { kind: 'day', zone: 'America/New_York' } as const
    const late = '2026-10-31T23:30:00Z'
    expect(matchesFilter('range', late, ['2026-10-01', '2026-10-31'], utc)).toBe(true)
    expect(matchesFilter('range', late, ['2026-10-31', '2026-10-31'], ny)).toBe(true)
    expect(matchesFilter('range', '2026-11-01T02:00:00Z', ['', '2026-10-31'], ny)).toBe(true)
    expect(matchesFilter('range', '2026-11-01T02:00:00Z', ['', '2026-10-31'], utc)).toBe(false)
    expect(matchesFilter('range', '2026-10-15', ['2026-10-15', ''], ny)).toBe(true)
    expect(matchesFilter('range', Date.UTC(2026, 9, 2), ['2026-10-02', '2026-10-02'], utc)).toBe(
      true,
    )
    expect(matchesFilter('range', 'not a date', ['2026-01-01', ''], utc)).toBe(false)
  })

  test('the engine path: a range with both ends open is removed, one per domain and zone', () => {
    const fn = constructFilterFn('range')
    expect(fn.autoRemove(['', ''])).toBe(true)
    expect(fn.autoRemove(['1', ''])).toBe(false)
    expect(constructFilterFn('range', { kind: 'day', zone: 'UTC' })).toBe(
      constructFilterFn('range', { kind: 'day', zone: 'UTC' }),
    )
    expect(constructFilterFn('range', { kind: 'day', zone: 'UTC' })).not.toBe(fn)
    const known = new Set(['amount'])
    expect(toColumnFilters([{ id: 'amount', op: 'range', values: ['', '5'] }], known)).toEqual([
      { id: 'amount', value: ['', '5'] },
    ])
    expect(toColumnFilters([{ id: 'amount', op: 'range', values: ['', ''] }], known)).toEqual([])
  })
})
