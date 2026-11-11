/**
 * 2.x store invariants (concept 7), pinned against the v3 shape and committed failing: master
 * stays green until ctl-2 lands `defineControls` and flips each case to a plain `test`.
 * Donors: src/state/fields.ts, src/router-tanstack/search-store.test.ts, controls.router.test.tsx.
 */
import { describe, expect, test } from 'bun:test'
import { api, handle, validated } from './api'

const { defineControls, field } = api

describe('field invariants (ctl-2)', () => {
  test.failing('a thunk fallback on a URL field throws at definition', () => {
    expect(() =>
      defineControls({ id: 'thunk', scope: 'page', fields: { q: field.string(() => 'x') } }),
    ).toThrow(/thunk|fallback/i)
  })

  test.failing('two stores owning one param throw at definition', () => {
    defineControls({ id: 'one', scope: 'page', fields: { tab: field.enum(['a', 'b'], 'a') } })
    expect(() =>
      defineControls({ id: 'two', scope: 'page', fields: { tab: field.enum(['a', 'b'], 'a') } }),
    ).toThrow()
  })

  test.failing('enum membership and aliases use Object.hasOwn, never the prototype chain', () => {
    const store = defineControls({
      id: 'proto',
      scope: 'page',
      fields: { range: field.enum(['24h', '7d'], '24h', { aliases: { day: '24h' } }) },
    })
    for (const hostile of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(validated(store, { range: hostile }, 'range')).toBe('24h')
    }
    expect(validated(store, { range: 'day' }, 'range')).toBe('24h')
  })

  test.failing('NUMERIC_RE accepts plain integers and rejects look-alikes', () => {
    const store = defineControls({
      id: 'num',
      scope: 'page',
      fields: { page: field.number({ fallback: 0, min: 0, int: true }) },
    })
    expect(validated(store, { page: '12' }, 'page')).toBe(12)
    expect(validated(store, { page: 12 }, 'page')).toBe(12)
    for (const bad of ['1e3', ' 5', '0x10', '', 'Infinity', '1.5']) {
      expect(validated(store, { page: bad }, 'page')).toBe(0)
    }
  })

  test.failing('a JSON-parsed ?item=123 reaches a string field as the string "123"', () => {
    const store = defineControls({
      id: 'item',
      scope: 'page',
      fields: { item: field.string('') },
    })
    expect(validated(store, { item: 123 }, 'item')).toBe('123')
  })

  test.failing('a codec is passed by reference, never spread into a copy', () => {
    const spec = field.enum(['a', 'b'], 'a')
    const store = defineControls({ id: 'codec', scope: 'page', fields: { tab: spec } })
    const { codec } = handle(store, 'tab')
    expect(codec).toBe(spec['codec'])
    expect(codec).toBe(handle(store, 'tab').codec)
  })
})
