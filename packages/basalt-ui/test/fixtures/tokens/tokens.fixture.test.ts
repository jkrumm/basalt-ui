import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { themeScript } from '../../../src/css/theme-script'
import { tokenNames } from '../../../src/tokens/emit'

const dir = import.meta.dir
const html = readFileSync(resolve(dir, 'index.html'), 'utf8')

function localSheets(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((m) => m[1] ?? '').filter((p) => p.startsWith('.'))
}

/** Follows `<link>` hrefs and relative `@import`s from the page; bare package imports are skipped. */
function collectCss(): string {
  const seen = new Set<string>()
  const out: string[] = []
  const visit = (file: string): void => {
    if (seen.has(file)) return
    seen.add(file)
    const css = readFileSync(file, 'utf8')
    out.push(css)
    for (const rel of localSheets(css, /@import\s+(?:url\()?['"]([^'"]+)['"]/g)) {
      visit(resolve(dirname(file), rel))
    }
  }
  for (const rel of localSheets(html, /<link[^>]*href="([^"]+)"/g)) visit(resolve(dir, rel))
  return out.join('\n')
}

const css = collectCss()
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]

describe('tokens fixture (static, framework-free)', () => {
  test('the four entry sheets are pulled in', () => {
    expect(css).toContain('--vx-canvas:')
    expect(css).toContain('@layer basalt.type')
    expect(css).toContain('@layer basalt.prose')
    expect(css).toContain('@font-face')
  })

  test('no Tailwind entry or directive reaches the page', () => {
    expect(css).not.toMatch(/@import\s+['"]tailwindcss/)
    expect(css).not.toMatch(/@theme\b/)
    expect(css).not.toMatch(/@utility\b/)
  })

  test('exactly one script: the boot script, byte for byte', () => {
    expect(scripts).toHaveLength(1)
    expect(scripts[0]?.[1]).toBe(themeScript())
  })

  test('no react or tailwind in the fixture', () => {
    const own = [html, readFileSync(resolve(dir, 'app.css'), 'utf8')].join('\n')
    expect(own.toLowerCase()).not.toContain('react')
    expect(own.toLowerCase()).not.toContain('tailwind')
    expect(css.toLowerCase()).not.toContain('react')
  })

  test('every var(--vx-*) the page reads is a real token', () => {
    const known = new Set(tokenNames())
    const read = new Set(
      [...`${html}\n${css}`.matchAll(/var\((--vx-[a-z0-9-]+)/g)].map((m) => m[1] ?? ''),
    )
    expect(read.size).toBeGreaterThan(0)
    expect([...read].filter((n) => !known.has(n))).toEqual([])
  })
})
