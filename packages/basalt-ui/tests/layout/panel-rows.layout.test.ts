/**
 * Expression cycle 10 (`v3-expr-10-kit-fixes` 6): a `DataPanel` body sized by rows shows whole
 * rows (no row is cut through its text by the box), and a phone card keeps the values it has a
 * place for: the title, the subtitle and six meta values, with the rest in the row's detail.
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
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'panel-rows-'))
  const cssOut = join(scratch, 'panel-rows.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'panel-rows.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`lists-focus: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'panel-rows-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`lists-focus: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs.find((o) => o.kind === 'entry-point')!.text()
  const moduleCss = (
    await Promise.all(build.outputs.filter((o) => o.path.endsWith('.css')).map((o) => o.text()))
  ).join('\n')
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>lists-focus</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style><style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="pr-panel"] tbody tr')
  await page.settle()
  return page
}

type Geometry = { box: { top: number; bottom: number }; rows: { top: number; bottom: number }[] }

const geometry = (page: LayoutPage): Promise<Geometry> =>
  page.raw.evaluate(() => {
    const box = document.querySelector('[data-testid="pr-panel"] [data-slot="data-panel-rows"]')!
    const b = box.getBoundingClientRect()
    return {
      box: { top: b.top, bottom: b.bottom },
      rows: [...box.querySelectorAll('tbody [data-slot="table-row"]')].map((row) => {
        const r = row.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom }
      }),
    }
  })

/** No row crosses the box's bottom edge: each is inside it or wholly below it. */
const cut = (g: Geometry): number =>
  g.rows.filter((r) => r.top < g.box.bottom - 0.5 && r.bottom > g.box.bottom + 0.5).length

const DESKTOP: Viewport = { name: 'desktop', width: 1280, height: 1600 }

layout('a DataPanel sized by rows shows whole rows', () => {
  for (const viewport of [DESKTOP, PHONE]) {
    test(`no row is cut by the body at ${viewport.name} ${viewport.width}`, async () => {
      const page = await open(viewport)
      const g = await geometry(page)
      const shown = g.rows.filter((r) => r.bottom <= g.box.bottom + 0.5)
      expect(shown.length).toBeGreaterThan(0)
      expect(cut(g)).toBe(0)
      // The box ends where the last whole row does.
      expect(g.box.bottom - Math.max(...shown.map((r) => r.bottom))).toBeLessThan(1)
    })
  }

  test('a phone row keeps a title and two meta values and leaves the rest to its detail', async () => {
    const page = await open(PHONE)
    const cells = await page.raw.evaluate(() => {
      const row = document.querySelector('[data-testid="pr-panel"] tbody tr')!
      return [...row.querySelectorAll('[data-slot="table-cell"]')].map(
        (cell) => getComputedStyle(cell).display !== 'none',
      )
    })
    expect(cells.length).toBe(9)
    expect(cells.filter(Boolean).length).toBe(3)
  })

  test('the desktop table still draws every column', async () => {
    const page = await open(DESKTOP)
    const cells = await page.raw.evaluate(() => {
      const row = document.querySelector('[data-testid="pr-panel"] tbody tr')!
      return [...row.querySelectorAll('[data-slot="table-cell"]')].map(
        (cell) => getComputedStyle(cell).display !== 'none',
      )
    })
    expect(cells.every(Boolean)).toBe(true)
  })
})
