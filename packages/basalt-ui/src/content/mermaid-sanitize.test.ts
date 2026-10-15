/**
 * `sanitizeMermaidFonts` — string fixtures plus one real `renderMermaidSVG` round trip, so the
 * patterns are checked against what the pinned beautiful-mermaid actually emits.
 */
import { renderMermaidSVG } from 'beautiful-mermaid'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { MERMAID_THEME_OPTIONS } from './mermaid'
import { sanitizeMermaidFonts } from './mermaid-sanitize'

const GF =
  "@import url('https://fonts.googleapis.com/css2?family=X:wght@400;500&amp;display=swap');"
const svg = (css: string, body = '<text>hi</text>'): string =>
  `<svg><style>\n  ${css}\n</style>${body}</svg>`

const originalEnv = process.env['NODE_ENV']
afterEach(() => {
  if (originalEnv === undefined) delete process.env['NODE_ENV']
  else process.env['NODE_ENV'] = originalEnv
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

  test('a truncated quoted import cannot eat the CSS after it', () => {
    const rule = "text { font-family: 'Inter'; }"
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const out = sanitizeMermaidFonts(
        svg(`@import url('https://fonts.googleapis.com/css2?family=X\n  ${rule}`),
      )
      expect(out).toContain(rule)
    } finally {
      warn.mockRestore()
    }
  })

  test('strips an import with a media list', () => {
    const out = sanitizeMermaidFonts(
      svg(
        "@import url('https://fonts.googleapis.com/css2?family=X') screen;\n  text { fill: red; }",
      ),
    )
    expect(out).not.toContain('googleapis')
    expect(out).toContain('text { fill: red; }')
  })

  test('strips an import directly before } with no newline', () => {
    const out = sanitizeMermaidFonts(
      "<svg><style>@import url('https://fonts.googleapis.com/css2?family=X')</style></svg>",
    )
    expect(out).toBe('<svg><style></style></svg>')
  })

  test('unquotes a var() followed by !important', () => {
    expect(sanitizeMermaidFonts(svg("text { font-family: 'var(--f)' !important; }"))).toContain(
      'font-family: var(--f) !important;',
    )
  })

  test('unquotes only the leading var() when a value holds two', () => {
    const out = sanitizeMermaidFonts(svg("text { font-family: 'var(--a)', 'var(--b)'; }"))
    expect(out).toContain("font-family: var(--a), 'var(--b)';")
  })

  test('returns an SVG with no <style> byte-identical', () => {
    const input = `<svg><text>${GF}</text></svg>`
    expect(sanitizeMermaidFonts(input)).toBe(input)
  })

  test('rewrites <STYLE> in uppercase and <style> with attributes', () => {
    const upper = sanitizeMermaidFonts(`<svg><STYLE>${GF}</STYLE></svg>`)
    expect(upper).toBe('<svg><STYLE></STYLE></svg>')
    const attrs = sanitizeMermaidFonts(`<svg><style type="text/css" nonce="n">${GF}</style></svg>`)
    expect(attrs).toBe('<svg><style type="text/css" nonce="n"></style></svg>')
  })

  test('strips two imports in one block', () => {
    const out = sanitizeMermaidFonts(svg(`${GF}\n  ${GF}`))
    expect(out).not.toContain('@import')
  })

  test('warns in dev when a remote font import survives, not in production', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      // an unterminated quote the patterns refuse to bound — stands in for a changed upstream shape
      const odd = svg(
        "@import url('https://fonts.googleapis.com/css2?family=X\n  text { fill: red; }",
      )
      sanitizeMermaidFonts(odd)
      expect(warn).toHaveBeenCalledTimes(1)
      process.env['NODE_ENV'] = 'production'
      sanitizeMermaidFonts(odd)
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  test('real beautiful-mermaid output: no import, unquoted var(), no warning', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const raw = renderMermaidSVG('flowchart LR\n  A --> B', MERMAID_THEME_OPTIONS)
      expect(raw).toContain('@import')
      const out = sanitizeMermaidFonts(raw)
      expect(out).not.toContain('@import')
      expect(out).not.toContain('googleapis')
      expect(out).toContain('font-family: var(--basalt-font-sans), system-ui')
      expect(out).not.toMatch(/font-family\s*:\s*['"]var\(/)
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})
