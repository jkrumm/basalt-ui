/**
 * `claims.ts`: the claim lifecycle without React. The property test drives a seeded random
 * mount/unmount/update/double-release sequence against a plain-array model.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { Mock } from 'bun:test'
import {
  asideFolded,
  createAsideClaims,
  createBarClaims,
  createClaimStore,
  devAssertOnce,
} from './claims'
import type { ClaimHandle } from './claims'

let warn: Mock<typeof console.warn>
beforeEach(() => {
  warn = spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => warn.mockRestore())

describe('aside claims (newest owns)', () => {
  test('mount A then B, unmounting A keeps B', () => {
    const store = createAsideClaims()
    const a = store.claim('a', false)
    const b = store.claim('b', false)
    expect(store.getSnapshot().owner?.id).toBe('b')
    a.release()
    expect(store.getSnapshot().owner?.id).toBe('b')
    expect(store.getSnapshot().count).toBe(1)
    expect(b.isOwner()).toBe(true)
  })

  test('releasing the newest hands the region back to the previous claim', () => {
    const store = createAsideClaims()
    store.claim('a', true)
    const b = store.claim('b', false)
    b.release()
    expect(store.getSnapshot().owner?.id).toBe('a')
    expect(asideFolded(store.getSnapshot())).toBe(true)
  })

  test('a stale cleanup does not resurrect a folded claim', () => {
    const store = createAsideClaims()
    const a = store.claim('a', false)
    a.release()
    a.update(true)
    expect(store.getSnapshot().count).toBe(0)
    expect(asideFolded(store.getSnapshot())).toBe(false)
    const b = store.claim('b', false)
    a.update(true)
    expect(asideFolded(store.getSnapshot())).toBe(false)
    expect(b.isOwner()).toBe(true)
  })

  test('a stale release of an earlier claim with the same id keeps the later one', () => {
    const store = createAsideClaims()
    const first = store.claim('same', false)
    first.release()
    const second = store.claim('same', false)
    first.release()
    expect(store.getSnapshot().count).toBe(1)
    expect(second.isOwner()).toBe(true)
  })

  test('the fold is the owner’s only', () => {
    const store = createAsideClaims()
    const a = store.claim('a', false)
    store.claim('b', false)
    a.update(true)
    expect(asideFolded(store.getSnapshot())).toBe(false)
  })

  test('unclaimed is not folded', () => {
    expect(asideFolded(createAsideClaims().getSnapshot())).toBe(false)
  })

  test('the snapshot is stable until something changes', () => {
    const store = createAsideClaims()
    const a = store.claim('a', false)
    const before = store.getSnapshot()
    a.update(false)
    a.release()
    a.release()
    expect(store.getSnapshot()).not.toBe(before)
    const after = store.getSnapshot()
    a.release()
    a.update(true)
    expect(store.getSnapshot()).toBe(after)
  })

  test('a second live aside raises the dev assertion once', () => {
    const store = createAsideClaims()
    store.claim('a', false)
    store.claim('b', false)
    store.claim('c', false)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('listeners hear every change and stop after unsubscribe', () => {
    const store = createAsideClaims()
    let heard = 0
    const off = store.subscribe(() => heard++)
    const a = store.claim('a', false)
    a.update(true)
    a.release()
    expect(heard).toBe(3)
    off()
    store.claim('b', false)
    expect(heard).toBe(3)
  })
})

describe('bar claims (oldest owns)', () => {
  test('a second bar under one Page is not the owner and raises the dev assertion once', () => {
    const store = createBarClaims()
    const first = store.claim('bar-1', undefined)
    const second = store.claim('bar-2', undefined)
    expect(first.isOwner()).toBe(true)
    expect(second.isOwner()).toBe(false)
    expect(store.getSnapshot().owner?.id).toBe('bar-1')
    store.claim('bar-3', undefined)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  test('when the first bar leaves the second takes the band', () => {
    const store = createBarClaims()
    const first = store.claim('bar-1', undefined)
    const second = store.claim('bar-2', undefined)
    first.release()
    expect(second.isOwner()).toBe(true)
  })

  test('one bar raises nothing', () => {
    const store = createBarClaims()
    store.claim('bar-1', undefined).release()
    store.claim('bar-2', undefined)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('kebab count', () => {
  test('counts live claims and a double release never goes negative', () => {
    const kebabs = createClaimStore({ policy: 'newest' })
    const a = kebabs.claim('page-a', undefined)
    const b = kebabs.claim('page-b', undefined)
    expect(kebabs.getSnapshot().count).toBe(2)
    a.release()
    a.release()
    expect(kebabs.getSnapshot().count).toBe(1)
    b.release()
    expect(kebabs.getSnapshot().count).toBe(0)
  })
})

describe('devAssertOnce', () => {
  test('raises its message once per function', () => {
    const assert = devAssertOnce('boom')
    assert()
    assert()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith('boom')
  })

  test('is silent in production', () => {
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      devAssertOnce('boom')()
    } finally {
      if (env === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = env
    }
    expect(warn).not.toHaveBeenCalled()
  })
})

// ---- Property test --------------------------------------------------------------------------

/** mulberry32: a small seeded PRNG, so a failing sequence replays from its seed. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Model = { id: string; value: boolean; handle: ClaimHandle<boolean> }

describe('property: any mount and unmount order', () => {
  for (const policy of ['newest', 'oldest'] as const) {
    test(`${policy}: one owner among exactly the live claims, none left at the end`, () => {
      for (let seed = 1; seed <= 200; seed++) {
        const rand = rng(seed)
        const store = createClaimStore<boolean>({ policy })
        const live: Model[] = []
        const dead: ClaimHandle<boolean>[] = []
        const check = () => {
          const snap = store.getSnapshot()
          expect(snap.entries.map((e) => e.id)).toEqual(live.map((m) => m.id))
          expect(snap.entries.map((e) => e.value)).toEqual(live.map((m) => m.value))
          expect(snap.count).toBe(live.length)
          const expected = policy === 'newest' ? live.at(-1) : live[0]
          expect(snap.owner?.id).toBe(expected?.id)
          // At most one live claim owns the region.
          expect(live.filter((m) => m.handle.isOwner()).length).toBe(expected ? 1 : 0)
          for (const handle of dead) expect(handle.isOwner()).toBe(false)
        }
        for (let step = 0; step < 60; step++) {
          const roll = rand()
          if (roll < 0.4 || live.length === 0) {
            // A reused id on purpose: identity, not the id, keys the claim.
            const id = `c${Math.floor(rand() * 4)}`
            const value = rand() < 0.5
            live.push({ id, value, handle: store.claim(id, value) })
          } else if (roll < 0.7) {
            const [gone] = live.splice(Math.floor(rand() * live.length), 1)
            gone!.handle.release()
            dead.push(gone!.handle)
          } else if (roll < 0.85) {
            const target = live[Math.floor(rand() * live.length)]!
            target.value = !target.value
            target.handle.update(target.value)
          } else if (dead.length > 0) {
            // A stale cleanup or a late publish from a claim that already left.
            const stale = dead[Math.floor(rand() * dead.length)]!
            stale.release()
            stale.update(rand() < 0.5)
          }
          check()
        }
        for (const m of live.toReversed()) m.handle.release()
        live.length = 0
        check()
        expect(store.getSnapshot().owner).toBeUndefined()
      }
    })
  }
})
