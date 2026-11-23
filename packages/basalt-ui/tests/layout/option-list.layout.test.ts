/**
 * The list engine's windowed list in real Chrome: a Combobox over ten thousand options with the
 * `VirtualList` port mounts only the rows in view, opens at the selected row, and the arrow keys walk
 * past the window with the active row mounted and scrolled into view. A closed combobox beside it
 * filters its list from the first key typed. Row heights are measured from probe rows, so a row with
 * a description and one without both sit where the window puts them.
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
  scratch = mkdtempSync(join(tmpdir(), 'option-list-'))
  const cssOut = join(scratch, 'option-list.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'option-list.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`option-list: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'option-list-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`option-list: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>option-list</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="combobox-content"] [data-slot="option-row"]')
  await page.settle()
  return page
}

type Window = { rows: number; scroller: number; inView: boolean; active: string | null }

/** The mounted rows, the scroller's height, and whether the highlighted row is inside it. */
const windowOf = (page: LayoutPage): Promise<Window> =>
  page.raw.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>(
      '[data-slot="combobox-content"] [data-slot="virtual-list"]',
    )!
    const box = scroller.getBoundingClientRect()
    const active = document.querySelector<HTMLElement>('[data-slot="option-row"][data-highlighted]')
    const at = active?.getBoundingClientRect()
    return {
      rows: document.querySelectorAll('[data-slot="option-row"]').length,
      scroller: box.height,
      inView: at !== undefined && at.top >= box.top - 0.5 && at.bottom <= box.bottom + 0.5,
      active: active?.querySelector('[data-slot="option-label"]')?.textContent ?? null,
    }
  })

layout('option list, windowed', () => {
  for (const viewport of [DESKTOP_1440, PHONE]) {
    test(`ten thousand options mount under 60 rows at ${viewport.name}`, async () => {
      const page = await open(viewport)
      const first = await windowOf(page)
      expect(first.scroller).toBeGreaterThan(100)
      expect(first.rows).toBeGreaterThan(5)
      expect(first.rows).toBeLessThan(60)
    })
  }

  test('the list opens at the selected row, far past the first window', async () => {
    const page = await open(DESKTOP_1440)
    const shown = await page.raw.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>(
        '[data-slot="combobox-content"] [data-slot="virtual-list"]',
      )!
      const box = scroller.getBoundingClientRect()
      const row = [...document.querySelectorAll<HTMLElement>('[data-slot="option-row"]')].find(
        (el) =>
          el.querySelector('[data-slot="option-label"]')?.textContent?.startsWith('Part 500 '),
      )
      const at = row?.getBoundingClientRect()
      return at !== undefined && at.top >= box.top - 0.5 && at.bottom <= box.bottom + 0.5
    })
    expect(shown).toBe(true)
  })

  test('the first key typed into a closed combobox already filters the list it opens', async () => {
    const page = await open(DESKTOP_1440)
    await page.raw.focus('input[aria-label="City"]')
    await page.raw.keyboard.type('y')
    // The Part list stays open beside it; read the City popup alone.
    const cityLabels = (): Promise<(string | null)[]> =>
      page.raw.evaluate(() =>
        [...document.querySelectorAll('[data-slot="combobox-content"]')]
          .filter((popup) => popup.querySelector('[data-slot="virtual-list"]') === null)
          .flatMap((popup) => [...popup.querySelectorAll('[data-slot="option-label"]')])
          .map((el) => el.textContent),
      )
    await page.raw.waitForFunction(
      () => document.querySelectorAll('[data-slot="combobox-content"]').length === 2,
      { timeout: 5000 },
    )
    await page.settle()
    const labels = await cityLabels()
    expect(labels).toEqual(['Lyon'])
  })

  test('the arrow keys walk past the window with the active row in view', async () => {
    const page = await open(DESKTOP_1440)
    await page.raw.focus('input[aria-label="Part"]')
    for (let i = 0; i < 60; i += 1) await page.raw.keyboard.press('ArrowDown')
    await page.settle()
    const after = await windowOf(page)
    expect(after.active).not.toBeNull()
    expect(after.inView).toBe(true)
    expect(after.rows).toBeLessThan(60)
  })
})
