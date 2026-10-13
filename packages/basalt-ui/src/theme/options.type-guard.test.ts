/**
 * V2-SPEC §3: the theme knobs are literal unions, so an out-of-range level is a tsc error before
 * `createBasaltTheme`'s runtime guard ever runs. One `@ts-expect-error` per bad line, proven by
 * `tsc --noEmit`.
 */
import { expect, test } from 'bun:test'
import { createBasaltTheme } from './index'

createBasaltTheme(undefined, { radius: -5, density: -3 })
createBasaltTheme(undefined, { radius: 5, density: 3 })

// Never called: the bad levels are compile-time facts only (the runtime guard throws on them).
export function rejected(): void {
  // @ts-expect-error radius stops at 5
  createBasaltTheme(undefined, { radius: 6 })
  // @ts-expect-error radius starts at -5
  createBasaltTheme(undefined, { radius: -6 })
  // @ts-expect-error density stops at 3
  createBasaltTheme(undefined, { density: 4 })
  // @ts-expect-error density is an integer level, not a ratio
  createBasaltTheme(undefined, { density: 1.5 })
  // @ts-expect-error the `inputs` dimension is gone (four dimensions: derive, fonts, radius, density)
  createBasaltTheme(undefined, { inputs: 'desktop' })
}

test('the knob types compile', () => {
  expect(createBasaltTheme(undefined, { radius: 2 })).toBeDefined()
})
