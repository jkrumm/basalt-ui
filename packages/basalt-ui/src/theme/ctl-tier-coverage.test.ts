/**
 * The ctl-tier coverage gate (`docs/CONTROLS-SPEC.md` §5) — greps every `getSize(size, '<prefix>')`
 * / `getFontSize(size)` call in the INSTALLED `@mantine/core` source for the TWELVE components the
 * tier covers (Button, ActionIcon, Input, SegmentedControl, Combobox, Select, MultiSelect,
 * TextInput, Menu — the nine the spec names — plus Radio, Checkbox and Switch) and asserts
 * `cssVariablesResolver`'s `variables` block declares a `-ctl` var for every distinct prefix found —
 * so a missing var (the `--button-padding-x-ctl` the spec's own text calls out as "every draft
 * omitted") fails the build instead of silently rendering at 0px/undefined.
 *
 * Radio/Checkbox/Switch joined the scan when they joined `CTL_THEME`: they had defaulted to
 * Mantine's `sm`, a 20px indicator beside the tier's 13.5px option label, in every filter popover and
 * in the mobile sheet. Adding them to `defaultProps` without declaring their vars would have been
 * strictly worse than leaving them alone — an undeclared `--radio-size-ctl` resolves to the
 * property's INITIAL value, which is how a Select once shipped with no chevron (see
 * `theme/index.ts`'s `ctlSizeVars` doc). This scan is what makes the two halves inseparable.
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
import { CTL_THEME, baseTheme, cssVariablesResolver } from './index'

const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme)

const MANTINE_CORE_ESM_COMPONENTS = join(
  dirname(require.resolve('@mantine/core/package.json')),
  'esm/components',
)

/** Every component `CTL_THEME` sets a `ctl` default on, plus `Input`/`Combobox`/`Menu` which the
 *  others resolve through. Keep this list and `CTL_THEME.components` in step — the last test in this
 *  file asserts exactly that, so they cannot drift apart silently. */
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
  'Radio',
  'Checkbox',
  'Switch',
  // In `CTL_THEME` since the tier shipped, and never scanned until the drift test below was added —
  // which is the whole argument for that test. It renders a native `<select>` through
  // `Input`/`InputBase`, so it contributes no prefix of its own; being scanned is what proves that
  // rather than assuming it.
  'NativeSelect',
  // Scanned WITHOUT being in `CTL_THEME` — the one entry of that shape, and see `ctl-theme.tsx`'s
  // note for why: `SliderControl` renders `size="ctl"` itself, so `--slider-size-ctl` has to exist
  // for the same reason every other tier var does, while adding `Slider` to the slot map would
  // widen a shipped `error` rule. The last test in this file allows the direction (themed ⊆
  // scanned), which is what makes this legal rather than drift.
  'Slider',
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

  test('the scan reaches Radio/Checkbox/Switch — the three the popovers and the sheet render', () => {
    expect(prefixes.has('radio-size')).toBe(true)
    expect(prefixes.has('radio-icon-size')).toBe(true)
    expect(prefixes.has('checkbox-size')).toBe(true)
    expect(prefixes.has('switch-height')).toBe(true)
    expect(prefixes.has('switch-width')).toBe(true)
    expect(prefixes.has('switch-thumb-size')).toBe(true)
    expect(prefixes.has('switch-label-font-size')).toBe(true)
    expect(prefixes.has('switch-track-label-padding')).toBe(true)
  })

  test('there is NO --checkbox-icon-size to declare — Checkbox derives its tick in CSS', () => {
    // Worth pinning: the obvious symmetry with `radio-icon-size` does not exist in 9.3.0, and
    // declaring a var no `getSize` call reads would be dead weight that reads like coverage.
    expect(prefixes.has('checkbox-icon-size')).toBe(false)
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

  test('every component CTL_THEME defaults to `ctl` is in the scanned set', () => {
    // The two halves of the tier — `defaultProps.size = 'ctl'` and the `-ctl` vars — must move
    // together, and this is what makes adding a component to one without the other fail. `*Group`
    // keys resolve to their base component's prefixes (a Group reads `Input.Wrapper`'s vars, and the
    // scan already covers `Input`), so they are stripped before the comparison.
    const scanned = new Set<string>(CTL_TIER_COMPONENTS)
    const themed = Object.keys(CTL_THEME.components ?? {}).map((name) =>
      name.endsWith('Group') ? name.slice(0, -'Group'.length) : name,
    )
    expect(themed.filter((name) => !scanned.has(name))).toEqual([])
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
