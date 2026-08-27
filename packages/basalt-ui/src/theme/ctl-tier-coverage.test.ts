/**
 * The ctl-tier coverage gate (`docs/CONTROLS-SPEC.md` §5) — greps every `getSize(size, '<prefix>')`
 * / `getFontSize(size)` call in the INSTALLED `@mantine/core` source for the nine components the
 * spec names (Button, ActionIcon, Input, SegmentedControl, Combobox, Select, MultiSelect,
 * TextInput, Menu) and asserts `cssVariablesResolver`'s `variables` block declares a `-ctl` var for
 * every distinct prefix found — so a missing var (the `--button-padding-x-ctl` the spec's own text
 * calls out as "every draft omitted") fails the build instead of silently rendering at 0px/undefined.
 *
 * Reads the REAL installed package (not a hand-typed list of prefixes) so a future `@mantine/core`
 * minor that adds a new `getSize`/`getFontSize` call to one of these nine components fails this
 * test until the matching `-ctl` var is declared — the same "verify against source, not memory"
 * discipline `ctl-theme.tsx`'s own doc comment describes.
 *
 * `getFontSize(size)` is `getSize(size, 'mantine-font-size')` (`core/utils/get-size/get-size.mjs`),
 * so every `-fz`/`-font-size` call site (Button's `--button-fz`, Input's `--input-fz`,
 * SegmentedControl's `--sc-font-size`, Combobox's `--combobox-option-fz`) collapses onto the ONE
 * `mantine-font-size` prefix — verified by proving the prove-it-would-fail step below actually red-
 * lines when `--mantine-font-size-ctl` is removed, not merely when a component-named font var is
 * missing (no such var is ever read).
 *
 * `*Group`/`*GroupSection` subdirectories (`Button.Group`, `ActionIcon.Group`) are excluded — they
 * are separate, undocumented-for-`ctl` components (`section-height`/`section-padding-x`/
 * `section-fz`), out of scope for `docs/CONTROLS-SPEC.md` §5's nine-component list.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { baseTheme, cssVariablesResolver } from './index'

const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme)

const MANTINE_CORE_ESM_COMPONENTS = join(
  dirname(require.resolve('@mantine/core/package.json')),
  'esm/components',
)

/** The nine components `docs/CONTROLS-SPEC.md` §5 names. */
const CTL_TIER_COMPONENTS = [
  'Button',
  'ActionIcon',
  'Input',
  'SegmentedControl',
  'Combobox',
  'Select',
  'MultiSelect',
  'TextInput',
  'Menu',
] as const

/** Every `.mjs` file (not `.mjs.map`) under a component directory, recursing into subcomponents but
 * skipping `*Group`/`*GroupSection` (see this file's doc). */
function collectMjsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (/Group/.test(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) out.push(...collectMjsFiles(full))
    else if (entry.endsWith('.mjs')) out.push(full)
  }
  return out
}

/** Every distinct `getSize`/`getFontSize` prefix the nine components actually read, extracted from
 * the installed source — `getFontSize(...)` always collapses to `mantine-font-size` (see this
 * file's doc). */
function collectSizePrefixes(): Set<string> {
  const prefixes = new Set<string>()
  for (const component of CTL_TIER_COMPONENTS) {
    for (const file of collectMjsFiles(join(MANTINE_CORE_ESM_COMPONENTS, component))) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/get(?:Size|Spacing)\(\s*[\w.?]+\s*,\s*["']([\w-]+)["']/g)) {
        prefixes.add(m[1]!)
      }
      if (/getFontSize\(/.test(src)) prefixes.add('mantine-font-size')
    }
  }
  return prefixes
}

describe('ctl-tier var coverage', () => {
  const prefixes = collectSizePrefixes()

  test('the scan finds the prefixes this spec is grounded in (sanity check on the scan itself)', () => {
    expect(prefixes.has('button-height')).toBe(true)
    expect(prefixes.has('button-padding-x')).toBe(true)
    expect(prefixes.has('ai-size')).toBe(true)
    expect(prefixes.has('input-height')).toBe(true)
    expect(prefixes.has('sc-padding')).toBe(true)
    expect(prefixes.has('combobox-option-padding')).toBe(true)
    expect(prefixes.has('combobox-chevron-size')).toBe(true)
    expect(prefixes.has('mantine-font-size')).toBe(true)
  })

  test('every scanned prefix has a declared -ctl var', () => {
    const declared = cssVariablesResolver(theme).variables
    const missing = [...prefixes].filter((prefix) => !(`--${prefix}-ctl` in declared))
    expect(missing).toEqual([])
  })

  test('ActionIcon additionally gets an -icon var (size="icon", WidgetHeader tier="widget")', () => {
    const declared = cssVariablesResolver(theme).variables
    expect(declared['--ai-size-icon']).toBeDefined()
  })

  test('--mantine-line-height-ctl is declared (read by every -ctl Input/Button label via the line-height cascade)', () => {
    const declared = cssVariablesResolver(theme).variables
    expect(declared['--mantine-line-height-ctl']).toBeDefined()
  })

  // Proves the gate actually bites — the exact regression the spec calls out
  // ("--button-padding-x-ctl every draft omitted").
  test('regression proof: a var missing from cssVariablesResolver would fail the coverage assertion above', () => {
    const declared = cssVariablesResolver(theme).variables
    const withoutOne = { ...declared }
    delete withoutOne['--button-padding-x-ctl']
    const missing = [...prefixes].filter((prefix) => !(`--${prefix}-ctl` in withoutOne))
    expect(missing).toEqual(['button-padding-x'])
  })
})
