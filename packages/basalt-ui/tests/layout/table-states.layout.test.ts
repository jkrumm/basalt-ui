/**
 * Expression cycle 9 table states and phone cards (docs/v3/cycles/expression-9.md rows .7, .8, .37):
 * an empty or failed table keeps its header row at the table's full width with whole headers, a
 * phone card names every value whose column has a header (a headerless one by its id), and a card
 * list clipped by `maxRows` says how many cards it shows.
 *
 * Self-contained like `table-short-text`: the fixture CSS is compiled with the Tailwind CLI into a
 * temp directory, the tier sheet `src/table/table.css` is inlined beside it, and the fixture bundles
 * in memory.
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

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-states-'))
  const cssOut = join(scratch, 'table-states.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-states.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0)
    throw new Error(`table-states: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-states-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-states: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-states</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, testid: string): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(`[data-testid="${testid}"] [data-slot="table-root"]`)
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

layout('table states and phone cards', () => {
  for (const kind of ['empty', 'error'] as const) {
    test(`${kind}: the header row spans the table and no header is cut at 1800`, async () => {
      const page = await open(DESKTOP_1800, `ts-${kind}`)
      const probe = await page.raw.evaluate((testid) => {
        const root = document.querySelector<HTMLElement>(`[data-testid="${testid}"]`)!
        const table = root.querySelector<HTMLElement>('[data-slot="table"]')!
        const heads = [...root.querySelectorAll<HTMLElement>('thead th')]
        const last = heads[heads.length - 1]!.getBoundingClientRect()
        return {
          width: table.getBoundingClientRect().width,
          right: last.right - table.getBoundingClientRect().left,
          cut: heads.map((th) => {
            const label = th.querySelector<HTMLElement>('.truncate, span')!
            return label.scrollWidth - label.clientWidth
          }),
        }
      }, `ts-${kind}`)
      expect(probe.width).toBeGreaterThan(1000)
      expect(Math.abs(probe.right - probe.width)).toBeLessThanOrEqual(2)
      for (const cut of probe.cut) expect(cut).toBeLessThanOrEqual(0)
    })
  }

  test('390: every headed value of a card has its label, a headerless one its column id', async () => {
    const page = await open(PHONE, 'ts-cards')
    const labels = await page.raw.evaluate(() =>
      [
        ...document.querySelectorAll(
          '[data-testid="ts-cards"] tbody tr:first-child [data-slot="table-cell"]',
        ),
      ]
        .filter((cell) => getComputedStyle(cell).display !== 'none')
        .map((cell) => {
          const before = getComputedStyle(cell, '::before').content
          return before === 'none' || before === 'normal' ? '' : before.replaceAll('"', '')
        }),
    )
    expect(labels).toEqual(['', 'Total: ', 'state: ', 'owner: ', 'Last seen: '])
  })

  test('390: a card list clipped by maxRows shows its cue inside the scrollport', async () => {
    const page = await open(PHONE, 'ts-clipped')
    const probe = await page.raw.evaluate(() => {
      const root = document.querySelector('[data-testid="ts-clipped"]')!
      const scroller = root.querySelector<HTMLElement>('[data-slot="table-scroller"]')!
      const cue = root.querySelector<HTMLElement>('[data-slot="table-rows-shown"]')
      const box = scroller.getBoundingClientRect()
      const at = cue?.getBoundingClientRect()
      return {
        text: cue?.textContent ?? '',
        shown: cue !== null && getComputedStyle(cue).display !== 'none',
        clipped: scroller.scrollHeight > scroller.clientHeight,
        inside: at !== undefined && at.bottom <= box.bottom + 1 && at.top >= box.top,
      }
    })
    expect(probe.text).toBe('2 of 20 shown')
    expect(probe.shown).toBe(true)
    expect(probe.clipped).toBe(true)
    expect(probe.inside).toBe(true)
  })

  test('1800: the cue of a clipped list is not drawn in the table tier', async () => {
    const page = await open(DESKTOP_1800, 'ts-clipped')
    const display = await page.raw.evaluate(
      () =>
        getComputedStyle(
          document.querySelector('[data-testid="ts-clipped"] [data-slot="table-rows-shown"]')!,
        ).display,
    )
    expect(display).toBe('none')
  })
})
