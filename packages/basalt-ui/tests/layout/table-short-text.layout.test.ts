/**
 * Short `text` columns give their width to the entity column (docs/v3/issues/cycles/v3-dogfood-3-visual.json,
 * dogfood-3.3): at 1800 no short text column is wider than its widest value plus padding, and the
 * Title keeps its sub line whole.
 *
 * Self-contained like `table-age`: the fixture CSS is compiled with the Tailwind CLI into a temp
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
const ROOT = '[data-testid="ts-main"] [data-slot="table-root"]'

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-short-text-'))
  const cssOut = join(scratch, 'table-short-text.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-short-text.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-short-text: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-short-text-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-short-text: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-short-text</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
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

layout('short text column width', () => {
  test('a short text column fits its widest value and the sub line is whole at 1800', async () => {
    const page = await open(DESKTOP_1800)
    const probe = await page.raw.evaluate((sel) => {
      const root = document.querySelector<HTMLElement>(sel)!
      const heads = [...root.querySelectorAll<HTMLElement>('thead th')]
      const rows = [...root.querySelectorAll('tbody tr')]
      const columns = heads.map((th, index) => {
        const cells = rows.map((tr) => tr.children[index] as HTMLElement)
        const widest = Math.max(
          ...cells.map((td) => {
            const range = document.createRange()
            range.selectNodeContents(td)
            return range.getBoundingClientRect().width
          }),
        )
        const pad = parseFloat(getComputedStyle(cells[0]!).paddingInline) * 2
        return {
          header: th.textContent?.trim() ?? '',
          width: th.getBoundingClientRect().width,
          widest,
          pad,
          cut: cells.flatMap((td) =>
            [td, ...td.querySelectorAll<HTMLElement>('*')]
              .filter((el) => el.scrollWidth > el.clientWidth + 1)
              .map((el) => el.textContent ?? ''),
          ),
        }
      })
      return columns
    }, ROOT)
    const by = (header: string) => probe.find((p) => p.header.startsWith(header))!
    for (const header of ['Issue', 'Project', 'Origin']) {
      const column = by(header)
      // The column is its widest value (or its header) plus padding, with a little slack for the
      // sort mark and menu; never the 250 px share a flexible column took.
      expect(column.width).toBeLessThanOrEqual(Math.max(column.widest, 120) + column.pad + 40)
    }
    expect(by('Title').cut).toEqual([])
  })
})
