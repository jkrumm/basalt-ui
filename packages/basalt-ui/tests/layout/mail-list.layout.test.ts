/**
 * `MailList` in real Chrome: a row's face turns into its checkbox on hover, on focus and on every
 * row once one is selected; the bulk bar floats inside the list's box at 440 and at 320 px; and the
 * period headers stick to the top of the windowed list while it scrolls.
 *
 * Self-contained like `split-page-resize`: `fixture/mail-list.css` is compiled with the Tailwind CLI
 * into a temp directory and `fixture/mail-list-fixture.tsx` is bundled in memory.
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
const ROW = '[data-slot="mail-row"]'
const SCROLLER = '[data-slot="virtual-list"]'

let documentPath = ''
let scratch = ''

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'mail-list-'))
  const cssOut = join(scratch, 'mail-list.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'mail-list.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`mail-list: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'mail-list-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`mail-list: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" ` +
      `/><meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>mail-list</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${js.replaceAll('</script', '<\\/script')}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(width = 440): Promise<LayoutPage> {
  const page = await openFixture(
    EMPTY_SPEC,
    DESKTOP_1440,
    `${documentPath}#w=${width}`,
    'reduce',
    'fine',
  )
  await page.raw.waitForSelector(ROW)
  await page.settle()
  return page
}

/** Which rows' checkboxes are visible, by row order among the rendered rows. */
const visibleBoxes = (page: LayoutPage): Promise<boolean[]> =>
  page.raw.evaluate(
    (row) =>
      [...document.querySelectorAll(row)].map((r) => {
        const box = r.querySelector('[data-slot="checkbox"]')
        return box !== null && getComputedStyle(box).visibility === 'visible'
      }),
    ROW,
  )

layout('MailList selection', () => {
  test('at rest every row shows its face, no checkbox', async () => {
    const page = await open()
    expect((await visibleBoxes(page)).some(Boolean)).toBe(false)
  })

  test('a hovered row shows its checkbox, the others keep their faces', async () => {
    const page = await open()
    await page.raw.locator(ROW).nth(1).hover()
    await page.settle()
    const shown = await visibleBoxes(page)
    expect(shown[1]).toBe(true)
    expect(shown.filter(Boolean)).toHaveLength(1)
  })

  test('a row whose open button holds focus shows its checkbox', async () => {
    const page = await open()
    await page.raw.locator(`${ROW} [data-mail-open]`).nth(2).focus()
    await page.settle()
    expect((await visibleBoxes(page))[2]).toBe(true)
  })

  test('once a row is selected every row shows its checkbox, and the bulk bar stays inside the list', async () => {
    for (const width of [440, 320]) {
      const page = await open(width)
      await page.raw.locator(ROW).nth(0).hover()
      await page.raw.locator(`${ROW} [data-slot="checkbox"]`).nth(0).click()
      await page.raw.mouse.move(1200, 900)
      await page.settle()
      expect((await visibleBoxes(page)).every(Boolean)).toBe(true)
      const boxes = await page.raw.evaluate(() => {
        const list = document.querySelector('[data-slot="mail-list"]')!.getBoundingClientRect()
        const bar = document.querySelector('[data-slot="table-bulk"]')!.getBoundingClientRect()
        const kids = [...document.querySelectorAll('[data-slot="table-bulk"] > *')].map((k) =>
          k.getBoundingClientRect(),
        )
        return { list, bar, kids }
      })
      expect(boxes.bar.left).toBeGreaterThanOrEqual(boxes.list.left)
      expect(boxes.bar.right).toBeLessThanOrEqual(boxes.list.right)
      expect(boxes.bar.bottom).toBeLessThanOrEqual(boxes.list.bottom)
      for (const kid of boxes.kids) {
        expect(kid.left).toBeGreaterThanOrEqual(boxes.bar.left)
        expect(kid.right).toBeLessThanOrEqual(boxes.bar.right)
      }
    }
  })
})

layout('MailList day groups', () => {
  test('the header of the group under the top edge sticks there while the list scrolls', async () => {
    const page = await open()
    for (const top of [2400, 6000, 12000]) {
      const probe = await page.raw.evaluate(
        async ({ scroller, at }) => {
          const el = document.querySelector<HTMLElement>(scroller)!
          el.scrollTop = at
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
          const box = el.getBoundingClientRect()
          const hit = document.elementFromPoint(box.left + 24, box.top + 4)
          const header = hit?.closest('[data-slot="mail-list-header"]') ?? null
          const headers = [...el.querySelectorAll('[data-slot="mail-list-header"]')]
          const below = header === null ? -1 : headers.indexOf(header)
          const nextHeader = headers[below + 1]?.getBoundingClientRect().top ?? Infinity
          const firstRow = [...el.querySelectorAll('[data-slot="mail-row"]')].find(
            (r) => r.getBoundingClientRect().bottom > box.top + 32,
          )
          return {
            stuck: header !== null && Math.abs(header.getBoundingClientRect().top - box.top) < 1,
            rowUnderIt: firstRow !== undefined && firstRow.getBoundingClientRect().top < nextHeader,
          }
        },
        { scroller: SCROLLER, at: top },
      )
      expect(probe).toEqual({ stuck: true, rowUnderIt: true })
    }
  })
})
