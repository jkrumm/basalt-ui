import { describe, expect, test } from 'bun:test'
import { createMultiSearchParamStore } from './multi-search-param-store'

const VALUES = ['api', 'design', 'guide'] as const

describe('createMultiSearchParamStore', () => {
  describe('validateSearch', () => {
    test('URL value wins when it decodes to a non-empty array', () => {
      const store = createMultiSearchParamStore({ key: 'tags-a', param: 'tags', values: VALUES })
      expect(store.validateSearch({ tags: ['api'] })).toEqual({ tags: ['api'] })
    })

    test('an allowlist rejects unknown/tampered values', () => {
      const store = createMultiSearchParamStore({ key: 'tags-b', param: 'tags', values: VALUES })
      expect(store.validateSearch({ tags: ['api', 'not-a-real-tag'] })).toEqual({ tags: ['api'] })
    })

    test('dedupes repeated entries', () => {
      const store = createMultiSearchParamStore({ key: 'tags-c', param: 'tags', values: VALUES })
      expect(store.validateSearch({ tags: ['api', 'api', 'design'] })).toEqual({
        tags: ['api', 'design'],
      })
    })

    test('canonically re-orders into the values declaration order', () => {
      const store = createMultiSearchParamStore({ key: 'tags-d', param: 'tags', values: VALUES })
      const a = store.validateSearch({ tags: ['design', 'api'] })
      const b = store.validateSearch({ tags: ['api', 'design'] })
      expect(a).toEqual(b)
      expect(a.tags).toEqual(['api', 'design'])
    })

    test('a non-array URL value falls through to the fallback (no localStorage in this env)', () => {
      const store = createMultiSearchParamStore({ key: 'tags-e', param: 'tags', values: VALUES })
      expect(store.validateSearch({ tags: 'api' })).toEqual({ tags: [] })
      expect(store.validateSearch({})).toEqual({ tags: [] })
    })

    test('an empty URL array falls through to the fallback', () => {
      const store = createMultiSearchParamStore({
        key: 'tags-f',
        param: 'tags',
        values: VALUES,
        fallback: ['guide'],
      })
      expect(store.validateSearch({ tags: [] })).toEqual({ tags: ['guide'] })
    })
  })

  describe('readStored', () => {
    test('returns null when nothing is persisted (no localStorage in this test environment)', () => {
      const store = createMultiSearchParamStore({ key: 'tags-g', param: 'tags', values: VALUES })
      expect(store.readStored()).toBeNull()
    })
  })
})
