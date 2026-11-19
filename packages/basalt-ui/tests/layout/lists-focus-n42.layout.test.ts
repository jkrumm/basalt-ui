/**
 * Expression cycle 10 gap, n42 shape (`v3-expr-11-kit-fixes` 10b): at 390 the pointer crossing from one
 * row of a `DataPanel` table to the next, with the body's fixed height clipping the rows below, must
 * keep the shared focus. The fixture is `lists-focus-n42`: a `DataTable` whose rows hold one item each
 * (`focusItems`), once as phone cards and once in the `phone: 'scroll'` arm n42 pins.
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
  scratch = mkdtempSync(join(tmpdir(), 'lists-focus-n42-'))
  const cssOut = join(scratch, 'lists-focus-n42.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'lists-focus-n42.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`lists-focus-n42: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'lists-focus-n42-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`lists-focus-n42: the fixture did not build:\n${build.logs.join('\n')}`)
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
      `<title>lists-focus-n42</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style><style>${moduleCss}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, PHONE, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="n42-cards"] tbody tr')
  await page.settle()
  return page
}

type Arm = 'n42-cards' | 'n42-scroll'

/**
 * Per arm: the row selector, the item index the first and second rows hold, the row whose bottom
 * the gap lies under (the cards' rows past the body's fixed height are clipped, so their gap is under
 * row 1; the scroll arm's rows are all visible, so its gap is under row 3), and the index the pointer
 * holds once it crosses down to the point under that row.
 */
const ARMS = {
  'n42-cards': { rows: 'tbody tr', first: '4', second: '9', from: 1, gap: '9' },
  'n42-scroll': { rows: 'tbody tr', first: '4', second: '9', from: 1, gap: '20' },
} as const satisfies Record<
  Arm,
  { rows: string; first: string; second: string; from: number; gap: string }
>

type Geometry = {
  rows: { top: number; bottom: number; centre: number; middle: number }[]
  card: { top: number; bottom: number }
  /** A point under the `from` row inside the card and outside the list, or null when there is none. */
  beyond: number | null
}

/** The rows, the card they sit in and the first point under the gap row that the list does not cover. */
const geometry = (page: LayoutPage, arm: Arm): Promise<Geometry> =>
  page.raw.evaluate(
    ([id, rowSel, from]) => {
      const root = document.querySelector(`[data-testid="${id}"]`) as HTMLElement
      root.scrollIntoView({ block: 'start' })
      const card = root.querySelector('[data-slot="card"]')!.getBoundingClientRect()
      const rowEls = [...root.querySelectorAll(rowSel as string)]
      const list = rowEls[0]!.parentElement!
      const rows = rowEls.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          top: r.top,
          bottom: r.bottom,
          centre: (r.left + r.right) / 2,
          middle: (r.top + r.bottom) / 2,
        }
      })
      const gapRow = rows[from as number]!
      let beyond: number | null = null
      for (let y = Math.ceil(gapRow.bottom); y < card.bottom; y++) {
        const hit = document.elementFromPoint(rows[0]!.centre, y)
        if (hit !== null && !list.contains(hit)) {
          beyond = y
          break
        }
      }
      return { rows, card: { top: card.top, bottom: card.bottom }, beyond }
    },
    [arm, ARMS[arm].rows, ARMS[arm].from],
  )

/** The focus state of one arm: its index, and how many of its rows are dimmed. */
const state = (page: LayoutPage, arm: Arm): Promise<{ index: string; dimmed: number }> =>
  page.raw.evaluate(
    ([id, rowSel]) => ({
      index: (document.querySelector(`[data-testid="${id}"]`) as HTMLElement).dataset[
        'focusIndex'
      ]!,
      dimmed: document.querySelectorAll(`[data-testid="${id}"] ${rowSel}[data-dimmed]`).length,
    }),
    [arm, ARMS[arm].rows],
  )

layout('a phone card list holds its shared focus across the gap below a row', () => {
  for (const arm of Object.keys(ARMS) as Arm[]) {
    const spec = ARMS[arm]
    test(`${arm}: the focus holds from row 1 into the gap below the list, and clears outside the card`, async () => {
      const page = await open()
      const g = await geometry(page, arm)
      expect(g.beyond).not.toBeNull()
      const x = g.rows[0]!.centre

      await page.raw.mouse.move(x, g.rows[0]!.middle, { steps: 3 })
      await page.settle()
      expect(await state(page, arm)).toEqual({ index: spec.first, dimmed: 3 })

      await page.raw.mouse.move(x, g.rows[1]!.middle, { steps: 10 })
      await page.settle()
      expect((await state(page, arm)).index).toBe(spec.second)

      await page.raw.mouse.move(x, g.beyond!, { steps: 6 })
      const at60 = await state(page, arm)
      await page.raw.waitForTimeout(340)
      const at400 = await state(page, arm)
      expect(at60).toEqual({ index: spec.gap, dimmed: 3 })
      expect(at400).toEqual({ index: spec.gap, dimmed: 3 })

      await page.raw.mouse.move(4, g.card.top + 40, { steps: 6 })
      await page.settle()
      expect(await state(page, arm)).toEqual({ index: '', dimmed: 0 })
    })
  }
})
