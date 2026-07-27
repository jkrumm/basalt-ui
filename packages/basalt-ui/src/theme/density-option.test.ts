/**
 * `createBasaltTheme`'s `{ density }` option — the graduation of `deriveSpacing` into a first-class
 * consumer API. Mirrors `radius-option.test.ts`'s two invariants:
 *
 *  1. The DEFAULT path (no `options`, or `density: 0`) stays byte-identical to the pre-baked static
 *     `baseTheme` — `theme.other.basaltDensity` stays unset, and `theme/spacing.test.ts` (untouched)
 *     stays green.
 *  2. A NON-default level rebuilds every density-anchored `defaultProps`/`styles` number AND the
 *     `spacing` size-scale from `deriveSpacing(level)`'s output, and lands it on
 *     `theme.other.basaltDensity`.
 */
import { describe, expect, test } from 'bun:test'
import { deriveSpacing } from '../tokens/palette'
import { createBasaltTheme } from './index'

describe('the default level stays on the static path', () => {
  test('createBasaltTheme() carries no theme.other.basaltDensity', () => {
    expect(createBasaltTheme().other?.['basaltDensity']).toBeUndefined()
  })

  test('createBasaltTheme(undefined, {}) resolves to the same default', () => {
    expect(createBasaltTheme(undefined, {}).other?.['basaltDensity']).toBeUndefined()
  })

  test('an explicit density: 0 also carries no basaltDensity', () => {
    expect(createBasaltTheme(undefined, { density: 0 }).other?.['basaltDensity']).toBeUndefined()
  })
})

describe('a non-default density level graduates onto the theme', () => {
  const theme = createBasaltTheme(undefined, { density: -2 })
  const expected = deriveSpacing(-2)

  test('the resolved values land on theme.other.basaltDensity', () => {
    expect(theme.other?.['basaltDensity']).toEqual(expected)
  })

  test('Timeline bulletSize follows the resolved step (18)', () => {
    expect(theme.components?.['Timeline']?.defaultProps?.['bulletSize']).toBe(18)
  })

  test('Progress size follows the resolved step (5)', () => {
    expect(theme.components?.['Progress']?.defaultProps?.['size']).toBe(5)
  })

  // Read off `expected.scale` rather than hardcoded literals: what this asserts is the WIRING (the
  // resolved scale group reaches `theme.spacing` as rem strings), and the law's own level-0 bases plus
  // its per-level output are locked by `spacing.test.ts` + `density-relations.test.ts`. At the time of
  // writing, `density: -2` resolves to 9/10/14/16/21.
  test('the spacing size-scale reflects the resolved scale group', () => {
    expect(theme.spacing?.xs).toBe(`${expected.scale.xs / 16}rem`)
    expect(theme.spacing?.sm).toBe(`${expected.scale.sm / 16}rem`)
    expect(theme.spacing?.md).toBe(`${expected.scale.md / 16}rem`)
    expect(theme.spacing?.lg).toBe(`${expected.scale.lg / 16}rem`)
    expect(theme.spacing?.xl).toBe(`${expected.scale.xl / 16}rem`)
  })
})

describe('the default theme is unchanged by the density option existing', () => {
  test('createBasaltTheme() still matches the shipped level-0 numbers', () => {
    const theme = createBasaltTheme()
    expect(theme.components?.['Timeline']?.defaultProps?.['bulletSize']).toBe(22)
    expect(theme.components?.['Progress']?.defaultProps?.['size']).toBe(6)
  })
})

describe('a malformed density level throws through createBasaltTheme', () => {
  test('rejects a non-integer', () => {
    expect(() => createBasaltTheme(undefined, { density: 1.5 })).toThrow()
  })

  test('rejects an out-of-range level', () => {
    expect(() => createBasaltTheme(undefined, { density: 10 })).toThrow()
  })
})

describe('consumer overrides still win on top of a density option', () => {
  test('an explicit override merges onto the density-rebuilt theme', () => {
    const theme = createBasaltTheme({ primaryColor: 'green' }, { density: -2 })
    expect(theme.primaryColor).toBe('green')
    expect(theme.other?.['basaltDensity']).toEqual(deriveSpacing(-2))
  })
})

describe('density combines with radius and derive without dropping any', () => {
  test('all three land on theme.other', () => {
    const theme = createBasaltTheme(undefined, {
      derive: { accent: '#16a34a' },
      radius: 2,
      density: -2,
    })
    expect(theme.other?.['basaltDerive']).toBeDefined()
    expect(theme.other?.['basaltRadius']).toBeDefined()
    expect(theme.other?.['basaltDensity']).toEqual(deriveSpacing(-2))
  })
})
