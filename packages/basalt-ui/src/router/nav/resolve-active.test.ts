import { describe, expect, test } from 'bun:test'
import { resolveActive } from './resolve-active'
import type { AnyNavConfig, AnyNavItem } from './types'

const item = (id: string, to: string, extra: Partial<AnyNavItem> = {}): AnyNavItem => ({
  id,
  label: id,
  link: { to },
  ...extra,
})
const navOf = (...items: AnyNavItem[]): AnyNavConfig => ({
  sections: [{ id: 's', label: 'S', items }],
})
const activeOf = (nav: AnyNavConfig, pathname: string) => resolveActive(nav, pathname).activeId

describe('resolveActive examples', () => {
  test("'/' matches only '/'", () => {
    const nav = navOf(item('home', '/'), item('a', '/a'))
    expect(activeOf(nav, '/')).toBe('home')
    expect(activeOf(nav, '/a')).toBe('a')
    expect(activeOf(nav, '/zzz')).toBeUndefined()
  })

  test('prefix matches on a segment boundary only', () => {
    const nav = navOf(item('a', '/a'))
    expect(activeOf(nav, '/a')).toBe('a')
    expect(activeOf(nav, '/a/b')).toBe('a')
    expect(activeOf(nav, '/ab')).toBeUndefined()
  })

  test('exact: true matches equality only', () => {
    const nav = navOf(item('a', '/a', { exact: true }))
    expect(activeOf(nav, '/a')).toBe('a')
    expect(activeOf(nav, '/a/b')).toBeUndefined()
  })

  test('the most specific item wins', () => {
    const nav = navOf(item('reports', '/reports'), item('daily', '/reports/daily'))
    expect(activeOf(nav, '/reports/daily')).toBe('daily')
    expect(activeOf(nav, '/reports/weekly')).toBe('reports')
  })

  test('a tie keeps the first item in definition order', () => {
    const nav = navOf(item('first', '/a'), item('second', '/a'))
    expect(activeOf(nav, '/a')).toBe('first')
  })

  test('an equality hit beats a prefix hit of equal specificity', () => {
    const nav = navOf(item('prefix', '/a/b'), item('splat', '/a/$'))
    expect(activeOf(nav, '/a/b/c')).toBe('splat')
  })

  test('$param matches one non-empty segment, a trailing $ the rest', () => {
    const nav = navOf(item('month', '/finance/$month', { exact: true }), item('files', '/files/$'))
    expect(activeOf(nav, '/finance/2026-11')).toBe('month')
    expect(activeOf(nav, '/finance')).toBeUndefined()
    expect(activeOf(nav, '/finance/a/b')).toBeUndefined()
    expect(activeOf(nav, '/files/a/b/c')).toBe('files')
  })

  test('activeWhen replaces path matching', () => {
    const nav = navOf(
      item('jobs', '/jobs', { activeWhen: ({ pathname }) => pathname.startsWith('/runs') }),
    )
    expect(activeOf(nav, '/runs/1')).toBe('jobs')
    expect(activeOf(nav, '/jobs')).toBeUndefined()
  })

  test('children and pinned items resolve; ancestors are the path above the winner', () => {
    const nav: AnyNavConfig = {
      sections: [
        {
          id: 's',
          label: 'S',
          items: [
            item('top', '/top', {
              children: [item('mid', '/top/mid', { children: [item('leaf', '/top/mid/leaf')] })],
            }),
          ],
        },
      ],
      pinned: [item('settings', '/settings')],
    }
    const leaf = resolveActive(nav, '/top/mid/leaf')
    expect(leaf.activeId).toBe('leaf')
    expect([...leaf.ancestorIds].toSorted()).toEqual(['mid', 'top'])
    const pinned = resolveActive(nav, '/settings')
    expect(pinned.activeId).toBe('settings')
    expect(pinned.ancestorIds.size).toBe(0)
    expect(resolveActive(nav, '/nowhere')).toEqual({
      activeId: undefined,
      ancestorIds: new Set(),
    })
  })
})

// ── seeded property test ─────────────────────────────────────────────────────────────────────────

