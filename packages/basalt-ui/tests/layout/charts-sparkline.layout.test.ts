/**
 * charts-3 (docs/v3/concepts/charts-cards-kanban.md section 9): the hand-SVG `Sparkline` and
 * `MiniBars` in real Chrome at 1440, 768, 390 and 320. Asserted here because happy-dom has no
 * geometry: in a `StatCard` chart box of 72 the plot is 56 and the label row 16, a bare sparkline has
 * no tab stop while a labelled one is a single stop that answers arrow keys, Home and End, the bars
 * hold the 24 px cap and the 3 px gap, nothing pushes the page sideways, and axe finds nothing serious
 * or critical in either colour scheme.
 *
 * Self-contained like `ui-range`: `fixture/charts-sparkline.css` is compiled with the Tailwind CLI
 * into a temp directory and `fixture/charts-sparkline-fixture.tsx` is bundled in memory.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  PHONE_SMALL,
  TABLET_768,
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
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'charts-sparkline-'))
  const cssOut = join(scratch, 'charts-sparkline.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-sparkline.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-sparkline: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-sparkline-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-sparkline: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-sparkline</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="sparkline"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

const IN = (id: string, selector: string): string => `[data-testid="${id}"] ${selector}`

type Box = { w: number; h: number }
const sizeOf = (page: LayoutPage, selector: string): Promise<Box> =>
  page.raw.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }, selector)

type AxeResult = { violations: { id: string; impact: string; nodes: { html: string }[] }[] }

layout('Sparkline and MiniBars', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('in the 72 px chart box the plot is 56 and the label row 16', async () => {
        const page = await open(viewport)
        for (const id of ['cs-line', 'cs-area', 'cs-bars']) {
          const plot = await sizeOf(page, IN(id, '[data-slot="spark-plot"]'))
          const labels = await sizeOf(page, IN(id, '[data-slot="spark-labels"]'))
          expect(plot.h, `${id} plot`).toBeCloseTo(56, 0)
          expect(labels.h, `${id} labels`).toBeCloseTo(16, 0)
        }
      })

      test('the now dot sits inside the sparkline box', async () => {
        const page = await open(viewport)
        const inside = await page.raw.evaluate(() => {
          const plot = document
            .querySelector('[data-testid="cs-line"] [data-slot="sparkline"]')!
            .getBoundingClientRect()
          const dot = document
            .querySelector('[data-testid="cs-line"] [data-slot="spark-now"]')!
            .getBoundingClientRect()
          return (
            dot.left >= plot.left - 0.5 &&
            dot.right <= plot.right + 0.5 &&
            dot.top >= plot.top - 0.5 &&
            dot.bottom <= plot.bottom + 0.5
          )
        })
        expect(inside).toBe(true)
      })

      test('nothing pushes the page sideways', async () => {
        const page = await open(viewport)
        const over = await page.raw.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        )
        expect(over).toBeLessThanOrEqual(0.5)
      })

      test('bars hold the 24 px cap and the 3 px gap', async () => {
        const page = await open(viewport)
        const geometry = await page.raw.evaluate(() => {
          const cols = [...document.querySelectorAll('[data-testid="cs-wide"] [data-index]')].map(
            (c) => c.getBoundingClientRect(),
          )
          return {
            widths: cols.map((c) => c.width),
            gaps: cols.slice(1).map((c, i) => c.left - cols[i]!.right),
          }
        })
        for (const w of geometry.widths) expect(w).toBeLessThanOrEqual(24.5)
        for (const g of geometry.gaps) expect(g).toBeCloseTo(3, 0)
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}`, async () => {
          const page = await open(viewport, scheme)
          await page.raw.addScriptTag({ content: axeSource })
          const violations = await page.raw.evaluate(async () => {
            const axe = (window as unknown as { axe: { run: () => Promise<AxeResult> } }).axe
            const result = await axe.run()
            return result.violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
          })
          expect(violations).toEqual([])
        })
      }
    })
  }

  describe('keyboard and pointer, desktop', () => {
    const slider = IN('cs-line', '[role="slider"]')
    const middle = (page: LayoutPage): Promise<string> =>
      page.raw.evaluate(
        () =>
          document.querySelector('[data-testid="cs-line"] [data-slot="spark-labels"]')!.children[1]!
            .textContent ?? '',
      )

    test('a bare sparkline is an image with a name and no tab stop', async () => {
      const page = await open(DESKTOP_1440)
      const probe = await page.raw.evaluate(() => {
        const el = document.querySelector('[data-testid="cs-image"] [data-slot="sparkline"]')!
        return {
          role: el.getAttribute('role'),
          name: el.getAttribute('aria-label'),
          tabindex: el.getAttribute('tabindex'),
        }
      })
      expect(probe).toEqual({ role: 'img', name: 'Latency, last 14 days', tabindex: '-1' })
      const stops = await page.raw.evaluate(
        () => document.querySelectorAll('[data-testid="cs-image"] [tabindex="0"]').length,
      )
      expect(stops).toBe(0)
    })

    test('Tab lands on a labelled sparkline once; End, Home and the arrows move the readout', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus(slider)
      expect(await middle(page)).toBe('47')
      await page.raw.keyboard.press('Home')
      expect(await middle(page)).toBe('12')
      await page.raw.keyboard.press('ArrowRight')
      expect(await middle(page)).toBe('18')
      await page.raw.keyboard.press('End')
      expect(await middle(page)).toBe('47')
      await page.raw.keyboard.press('Tab')
      expect(await middle(page)).toBe('Today')
    })

    test('the focus ring paints', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.keyboard.press('Tab')
      await page.raw.focus(slider)
      await page.raw.keyboard.press('Shift+Tab')
      await page.raw.keyboard.press('Tab')
      const outline = await page.raw.evaluate(
        (sel) => getComputedStyle(document.querySelector(sel)!).outlineStyle,
        IN('cs-line', '[data-slot="sparkline"]'),
      )
      expect(outline).not.toBe('none')
    })

    test('hovering the plot moves the readout to the point under the pointer', async () => {
      const page = await open(DESKTOP_1440)
      const at = await page.raw.evaluate(() => {
        const r = document
          .querySelector('[data-testid="cs-line"] [data-slot="spark-plot"]')!
          .getBoundingClientRect()
        return { x: r.left + 1, y: r.top + r.height / 2 }
      })
      await page.raw.mouse.move(at.x, at.y)
      await page.settle()
      expect(await middle(page)).toBe('12')
      await page.raw.mouse.move(2, 2)
      await page.settle()
      expect(await middle(page)).toBe('Today')
    })
  })
})
