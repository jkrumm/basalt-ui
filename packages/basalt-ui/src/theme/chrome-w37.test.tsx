/** Wave 37 theme chrome: the symmetric Button section inset and the Badge dot scope (browser checks: tests/layout). */
import { Button, MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RADIUS_STEP, deriveRadius } from '../tokens/palette'
import { baseTheme } from './index'

const controlsCss = readFileSync(resolve(import.meta.dirname, 'controls.module.css'), 'utf8')

const rootStyle = (size?: string): string => {
  const { getByText, unmount } = render(
    <MantineProvider theme={baseTheme}>
      <Button leftSection="i" {...(size !== undefined && { size })}>
        go
      </Button>
    </MantineProvider>,
  )
  const style = getByText('go').closest('.mantine-Button-root')?.getAttribute('style') ?? ''
  unmount()
  return style
}

const decl = (style: string, name: string): string =>
  style.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]?.trim() ?? ''

describe('Button section inset', () => {
  test.each([undefined, 'xs', 'sm', 'md', 'lg', 'xl', 'compact-sm'])(
    'size %p: the icon side equals the text side',
    (size) => {
      const style = rootStyle(size)
      expect(decl(style, '--button-section-padding-x')).toBe(decl(style, '--button-padding-x'))
      expect(decl(style, '--button-section-padding-x')).not.toBe('')
    },
  )

  test('ctl: the icon side equals the ctl text inset', () => {
    expect(decl(rootStyle('ctl'), '--button-section-padding-x')).toBe('var(--button-padding-x-ctl)')
  })
})

describe('the Badge dot rule', () => {
  test('is scoped to the light variant, so variant="dot" keeps its own ::before', () => {
    // The case reset (`html .badgeRoot`) is the one rule meant for every variant, the dot one included.
    const rules = [...controlsCss.matchAll(/([^{}]*\.badgeRoot[^{}]*)\{/g)]
      .map((m) => (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim())
      .filter((selector) => selector !== 'html .badgeRoot')
    expect(rules.length).toBeGreaterThan(0)
    for (const selector of rules) expect(selector).toContain("[data-variant='light']")
  })
})

describe('Wave 37 r2 chrome rules', () => {
  test('the Badge root resets text-transform so a status word keeps its case', () => {
    expect(controlsCss).toMatch(/html \.badgeRoot\s*\{\s*text-transform:\s*none/)
  })
})

/** Evaluate a nested-radius CSS expression for a parent radius, in px (calc/min/max/round only). */
const evalRadius = (expr: string, parent: number): number => {
  const js = expr
    .replace(/var\(--sc-radius\)|var\(--alert-radius, var\(--vx-radius-ctrl\)\)/g, String(parent))
    .replace(/(\d+)px/g, '$1')
    .replace(/\bdown\b/g, "'down'")
    .replace(/\bcalc\b/g, '')
  const fn = new Function('min', 'max', 'round', `return ${js}`) as (
    a: typeof Math.min,
    b: typeof Math.max,
    c: (m: string, x: number, s: number) => number,
  ) => number
  return fn(Math.min, Math.max, (_m, x, step) => Math.floor(x / step) * step)
}

const ctrlAt = (level: number) => deriveRadius(level).ctrl
const scale = (level: number) => {
  const r = deriveRadius(level)
  return new Set([0, RADIUS_STEP.scaleXs, r.fine, r.tight, r.ctrl, r.card])
}

describe('nested radius step (craft-1/nested-radius-step)', () => {
  const alertExpr = /--basalt-code-radius:\s*(round\([^;]+\));/
    .exec(controlsCss)?.[1]
    ?.replace(/\s+/g, ' ')
  const stylesFn = baseTheme.components?.['SegmentedControl']?.styles as (
    t: unknown,
    p: object,
    c: unknown,
  ) => { indicator: { borderRadius: string } }
  const tabsExpr = stylesFn({}, {}, {}).indicator.borderRadius
  test.each([-5, 0, 5])('indicator and inline-code radii are scale steps at radius %i', (level) => {
    expect(alertExpr).toBeDefined()
    for (const expr of [tabsExpr, alertExpr as string]) {
      const inner = evalRadius(expr, ctrlAt(level))
      expect(scale(level).has(inner)).toBe(true)
      expect(ctrlAt(level) - inner >= 3 || inner === 0).toBe(true)
    }
  })

  test('at the default radius both nest at 2 under a 6 px container', () => {
    expect(evalRadius(tabsExpr, 6)).toBe(2)
    expect(evalRadius(alertExpr as string, 6)).toBe(2)
  })

  test('the Code theme reads that var, falling back to the tight radius', () => {
    const code = baseTheme.components?.['Code']?.styles as { root: { borderRadius: string } }
    expect(code.root.borderRadius).toBe('var(--basalt-code-radius, var(--vx-radius-tight))')
  })
})
