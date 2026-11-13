/**
 * P9, tokens half (docs/v3/concepts/ai-mdx.md section 8): an MDX page rendered as plain elements
 * under `.vx-prose` alone, with no React and no component map, reads the same body size, leading
 * and measure as the `Prose` article. The markup below is what the fixture compiles to with an
 * empty component map. Chrome only.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { compile } from 'tailwindcss'
import { Prose } from '../../src/page/prose'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openDocument,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const CSS_DIR = new URL('../../src/css/', import.meta.url).pathname
const read = (name: string) => readFileSync(join(CSS_DIR, name), 'utf8')

/** The fixture page as the compiler emits it when every tag is a plain element. */
const PLAIN = [
  '<h2 id="writing-the-docs">Writing the docs</h2>',
  '<p>An authored page uses <a href="/docs/guide">a guide</a> and <code>code</code>.</p>',
  '<h3 id="install">Install</h3>',
  '<ol><li>Add the package</li><li>Wrap the app</li></ol>',
  '<table><thead><tr><th>Stage</th><th>Latency</th></tr></thead>' +
    '<tbody><tr><td>Ingest</td><td>40 ms</td></tr></tbody></table>',
  '<blockquote><p>Quoted text.</p></blockquote>',
  '<pre><code>export const load = 1</code></pre>',
].join('')

const require = createRequire(import.meta.url)
const tailwindDir = dirname(require.resolve('tailwindcss/package.json'))

/** The utilities `Prose` writes, built against the Tailwind default theme. */
async function utilities(markup: string): Promise<string> {
  const candidates = [
    ...new Set([...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1]!.split(/\s+/))),
  ]
  const { build } = await compile(
    '@import "tailwindcss/theme.css" layer(theme); @import "tailwindcss/utilities.css" layer(utilities);',
    {
      base: tailwindDir,
      loadStylesheet: async (id, base) => {
        const path = id.startsWith('tailwindcss/')
          ? join(tailwindDir, id.slice('tailwindcss/'.length))
          : join(base, id)
        return {
          path,
          base: dirname(path),
          content: readFileSync(path, 'utf8'),
        }
      },
    },
  )
  return build(candidates)
}

const article = renderToStaticMarkup(
  createElement(Prose, null, createElement('div', { dangerouslySetInnerHTML: { __html: PLAIN } })),
)

async function doc(body: string, extraCss = ''): Promise<string> {
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><style>' +
    '@layer theme, base, basalt, components, utilities;\n' +
    `@layer theme {\n${read('tokens.css')}\n}\n${read('prose.css')}\n${extraCss}` +
    `</style></head><body>${body}</body></html>`
  )
}

type Metrics = {
  fontSize: string
  lineHeight: string
  maxWidth: string
  width: number
}

async function measure(html: string, selector: string): Promise<Metrics> {
  const p = await openDocument(html, DESKTOP_1440)
  const [fontSize, lineHeight, maxWidth] = await Promise.all([
    p.computed(selector, 'font-size'),
    p.computed(selector, 'line-height'),
    p.computed(selector, 'max-width'),
  ])
  const { box } = await p.box('prose', selector)
  return { fontSize, lineHeight, maxWidth, width: box.width }
}

const both = async () => ({
  plain: await measure(await doc(`<article class="vx-prose">${PLAIN}</article>`), '.vx-prose'),
  prose: await measure(await doc(article, await utilities(article)), '[data-slot="prose"]'),
})

layout('MDX as plain elements under .vx-prose', () => {
  test('body is 16px, equal to the Prose article', async () => {
    const { plain, prose } = await both()
    expect(plain.fontSize).toBe('16px')
    expect(plain.fontSize).toBe(prose.fontSize)
  })

  // GAP, recorded as a factory signal: `.vx-prose` alone resolves line-height 24px (1.5) and
  // `--vx-measure` 68ch, while `Prose` adds `leading-[1.7]` and `max-w-[72ch]` on top. The fix is in
  // the token table and the prose template (`src/tokens`, a frozen lane), so this assertion is
  // `failing` until that lands; when it starts to pass, bun flags it and the wrapper comes off.
  test.failing('line-height is 1.7 and the measure 72ch, equal to the Prose article', async () => {
    const { plain, prose } = await both()
    expect(parseFloat(plain.lineHeight) / parseFloat(plain.fontSize)).toBeCloseTo(1.7, 2)
    expect(plain.lineHeight).toBe(prose.lineHeight)
    expect(plain.width).toBeCloseTo(prose.width, 0)
  })
})
