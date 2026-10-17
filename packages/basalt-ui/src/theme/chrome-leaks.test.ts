/**
 * Wave 33 chrome (`docs/waves/design-parity/SPEC.md` § 6.10, § 6.12): the status chip is a `light`
 * Badge, and the subtle Button label and the active Tabs underline take ink, not the accent.
 */
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { INK, RADIUS_STEP, SURFACE } from '../tokens/palette'
import { baseTheme } from './index'

const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme)
const SCHEMES = ['light', 'dark'] as const
const AA = 4.5

describe('Badge is the status chip', () => {
  const badge = baseTheme.components?.['Badge']

  test('defaults to the light variant', () => {
    expect(badge?.defaultProps?.['variant']).toBe('light')
  })

  test('radius is the tight role, not the pill', () => {
    expect(badge?.defaultProps?.['radius']).toBe(5)
    expect(badge?.defaultProps?.['radius']).toBe(RADIUS_STEP.tight)
  })

  test('is 20 high (Mantine md, no size override)', () => {
    expect(badge?.defaultProps?.['size']).toBeUndefined()
    expect(theme.components['Badge']?.defaultProps?.['size']).toBeUndefined()
  })

  test('a leading glyph is sized and spaced by the section class', () => {
    expect(badge?.classNames).toHaveProperty('section')
  })
})

describe('subtle Button label is ink', () => {
  const subtle = (color?: string) =>
    theme.variantColorResolver({ color: color ?? theme.primaryColor, theme, variant: 'subtle' })

  test('default colour: label is --vx-ink (scheme-reactive), hover stays the ink tint', () => {
    const resolved = subtle()
    expect(resolved.color).toBe('var(--vx-ink)')
    expect(resolved.hover).toContain('var(--vx-ink) 6%')
  })

  test('an explicit colour keeps its hue (opt-out)', () => {
    expect(subtle('red').color).not.toBe('var(--vx-ink)')
  })
})

describe('active Tabs underline is ink', () => {
  const vars = baseTheme.components?.['Tabs']?.vars as (
    t: MantineTheme,
    props: Record<string, unknown>,
  ) => { root: Record<string, string | undefined> }

  test('default variant resolves --tabs-color to ink', () => {
    expect(vars(theme, {}).root['--tabs-color']).toBe('var(--vx-ink)')
  })

  test('color= opts back into a hue; pills keep the filled colour', () => {
    expect(vars(theme, { color: 'red' }).root['--tabs-color']).toBeUndefined()
    expect(vars(theme, { variant: 'pills' }).root['--tabs-color']).toBeUndefined()
  })
})

describe('the light badge text clears AA on its own tint, every colour, both schemes', () => {
  const channels = (hex: string): [number, number, number] => {
    const n = Number.parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const toHex = (c: number[]) =>
    `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  /** sRGB `color-mix(in srgb, a pct%, b)` for opaque inputs. */
  const mix = (a: string, pct: number, b: string): string => {
    const [ca, cb] = [channels(a), channels(b)]
    return toHex(ca.map((v, i) => v * pct + cb[i]! * (1 - pct)))
  }
  const luminance = (hex: string) => {
    const l = channels(hex).map((c) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!
  }
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
    return (hi! + 0.05) / (lo! + 0.05)
  }

  for (const scheme of SCHEMES) {
    for (const color of Object.keys(theme.colors)) {
      test(`${color} / ${scheme}`, () => {
        // Mantine's `-light-color` role: shade 9 on light, shade 0 on dark. The accent bridge
        // (`accentBridge`) re-points it at the derived accent ink.
        const tone = theme.colors[color]![scheme === 'light' ? 9 : 0]!
        const surface = SURFACE.panel[scheme]
        const bg = mix(tone, 0.13, surface)
        const text = mix(tone, 0.7, INK.ink[scheme])
        expect(ratio(text, bg)).toBeGreaterThanOrEqual(AA)
      })
    }
  }
})
