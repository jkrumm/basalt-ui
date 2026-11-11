/**
 * `docking.ts`: the decision table, pinned directly rather than through a rendered shell. The first
 * nine cases are the executed `aside-docking` cases on 2.x, ported unchanged; the `'always'` rows
 * are the v3 addition (spike S8).
 */
import { describe, expect, test } from 'bun:test'
import { asideDockQuery, resolveAsideDocking, roomToDockServerFallback } from './docking'
import type { AsideDockingInput } from './docking'

const base: AsideDockingInput = {
  claimed: true,
  folded: false,
  sizeClass: 'expanded',
  roomToDock: true,
  asideWidth: 300,
  asideRailWidth: 36,
}

describe('resolveAsideDocking', () => {
  test('unclaimed: zero-wide, never overlays', () => {
    expect(resolveAsideDocking({ ...base, claimed: false })).toEqual({
      docks: true,
      overlay: false,
      width: 0,
    })
  })

  test('expanded with room: an open aside docks at full width', () => {
    expect(resolveAsideDocking(base)).toEqual({ docks: true, overlay: false, width: 300 })
  })

  test('expanded with room: a folded aside reserves its rail', () => {
    expect(resolveAsideDocking({ ...base, folded: true })).toEqual({
      docks: true,
      overlay: false,
      width: 36,
    })
  })

  test('expanded without room: an open aside overlays over its rail', () => {
    expect(resolveAsideDocking({ ...base, roomToDock: false })).toEqual({
      docks: false,
      overlay: true,
      width: 36,
    })
  })

  test('medium never docks, even with room', () => {
    expect(resolveAsideDocking({ ...base, sizeClass: 'medium' })).toEqual({
      docks: false,
      overlay: true,
      width: 36,
    })
  })

  test('a folded aside that cannot dock does not overlay', () => {
    expect(resolveAsideDocking({ ...base, sizeClass: 'compact', folded: true })).toEqual({
      docks: false,
      overlay: false,
      width: 36,
    })
  })
})

describe('dock "always"', () => {
  const always: AsideDockingInput = { ...base, dock: 'always' }

  test('medium docks an open aside, with or without room', () => {
    for (const roomToDock of [true, false]) {
      expect(resolveAsideDocking({ ...always, sizeClass: 'medium', roomToDock })).toEqual({
        docks: true,
        overlay: false,
        width: 300,
      })
    }
  })

  test('expanded docks an open aside, with or without room', () => {
    for (const roomToDock of [true, false]) {
      expect(resolveAsideDocking({ ...always, roomToDock })).toEqual({
        docks: true,
        overlay: false,
        width: 300,
      })
    }
  })

  test('a folded docked aside reserves its rail at medium and expanded', () => {
    for (const sizeClass of ['medium', 'expanded'] as const) {
      expect(resolveAsideDocking({ ...always, sizeClass, folded: true })).toEqual({
        docks: true,
        overlay: false,
        width: 36,
      })
    }
  })

  test('compact still never docks: an open aside overlays', () => {
    expect(resolveAsideDocking({ ...always, sizeClass: 'compact' })).toEqual({
      docks: false,
      overlay: true,
      width: 36,
    })
  })

  test('unclaimed stays zero-wide', () => {
    expect(resolveAsideDocking({ ...always, sizeClass: 'medium', claimed: false }).width).toBe(0)
  })

  test('"auto" spelled out equals the default', () => {
    expect(resolveAsideDocking({ ...base, dock: 'auto' })).toEqual(resolveAsideDocking(base))
  })
})

describe('asideDockQuery', () => {
  test('navbar + aside + the 720px main floor', () => {
    expect(asideDockQuery({ navbarWidth: 240, asideWidth: 300 })).toBe('(min-width: 78.75em)')
  })
})

// Regression: used to be hardcoded `false`, so a `sizeClassHint="expanded"` route rendered a
// default-open aside "cannot dock" for one commit on a desktop the server already knew was wide.
describe('roomToDockServerFallback', () => {
  test('an expanded hint means the server already believes there is room to dock', () => {
    expect(roomToDockServerFallback('expanded')).toBe(true)
  })

  test('a compact or medium hint, or none, never assumes room to dock', () => {
    expect(roomToDockServerFallback('compact')).toBe(false)
    expect(roomToDockServerFallback('medium')).toBe(false)
    expect(roomToDockServerFallback(undefined)).toBe(false)
  })
})
