/**
 * V2-SPEC §3: `groupTokens` returns a branded `SeriesGroup` and `BuildPaletteOpts.groups` takes
 * `SeriesGroup[]`, so the `${name}-` key that emits the variables is the one that references them.
 */
import { expect, test } from 'bun:test'
import { buildPaletteCss, defineSeries, groupTokens } from './index'
import type { SeriesGroup } from './index'

const MAP = defineSeries({ a: { light: '#111111', dark: '#eeeeee' } })
const ACTIVITY = groupTokens('activity', MAP)

buildPaletteCss({ groups: [ACTIVITY] })

// Never called: the bad shapes are compile-time facts only.
export function rejected(): void {
  // @ts-expect-error a string-keyed record is no longer a group list
  buildPaletteCss({ groups: { 'activity-': MAP } })
  // @ts-expect-error a bare series map carries no brand
  buildPaletteCss({ groups: [MAP] })
}

// `keyof` a group is exactly the series names — no brand symbol, no `Extract<…, string>`.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
const keysAreExact: Equal<keyof typeof ACTIVITY, 'a'> = true
const wide = groupTokens('wide', defineSeries({ a: MAP.a, b: MAP.a }))
const wideKeysAreExact: Equal<keyof typeof wide, 'a' | 'b'> = true
void [keysAreExact, wideKeysAreExact]

test('the group emits under the prefix it was named with, and its refs point at it', () => {
  expect(buildPaletteCss({ groups: [ACTIVITY] })).toContain('--vx-activity-a')
  expect(String(ACTIVITY.a)).toBe('var(--vx-activity-a)')
  expect(Object.keys(ACTIVITY)).toEqual(['a'])
})

test('a hand-built group without the groupTokens payload throws, naming groupTokens', () => {
  const handBuilt: SeriesGroup = { a: ACTIVITY.a }
  expect(() => buildPaletteCss({ groups: [handBuilt] })).toThrow(/must come from groupTokens/)
})
