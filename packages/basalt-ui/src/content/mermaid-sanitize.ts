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

// One `@import` statement, built from fragments. The family URL itself contains `;` (`wght@400;500`,
// `&amp;`), so each form is bounded by its closing quote / `)` — never by `;` — and never crosses
// a newline or `}`: a truncated import cannot eat unrelated CSS.
const HOST = String.raw`(?:https?:)?\/\/fonts\.googleapis\.com`
const QUOTED_FORM = String.raw`(?:url\(\s*)?(['"])${HOST}[^'"}\n]*\1(?:\s*\))?` //  'url' | url('url') | url("url")
const URL_FORM = String.raw`url\(\s*${HOST}[^}'"\n]*?\)` //                         url(url)
const MEDIA_LIST = String.raw`(?:[ \t]+[^;{}\n]*)?` //                              `url(…) screen`
const GOOGLE_FONTS_IMPORT = new RegExp(
  String.raw`@import\s+(?:${QUOTED_FORM}|${URL_FORM})${MEDIA_LIST}[ \t]*;?`,
  'g',
)

// `font-family: 'var(--x)'` — a value that is exactly a quoted var(). `var(--a, 'fallback')` has a
// quote inside and `'Inter', var(--x)` does not start with var(, so neither matches.
const QUOTED_VAR_FONT_FAMILY = /(font-family\s*:\s*)(['"])(var\([^'"]*\))\2/g

function sanitizeStyle(css: string): string {
  const cleaned = css.replace(GOOGLE_FONTS_IMPORT, '').replace(QUOTED_VAR_FONT_FAMILY, '$1$3')
  if (process.env.NODE_ENV !== 'production' && /googleapis/i.test(cleaned)) {
    console.warn(
      '[basalt] MermaidDiagram: a remote font import survived sanitization — beautiful-mermaid ' +
        'changed its <style> output; update src/content/mermaid-sanitize.ts.',
    )
  }
  return cleaned
}

export function sanitizeMermaidFonts(svg: string): string {
  return svg.replace(
    STYLE_BLOCK,
    (_block, open: string, css: string, close: string) => open + sanitizeStyle(css) + close,
  )
}
