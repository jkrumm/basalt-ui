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

describe('Tabs hover is a visible neutral step in both schemes', () => {
  const rule =
    css('controls.module.css').match(
      /html\[data-mantine-color-scheme\] \.tabsRoot \{[^}]*\}/,
    )?.[0] ?? ''
  test('--tab-hover-color is an ink mix, not Mantine dark-6', () => {
    expect(rule).toMatch(
      /--tab-hover-color:\s*color-mix\(in srgb, var\(--vx-ink\) \d+%, transparent\)/,
    )
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
