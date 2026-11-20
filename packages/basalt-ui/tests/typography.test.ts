import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { resolveTokens } from '../src/tokens/table'

const css = (name: string): string =>
  readFileSync(join(import.meta.dir, '../src/css', name), 'utf8')
const typography = css('typography.css')
const fonts = css('fonts.css')

const strip = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '')

/** Selector lines: every line ending in `{` that is not an at-rule. */
const selectors = (source: string): string[] =>
  strip(source)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('{') && !line.startsWith('@'))

describe('typography.css', () => {
  test('has no class selector', () => {
    for (const selector of selectors(typography)) expect(selector, selector).not.toMatch(/\.[a-z]/i)
  })

  test('uses !important only inside the reduced-motion block', () => {
    const body = strip(typography)
    const reduced = body.slice(body.indexOf('@media (prefers-reduced-motion'))
    const end = reduced.indexOf('@media print')
    const outside = body.replace(end < 0 ? reduced : reduced.slice(0, end), '')
    expect(outside).not.toContain('!important')
    expect(reduced).toContain('!important')
  })

  test('every rung size and line height equals the token table value', () => {
    const rungs = resolveTokens().filter(
      ({ def }) => def.family === 'type' && def.name.startsWith('text-'),
    )
    expect(rungs).toHaveLength(14)
    for (const { def, value } of rungs) {
      expect(typography, def.name).toContain(`--basalt-${def.name}: ${String(value)};`)
    }
  })
})

describe('fonts.css', () => {
  test('contains only @font-face rules', () => {
    const body = strip(fonts).trim()
    expect(body).not.toContain('@import')
    const rest = body.replace(/@font-face\s*\{[^}]*\}/g, '').trim()
    expect(rest).toBe('')
  })

  test('declares only the three families and Head Digits, latin subsets only', () => {
    const families = [...fonts.matchAll(/font-family: '([^']+)'/g)].map((m) => m[1])
    expect(new Set(families)).toEqual(
      new Set([
        'Nunito Sans Variable',
        'Hubot Sans Variable',
        'JetBrains Mono Variable',
        'Head Digits',
      ]),
    )
    for (const [, file] of fonts.matchAll(/files\/([^']+)'/g)) {
      expect(file, file).toMatch(/-latin(-ext)?-(wght|wdth)-normal\.woff2$/)
    }
  })

  test('every face is a relative url() to a file shipped beside the sheet, byte-equal to the fontsource original', () => {
    const require = createRequire(import.meta.url)
    const urls = [...fonts.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1] ?? '')
    expect(urls).toHaveLength(7)
    for (const url of urls) {
      expect(url, url).toMatch(/^\.\/files\/[a-z-]+\.woff2$/)
      const name = url.slice('./files/'.length)
      const shipped = join(import.meta.dir, '../src/css/files', name)
      expect(existsSync(shipped), name).toBe(true)
      const pkg = name.replace(/-latin.*$/, '')
      const original = join(
        dirname(require.resolve(`@fontsource-variable/${pkg}/package.json`)),
        'files',
        name,
      )
      expect(readFileSync(shipped).equals(readFileSync(original)), name).toBe(true)
    }
  })

  test('styles.css names its Head Digits file relative to itself, inside the same folder', () => {
    const styles = readFileSync(join(import.meta.dir, '../src/styles.css'), 'utf8')
    const [, file] = /url\('\.\/css\/files\/([^']+)'\)/.exec(styles) ?? []
    expect(file).toBeDefined()
    expect(existsSync(join(import.meta.dir, '../src/css/files', file ?? ''))).toBe(true)
  })
})
