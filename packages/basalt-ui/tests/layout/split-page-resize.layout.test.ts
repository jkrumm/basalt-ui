/**
 * `SplitPage` with `resize` in real Chrome at 1440 and 390: the list column is 320 px by default, a drag by +100 px
 * widens it by 100 and survives a reload, a drag past the widest clamps at 640 px, a double click returns it to 320 px,
 * ArrowRight and ArrowLeft on the focused separator move it 16 px, and below the wide tier one pane shows and no
 * separator is drawn.
 *
 * Self-contained like `cards-schedule`: `fixture/split-page-resize.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/split-page-resize-fixture.tsx` is bundled in memory.
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
const TOLERANCE = 0.5
const DEFAULT_PX = 320
const MAX_PX = 640
const STEP_PX = 16
const LIST = '[data-slot="split-page-list"]'
const HANDLE = '[data-slot="split-handle"]'

let documentPath = ''
let scratch = ''

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'split-page-resize-'))
  const cssOut = join(scratch, 'split-page-resize.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'split-page-resize.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`split-page-resize: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'split-page-resize-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`split-page-resize: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" ` +
      `/><meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>split-page-resize</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${js.replaceAll('</script', '<\\/script')}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(LIST)
  await page.settle()
  return page
}

async function listWidth(page: LayoutPage): Promise<number> {
  return page.raw.evaluate(
    (sel) => document.querySelector<HTMLElement>(sel)?.getBoundingClientRect().width ?? -1,
    LIST,
  )
}

async function handleBox(
  page: LayoutPage,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.raw.locator(HANDLE).boundingBox()
  if (box === null) throw new Error('no split handle')
  return box
}

async function drag(page: LayoutPage, dx: number): Promise<void> {
  const box = await handleBox(page)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.raw.mouse.move(x, y)
  await page.raw.mouse.down()
  await page.raw.mouse.move(x + dx, y, { steps: 4 })
  await page.raw.mouse.up()
  await page.settle()
}

const near = (actual: number, expected: number): boolean => Math.abs(actual - expected) <= TOLERANCE

layout('SplitPage resize at 1440', () => {
  test('the list column is 320 px and its separator sits on its end edge', async () => {
    const page = await open(DESKTOP_1440)
    expect(near(await listWidth(page), DEFAULT_PX)).toBe(true)
    const listRight = await page.raw.evaluate(
      (sel) => document.querySelector<HTMLElement>(sel)?.getBoundingClientRect().right ?? -1,
      LIST,
    )
    const handle = await handleBox(page)
    expect(near(handle.x + handle.width, listRight)).toBe(true)
  })

  test('a drag by +100 px widens the list by 100, and the width survives a reload', async () => {
    const page = await open(DESKTOP_1440)
    await drag(page, 100)
    expect(near(await listWidth(page), DEFAULT_PX + 100)).toBe(true)
    await page.raw.reload()
    await page.raw.waitForSelector(LIST)
    await page.settle()
    expect(near(await listWidth(page), DEFAULT_PX + 100)).toBe(true)
  })

  test('a drag past the widest clamps the list at 640 px', async () => {
    const page = await open(DESKTOP_1440)
    await drag(page, 400)
    expect(near(await listWidth(page), MAX_PX)).toBe(true)
  })

  test('a double click returns the list to 320 px', async () => {
    const page = await open(DESKTOP_1440)
    await drag(page, 100)
    await page.raw.dblclick(HANDLE)
    await page.settle()
    expect(near(await listWidth(page), DEFAULT_PX)).toBe(true)
  })

  test('ArrowRight and ArrowLeft on the focused separator widen and narrow the list by 16 px', async () => {
    const page = await open(DESKTOP_1440)
    await page.raw.focus(HANDLE)
    await page.raw.keyboard.press('ArrowRight')
    await page.settle()
    expect(near(await listWidth(page), DEFAULT_PX + STEP_PX)).toBe(true)
    await page.raw.keyboard.press('ArrowLeft')
    await page.settle()
    expect(near(await listWidth(page), DEFAULT_PX)).toBe(true)
  })
})

layout('SplitPage resize at 390', () => {
  test('one pane shows and no separator is drawn below the wide tier', async () => {
    const page = await open(PHONE)
    const shown = await page.raw.evaluate(() => ({
      list:
        (document.querySelector('[data-slot="split-page-list"]')?.getClientRects().length ?? 0) > 0,
      detail:
        (document.querySelector('[data-slot="split-page-detail"]')?.getClientRects().length ?? 0) >
        0,
      handle:
        (document.querySelector('[data-slot="split-handle"]')?.getClientRects().length ?? 0) > 0,
    }))
    expect(shown).toEqual({ list: true, detail: false, handle: false })
  })
})
