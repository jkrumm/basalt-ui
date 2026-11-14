// Headless Chrome measurement shared by the oracle generator and the bench. A page holds one
// `<section data-sig>` per signature inside a hostile host (bold, red, centred, line-height 3, 21px);
// every element below a section is recorded as 7 numbers relative to the section.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright-core'

export const WIDTHS = [700, 1100, 1300] as const
/** x, y, width, height, font-size, line-height (-1 for `normal`), border-radius. */
export const STRIDE = 7
export type Node = {
  x: number
  y: number
  w: number
  h: number
  fs: number
  lh: number
  br: number
}
/** `[width][signature]` flat arrays of STRIDE numbers per node. */
export type Measured = number[][][]

export const REPO_ROOT = join(import.meta.dir, '../../..')

export function decode(flat: number[]): Node[] {
  const nodes: Node[] = []
  for (let i = 0; i + STRIDE <= flat.length; i += STRIDE) {
    const [x, y, w, h, fs, lh, br] = flat.slice(i, i + STRIDE) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
    nodes.push({ x, y, w, h, fs, lh, br })
  }
  return nodes
}

/** The one face both pages use, so text width never depends on the host's fonts. */
export function fontCss(): string {
  const pkg = Bun.resolveSync(
    '@fontsource-variable/nunito-sans/package.json',
    join(REPO_ROOT, 'packages/basalt-ui'),
  )
  const file = join(dirname(pkg), 'files/nunito-sans-latin-wght-normal.woff2')
  const data = readFileSync(file).toString('base64')
  return `@font-face{font-family:'BenchFont';font-weight:200 1000;src:url(data:font/woff2;base64,${data}) format('woff2')}`
}

export function fontVersion(): string {
  const pkg = Bun.resolveSync(
    '@fontsource-variable/nunito-sans/package.json',
    join(REPO_ROOT, 'packages/basalt-ui'),
  )
  return `nunito-sans@${(JSON.parse(readFileSync(pkg, 'utf8')) as { version: string }).version}`
}

/** Unlayered, so it outranks Mantine's and Tailwind's layers alike. */
export const HOST_CSS = `
html,body{margin:0}
.host{box-sizing:border-box;width:100%;font-family:'BenchFont';font-size:21px;font-weight:700;color:red;text-align:center;line-height:3;text-rendering:geometricPrecision}
[data-k]{min-height:20px;min-width:24px}
`

export function sections(bodies: string[]): string {
  return bodies.map((b, i) => `<section data-sig="${i}" class="host">${b}</section>`).join('\n')
}

type Overrides = number[][][] | undefined

/**
 * Loads `html` at each width and records every node. With `lineHeights` (`[width][signature]` of
 * per-node px values) each node's line-height is pinned first, so geometry is compared with the
 * line-height shift taken out; that shift is what `valueshifts` accounts for.
 */
export async function measure(html: string, lineHeights?: Overrides): Promise<Measured> {
  const server = await chromium.launchServer({
    channel: 'chrome',
    chromiumSandbox: !process.env['CI'],
  })
  const browser = await chromium.connect(server.wsEndpoint())
  try {
    const out: Measured = []
    for (const [wi, width] of WIDTHS.entries()) {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      const page = await context.newPage()
      await page.setContent(html, { waitUntil: 'load' })
      const result = await page.evaluate(
        async ({ pins }) => {
          await document.fonts.load("400 15px 'BenchFont'")
          await document.fonts.load("700 21px 'BenchFont'")
          await document.fonts.ready
          // Serialised into the page: it cannot reach a module-level helper.
          const round = (n: number) => Math.round(n * 100) / 100
          const sections = [...document.querySelectorAll<HTMLElement>('section[data-sig]')]
          if (pins) {
            sections.forEach((s, si) =>
              [...s.querySelectorAll<HTMLElement>('*:not(style)')].forEach((el, ni) => {
                const v = pins[si]?.[ni]
                if (v !== undefined && v >= 0)
                  el.style.setProperty('line-height', `${v}px`, 'important')
              }),
            )
          }
          return sections.map((s) => {
            const origin = s.getBoundingClientRect()
            return [...s.querySelectorAll<HTMLElement>('*:not(style)')].flatMap((el) => {
              const r = el.getBoundingClientRect()
              const cs = getComputedStyle(el)
              const lh = Number.parseFloat(cs.lineHeight)
              return [
                round(r.left - origin.left),
                round(r.top - origin.top),
                round(r.width),
                round(r.height),
                round(Number.parseFloat(cs.fontSize)),
                Number.isNaN(lh) ? -1 : round(lh),
                round(Number.parseFloat(cs.borderTopLeftRadius) || 0),
              ]
            })
          })
        },
        { pins: lineHeights?.[wi] ?? null },
      )
      out.push(result)
      await context.close()
    }
    return out
  } finally {
    server.kill()
  }
}

/** Per-node line-heights (px, -1 when `normal`) of a measurement, the pins for a second pass. */
export function lineHeightsOf(m: Measured): number[][][] {
  return m.map((bySig) => bySig.map((flat) => decode(flat).map((n) => n.lh)))
}
