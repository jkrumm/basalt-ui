/**
 * The bench table kinds in real Chrome (docs/v3/issues/bench/bench-table-kinds.json): at 1800 every
 * kind draws on one line, the tags fold to a `+N` instead of wrapping, a countdown follows the
 * table's clock and sorts by its date, and at 390 the same columns are phone cards.
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

const FIXTURE_DIR = import.meta.dirname
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const DESKTOP_1800: Viewport = { name: 'wide', width: 1800, height: 1200 }
const ROOT = '[data-testid="tk-main"] [data-slot="table-root"]'

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-kinds-'))
  const cssOut = join(scratch, 'table-kinds.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-kinds.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`table-kinds: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-kinds-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-kinds: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-kinds</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`${ROOT} tbody tr, ${ROOT} [data-slot="table-card"]`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

layout('table kinds at 1800', () => {
  test('every kind draws on one line and the typed icon follows the row', async () => {
    const page = await open(DESKTOP_1800)
    const seen = await page.raw.evaluate((sel) => {
      const root = document.querySelector<HTMLElement>(sel)!
      const rows = [...root.querySelectorAll('tbody tr')]
      const count = (slot: string): number => root.querySelectorAll(`[data-slot="${slot}"]`).length
      return {
        rows: rows.length,
        person: count('table-person'),
        people: count('table-people'),
        tags: count('table-tags'),
        countdown: count('table-countdown'),
        link: count('table-link'),
        quiet: count('table-quiet'),
        entityId: count('table-entity-id'),
        icons: rows.map((tr) => tr.querySelector('[data-glyph]')?.getAttribute('data-glyph')),
        // a cell that holds one line is no taller than its row's tallest chip or face
        tall: rows.flatMap((tr) =>
          [...tr.children]
            .filter((td) => td.getBoundingClientRect().height > 48)
            .map((td) => td.textContent),
        ),
      }
    }, ROOT)
    expect(seen.rows).toBe(3)
    expect([seen.person, seen.people, seen.tags, seen.countdown, seen.link, seen.quiet]).toEqual([
      3, 3, 3, 3, 3, 3,
    ])
    expect(seen.entityId).toBe(3)
    expect(seen.icons).toEqual(['call', 'note', 'note'])
    expect(seen.tall).toEqual([])
  })

  test('tags fold to +N, never wrap and never spill out of the cell', async () => {
    const page = await open(DESKTOP_1800)
    const tags = await page.raw.evaluate((sel) => {
      const root = document.querySelector<HTMLElement>(sel)!
      return [...root.querySelectorAll<HTMLElement>('[data-slot="table-tags"]')].map((box) => {
        const edge = box.getBoundingClientRect().right
        const chips = [...box.querySelectorAll<HTMLElement>('[data-slot="table-tag"]')]
        const shown = chips.filter((chip) => getComputedStyle(chip).visibility !== 'hidden')
        return {
          more: box.querySelector('[data-slot="table-tags-more"]')?.textContent ?? null,
          spill: shown.filter((chip) => chip.getBoundingClientRect().right > edge + 0.5).length,
          lines: new Set(chips.map((chip) => Math.round(chip.getBoundingClientRect().top))).size,
        }
      })
    }, ROOT)
    expect(tags[0]?.more).toMatch(/^\+\d+$/)
    expect(tags[1]?.more).toBeNull()
    expect(tags.filter((t) => t.spill !== 0 || t.lines !== 1)).toEqual([])
  })

  test('the countdown follows the clock and sorts by its date', async () => {
    const page = await open(DESKTOP_1800)
    const read = (): Promise<string[]> =>
      page.raw.evaluate(
        (sel) =>
          [...document.querySelectorAll(`${sel} [data-slot="table-countdown"]`)].map(
            (el) => el.textContent ?? '',
          ),
        ROOT,
      )
    expect(await read()).toEqual(['26 days late', 'in 4 days', 'Today'])
    await page.raw.evaluate(() =>
      (window as unknown as { basaltSetNow: (ms: number) => void }).basaltSetNow(
        Date.UTC(2026, 10, 18, 12),
      ),
    )
    await page.settle()
    expect(await read()).toEqual(['28 days late', 'in 2 days', '2 days late'])
    await page.raw.click(`${ROOT} thead th:has-text("Due") button`)
    await page.settle()
    expect(await read()).toEqual(['28 days late', '2 days late', 'in 2 days'])
  })
})

layout('table kinds at 390', () => {
  test('the same columns are phone cards and nothing scrolls sideways', async () => {
    const page = await open(PHONE)
    const m = await page.raw.evaluate((sel) => {
      const root = document.querySelector<HTMLElement>(sel)!
      const text = root.textContent ?? ''
      return {
        cards: root.querySelector('thead')!.getBoundingClientRect().height <= 1,
        text,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }
    }, ROOT)
    expect(m.cards).toBe(true)
    expect(m.overflow).toBe(false)
    expect(m.text).toContain('Renewal call')
    expect(m.text).toContain('Ada Lovelace')
    expect(m.text).toContain('26 days late')
  })
})
