/**
 * P4 (docs/v3/concepts/primitives-distribution.md section 4, rows 13, 14 and 18): the `Dialog`,
 * `AlertDialog`, `Sheet` and toast primitives in real Chrome at 1440, 768, 390 and 320. Asserted
 * here because happy-dom has no geometry, no stacking and no real focus: each overlay opens inside
 * the viewport, axe finds nothing serious or critical with it open, Escape closes it and gives
 * focus back, a closed overlay is no longer hit-testable (the page answers at its former rect), a
 * `Sheet` sits on the edge `placement="auto"` picks for the width, and the toast viewport stacks
 * above an open dialog.
 *
 * The page is self-contained: `fixture/ui-dialogs.css` is compiled with the Tailwind CLI into a
 * temp directory and `fixture/ui-dialogs-fixture.tsx` is bundled in memory, both inlined into a
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

/** The `md` breakpoint: a `placement="auto"` sheet is the bottom sheet below it, the right one from it. */
const MD = 840

type Overlay = { name: string; trigger: string; popup: string; close: string }

/** A `data-testid` id, or a selector when it starts with `[`. */
const closeSelector = (close: string): string => (close.startsWith('[') ? close : byId(close))
const OVERLAYS: Overlay[] = [
  {
    name: 'dialog',
    trigger: 'ud-open-dialog',
    popup: '[data-slot="dialog-content"]',
    close: 'ud-close-dialog',
  },
  {
    name: 'wide dialog',
    trigger: 'ud-open-wide',
    popup: '[data-slot="dialog-content"]',
    close: 'ud-close-wide',
  },
  {
    name: 'wizard dialog',
    trigger: 'ud-open-wizard',
    popup: '[data-slot="dialog-content"]',
    close: '[data-slot="wizard-top-bar"] [data-slot="dialog-close"]',
  },
  {
    name: 'alert dialog',
    trigger: 'ud-open-alert',
    popup: '[data-slot="alert-dialog-content"]',
    close: 'ud-close-alert',
  },
  {
    name: 'sheet',
    trigger: 'ud-open-sheet',
    popup: '[data-slot="sheet-content"]',
    close: 'ud-close-sheet',
  },
]

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-dialogs-'))
  const cssOut = join(scratch, 'ui-dialogs.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-dialogs.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`ui-dialogs: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-dialogs-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-dialogs: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-dialogs</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="ud-open-dialog"]')
  await page.settle()
  return page
}

const byId = (id: string): string => `[data-testid="${id}"]`

async function show(page: LayoutPage, overlay: Overlay): Promise<void> {
  await page.raw.click(byId(overlay.trigger))
  await page.raw.waitForSelector(overlay.popup)
  await page.settle()
}

