/**
 * Post-process for beautiful-mermaid's SVG (consumed by `./mermaid`).
 *
 * `buildStyleBlock(font)` treats the font as a family NAME: it emits a Google Fonts `@import` (plus
 * a JetBrains Mono one when `mono` is set) and writes `text { font-family: '<font>', … }`. basalt
 * feeds it `var(--basalt-font-sans)`, so the import is a broken request and the quoted `'var(…)'`
 * is an invalid family. basalt self-hosts its fonts: drop the import, unquote the var().
 *
 * Patterns verified against beautiful-mermaid 1.1.3 (peer range ^1.1.0): the style block is a
 * single `<style>` holding the `@import`s and one `text { font-family }` rule; `font-family`
 * never appears as a presentation attribute. Only `<style>` content is rewritten — a node label
 * that happens to contain the same text is left alone.
 */

const STYLE_BLOCK = /(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi

// One statement: `@import [url(]'//fonts.googleapis.com/…'[)] [;]`. The family URL itself contains
// `;` (`wght@400;500`, `&amp;`), so the quoted forms are bounded by their closing quote, the
// unquoted `url(…)` form by `)` and never crosses a `}`. A missing trailing `;` is tolerated.
const GOOGLE_FONTS_IMPORT =
  /@import\s+(?:(?:url\(\s*)?(['"])(?:https?:)?\/\/fonts\.googleapis\.com[^'"]*\1(?:\s*\))?|url\(\s*(?:https?:)?\/\/fonts\.googleapis\.com[^}'"]*?\))[ \t]*;?/g

// `font-family: 'var(--x)'` — a value that is exactly a quoted var(). `var(--a, 'fallback')` has a
// quote inside and `'Inter', var(--x)` does not start with var(, so neither matches.
const QUOTED_VAR_FONT_FAMILY = /(font-family\s*:\s*)(['"])(var\([^'"]*\))\2/g

function sanitizeStyle(css: string): string {
  return css.replace(GOOGLE_FONTS_IMPORT, '').replace(QUOTED_VAR_FONT_FAMILY, '$1$3')
}

export function sanitizeMermaidFonts(svg: string): string {
  const out = svg.replace(
    STYLE_BLOCK,
    (_block, open: string, css: string, close: string) => open + sanitizeStyle(css) + close,
  )
  if (process.env.NODE_ENV !== 'production' && /googleapis/i.test(styleText(out))) {
    console.warn(
      '[basalt] MermaidDiagram: a remote font import survived sanitization — beautiful-mermaid ' +
        'changed its <style> output; update src/content/mermaid-sanitize.ts.',
    )
  }
  return out
}

function styleText(svg: string): string {
  return [...svg.matchAll(STYLE_BLOCK)].map((m) => m[2]).join('\n')
}
