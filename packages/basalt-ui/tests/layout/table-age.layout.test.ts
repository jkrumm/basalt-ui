/**
 * A `relativeTime` column shows its whole phrase (docs/v3/issues/cycles/v3-dogfood-2-visual.json,
 * dogfood-2.3): at 1800 and 1440 no Age cell is cut, whatever the phrase (`30 minutes ago`,
 * `11 months ago`).
 *
 * Self-contained like `table-group`: the fixture CSS is compiled with the Tailwind CLI into a temp
 * directory, the tier sheet `src/table/table.css` is inlined beside it, and the fixture bundles in
 * memory.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
  serveDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const DESKTOP_1800: Viewport = { name: 'wide', width: 1800, height: 1200 }
const ROOT = '[data-testid="ta-main"] [data-slot="table-root"]'

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-age-'))
  const cssOut = join(scratch, 'table-age.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-age.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`table-age: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-age-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-age: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-age</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`${ROOT} tbody tr`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

layout('relativeTime column width', () => {
  for (const viewport of [DESKTOP_1800, DESKTOP_1440]) {
    test(`no Age cell is cut at ${viewport.width}`, async () => {
      const page = await open(viewport)
      const cut = await page.raw.evaluate((sel) => {
        const root = document.querySelector<HTMLElement>(sel)!
        const heads = [...root.querySelectorAll('thead th')]
        const index = heads.findIndex((th) => th.textContent?.trim() === 'Age')
        const cells = [...root.querySelectorAll('tbody tr')].map(
          (tr) => tr.children[index] as HTMLElement,
        )
        return {
          index,
          cells: cells.length,
          cut: cells.flatMap((td) =>
            [td, ...td.querySelectorAll<HTMLElement>('*')]
              .filter((el) => el.scrollWidth > el.clientWidth + 1)
              .map((el) => `${td.textContent}: ${el.scrollWidth} > ${el.clientWidth}`),
          ),
        }
      }, ROOT)
      expect(cut.index).toBeGreaterThanOrEqual(0)
      expect(cut.cells).toBe(6)
      expect(cut.cut).toEqual([])
    })
  }
})
