/**
 * Documents for the one-look suite: the static tokens page and the bridge page, built from the
 * package's own CSS, with no bundler between the sheets and Chrome.
 *
 * The harness serves HTML only, so every sheet is inlined. `fonts.css` is left out on purpose: its
 * `url()`s are bare package specifiers that only a CSS bundler (or a copy step) resolves, and no
 * assertion here reads a face.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { compile } from 'tailwindcss'
import { themeScript } from '../../../src/css/theme-script'
import { ATOMS, atomRules } from './atoms'

const here = import.meta.dir
export const PACKAGE_DIR = resolve(here, '../../..')
const tokensFixture = join(PACKAGE_DIR, 'test/fixtures/tokens')
const bridgeFixture = join(PACKAGE_DIR, 'test/fixtures/bridge')

const read = (path: string): string => readFileSync(path, 'utf8')

/** The tokens fixture page with its sheets inlined (fonts.css dropped) and its boot script swapped. */
export function tokensPage(
  options: { script?: string | null; head?: string; body?: string; withAtoms?: boolean } = {},
): string {
  const { script = themeScript(), head = '', body = '', withAtoms = false } = options
  let html = read(join(tokensFixture, 'index.html'))
  html = html.replace(/<link[^>]*href="([^"]+)"[^>]*>/g, (_, href: string) => {
    if (href.endsWith('fonts.css')) return ''
    return `<style>${read(resolve(tokensFixture, href))}</style>`
  })
  html = html.replace(/<!-- prettier-ignore -->\s*<script\b[^>]*>[\s\S]*?<\/script>/, '')
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/, '')
  const atoms = withAtoms
    ? `<style>${atomRules()}</style>${ATOMS.map((a) => a.tokensMarkup).join('')}`
    : ''
  html = html.replace(
    '</head>',
    `${head}${script === null ? '' : `<script>${script}</script>`}</head>`,
  )
  return html.replace('</body>', `${atoms}${body}</body>`)
}

const require = createRequire(import.meta.url)
const tailwindIndex = join(dirname(require.resolve('tailwindcss/package.json')), 'index.css')

/** The bridge fixture's `app.css` compiled by Tailwind 4 for the probe markup, `@font-face` dropped. */
async function bridgeCss(markup: string): Promise<string> {
  const candidates = [
    ...new Set(
      [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) =>
        (m[1] ?? '').split(/\s+/).filter(Boolean),
      ),
    ),
  ]
  const { build } = await compile(read(join(bridgeFixture, 'app.css')), {
    base: bridgeFixture,
    loadStylesheet: async (id, base) => {
      if (id.startsWith('@fontsource-variable/')) return { path: id, base, content: '' }
      const path = id === 'tailwindcss' ? tailwindIndex : resolve(base, id)
      return { path, base: dirname(path), content: read(path) }
    },
  })
  return build(candidates).replace(/@font-face\s*\{[^}]*\}/g, '')
}

/** The bridge page: the same atoms, expressed as Tailwind utilities the bridge maps onto `--vx-*`. */
export async function bridgePage(): Promise<string> {
  const markup = ATOMS.map((a) => a.bridgeMarkup).join('')
  const css = await bridgeCss(markup)
  return `<!doctype html><html lang="en" data-density="dense"><head><meta charset="utf-8" /><style>${css}</style></head><body>${markup}</body></html>`
}
