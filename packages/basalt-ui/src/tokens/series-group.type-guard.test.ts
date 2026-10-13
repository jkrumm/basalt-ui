/**
 * V2-SPEC §3: `groupTokens` returns a branded `SeriesGroup` and `BuildPaletteOpts.groups` takes
 * `SeriesGroup[]`, so the `${name}-` key that emits the variables is the one that references them.
 */
import { expect, test } from 'bun:test'
import { buildPaletteCss, defineSeries, groupTokens } from './index'

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

test('the group emits under the prefix it was named with, and its refs point at it', () => {
  expect(buildPaletteCss({ groups: [ACTIVITY] })).toContain('--vx-activity-a')
  expect(ACTIVITY.a).toBe('var(--vx-activity-a)')
  expect(Object.keys(ACTIVITY)).toEqual(['a'])
})
