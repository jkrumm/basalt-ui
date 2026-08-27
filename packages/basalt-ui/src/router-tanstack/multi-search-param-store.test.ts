/**
 * The deprecated multi wrapper's contract, unchanged across the rewrite onto
 * `createSearchStore` — plus the storage path two of these tests used to claim was unreachable.
 *
 * `bun test` runs under happy-dom (root `bunfig.toml` preload), so `localStorage` has always been
 * REAL here: "no localStorage in this environment" was false, and it meant the fallback-to-storage
 * half of `validateSearch` — the entire reason the store exists — was asserted only in the
 * single-value store's tests (D12).
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { createMultiSearchParamStore } from './multi-search-param-store'

const VALUES = ['api', 'design', 'guide'] as const

/** Writes the wrapper's single-value envelope — the layout it has used since 1.0.0. */
function persist(key: string, value: readonly string[], version = 1): void {
  localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: version, value }))
}

beforeEach(() => {
  localStorage.clear()
})

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

    test('a non-array URL value falls through to storage, then to the fallback', () => {
      const store = createMultiSearchParamStore({ key: 'tags-e', param: 'tags', values: VALUES })
      expect(store.validateSearch({ tags: 'api' })).toEqual({ tags: [] })
      expect(store.validateSearch({})).toEqual({ tags: [] })

      persist('tags-e', ['guide', 'api'])
      // Storage is read, and normalized on the way out like any other source.
      expect(store.validateSearch({ tags: 'api' })).toEqual({ tags: ['api', 'guide'] })
      expect(store.validateSearch({})).toEqual({ tags: ['api', 'guide'] })
      // A valid URL array still wins over it.
      expect(store.validateSearch({ tags: ['design'] })).toEqual({ tags: ['design'] })
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
    test('returns null when nothing is persisted', () => {
      const store = createMultiSearchParamStore({ key: 'tags-g', param: 'tags', values: VALUES })
      expect(store.readStored()).toBeNull()
    })

    test('returns the normalized stored selection, and null for a stale envelope version', () => {
      const store = createMultiSearchParamStore({ key: 'tags-h', param: 'tags', values: VALUES })
      persist('tags-h', ['guide', 'nope', 'api'])
      expect(store.readStored()).toEqual(['api', 'guide'])

      const versioned = createMultiSearchParamStore({
        key: 'tags-i',
        param: 'tags',
        values: VALUES,
        version: 1,
      })
      persist('tags-i', ['api'], 2)
      expect(versioned.readStored()).toBeNull()
    })

    test('a stored EMPTY selection reads back as empty — a cleared filter stays cleared', () => {
      // `{ v: 1, value: [] }` is exactly what `useStore()`'s setter writes when a user clears every
      // filter. The empty-array-means-absent rule is a URL rule; applying it to storage too would
      // resurrect the fallback on upgrade, which is not what "byte-compatible" means.
      const store = createMultiSearchParamStore({
        key: 'tags-empty',
        param: 'tags',
        values: VALUES,
        fallback: ['guide'],
      })
      persist('tags-empty', [])

      expect(store.readStored()).toEqual([])
      expect(store.validateSearch({})).toEqual({ tags: [] })
      expect(store.linkSearch()).toEqual({ tags: [] })
      // …while an empty URL array still falls through to storage, as it always has.
      persist('tags-empty', ['api'])
      expect(store.validateSearch({ tags: [] })).toEqual({ tags: ['api'] })
    })

    test('linkSearch carries the stored selection at CALL time', () => {
      const store = createMultiSearchParamStore({ key: 'tags-j', param: 'tags', values: VALUES })
      expect(store.linkSearch()).toEqual({ tags: [] })

      persist('tags-j', ['design'])
      expect(store.linkSearch()).toEqual({ tags: ['design'] })
    })
  })
})
