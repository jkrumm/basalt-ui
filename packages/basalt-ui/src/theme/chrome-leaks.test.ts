/**
 * Wave 33 chrome (`docs/waves/design-parity/SPEC.md` § 6.10, § 6.12): the status chip is a `light`
 * Badge, and the subtle Button label and the active Tabs underline take ink, not the accent.
 */
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme, MantineThemeOverride } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
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

type Props = { color?: string | null; variant?: string; size?: string }
type Root = Record<string, string | undefined>
type Resolver = (t: MantineTheme, props: Props, ctx: unknown) => { root: Root }

const rootVars = (component: 'Button' | 'ActionIcon', t: MantineTheme, props: Props): Root => {
  const resolve = baseTheme.components?.[component]?.vars as Resolver | undefined
  if (!resolve) throw new Error(`${component} sets no vars resolver`)
  return resolve(t, props, undefined).root
}

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
  const vars = rootVars
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

test.each(['Button', 'ActionIcon'])(
  "Mantine's %s disabled rule sets colour, background and border directly, not through the ink vars",
  (css) => {
    const dir = dirname(fileURLToPath(import.meta.resolve('@mantine/core/package.json')))
    const source = readFileSync(`${dir}/styles/${css}.css`, 'utf8')
    const match = /:where\(:disabled:not\(\[data-loading\]\)[^{]*\{([^}]*)\}/.exec(source)
    expect(match).not.toBeNull()
    const rule = match?.[1] ?? ''
    expect(rule).toContain('color: var(--mantine-color-disabled-color)')
    expect(rule).toContain('background: var(--mantine-color-disabled)')
    expect(rule).toContain('border:')
  },
)

describe('light / outline Button / ActionIcon: only an unnamed colour takes ink', () => {
  const vars = (component: 'Button' | 'ActionIcon', props: Props) =>
    rootVars(component, theme, props)
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

    test(`${component}: light, no colour -> subtle surface, ink label`, () => {
      const root = vars(component, { variant: 'light' })
      expect(root[k.color]).toBe('var(--vx-ink)')
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

    for (const variant of ['filled', 'default', 'white', 'transparent', undefined]) {
      test(`${component}: variant ${variant ?? '(omitted)'} emits none of the four keys`, () => {
        const root = vars(component, variant ? { variant } : {})
        for (const key of Object.values(k)) expect(root[key]).toBeUndefined()
      })
    }

    test.each([
      ['light', ''],
      ['light', null],
      ['outline', ''],
      ['outline', null],
      ['subtle', ''],
      ['subtle', null],
    ] as const)(`${component}: %s color=%p counts as unnamed -> ink`, (variant, color) => {
      expect(vars(component, { variant, color })[k.color]).toBe('var(--vx-ink)')
    })

    test.each(['toString', '__proto__', 'constructor', 'unknown'])(
      `${component}: unknown variant %p emits none of the four keys`,
      (variant) => {
        const root = vars(component, { variant })
        for (const key of Object.values(k)) expect(root[key]).toBeUndefined()
      },
    )

    test(`${component}: light hover is one ink step off the light bg`, () => {
      const root = vars(component, { variant: 'light' })
      expect(root[k.bg]).toBe('var(--vx-surface-subtle)')
      expect(root[k.hover]).toBe('color-mix(in srgb, var(--vx-ink) 6%, var(--vx-surface-subtle))')
    })
  }
})

describe('active Tabs underline is ink', () => {
  test.each(['', null])('color=%p counts as unnamed -> ink', (color) => {
    expect(tabsVars(theme, { color }).root['--tabs-color']).toBe('var(--vx-ink)')
  })

  test('default variant, no colour (omitted and explicit "default")', () => {
    expect(tabsVars(theme, {}).root['--tabs-color']).toBe('var(--vx-ink)')
    expect(tabsVars(theme, { variant: 'default' }).root['--tabs-color']).toBe('var(--vx-ink)')
  })

  test('an explicit colour, the primary one included, opts out', () => {
    expect(tabsVars(theme, { color: 'red' }).root['--tabs-color']).toBeUndefined()
    expect(tabsVars(theme, { color: 'blue' }).root['--tabs-color']).toBeUndefined()
  })

  test('outline takes the ink border like the underline; the on-color text var stays', () => {
    const { root } = tabsVars(theme, { variant: 'outline' })
    expect(root['--tabs-color']).toBe('var(--vx-ink)')
    expect(root['--tabs-text-color']).toBe('var(--vx-on-blue)')
    expect(tabsVars(theme, { variant: 'default' }).root['--tabs-text-color']).toBe(
      'var(--vx-on-blue)',
    )
  })

  test('pills: the selected pill is an ink-mixed neutral with an ink label, never the accent', () => {
    const { root } = tabsVars(theme, { variant: 'pills' })
    expect(root['--tabs-color']).toBe(
      'color-mix(in srgb, var(--vx-ink) 12%, var(--vx-surface-panel))',
    )
    expect(root['--tabs-text-color']).toBe('var(--vx-ink)')
  })

  test.each(['default', 'pills', 'outline'])(
    '%s with an explicit colour keeps its hue',
    (variant) => {
      const { root } = tabsVars(theme, { variant, color: 'red' })
      expect(root['--tabs-color']).toBeUndefined()
      expect(root['--tabs-text-color']).toBe('var(--vx-on-red)')
    },
  )
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

describe('Slider fill is ink unless it encodes a status', () => {
  test('styles.css points --slider-color at ink for both sliders; an explicit color= is inline', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
    expect(css).toMatch(
      /\.mantine-Slider-root,\s*\.mantine-RangeSlider-root\s*\{\s*--slider-color:\s*var\(--vx-ink\)/,
    )
  })
})

describe('autofill does not recolour a field', () => {
  test('styles.css paints the field surface over the UA autofill background', () => {
    const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')
    expect(css).toMatch(/input:-webkit-autofill:focus[\s\S]*?--vx-surface-field\) inset/)
    expect(css).not.toContain('input:autofill')
  })

  test('a themed .input re-points --field-depth over its resting depth, since its unlayered box-shadow outranks the layer', () => {
    const css = readFileSync(new URL('./controls.module.css', import.meta.url), 'utf8')
    expect(css).toMatch(
      /\.input:-webkit-autofill\s*\{\s*--field-depth:\s*var\(--field-resting\),\s*0 0 0 100vmax var\(--vx-surface-field\) inset/,
    )
    expect(css).toMatch(
      /\[data-variant='default'\]\s*\{\s*--field-resting:\s*var\(--vx-shadow-raised\)/,
    )
  })
})
