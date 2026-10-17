/**
 * Wave 33 chrome (`docs/waves/design-parity/SPEC.md` § 6.10, § 6.12): the status chip is a `light`
 * Badge, and the subtle Button label and the active Tabs underline take ink, not the accent.
 */
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme, MantineThemeOverride } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { contrastRatio } from '../tokens/hct'
import { INK, RADIUS_STEP, SURFACE } from '../tokens/palette'
import { tabsVars } from './chrome-vars'
import { baseTheme } from './index'
import controlsClasses from './controls.module.css'

const merge = (override: MantineThemeOverride): MantineTheme =>
  mergeMantineTheme(DEFAULT_THEME, override)
const theme = merge(baseTheme)
const SCHEMES = ['light', 'dark'] as const
const AA = 4.5

describe('Badge is the status chip', () => {
  const badge = baseTheme.components?.['Badge']

  test('defaults to the light variant', () => {
    expect(badge?.defaultProps?.['variant']).toBe('light')
  })

  test('defaults to the neutral colour, so the accent is spent only where a caller names it', () => {
    expect(badge?.defaultProps?.['color']).toBe('gray')
  })

  test('radius is the tight role, not the pill', () => {
    expect(badge?.defaultProps?.['radius']).toBe(RADIUS_STEP.tight)
  })

  test('sets no size, so Mantine md (20 px high) applies — the pixels are pinned in the layout suite', () => {
    expect(badge?.defaultProps?.['size']).toBeUndefined()
  })

  test('a leading glyph is sized and spaced by the badgeSection class', () => {
    expect(badge?.classNames).toEqual({ section: controlsClasses.badgeSection })
  })
})

describe('subtle Button / ActionIcon: only an unnamed colour takes ink', () => {
  const greenPrimary = merge({ ...baseTheme, primaryColor: 'green' })
  const vars = (component: 'Button' | 'ActionIcon', t: MantineTheme, props: object) => {
    const resolve = baseTheme.components?.[component]?.vars as (
      t: MantineTheme,
      props: object,
    ) => { root: Record<string, string | undefined> }
    return resolve(t, props).root
  }
  const KEYS = {
    Button: ['--button-color', '--button-hover'],
    ActionIcon: ['--ai-color', '--ai-hover'],
  } as const

  for (const component of ['Button', 'ActionIcon'] as const) {
    const [label, hover] = KEYS[component]

    test(`${component}: no colour -> ink label and ink-6% hover`, () => {
      const root = vars(component, theme, { variant: 'subtle' })
      expect(root[label]).toBe('var(--vx-ink)')
      expect(root[hover]).toContain('var(--vx-ink) 6%')
    })

    for (const color of ['blue', 'red']) {
      test(`${component}: color="${color}" keeps Mantine's tinted label and hover`, () => {
        const root = vars(component, theme, { variant: 'subtle', color })
        expect(root[label]).toBeUndefined()
        expect(root[hover]).toBeUndefined()
      })
    }

    test(`${component}: with primaryColor green, only the unnamed one is ink`, () => {
      expect(vars(component, greenPrimary, { variant: 'subtle' })[label]).toBe('var(--vx-ink)')
      expect(
        vars(component, greenPrimary, { variant: 'subtle', color: 'green' })[label],
      ).toBeUndefined()
    })

    test(`${component}: other variants are untouched`, () => {
      expect(vars(component, theme, { variant: 'filled' })[label]).toBeUndefined()
      expect(vars(component, theme, {})[label]).toBeUndefined()
    })
  }
})

