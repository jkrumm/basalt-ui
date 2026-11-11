/**
 * v3 charts, kinds (docs/v3/concepts/charts-cards-kanban.md section 9): `Lines`, `Bars`,
 * `CartesianChart` and `selection` in real Chrome at 1440, 768, 390 and 320. Asserted here because
 * happy-dom has no geometry: nothing pushes the page sideways, axe finds nothing serious or critical
 * in either colour scheme, every plot has a real box, the opt-in table is out of sight but in the
 * tree, and a click or Enter on a point selects it.
 *
 * The page is self-contained: `fixture/charts-kinds.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/charts-kinds-fixture.tsx` is bundled in memory (its CSS modules included),
 * both inlined into a document served beside the shared fixture, so no shared fixture file changes.
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
  scratch = mkdtempSync(join(tmpdir(), 'charts-kinds-'))
  const cssOut = join(scratch, 'charts-kinds.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'charts-kinds.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`charts-kinds: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'charts-kinds-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`charts-kinds: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  // The chart CSS modules come out as a sibling artifact: inline it beside the Tailwind sheet.
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>charts-kinds</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce')
  await page.raw.waitForSelector('[data-testid="ck-select"] svg')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

const IDS = ['ck-lines', 'ck-bars', 'ck-mixed', 'ck-select'] as const
type AxeResult = { violations: { id: string; impact: string; nodes: { html: string }[] }[] }

layout('Lines, Bars and CartesianChart', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('nothing pushes the page sideways', async () => {
        const page = await open(viewport)
        const { scrollWidth, innerWidth } = await page.raw.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }))
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
      })

      test('every plot has a real box inside its section', async () => {
        const page = await open(viewport)
        const boxes = await page.raw.evaluate(
          (ids) => {
            return ids.map((id) => {
              const section = document
                .querySelector(`[data-testid="${id}"]`)!
                .getBoundingClientRect()
              const svg = document
                .querySelector(`[data-testid="${id}"] svg`)!
                .getBoundingClientRect()
              return { id, w: svg.width, h: svg.height, within: svg.right <= section.right + 0.5 }
            })
          },
          [...IDS],
        )
        for (const box of boxes) {
          expect(box.w, `${box.id} width`).toBeGreaterThan(100)
          expect(box.h, `${box.id} height`).toBeGreaterThan(100)
          expect(box.within, `${box.id} stays inside`).toBe(true)
        }
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

  describe('table and selection, desktop', () => {
    test('the opt-in table is in the tree, out of sight, with one row per day', async () => {
      const page = await open(DESKTOP_1440)
      const table = await page.raw.evaluate(() => {
        const el = document.querySelector('[data-testid="ck-lines"] table')!
        const r = el.closest('[data-basalt-chart-table-box]')!.getBoundingClientRect()
        return { rows: el.querySelectorAll('tbody tr').length, w: r.width, h: r.height }
      })
      expect(table.rows).toBe(30)
      expect(table.w).toBeLessThanOrEqual(1)
      expect(table.h).toBeLessThanOrEqual(1)
    })

    const log = (page: LayoutPage): Promise<string> =>
      page.raw.evaluate(() => document.querySelector('[data-testid="ck-log"]')!.textContent ?? '')

    test('a click on a point selects its datum', async () => {
      const page = await open(DESKTOP_1440)
      // The page is taller than the viewport: bring the chart into view before pointing at it.
      const at = await page.raw.evaluate(() => {
        const svg = document.querySelector('[data-testid="ck-select"] svg')!
        svg.scrollIntoView({ block: 'center' })
        const r = svg.getBoundingClientRect()
        return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5, w: r.width }
      })
      await page.raw.mouse.move(at.x - 20, at.y)
      await page.raw.mouse.move(at.x, at.y)
      await page.settle()
      await page.raw.mouse.click(at.x, at.y)
      await page.settle()
      expect(await log(page)).not.toBe('picked:none')
    })

    test('Enter on the focused point selects it', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus('[data-testid="ck-select"] svg')
      await page.raw.keyboard.press('ArrowRight')
      await page.raw.keyboard.press('Enter')
      await page.settle()
      expect(await log(page)).not.toBe('picked:none')
    })
  })
})
