import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * A shipped stylesheet that reads `var(--x)` with no fallback paints nothing when `--x` is never set:
 * the 2.x name `--basalt-surface-row-selected` left a selected table row transparent for a whole
 * dogfood cycle while its attribute and every test were green. `basalt-resolves.test.ts` holds the
 * `BASALT` refs to the v3 sheet; this holds the CSS files.
 *
 * A name resolves when something ships that sets it: a declaration in any shipped stylesheet outside
 * an `@theme` block, or a quoted `--name` in a source file (an inline style key; basalt names are
 * excluded, they come from the sheet alone). `@theme` names do NOT count: Tailwind emits one only
 * while a utility or a `var()` in a processed file uses it, which is how `--color-selected` stayed
 * unset. A `var(--x, fallback)` is an optional knob the consumer may set, so it is skipped.
 */
const SRC = join(import.meta.dir, '..')

/** Set by Tailwind's own preflight whenever any spacing utility or `var()` of it is compiled. */
const ALLOWED = new Set(['--spacing'])

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const files = walk(SRC).filter((f) => !/\.test\.|[/]golden[/]|__snapshots__/.test(f))
const sheets = files.filter((f) => f.endsWith('.css'))
const sources = files.filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'))

const stripTheme = (css: string): string => css.replace(/@theme[^{]*\{[^}]*\}/g, '')

const declaredIn = (css: string): string[] =>
  [...stripTheme(css).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]!)

/** The names a stylesheet reads with no fallback, deduplicated. */
const requiredVars = (css: string): string[] => [
  ...new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/g)].map((m) => m[1]!)),
]

const unresolved = (css: string, declared: ReadonlySet<string>): string[] =>
  requiredVars(css).filter((name) => !declared.has(name) && !ALLOWED.has(name))

const DECLARED = new Set<string>([
  ...sheets.flatMap((f) => declaredIn(readFileSync(f, 'utf8'))),
  ...sources.flatMap((f) =>
    [
      ...readFileSync(f, 'utf8').matchAll(
        /['"`](--(?!basalt-|color-|font-|radius-|shadow-|text-|breakpoint-|container-)[a-z0-9-]+)['"`]/g,
      ),
    ].map((m) => m[1]!),
  ),
])

describe('shipped CSS reads only variables something sets', () => {
  test('the sheet declares the names the guard resolves against', () => {
    expect(DECLARED.has('--basalt-selected')).toBe(true)
    expect(DECLARED.has('--basalt-hover')).toBe(true)
    expect(DECLARED.has('--basalt-canvas')).toBe(true)
  })

  test('a @theme-only name does not count as set', () => {
    expect(DECLARED.has('--color-selected')).toBe(false)
  })

  test('the 2.x row-selected name and a @theme-only name both fail', () => {
    const old = `[data-selected] { background-color: var(--basalt-surface-row-selected); }
      [data-focused] { background-color: var(--color-selected); }
      [data-ok] { color: var(--basalt-ink); padding: var(--basalt-knob, 1px); }`
    expect(unresolved(old, DECLARED)).toEqual(['--basalt-surface-row-selected', '--color-selected'])
  })

  for (const file of sheets) {
    test(`${relative(SRC, file)} reads no unset variable`, () => {
      expect(unresolved(readFileSync(file, 'utf8'), DECLARED)).toEqual([])
    })
  }
})
