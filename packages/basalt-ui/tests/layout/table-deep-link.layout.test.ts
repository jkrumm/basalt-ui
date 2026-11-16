/**
 * A deep-linked row detail keeps its id and marks its row (docs/v3/issues/cycles/
 * v3-dogfood-2-deep-link.json). The table's `detailState` field names a row on load; the detail
 * shows in the page's `PageAside`, which mounts after the table's first render. The field stays
 * set and the row carries `aria-current` while the detail shows, with and without the aside's
 * `state` bound to the same field, and closing the detail clears the field and unmarks the row.
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

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const MODES = ['unbound', 'bound'] as const
const documents: Record<(typeof MODES)[number], string> = { unbound: '', bound: '' }
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-deep-link-'))
  const cssOut = join(scratch, 'table-deep-link.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-deep-link.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-deep-link: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-deep-link-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-deep-link: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )
  for (const mode of MODES)
    documents[mode] = serveDocument(
      `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
        `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
        `<title>table-deep-link ${mode}</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
        `<style>${tiers}</style></head><body><div id="root"></div>` +
        `<script>window.asideState = '${mode}'</script>` +
        `<script type="module">${inlineScript(js)}</script></body></html>`,
    )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(mode: (typeof MODES)[number]): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, DESKTOP_1440, documents[mode], 'reduce', 'fine')
  await page.raw.waitForSelector('tbody tr')
  await page.settle()
  // The 500 ms of the cycle's probe, and then some: a late clear would have landed.
  await page.raw.waitForTimeout(600)
  return page
}

const seen = (page: LayoutPage): Promise<{ field: string; marked: string[]; body: string }> =>
  page.raw.evaluate(() => ({
    field: document.querySelector('[data-testid="field-value"]')?.textContent ?? '',
    marked: [...document.querySelectorAll('tbody tr[aria-current="true"]')].map(
      (tr) => tr.textContent ?? '',
    ),
    body:
      document.querySelector('[data-slot="page-aside"] [data-testid="detail-body"]')?.textContent ??
      '',
  }))

for (const mode of MODES)
  layout(`A deep-linked row detail, aside state ${mode}`, () => {
    test('keeps its id in the field and marks its row while the aside shows it', async () => {
      const page = await open(mode)
      const now = await seen(page)
      expect(now.field).toBe('slow-export')
      expect(now.body).toBe('Slow export detail')
      expect(now.marked).toEqual(['Slow export'])
    })

    test('closing it clears the field and unmarks the row', async () => {
      const page = await open(mode)
      await page.raw.click('[data-aside-close]')
      await page.settle()
      const now = await seen(page)
      expect(now.field).toBe('')
      expect(now.marked).toEqual([])
    })
  })
