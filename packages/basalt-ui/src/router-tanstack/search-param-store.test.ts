/**
 * `createSearchParamStore`'s persistence seam — the half that was invisible.
 *
 * The reference consumer adopted the store in three features, hand-rolled the persistence in all
 * three, and the reader had ZERO call sites: "remember my window" had never once worked, and
 * nothing in the type, the runtime or the tests said so. The 5-step recipe in the JSDoc was
 * present the whole time. So the fix is API-shaped (`linkSearch`) plus a dev warning that fires in
 * exactly the broken state — and these tests are what keep both honest.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { createSearchParamStore } from './search-param-store'

const VALUES = ['1d', '7d', '30d'] as const

function makeStore(key: string) {
  return createSearchParamStore({ key, param: 'range', values: VALUES, fallback: '30d' })
}

/** Writes the `createPersistedState` envelope directly — the shape `readStored` parses. */
function persist(key: string, value: string, version = 1): void {
  localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: version, value }))
}

let warn: ReturnType<typeof spyOn<Console, 'warn'>>

beforeEach(() => {
  localStorage.clear()
  warn = spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

describe('linkSearch', () => {
  it('is the click-time thunk — it reads storage at CALL time, not at creation', () => {
    const store = makeStore('link-thunk')
    expect(store.linkSearch()).toEqual({ range: '30d' })

    persist('link-thunk', '7d')
    // A value captured at module scope would still say 30d here. That is the bug it prevents.
    expect(store.linkSearch()).toEqual({ range: '7d' })
  })

  it('falls back when nothing valid is stored', () => {
    persist('link-fallback', 'not-a-range')
    expect(makeStore('link-fallback').linkSearch()).toEqual({ range: '30d' })
  })

  it('returns the param under the store’s own param name', () => {
    const store = createSearchParamStore({
      key: 'link-param',
      param: 'window',
      values: VALUES,
      fallback: '1d',
    })
    persist('link-param', '7d')
    expect(store.linkSearch()).toEqual({ window: '7d' })
  })
})

describe('the unwired-reader warning', () => {
  it('fires when a link pins the fallback over a different stored value', () => {
    const store = makeStore('warn-pinned')
    persist('warn-pinned', '7d')

    expect(store.validateSearch({ range: '30d' })).toEqual({ range: '30d' })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('linkSearch')
  })

  it('fires at most once per store, so a nav-heavy app is not spammed', () => {
    const store = makeStore('warn-once')
    persist('warn-once', '7d')

    store.validateSearch({ range: '30d' })
    store.validateSearch({ range: '30d' })
    store.validateSearch({ range: '30d' })
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('stays silent once a reader is wired — that is the whole point', () => {
    const store = makeStore('warn-wired')
    persist('warn-wired', '7d')

    store.linkSearch()
    store.validateSearch({ range: '30d' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays silent for a deliberate deep link to a non-fallback value', () => {
    const store = makeStore('warn-deeplink')
    persist('warn-deeplink', '30d')

    store.validateSearch({ range: '7d' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays silent when nothing is stored yet', () => {
    makeStore('warn-empty').validateSearch({ range: '30d' })
    expect(warn).not.toHaveBeenCalled()
  })

  it('never fires from validateSearch’s own internal read', () => {
    // validateSearch reads the store on every navigation; that must not count as "wired", and it
    // must not itself trigger the warning when the URL carries no param at all.
    const store = makeStore('warn-internal')
    persist('warn-internal', '7d')

    expect(store.validateSearch({})).toEqual({ range: '7d' })
    expect(warn).not.toHaveBeenCalled()
    // Still unwired, so the pinned-link case is still detectable afterwards.
    store.validateSearch({ range: '30d' })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('validateSearch (unchanged behaviour)', () => {
  it('prefers a valid URL param, then storage, then the fallback', () => {
    const store = makeStore('validate')
    expect(store.validateSearch({ range: '7d' })).toEqual({ range: '7d' })

    persist('validate', '1d')
    expect(store.validateSearch({})).toEqual({ range: '1d' })
    expect(store.validateSearch({ range: 'bogus' })).toEqual({ range: '1d' })

    localStorage.clear()
    expect(store.validateSearch({})).toEqual({ range: '30d' })
  })

  it('discards an envelope written under a different version', () => {
    persist('validate-version', '7d', 2)
    expect(makeStore('validate-version').readStored()).toBeNull()
  })
})