/** mulberry32: a tiny seeded PRNG, so a failing case is reproducible from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!

const PATH_SEGS = ['a', 'b', 'c', 'x', 'ab'] as const
const TEMPLATE_SEGS = ['a', 'b', 'c', '$id'] as const

function genTemplate(rng: Rng, allowSplat: boolean): string {
  const n = Math.floor(rng() * 4)
  const segs: string[] = Array.from({ length: n }, () => pick(rng, TEMPLATE_SEGS))
  if (allowSplat && n > 0 && rng() < 0.2) segs.push('$')
  return `/${segs.join('/')}`
}

function genTree(rng: Rng, allowSplat: boolean, allowActiveWhen: boolean) {
  let counter = 0
  const parentOf = new Map<string, string | undefined>()
  const genItem = (depth: number, parent: string | undefined): AnyNavItem => {
    const id = `i${counter++}`
    parentOf.set(id, parent)
    const children =
      depth < 2 && rng() < 0.35
        ? Array.from({ length: 1 + Math.floor(rng() * 2) }, () => genItem(depth + 1, id))
        : undefined
    return {
      id,
      label: id,
      link: { to: genTemplate(rng, allowSplat) },
      ...(rng() < 0.2 && { exact: true }),
      ...(allowActiveWhen &&
        rng() < 0.1 && { activeWhen: ({ pathname }: { pathname: string }) => pathname === '/a/x' }),
      ...(children && { children }),
    }
  }
  const genItems = (): AnyNavItem[] =>
    Array.from({ length: 1 + Math.floor(rng() * 4) }, () => genItem(0, undefined))
  const nav: AnyNavConfig = {
    sections: Array.from({ length: 1 + Math.floor(rng() * 3) }, (_, i) => ({
      id: `sec${i}`,
      label: `Sec ${i}`,
      items: genItems(),
    })),
    ...(rng() < 0.5 && { pinned: genItems() }),
  }
  return { nav, parentOf }
}

const genPath = (rng: Rng): string => {
  const n = Math.floor(rng() * 5)
  return `/${Array.from({ length: n }, () => pick(rng, PATH_SEGS)).join('/')}`
}

function* walkItems(items: ReadonlyArray<AnyNavItem>): Generator<AnyNavItem> {
  for (const it of items) {
    yield it
    if (it.children) yield* walkItems(it.children)
  }
}

function* allItems(nav: AnyNavConfig): Generator<AnyNavItem> {
  for (const s of nav.sections) yield* walkItems(s.items)
  if (nav.pinned) yield* walkItems(nav.pinned)
}

const segs = (p: string): string[] => p.split('/').filter(Boolean)
/** Independent oracle: the template equals the pathname segment for segment (no splat). */
const equalsPath = (to: string, pathname: string): boolean => {
  const t = segs(to)
  const p = segs(pathname)
  return t.length === p.length && t.every((s, i) => s.startsWith('$') || s === p[i])
}

describe('resolveActive properties (seeded)', () => {
  const RUNS = 300
  for (let seed = 1; seed <= RUNS; seed++) {
    test(`seed ${seed}`, () => {
      const rng = mulberry32(seed)
      const { nav, parentOf } = genTree(rng, true, true)
      for (let k = 0; k < 8; k++) {
        const pathname = genPath(rng)
        const result = resolveActive(nav, pathname)
        // deterministic
        expect(resolveActive(nav, pathname)).toEqual(result)
        // at most one active, and ancestors never include it
        expect(result.ancestorIds.has(result.activeId ?? '')).toBe(false)
        if (result.activeId === undefined) {
          expect(result.ancestorIds.size).toBe(0)
          continue
        }
        // every ancestor is a strict ancestor on the winner's parent chain
        const chain = new Set<string>()
        for (let p = parentOf.get(result.activeId); p; p = parentOf.get(p)) chain.add(p)
        expect(result.ancestorIds).toEqual(chain)
      }
    })
  }

  test('an exact match beats a prefix match (no splat, no activeWhen)', () => {
    let checked = 0
    for (let seed = 1; seed <= RUNS; seed++) {
      const rng = mulberry32(seed * 7919)
      const { nav } = genTree(rng, false, false)
      for (let k = 0; k < 8; k++) {
        const pathname = genPath(rng)
        const equal = [...allItems(nav)].filter((it) => equalsPath(it.link.to, pathname))
        if (equal.length === 0) continue
        checked++
        const { activeId } = resolveActive(nav, pathname)
        const winner = [...allItems(nav)].find((it) => it.id === activeId)
        expect(winner).toBeDefined()
        expect(equalsPath(winner!.link.to, pathname)).toBe(true)
      }
    }
    expect(checked).toBeGreaterThan(50)
  })

  test("'/' matches only '/'", () => {
    for (let seed = 1; seed <= RUNS; seed++) {
      const rng = mulberry32(seed * 104729)
      const { nav } = genTree(rng, true, false)
      const root = [...allItems(nav)].filter((it) => it.link.to === '/')
      for (let k = 0; k < 8; k++) {
        const pathname = genPath(rng)
        if (pathname === '/') continue
        const { activeId } = resolveActive(nav, pathname)
        for (const r of root) expect(activeId).not.toBe(r.id)
      }
    }
  })
})
