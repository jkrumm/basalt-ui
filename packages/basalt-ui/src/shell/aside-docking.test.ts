/**
 * `aside-docking.ts` — the docking decision table, pinned directly rather than through a rendered
 * `BasaltShell`: the aside's claim/fold/portal machinery is effect- and ref-driven, and forcing the
 * no-`matchMedia` fallback path also breaks `MantineProvider` (it reads `matchMedia` itself).
 */
import { describe, expect, test } from 'bun:test'
import { asideDockQuery, resolveAsideDocking, roomToDockServerFallback } from './aside-docking'
import type { AsideDockingInput } from './aside-docking'

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
