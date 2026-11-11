/**
 * P4b (docs/v3/concepts/primitives-distribution.md section 4, rows 15 to 17): the `Popover`,
 * `Tooltip` and `Menu` primitives in real Chrome at 1440, 768, 390 and 320. Asserted here because
 * happy-dom has no geometry, no stacking and no real focus: each popup opens inside the viewport,
 * axe finds nothing serious or critical with it open, Escape closes it and gives focus back, a
 * closed popup is no longer hit-testable (the page answers at its former rect), a trigger-less menu
 * on a virtual anchor opens at the point, focuses its first item and returns focus on close, a
 * tooltip opens on keyboard focus (the touch-equivalent), and Escape closes only the top overlay
 * when a popover sits in a dialog.
 *
 * The page is self-contained: `fixture/ui-popups.css` is compiled with the Tailwind CLI into a
 * temp directory and `fixture/ui-popups-fixture.tsx` is bundled in memory, both inlined into a
 * document served beside the shared fixture, so no shared fixture file carries a line for this
 * suite.
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
  PHONE_SMALL,
  TABLET_768,
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
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

type Popup = { name: string; trigger: string; popup: string }
const POPUPS: Popup[] = [
  {
    name: 'popover',
    trigger: 'up-open-popover',
    popup: '[data-slot="popover-content"]',
  },
  {
    name: 'menu',
    trigger: 'up-open-menu',
    popup: '[data-slot="menu-content"]',
  },
  { name: 'tooltip', trigger: 'up-tip', popup: '[data-slot="tooltip"]' },
]

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-popups-'))
  const cssOut = join(scratch, 'ui-popups.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-popups.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`ui-popups: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-popups-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-popups: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-popups</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="up-open-popover"]')
  await page.settle()
  return page
}

const byId = (id: string): string => `[data-testid="${id}"]`

/** Opens a popup the way a person does: a click, or keyboard focus for the tooltip. */
async function show(page: LayoutPage, popup: Popup): Promise<void> {
  if (popup.name === 'tooltip') await page.raw.focus(byId(popup.trigger))
  else await page.raw.click(byId(popup.trigger))
  await page.raw.waitForSelector(popup.popup)
  await page.settle()
}

async function hide(page: LayoutPage, popup: Popup): Promise<void> {
  await page.raw.keyboard.press('Escape')
  await page.raw.waitForSelector(popup.popup, { state: 'detached' })
  await page.settle()
}

type Rect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

const rectOf = (page: LayoutPage, selector: string): Promise<Rect> =>
  page.raw.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    return {
      left: r.left,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    }
  }, selector)

const activeTestId = (page: LayoutPage): Promise<string | null> =>
  page.raw.evaluate(() => {
    const el = document.activeElement
    return el?.getAttribute('data-testid') ?? el?.getAttribute('data-slot') ?? null
  })

const slotAt = (page: LayoutPage, x: number, y: number): Promise<string | null> =>
  page.raw.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('[data-slot^="popover"],[data-slot^="menu"],[data-slot="tooltip"]')
        ?.getAttribute('data-slot') ?? null,
    { x, y },
  )

