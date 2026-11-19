/**
 * Expression cycle 11 (`v3-expr-11-kit-fixes` 2): a chart's focus brings the joined table row into view
 * inside the table's own scroll region, and nothing else scrolls. Two lists: one row per item (`focus`),
 * and rows that each hold a run of items (`focusItems`), where the row must show for every item it holds.
 * Reuses the `lists-focus-reveal` fixture; the buttons call `focus.set`, the path a chart's pointer takes.
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
import type { LayoutPage } from './harness'

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
  scratch = mkdtempSync(join(tmpdir(), 'lists-focus-reveal-'))
  const cssOut = join(scratch, 'lists-focus-reveal.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'lists-focus-reveal.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`lists-focus-reveal: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'lists-focus-reveal-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`lists-focus-reveal: the fixture did not build:\n${build.logs.join('\n')}`)
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
      `<title>lists-focus-reveal</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style><style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP_1440, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="fr-runs"] tbody tr')
  await page.settle()
  return page
}

type Reading = {
  rowTop: number
  rowBottom: number
  regionTop: number
  regionBottom: number
  pageY: number
}

/** Where row `n` of the table in `part` sits against its scroll region, and the page's own offset. */
const reading = (page: LayoutPage, part: string, n: number): Promise<Reading> =>
  page.raw.evaluate(
    ([sel, i]) => {
      const row = document.querySelectorAll(`${sel} tbody tr`)[i as number] as HTMLElement
      const region = row.closest('[data-slot="table-scroller"]') as HTMLElement
      const r = row.getBoundingClientRect()
      const g = region.getBoundingClientRect()
      return {
        rowTop: r.top,
        rowBottom: r.bottom,
        regionTop: g.top,
        regionBottom: g.bottom,
        pageY: window.scrollY,
      }
    },
    [`[data-testid="${part}"]`, n],
  )

const visible = (r: Reading): boolean =>
  r.rowTop >= r.regionTop - 1 && r.rowBottom <= r.regionBottom + 1

layout('a chart focus scrolls the joined row into its own region', () => {
  test('a one-row-per-item table brings the focused row into view', async () => {
    const page = await open()
    expect(visible(await reading(page, 'fr-single', 11))).toBe(false)
    await page.raw.click('[data-testid="fr-a-11"]')
    await page.settle()
    expect(visible(await reading(page, 'fr-single', 11))).toBe(true)
  })

  test('a row holding a run brings the row into view for every item it holds', async () => {
    const page = await open()
    expect(visible(await reading(page, 'fr-runs', 5))).toBe(false)
    await page.raw.click('[data-testid="fr-b-11"]')
    await page.settle()
    expect(visible(await reading(page, 'fr-runs', 5))).toBe(true)
  })

  test('a chart mark on the same index as the row does not hold the row out of reveal', async () => {
    const page = await open()
    expect(visible(await reading(page, 'fr-single', 11))).toBe(false)
    await page.raw.click('[data-testid="fr-a-11"]')
    await page.settle()
    expect(visible(await reading(page, 'fr-single', 11))).toBe(true)
  })

  test('the page does not scroll for a row inside its region', async () => {
    const page = await open()
    const before = (await reading(page, 'fr-runs', 5)).pageY
    await page.raw.click('[data-testid="fr-b-11"]')
    await page.settle()
    expect((await reading(page, 'fr-runs', 5)).pageY).toBe(before)
  })
})
