/**
 * `createBasaltTheme`'s `{ fonts }` option — a pure pass-through onto `theme.other.basaltFonts`
 * (no derivation math, unlike `{ derive }`). See `derive-theme.test.ts` for the derive-config
 * equivalent this mirrors.
 */
import { describe, expect, test } from 'bun:test'
import { baseTheme, createBasaltTheme } from './index'

describe('the default path carries no theme.other.basaltFonts', () => {
  test('createBasaltTheme() carries no basaltFonts', () => {
    expect(createBasaltTheme().other?.['basaltFonts']).toBeUndefined()
  })

  test('createBasaltTheme(undefined, {}) carries no basaltFonts', () => {
    expect(createBasaltTheme(undefined, {}).other?.['basaltFonts']).toBeUndefined()
  })
})

describe('an empty fonts object is treated as absent — stays on the static baseTheme fast path', () => {
  test('createBasaltTheme(undefined, { fonts: {} }) returns the identical baseTheme reference', () => {
    expect(createBasaltTheme(undefined, { fonts: {} })).toBe(baseTheme)
  })

  test('carries no theme.other.basaltFonts', () => {
    expect(createBasaltTheme(undefined, { fonts: {} }).other?.['basaltFonts']).toBeUndefined()
  })

  test('an all-undefined-keys fonts object is also treated as absent', () => {
    const theme = createBasaltTheme(undefined, { fonts: { sans: undefined } })
    expect(theme).toBe(baseTheme)
    expect(theme.other?.['basaltFonts']).toBeUndefined()
  })
})

describe('a fonts option graduates onto the theme', () => {
  test('exposes the exact fonts object on theme.other.basaltFonts', () => {
    const theme = createBasaltTheme(undefined, { fonts: { sans: 'Inter, sans-serif' } })
    expect(theme.other?.['basaltFonts']).toEqual({ sans: 'Inter, sans-serif' })
  })

  test('accepts all three slots', () => {
    const fonts = {
      sans: 'Inter, sans-serif',
      head: 'Poppins, sans-serif',
      mono: 'Fira Code, monospace',
    }
    const theme = createBasaltTheme(undefined, { fonts })
    expect(theme.other?.['basaltFonts']).toEqual(fonts)
  })

  test('combines with a non-default derive config without dropping either', () => {
    const theme = createBasaltTheme(undefined, {
      derive: { accent: '#16a34a' },
      fonts: { sans: 'Inter, sans-serif' },
    })
    expect(theme.other?.['basaltFonts']).toEqual({ sans: 'Inter, sans-serif' })
    expect(theme.other?.['basaltDerive']).toBeDefined()
  })
})

describe('consumer overrides still win on top of a fonts option', () => {
  test('an explicit other.basaltFonts override replaces it', () => {
    const theme = createBasaltTheme(
      { other: { basaltFonts: { sans: 'Georgia, serif' } } },
      { fonts: { sans: 'Inter, sans-serif' } },
    )
    expect(theme.other?.['basaltFonts']).toEqual({ sans: 'Georgia, serif' })
  })
})