describe('light / outline Button / ActionIcon: only an unnamed colour takes ink', () => {
  const vars = (component: 'Button' | 'ActionIcon', props: object) => {
    const resolve = baseTheme.components?.[component]?.vars as (
      t: MantineTheme,
      props: object,
    ) => { root: Record<string, string | undefined> }
    return resolve(theme, props).root
  }
  const KEYS = {
    Button: {
      color: '--button-color',
      hover: '--button-hover',
      bg: '--button-bg',
      bd: '--button-bd',
    },
    ActionIcon: { color: '--ai-color', hover: '--ai-hover', bg: '--ai-bg', bd: '--ai-bd' },
  } as const

  for (const component of ['Button', 'ActionIcon'] as const) {
    const k = KEYS[component]

    test(`${component}: light, no colour -> neutral tint, ink label`, () => {
      const root = vars(component, { variant: 'light' })
      expect(root[k.color]).toBe('var(--vx-ink)')
      expect(root[k.bg]).toBe('var(--mantine-color-gray-light)')
      expect(root[k.hover]).toBe('var(--mantine-color-gray-light-hover)')
      expect(root[k.bd]).toBeUndefined()
    })

    test(`${component}: outline, no colour -> surface border, ink label, subtle hover`, () => {
      const root = vars(component, { variant: 'outline' })
      expect(root[k.color]).toBe('var(--vx-ink)')
      expect(root[k.bd]).toContain('var(--vx-surface-border)')
      expect(root[k.hover]).toBe('var(--vx-surface-subtle)')
      expect(root[k.bg]).toBeUndefined()
    })

    for (const variant of ['light', 'outline']) {
      for (const color of ['blue', theme.primaryColor]) {
        test(`${component}: ${variant} color="${color}" keeps Mantine's accent vars`, () => {
          const root = vars(component, { variant, color })
          for (const key of Object.values(k)) expect(root[key]).toBeUndefined()
        })
      }
    }

    test(`${component}: filled is untouched`, () => {
      const root = vars(component, { variant: 'filled' })
      for (const key of Object.values(k)) expect(root[key]).toBeUndefined()
    })
  }
})

describe('active Tabs underline is ink', () => {
  test('default variant, no colour (omitted and explicit "default")', () => {
    expect(tabsVars(theme, {}).root['--tabs-color']).toBe('var(--vx-ink)')
    expect(tabsVars(theme, { variant: 'default' }).root['--tabs-color']).toBe('var(--vx-ink)')
  })

  test('an explicit colour, the primary one included, opts out', () => {
    expect(tabsVars(theme, { color: 'red' }).root['--tabs-color']).toBeUndefined()
    expect(tabsVars(theme, { color: 'blue' }).root['--tabs-color']).toBeUndefined()
  })

  test('pills and outline do not take the ink underline, and keep the on-color text var', () => {
    for (const variant of ['pills', 'outline']) {
      const { root } = tabsVars(theme, { variant })
      expect(root['--tabs-color']).toBeUndefined()
      expect(root['--tabs-text-color']).toBe('var(--vx-on-blue)')
    }
    expect(tabsVars(theme, { variant: 'default' }).root['--tabs-text-color']).toBe(
      'var(--vx-on-blue)',
    )
  })
})

describe('the light badge text clears AA on its own tint, every colour, both schemes', () => {
  const channels = (hex: string): number[] => {
    const n = Number.parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const toHex = (c: number[]) =>
    `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
  /** Evaluates the resolver's `color-mix(in srgb, <tone> N%, <base>)` against known hexes. */
  const evalMix = (css: string, vars: Record<string, string>, transparent: string): string => {
    const m = /^color-mix\(in srgb, (var\([^)]*\)) (\d+)%, (var\([^)]*\)|transparent)\)$/.exec(css)
    if (!m) throw new Error(`unexpected light-variant shape: ${css}`)
    const resolve = (ref: string) => (ref === 'transparent' ? transparent : vars[ref]!)
    const [a, b] = [channels(resolve(m[1]!)), channels(resolve(m[3]!))]
    const pct = Number(m[2]) / 100
    return toHex(a.map((v, i) => v * pct + b[i]! * (1 - pct)))
  }

  for (const scheme of SCHEMES) {
    for (const color of Object.keys(theme.colors)) {
      test(`${color} / ${scheme}`, () => {
        const resolved = theme.variantColorResolver({ color, theme, variant: 'light' })
        // Mantine's `-light-color` role: shade 9 on light, shade 0 on dark.
        const tone = theme.colors[color]![scheme === 'light' ? 9 : 0]!
        const vars = {
          [`var(--mantine-color-${color}-light-color)`]: tone,
          'var(--vx-ink)': INK.ink[scheme],
        }
        const bg = evalMix(resolved.background, vars, SURFACE.panel[scheme])
        const text = evalMix(resolved.color, vars, SURFACE.panel[scheme])
        expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(AA)
      })
    }
  }
})
