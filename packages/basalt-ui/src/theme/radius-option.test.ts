/**
 * `createBasaltTheme`'s `{ radius }` option — the graduation of `deriveRadius` into a first-class
 * consumer API. Mirrors `derive-theme.test.ts`'s two invariants:
 *
 *  1. The DEFAULT path (no `options`, or `radius: 0`) stays byte-identical to the pre-baked static
 *     `baseTheme` — `theme.other.basaltRadius` stays unset, and `radius.test.ts` (untouched) stays
 *     green.
 *  2. A NON-default level rebuilds every radius-anchored `defaultProps`/`styles` number AND the
 *     `radius` size-scale from `deriveRadius(level)`'s output, and lands it on
 *     `theme.other.basaltRadius`.
 */
import { describe, expect, test } from 'bun:test'
import { deriveRadius } from '../tokens/palette'
import { createBasaltTheme } from './index'

describe('the default level stays on the static path', () => {
  test('createBasaltTheme() carries no theme.other.basaltRadius', () => {
    expect(createBasaltTheme().other?.['basaltRadius']).toBeUndefined()
  })

  test('createBasaltTheme(undefined, {}) resolves to the same default', () => {
    expect(createBasaltTheme(undefined, {}).other?.['basaltRadius']).toBeUndefined()
  })

  test('an explicit radius: 0 also carries no basaltRadius', () => {
    expect(createBasaltTheme(undefined, { radius: 0 }).other?.['basaltRadius']).toBeUndefined()
  })
})

describe('a non-default radius level graduates onto the theme', () => {
  const theme = createBasaltTheme(undefined, { radius: 2 })
  const expected = deriveRadius(2)

  test('the resolved values land on theme.other.basaltRadius', () => {
    expect(theme.other?.['basaltRadius']).toEqual(expected)
  })

  test('Tooltip/Modal defaultProps radius follows floating (card + 1 = 10)', () => {
    expect(theme.components?.['Tooltip']?.defaultProps?.['radius']).toBe(10)
    expect(theme.components?.['Modal']?.defaultProps?.['radius']).toBe(10)
  })

  test('the radius size-scale md step reflects ctrl (8)', () => {
    expect(theme.radius?.md).toBe(`${8 / 16}rem`)
  })

  test('the independent scale steps (xs/lg/xl) stay fixed', () => {
    expect(theme.radius?.xs).toBe(`${2 / 16}rem`)
    expect(theme.radius?.lg).toBe(`${16 / 16}rem`)
    expect(theme.radius?.xl).toBe(`${32 / 16}rem`)
  })
})

describe('the default theme is unchanged by the radius option existing', () => {
  test('createBasaltTheme() still matches the shipped level-0 numbers', () => {
    const theme = createBasaltTheme()
    expect(theme.components?.['Tooltip']?.defaultProps?.['radius']).toBe(8)
    expect(theme.components?.['Badge']?.defaultProps?.['radius']).toBe(6)
  })
})

describe('a malformed radius level throws through createBasaltTheme', () => {
  test('rejects a non-integer', () => {
    expect(() => createBasaltTheme(undefined, { radius: 1.5 })).toThrow()
  })

  test('rejects an out-of-range level', () => {
    expect(() => createBasaltTheme(undefined, { radius: 10 })).toThrow()
  })
})

describe('consumer overrides still win on top of a radius option', () => {
  test('an explicit override merges onto the radius-rebuilt theme', () => {
    const theme = createBasaltTheme({ primaryColor: 'green' }, { radius: 2 })
    expect(theme.primaryColor).toBe('green')
    expect(theme.other?.['basaltRadius']).toEqual(deriveRadius(2))
  })
})

describe('radius and derive combine without dropping either', () => {
  test('both land on theme.other', () => {
    const theme = createBasaltTheme(undefined, { derive: { accent: '#16a34a' }, radius: 2 })
    expect(theme.other?.['basaltDerive']).toBeDefined()
    expect(theme.other?.['basaltRadius']).toEqual(deriveRadius(2))
  })
})
