/**
 * Expression cycle 10 (`v3-expr-10-kit-fixes` 10): at 390 the pointer crossing from one phone card
 * to the next never clears the shared focus on the way, for a `DataTable` and a `BarList`.
 * Reuses the `lists-focus` fixture.
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
  scratch = mkdtempSync(join(tmpdir(), 'lists-focus-gap-'))
  const cssOut = join(scratch, 'lists-focus-gap.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'lists-focus-gap.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`lists-focus: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'lists-focus-gap-fixture.tsx')],
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
  await page.raw.waitForSelector('[data-testid="lg-table"] tbody tr')
  await page.settle()
  return page
}

const TABLE_ROWS = '[data-testid="lg-table"] tbody tr'
const LIST_ROWS = '[data-testid="lg-list"] [data-slot="row-list-row"]'

const index = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate(
    () => (document.querySelector('[data-testid="lg-root"]') as HTMLElement).dataset['focusIndex']!,
  )

/** The vertical extent of the nth element, scrolled into view. */
const extent = (page: LayoutPage, selector: string, n: number) =>
  page.raw.evaluate(
    ([sel, i]) => {
      const el = document.querySelectorAll(sel as string)[i as number]!
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom }
    },
    [selector, n],
  )

/** The focus index at every pixel from the middle of row 0 to the middle of the last row. */
const sweep = async (page: LayoutPage, selector: string, rows: number): Promise<string[]> => {
  const first = await extent(page, selector, 0)
  const last = await extent(page, selector, rows - 1)
  const from = (first.top + first.bottom) / 2
  const to = (last.top + last.bottom) / 2
  await page.raw.mouse.move(first.x, from)
  await page.settle()
  const seen: string[] = []
  for (let y = from; y <= to; y += 1) {
    await page.raw.mouse.move(first.x, y)
    seen.push(await index(page))
  }
  return seen
}

layout('a phone card list holds its focus across the gap between cards', () => {
  test('the table cards keep a focus on every pixel across all cards', async () => {
    const page = await open(PHONE)
    expect(await page.computed(TABLE_ROWS, 'display')).toBe('grid')
    const seen = await sweep(page, TABLE_ROWS, 4)
    expect(seen).not.toContain('')
  })

  test('the list rows keep a focus on every pixel across all rows', async () => {
    const page = await open(PHONE)
    const seen = await sweep(page, LIST_ROWS, 8)
    expect(seen).not.toContain('')
  })
})
