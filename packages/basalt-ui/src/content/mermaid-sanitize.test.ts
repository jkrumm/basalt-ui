/**
 * `sanitizeMermaidFonts` — string fixtures plus one real `renderMermaidSVG` round trip, so the
 * patterns are checked against what the pinned beautiful-mermaid actually emits.
 */
import { renderMermaidSVG } from 'beautiful-mermaid'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { sanitizeMermaidFonts } from './mermaid-sanitize'

const GF =
  "@import url('https://fonts.googleapis.com/css2?family=X:wght@400;500&amp;display=swap');"
const svg = (css: string, body = '<text>hi</text>'): string =>
  `<svg><style>\n  ${css}\n</style>${body}</svg>`

afterEach(() => {
  process.env.NODE_ENV = 'test'
})

describe('sanitizeMermaidFonts', () => {
  test('strips the Google Fonts import, including the mono variant', () => {
    const mono =
      "@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500');"
    const out = sanitizeMermaidFonts(svg(`${GF}\n  ${mono}\n  text { fill: red; }`))
    expect(out).not.toContain('@import')
    expect(out).toContain('text { fill: red; }')
  })

  test.each([
    ['protocol-relative', "@import url('//fonts.googleapis.com/css2?family=X');"],
    ['string form', "@import 'https://fonts.googleapis.com/css2?family=X';"],
    ['double quotes', '@import url("https://fonts.googleapis.com/css2?family=X");'],
    ['unquoted url()', '@import url(https://fonts.googleapis.com/css2?family=X);'],
    ['missing semicolon before }', "@import url('https://fonts.googleapis.com/css2?family=X')"],
  ])('strips the %s form', (_name, imp) => {
    const out = sanitizeMermaidFonts(svg(`${imp}\n  text { fill: red; }`))
    expect(out).not.toContain('googleapis')
    expect(out).toContain('text { fill: red; }')
  })

  test('keeps a non-googleapis @import', () => {
    const own = "@import url('https://example.com/own.css');"
    expect(sanitizeMermaidFonts(svg(`${GF}\n  ${own}`))).toContain(own)
  })

  test('unquotes a font-family that is exactly a var()', () => {
    expect(sanitizeMermaidFonts(svg("text { font-family: 'var(--f)', system-ui; }"))).toContain(
      'font-family: var(--f), system-ui;',
    )
    expect(sanitizeMermaidFonts(svg('text { font-family: "var(--f)"; }'))).toContain(
      'font-family: var(--f);',
    )
  })

  test.each([
    "text { font-family: 'Inter', system-ui; }",
    "text { font-family: 'Inter', var(--x); }",
    "text { font-family: var(--a, 'fallback'); }",
  ])('leaves %s alone', (css) => {
    const input = svg(css)
    expect(sanitizeMermaidFonts(input)).toBe(input)
  })

  test('leaves label text outside <style> untouched', () => {
    const label = `<text>${GF} font-family: 'var(--x)'</text>`
    const out = sanitizeMermaidFonts(svg(`${GF}\n  text { font-family: 'var(--f)'; }`, label))
    expect(out).toContain(label)
    expect(out).toContain('font-family: var(--f);')
  })

  test('returns an SVG with no font rules byte-identical', () => {
    const input = svg('svg { --a: 1; }')
    expect(sanitizeMermaidFonts(input)).toBe(input)
  })

  test('strips two imports in one block', () => {
    const out = sanitizeMermaidFonts(svg(`${GF}\n  ${GF}`))
    expect(out).not.toContain('@import')
  })

  test('warns in dev when a remote font import survives, not in production', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      // an unterminated url( the patterns cannot bound — stands in for a changed upstream shape
      const odd = svg("@import url('https://fonts.googleapis.com/css2?family=X")
      sanitizeMermaidFonts(odd)
      expect(warn).toHaveBeenCalledTimes(1)
      process.env.NODE_ENV = 'production'
      sanitizeMermaidFonts(odd)
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  test('real beautiful-mermaid output: no import, unquoted var(), no warning', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const raw = renderMermaidSVG('flowchart LR\n  A --> B', { font: 'var(--basalt-font-sans)' })
      expect(raw).toContain('@import')
      const out = sanitizeMermaidFonts(raw)
      expect(out).not.toContain('@import')
      expect(out).not.toContain('googleapis')
      expect(out).toContain('font-family: var(--basalt-font-sans), system-ui')
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})
