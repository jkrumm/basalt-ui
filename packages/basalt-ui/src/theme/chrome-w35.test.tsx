/**
 * Wave 35 chrome (`docs/waves/design-parity/SPEC.md` § 6.12): Button paddings sit on the spacing
 * scale, a hovered Tab is visible in dark, and the selected nav row is neutral.
 */
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildDensityCss } from '../tokens/core'
import { deriveSpacing } from '../tokens/palette'
import { baseTheme } from './index'

const here = dirname(fileURLToPath(import.meta.url))
const css = (file: string): string => readFileSync(`${here}/${file}`, 'utf8')
const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme)

type Resolver = (
  t: MantineTheme,
  props: { size?: string },
  ctx: unknown,
) => { root: Record<string, string | undefined> }
const paddingX = (size: string | undefined): string | undefined => {
  const resolve = baseTheme.components?.['Button']?.vars as Resolver
  return resolve(theme, size === undefined ? {} : { size }, undefined).root['--button-padding-x']
}

const STEP = 'var\\(--vx-space-stack-(?:xs|sm|md|lg|xl)\\)'
const STACK = new RegExp(`^calc\\(\\(${STEP}(?: \\+ ${STEP})*\\) \\* var\\(--mantine-scale\\)\\)$`)

describe('Button padding sits on the spacing scale', () => {
  const sizes = [
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
    'compact-xs',
    'compact-sm',
    'compact-md',
    'compact-lg',
    'compact-xl',
  ]
  test.each(sizes)('%s maps to --vx-space-stack-* steps', (size) => {
    expect(paddingX(size)).toMatch(STACK)
  })
  test('an unsized Button (Mantine default: sm) is on-scale too', () => {
    expect(paddingX(undefined)).toMatch(STACK)
  })
  test('the ctl tier keeps its own var', () => {
    expect(paddingX('ctl')).toBeUndefined()
  })
})

describe('Tabs hover override (source-level; the cascade itself is shot in the layout rounds)', () => {
  const source = css('controls.module.css')
  const rule = source.match(/html\[data-mantine-color-scheme\] \.tabsRoot \{[^}]*\}/)?.[0] ?? ''
  test('--tab-hover-color is an ink mix, not Mantine dark-6', () => {
    expect(rule).toMatch(
      /--tab-hover-color:\s*color-mix\(in srgb, var\(--vx-ink\) \d+%, transparent\)/,
    )
  })
  test('the rule is unlayered, so it outranks Mantine whichever stylesheet the app loads', () => {
    expect(source).not.toContain('@layer')
  })
  test('Mantine reads --tab-hover-color for both the default and the pills variant', () => {
    const tabs = readFileSync(require.resolve('@mantine/core/styles/Tabs.css'), 'utf8')
    expect(tabs).toMatch(/\[data-variant='pills'\][^{]*\{[^}]*--tab-hover-color/s)
    expect(tabs).toMatch(/background-color:\s*var\(--tab-hover-color\)/)
    expect(tabs).toMatch(/--tab-hover-color:\s*var\(--mantine-color-gray-0\)/)
  })
})

describe('Button padding vs height and density', () => {
  const resolve = baseTheme.components?.['Button']?.vars as Resolver
  test('heights are untouched by the padding map', () => {
    for (const size of ['xs', 'sm', 'lg', 'compact-xs']) {
      expect(resolve(theme, { size }, undefined).root['--button-height']).toBeUndefined()
    }
    expect(resolve(theme, { size: 'md' }, undefined).root['--button-height']).toBe(
      'calc(var(--vx-space-control-height) * var(--mantine-scale))',
    )
  })
  test('padding follows density through the stack var, which differs per level', () => {
    expect(paddingX('xs')).toContain('var(--vx-space-stack-md)')
    const stackMd = (level: number): string =>
      buildDensityCss(deriveSpacing(level)).match(/--vx-space-stack-md: (\d+)px/)?.[1] ?? ''
    expect(stackMd(-3)).not.toBe(stackMd(3))
  })
})

describe('the selected nav row is neutral', () => {
  const src = css('nav-link.module.css')
  const block = (sel: string): string =>
    src.match(new RegExp(`${sel.replace(/[[\]]/g, '\\$&')} \\{[^}]*\\}`))?.[0] ?? ''
  test('rest and hover fills never read the accent', () => {
    expect(block('.root[data-active]')).not.toContain('--vx-accent')
    expect(block('.root[data-active]:hover')).not.toContain('--vx-accent')
    expect(block('.root[data-active]')).toContain('--vx-ink')
    expect(block('.root[data-active]')).toContain('font-weight: 600')
  })
})
