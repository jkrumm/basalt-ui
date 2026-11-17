/**
 * Bar value labels (`Series.values`, `Series.highlight`) in real Chrome at 1800 and 390: ten long
 * category names, one highlighted bar. No two labels overlap and each lies inside the plot; the
 * highlighted bar keeps its label at 390 and all ten are drawn at 1800.
 *
 * The page is self-contained like `charts-expr7-contract.layout.test.ts`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const VIEWPORTS: Viewport[] = [WIDE, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-bar-values-'))
  const cssOut = join(scratch, 'charts-bar-values.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-bar-values.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-bar-values: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-bar-values-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-bar-values: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-bar-values</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-ts-key^="bar-values-"]')
  await page.settle()
  return page
}

type Box = { left: number; top: number; right: number; bottom: number }
type Drawn = { labels: { text: string; box: Box }[]; plot: Box }

/** Every value label's box and the plot's, in page px. */
const drawn = (page: LayoutPage): Promise<Drawn> =>
  page.raw.evaluate(() => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="bars"] svg.ts-chart')!
    const frame = svg.getBoundingClientRect()
    const view = svg.viewBox.baseVal
    const scale = view.width > 0 ? frame.width / view.width : 1
    const clip = svg.querySelector('clipPath rect')!
    const at = (name: string): number => Number(clip.getAttribute(name))
    const box = (r: DOMRect): Box => ({
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
    })
    return {
      plot: {
        left: frame.left + at('x') * scale,
        top: frame.top + at('y') * scale,
        right: frame.left + (at('x') + at('width')) * scale,
        bottom: frame.top + (at('y') + at('height')) * scale,
      },
      labels: [...svg.querySelectorAll<SVGTextElement>('[data-ts-key^="bar-values-"] text')].map(
        (el) => ({ text: el.textContent ?? '', box: box(el.getBoundingClientRect()) }),
      ),
    }
  })

const meets = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

layout('bar value labels', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name}`, () => {
      test('no two labels overlap and each lies inside the plot', async () => {
        const page = await open(viewport)
        const { labels, plot } = await drawn(page)
        expect(labels.length).toBeGreaterThan(0)
        for (const [i, a] of labels.entries()) {
          expect(a.box.left, a.text).toBeGreaterThanOrEqual(plot.left - 0.5)
          expect(a.box.right, a.text).toBeLessThanOrEqual(plot.right + 0.5)
          expect(a.box.top, a.text).toBeGreaterThanOrEqual(plot.top - 0.5)
          expect(a.box.bottom, a.text).toBeLessThanOrEqual(plot.bottom + 0.5)
          for (const b of labels.slice(i + 1)) expect(meets(a.box, b.box), a.text).toBe(false)
        }
      })
    })
  }

  test('the highlighted bar keeps its label at 390', async () => {
    const page = await open(PHONE)
    const { labels } = await drawn(page)
    expect(labels.map((l) => l.text)).toContain('760 ms')
  })

  test('all ten labels are drawn at 1800', async () => {
    const page = await open(WIDE)
    const { labels } = await drawn(page)
    expect(labels).toHaveLength(10)
  })
})
