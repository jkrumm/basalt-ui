/**
 * Dev-only code must sit behind a LITERAL `process.env.NODE_ENV` read at the branch itself, or a
 * consumer's production bundle keeps it. Measured on minified production builds with the dev branch
 * behind an import (fold matrix, `provider/lab-theme.ts`):
 *
 * | gate form                        | Rolldown | esbuild | Bun  | webpack + terser |
 * |-|-|-|-|-|
 * | literal read at the branch       | drop     | drop    | drop | drop             |
 * | module-level `const DEV = …`     | drop     | KEEP    | KEEP | drop             |
 * | cross-module helper (`isDev()`)  | KEEP     | KEEP    | KEEP | drop             |
 *
 * 1.32.1 shipped the theme lab's whole store to every production app through the helper form; this
 * scan is what stops either leaking form from coming back.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(import.meta.dir, '..')

const NODE_ENV = String.raw`process\.env(?:\.NODE_ENV|\[['"]NODE_ENV['"]\])`

const LEAKING_FORMS = [
  {
    name: 'a module-level boolean bound from NODE_ENV',
    pattern: new RegExp(
      String.raw`^(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*${NODE_ENV}\s*[!=]==?\s*['"]production['"]\s*;?\s*$`,
      'm',
    ),
  },
  {
    name: 'a helper function returning the NODE_ENV comparison',
    pattern: new RegExp(
      String.raw`function\s+\w+\s*\(\s*\)[^{]*\{\s*return\s+${NODE_ENV}\s*[!=]==?\s*['"]production['"]`,
    ),
  },
  { name: 'a call to the removed `isDev()` helper', pattern: /\bisDev\s*\(/ },
] as const

// Comments may name the forms (this file's own doc, lab-theme's matrix) — only code is scanned.
const stripComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/^\s*\/\/.*$/gm, '')

const files = [...new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: SRC })].filter(
  (rel) => !/\.test\.tsx?$/.test(rel) && !rel.endsWith('.d.ts'),
)

describe('dev-only gates fold in every bundler', () => {
  for (const form of LEAKING_FORMS) {
    test(`no src module gates dev code through ${form.name}`, () => {
      const offenders = files.filter((rel) =>
        form.pattern.test(stripComments(readFileSync(join(SRC, rel), 'utf8'))),
      )
      expect(offenders).toEqual([])
    })
  }

  test('the scan sees the tree and each pattern catches its own form', () => {
    expect(files.length).toBeGreaterThan(100)
    const [boolConst, helper, call] = LEAKING_FORMS
    expect(boolConst.pattern.test(`const DEV = process.env['NODE_ENV'] !== 'production'`)).toBe(
      true,
    )
    expect(
      boolConst.pattern.test(`export const LAB = process.env.NODE_ENV !== "production";`),
    ).toBe(true)
    // The sanctioned module-scope shape: the literal read sits inside the selecting ternary.
    expect(
      boolConst.pattern.test(
        `export const useLabTheme = process.env.NODE_ENV !== 'production' ? useDev : useProd`,
      ),
    ).toBe(false)
    expect(
      helper.pattern.test(
        `export function dev(): boolean {\n  return process.env.NODE_ENV !== 'production'\n}`,
      ),
    ).toBe(true)
    expect(call.pattern.test(`if (isDev()) warn()`)).toBe(true)
  })
})