async function hide(page: LayoutPage, overlay: Overlay): Promise<void> {
  await page.raw.keyboard.press('Escape')
  await page.raw.waitForSelector(overlay.popup, { state: 'detached' })
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

layout('Dialog, AlertDialog, Sheet and Toast', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      for (const overlay of OVERLAYS) {
        describe(overlay.name, () => {
          test('opens inside the viewport and the page does not scroll sideways', async () => {
            const page = await open(viewport)
            await show(page, overlay)
            const rect = await rectOf(page, overlay.popup)
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
            await show(page, overlay)
            await page.raw.addScriptTag({ content: axeSource })
            const violations = await page.raw.evaluate(async () => {
              const axe = (
                window as unknown as {
                  axe: {
                    run: () => Promise<{
                      violations: { id: string; impact: string; nodes: { html: string }[] }[]
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

          test('Escape closes it, focus returns to the trigger, and the former rect hits the page', async () => {
            const page = await open(viewport)
            await show(page, overlay)
            const rect = await rectOf(page, overlay.popup)
            const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
            await hide(page, overlay)
            const hit = await page.raw.evaluate(({ x, y }) => {
              const el = document.elementFromPoint(x, y)
              return {
                inPage: el?.closest('[data-testid="ud-page"]') !== null,
                inOverlay: el?.closest('[data-slot]')?.getAttribute('data-slot') ?? null,
                focus: document.activeElement?.getAttribute('data-testid') ?? null,
              }
            }, point)
            expect(hit.inPage).toBe(true)
            expect(hit.inOverlay === null || !/dialog|sheet/.test(hit.inOverlay)).toBe(true)
            expect(hit.focus).toBe(overlay.trigger)
          })

          test('the close button inside closes it', async () => {
            const page = await open(viewport)
            await show(page, overlay)
            await page.raw.click(closeSelector(overlay.close))
            await page.raw.waitForSelector(overlay.popup, { state: 'detached' })
            expect(await page.count(overlay.popup)).toBe(0)
          })
        })
      }

      test('the sheet sits on the edge placement="auto" picks for this width', async () => {
        const page = await open(viewport)
        await show(
          page,
          OVERLAYS.find((o) => o.name === 'sheet')!,
        )
        const rect = await rectOf(page, '[data-slot="sheet-content"]')
        const { innerWidth, innerHeight } = await page.raw.evaluate(() => ({
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        }))
        if (viewport.width >= MD) {
          expect(Math.abs(rect.right - innerWidth)).toBeLessThanOrEqual(0.5)
          expect(rect.width).toBeCloseTo(360, 0)
          expect(rect.height).toBeCloseTo(innerHeight, 0)
        } else {
          expect(Math.abs(rect.bottom - innerHeight)).toBeLessThanOrEqual(0.5)
          expect(rect.width).toBeCloseTo(innerWidth, 0)
          expect(rect.height).toBeLessThanOrEqual(Math.min(0.72 * innerHeight, 560) + 0.5)
        }
      })

      test('the toast viewport renders above an open dialog and stays reachable', async () => {
        const page = await open(viewport)
        await show(page, OVERLAYS[0]!)
        await page.raw.evaluate(() => {
          document.querySelector<HTMLElement>('[data-testid="ud-add-toast"]')?.click()
        })
        await page.raw.waitForSelector('[data-slot="toast"]')
        await page.settle()
        const z = await page.raw.evaluate(() => ({
          toast: Number(
            getComputedStyle(document.querySelector('[data-slot="toast-viewport"]')!).zIndex,
          ),
          dialog: Number(
            getComputedStyle(document.querySelector('[data-slot="dialog-content"]')!.parentElement!)
              .zIndex,
          ),
        }))
        expect(z.toast).toBeGreaterThan(z.dialog)
        const toast = await rectOf(page, '[data-slot="toast"]')
        const hit = await page.raw.evaluate(
          ({ x, y }) =>
            document.elementFromPoint(x, y)?.closest('[data-slot]')?.getAttribute('data-slot') ??
            null,
          { x: toast.left + 4, y: toast.top + toast.height / 2 },
        )
        expect(hit).toBe('toast')
      })
    })
  }

  describe('sizes, wash and the wizard panes', () => {
    const named = (name: string): Overlay => OVERLAYS.find((o) => o.name === name)!
    const backdropOf = (page: LayoutPage): Promise<string> =>
      page.raw.evaluate(
        () =>
          getComputedStyle(
            document.querySelector('[role="dialog"], [role="alertdialog"]')!.parentElement!
              .previousElementSibling!,
          ).backgroundColor,
      )

    test('the wide dialog is 64 rem at 1440 and fills a phone minus its margin', async () => {
      const page = await open(DESKTOP_1440)
      await show(page, named('wide dialog'))
      expect((await rectOf(page, '[data-slot="dialog-content"]')).width).toBeCloseTo(1024, 0)
      await page.raw.keyboard.press('Escape')
      const phone = await open(PHONE)
      await show(phone, named('wide dialog'))
      expect((await rectOf(phone, '[data-slot="dialog-content"]')).width).toBeCloseTo(390 - 32, 0)
    })

    test('the wizard is 1100 by 700 with two panes at 1440 and the form pane alone at 390', async () => {
      const page = await open(DESKTOP_1440)
      await show(page, named('wizard dialog'))
      const panel = await rectOf(page, '[data-slot="dialog-content"]')
      expect(panel.width).toBeCloseTo(1100, 0)
      expect(panel.height).toBeCloseTo(700, 0)
      const preview = await rectOf(page, '[data-slot="wizard-preview"]')
      const form = await rectOf(page, '[data-slot="wizard-form"]')
      expect(preview.width).toBeGreaterThan(400)
      expect(form.left).toBeGreaterThanOrEqual(preview.right - 0.5)

      const phone = await open(PHONE)
      await show(phone, named('wizard dialog'))
      expect(await phone.count('[data-slot="wizard-preview"]')).toBe(1)
      const hidden = await phone.raw.evaluate(
        () => getComputedStyle(document.querySelector('[data-slot="wizard-preview"]')!).display,
      )
      expect(hidden).toBe('none')
      const formPane = await rectOf(phone, '[data-slot="wizard-form"]')
      const panelPhone = await rectOf(phone, '[data-slot="dialog-content"]')
      expect(formPane.width).toBeCloseTo(panelPhone.width, 0)
      expect(formPane.bottom).toBeLessThanOrEqual(panelPhone.bottom + 0.5)
    })

    test('the wizard primary is disabled until the step is valid and its preview follows typing', async () => {
      const page = await open(DESKTOP_1440)
      await show(page, named('wizard dialog'))
      const primary = '[data-slot="wizard-footer"] button'
      expect(await page.raw.getAttribute(primary, 'data-disabled')).not.toBeNull()
      await page.raw.fill('[data-slot="wizard-body"] input', 'Acme')
      await page.settle()
      expect(await page.raw.getAttribute(primary, 'data-disabled')).toBeNull()
      expect(await page.raw.textContent('[data-testid="ud-preview"]')).toBe('Acme')
    })

    test('a Dialog backdrop is a light wash and an AlertDialog keeps the strong scrim', async () => {
      const page = await open(DESKTOP_1440)
      await show(page, named('dialog'))
      const wash = await backdropOf(page)
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector('[data-slot="dialog-content"]', { state: 'detached' })
      await show(page, named('alert dialog'))
      const scrim = await backdropOf(page)
      // Light scheme: the wash is the pale canvas, the scrim is dark ink, so the wash is lighter.
      const lightness = (c: string): number => {
        const [r = 0, g = 0, b = 0] = (c.match(/[\d.]+/g) ?? []).map(Number)
        return (r + g + b) / (r > 1 || g > 1 || b > 1 ? 255 * 3 : 3)
      }
      expect(wash).not.toBe(scrim)
      expect(lightness(wash)).toBeGreaterThan(lightness(scrim))
    })
  })

  describe('keyboard, desktop fine pointer', () => {
    test('focus moves into the dialog on open and Tab stays inside it', async () => {
      const page = await open(DESKTOP_1440)
      await show(page, OVERLAYS[0]!)
      for (let i = 0; i < 6; i += 1) {
        await page.raw.keyboard.press('Tab')
        await page.settle()
        const where = await page.raw.evaluate(() => {
          const el = document.activeElement
          return el?.closest('[data-slot="dialog-content"]') === null
            ? `outside: ${el?.outerHTML.slice(0, 120) ?? 'nothing'}`
            : 'inside'
        })
        expect(where, `tab ${i + 1}`).toBe('inside')
      }
    })
  })
})
