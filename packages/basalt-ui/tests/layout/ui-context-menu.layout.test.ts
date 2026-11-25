/**
 * The context menu in real Chrome (docs/v3/concepts/primitives-distribution.md section 4, the menu
 * rows): a real right click opens the same entries as the "..." button at the pointer, a popup near a
 * corner flips and stays inside the viewport, the trigger reads as open while the menu is, Shift+right
 * click and a click in a text field leave the browser's menu, Shift+F10 opens it on the focused part
 * and Escape closes it and gives focus back.
 *
 * Self-contained like `ui-popups`: the CSS is compiled with the Tailwind CLI into a temp directory and
 * the fixture is bundled in memory.
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
const POPUP = '[data-slot="context-menu-content"]'
const byId = (id: string): string => `[data-testid="${id}"]`

let documentPath = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-context-menu-'))
  const cssOut = join(scratch, 'ui-context-menu.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-context-menu.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`ui-context-menu: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-context-menu-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-context-menu: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-context-menu</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector(byId('cm-row'))
  await page.settle()
  return page
}

type Box = { x: number; y: number; width: number; height: number }
const boxOf = async (page: LayoutPage, selector: string): Promise<Box> =>
  (await page.raw.locator(selector).boundingBox()) as Box

const labels = (page: LayoutPage): Promise<string[]> =>
  page.raw.evaluate(() =>
    [...document.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent ?? ''),
  )

/** Whether the page saw its contextmenu event default-prevented (the browser's menu suppressed). */
async function watchContextMenu(page: LayoutPage): Promise<void> {
  await page.raw.evaluate(() => {
    ;(window as unknown as { seen: boolean[] }).seen = []
    document.addEventListener('contextmenu', (e) =>
      queueMicrotask(() =>
        (window as unknown as { seen: boolean[] }).seen.push(e.defaultPrevented),
      ),
    )
  })
}
const prevented = (page: LayoutPage): Promise<boolean[]> =>
  page.raw.evaluate(() => (window as unknown as { seen: boolean[] }).seen)

layout('ContextMenu', () => {
  for (const viewport of [DESKTOP_1440, PHONE]) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('a right click opens the "..." entries at the pointer and marks the trigger', async () => {
        const page = await open(viewport)
        await page.raw.click(byId('cm-more'))
        await page.raw.waitForSelector('[data-slot="menu-content"]')
        const fromButton = await labels(page)
        await page.raw.keyboard.press('Escape')
        await page.raw.waitForSelector('[data-slot="menu-content"]', { state: 'detached' })

        const row = await boxOf(page, byId('cm-row'))
        const at = { x: row.x + 20, y: row.y + 12 }
        const before = await page.raw.evaluate(
          (sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor,
          byId('cm-row'),
        )
        await page.raw.mouse.click(at.x, at.y, { button: 'right' })
        await page.raw.waitForSelector(POPUP)
        await page.settle()
        expect(await labels(page)).toEqual(fromButton)
        const popup = await boxOf(page, POPUP)
        expect(Math.abs(popup.x - at.x)).toBeLessThanOrEqual(6)
        expect(Math.abs(popup.y - at.y)).toBeLessThanOrEqual(6)
        const after = await page.raw.evaluate(
          (sel) => getComputedStyle(document.querySelector(sel)!).backgroundColor,
          byId('cm-row'),
        )
        expect(after).not.toBe(before)
        expect(await page.raw.getAttribute(byId('cm-row'), 'data-popup-open')).toBe('')
      })

      test('near the corner the popup flips and stays inside the viewport', async () => {
        const page = await open(viewport)
        const corner = await boxOf(page, byId('cm-corner'))
        await page.raw.mouse.click(corner.x + corner.width - 4, corner.y + corner.height - 4, {
          button: 'right',
        })
        await page.raw.waitForSelector(POPUP)
        await page.settle()
        const popup = await boxOf(page, POPUP)
        const { innerWidth, innerHeight } = await page.raw.evaluate(() => ({
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        }))
        expect(popup.x).toBeGreaterThanOrEqual(-0.5)
        expect(popup.y).toBeGreaterThanOrEqual(-0.5)
        expect(popup.x + popup.width).toBeLessThanOrEqual(innerWidth + 0.5)
        expect(popup.y + popup.height).toBeLessThanOrEqual(innerHeight + 0.5)
      })

      test('Shift+right click and a click in a text field keep the browser menu', async () => {
        const page = await open(viewport)
        await watchContextMenu(page)
        const row = await boxOf(page, byId('cm-row'))
        await page.raw.keyboard.down('Shift')
        await page.raw.mouse.click(row.x + 20, row.y + 12, { button: 'right' })
        await page.raw.keyboard.up('Shift')
        const field = await boxOf(page, byId('cm-field'))
        await page.raw.mouse.click(field.x + 10, field.y + 10, { button: 'right' })
        await page.settle()
        expect(await prevented(page)).toEqual([false, false])
        expect(await page.raw.locator(POPUP).count()).toBe(0)
      })

      test('Shift+F10 opens it on the focused part, Escape closes it and returns focus', async () => {
        const page = await open(viewport)
        await page.raw.focus(byId('cm-row'))
        await page.raw.keyboard.press('Shift+F10')
        await page.raw.waitForSelector(POPUP)
        await page.settle()
        const firstFocused = await page.raw.evaluate(
          () => document.activeElement?.getAttribute('role') === 'menuitem',
        )
        expect(firstFocused).toBe(true)
        await page.raw.keyboard.press('Escape')
        await page.raw.waitForSelector(POPUP, { state: 'detached' })
        await page.settle()
        expect(
          await page.raw.evaluate(() => document.activeElement?.getAttribute('data-testid')),
        ).toBe('cm-row')
      })
    })
  }
})