layout('Popover, Tooltip and Menu', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      for (const popup of POPUPS) {
        describe(popup.name, () => {
          test('opens inside the viewport and the page does not scroll sideways', async () => {
            const page = await open(viewport)
            await show(page, popup)
            const rect = await rectOf(page, popup.popup)
            const { innerWidth, innerHeight, scrollWidth } = await page.raw.evaluate(() => ({
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight,
              scrollWidth: document.documentElement.scrollWidth,
            }))
            expect(rect.left).toBeGreaterThanOrEqual(-0.5)
            expect(rect.right).toBeLessThanOrEqual(innerWidth + 0.5)
            expect(rect.top).toBeGreaterThanOrEqual(-0.5)
            expect(rect.bottom).toBeLessThanOrEqual(innerHeight + 0.5)
            expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
          })

          test('axe finds nothing serious or critical while it is open', async () => {
            const page = await open(viewport)
            await show(page, popup)
            await page.raw.addScriptTag({ content: axeSource })
            const violations = await page.raw.evaluate(async () => {
              const axe = (
                window as unknown as {
                  axe: {
                    run: () => Promise<{
                      violations: {
                        id: string
                        impact: string
                        nodes: { html: string }[]
                      }[]
                    }>
                  }
                }
              ).axe
              const result = await axe.run()
              return result.violations
                .filter((v) => v.impact === 'serious' || v.impact === 'critical')
                .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
            })
            expect(violations).toEqual([])
          })

          test('Escape closes it, focus stays or returns to the trigger, and the former rect hits the page', async () => {
            const page = await open(viewport)
            await show(page, popup)
            const rect = await rectOf(page, popup.popup)
            const point = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            }
            await hide(page, popup)
            expect(await slotAt(page, point.x, point.y)).toBeNull()
            expect(await activeTestId(page)).toBe(popup.trigger)
          })
        })
      }

      test('the popup layers sit above the page (z-50 positioner, page answers once closed)', async () => {
        const page = await open(viewport)
        await show(page, POPUPS[1]!)
        const z = await page.raw.evaluate(() =>
          Number(
            getComputedStyle(document.querySelector('[data-slot="menu-content"]')!.parentElement!)
              .zIndex,
          ),
        )
        expect(z).toBe(50)
      })

      test('a submenu opens beside its row and Escape closes it before the menu', async () => {
        const page = await open(viewport)
        await show(page, POPUPS[1]!)
        await page.raw.click('[data-slot="menu-sub"]')
        await page.raw.waitForFunction(
          () => document.querySelectorAll('[data-slot="menu-content"]').length === 2,
        )
        await page.settle()
        const { innerWidth } = await page.raw.evaluate(() => ({
          innerWidth: window.innerWidth,
        }))
        const [parent, sub] = await page.raw.evaluate(() =>
          [...document.querySelectorAll('[data-slot="menu-content"]')].map((el) => {
            const r = el.getBoundingClientRect()
            return {
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            }
          }),
        )
        expect(sub!.left).toBeGreaterThanOrEqual(-0.5)
        expect(sub!.right).toBeLessThanOrEqual(innerWidth + 0.5)
        expect(parent!.left).toBeGreaterThanOrEqual(-0.5)
        await page.raw.keyboard.press('Escape')
        await page.settle()
        expect(await page.count('[data-slot="menu-content"]')).toBe(1)
        await page.raw.keyboard.press('Escape')
        await page.raw.waitForSelector('[data-slot="menu-content"]', {
          state: 'detached',
        })
      })

      test('Escape closes only the popover when it sits in a dialog, then the dialog', async () => {
        const page = await open(viewport)
        await page.raw.click(byId('up-open-dialog'))
        await page.raw.waitForSelector('[data-slot="dialog-content"]')
        await page.raw.click(byId('up-nested-popover'))
        await page.raw.waitForSelector('[data-slot="popover-content"]')
        await page.settle()
        await page.raw.keyboard.press('Escape')
        await page.raw.waitForSelector('[data-slot="popover-content"]', {
          state: 'detached',
        })
        expect(await page.count('[data-slot="dialog-content"]')).toBe(1)
        await page.raw.keyboard.press('Escape')
        await page.raw.waitForSelector('[data-slot="dialog-content"]', {
          state: 'detached',
        })
      })

      test('Menu on a virtual anchor opens at the point, focuses the first item and returns focus', async () => {
        const page = await open(viewport)
        await page.raw.click(byId('up-open-virtual'))
        await page.raw.waitForSelector('[data-slot="menu-content"]')
        await page.settle()
        const rect = await rectOf(page, '[data-slot="menu-content"]')
        const { innerWidth } = await page.raw.evaluate(() => ({
          innerWidth: window.innerWidth,
        }))
        expect(rect.left).toBeGreaterThanOrEqual(-0.5)
        expect(rect.right).toBeLessThanOrEqual(innerWidth + 0.5)
        // The popup hangs off the point (120, 260), 4 px below it at most, whatever the width.
        expect(Math.abs(rect.top - 264)).toBeLessThanOrEqual(8)
        expect(await activeTestId(page)).toBe('up-virtual-first')
        await page.raw.keyboard.press('Escape')
        await page.raw.waitForSelector('[data-slot="menu-content"]', {
          state: 'detached',
        })
        expect(await activeTestId(page)).toBe('up-open-virtual')
      })
    })
  }

  describe('keyboard, desktop fine pointer', () => {
    test('a tooltip opens on keyboard focus (the touch-equivalent) and closes on blur', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus(byId('up-open-popover'))
      await page.raw.keyboard.press('Tab')
      await page.raw.waitForSelector('[data-slot="tooltip"]')
      expect(await activeTestId(page)).toBe('up-tip')
      expect(
        await page.raw.evaluate(() => document.querySelector('[data-slot="tooltip"]')!.textContent),
      ).toBe('Copy link')
      await page.raw.keyboard.press('Tab')
      await page.raw.waitForSelector('[data-slot="tooltip"]', {
        state: 'detached',
      })
    })

    test('a menu opens with Enter, focuses its first item, arrows move, Escape returns focus', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus(byId('up-open-menu'))
      await page.raw.keyboard.press('Enter')
      await page.raw.waitForSelector('[data-slot="menu-content"]')
      await page.settle()
      const first = await page.raw.evaluate(() => document.activeElement?.textContent)
      expect(first).toBe('Rename')
      await page.raw.keyboard.press('ArrowDown')
      const second = await page.raw.evaluate(() => document.activeElement?.textContent)
      expect(second).toBe('Inbox')
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector('[data-slot="menu-content"]', {
        state: 'detached',
      })
      expect(await activeTestId(page)).toBe('up-open-menu')
    })

    test('a popover moves focus in on open and gives it back on close', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.click(byId('up-open-popover'))
      await page.raw.waitForSelector('[data-slot="popover-content"]')
      await page.settle()
      expect(
        await page.raw.evaluate(
          () => document.activeElement?.closest('[data-slot="popover-content"]') !== null,
        ),
      ).toBe(true)
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector('[data-slot="popover-content"]', {
        state: 'detached',
      })
      expect(await activeTestId(page)).toBe('up-open-popover')
    })
  })
})
