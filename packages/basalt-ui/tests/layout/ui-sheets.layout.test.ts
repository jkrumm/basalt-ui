/**
 * The list overlays on a phone (Issue 3207): a Select opens as a bottom sheet on a compact viewport
 * with a coarse pointer and as the anchored popup everywhere else, `present` forces either, the
 * rows are selectable by touch, focus returns to the trigger, axe passes with the sheet open, and a
 * Select inside a Sheet opens a nested sheet that closes first.
 *
 * Self-contained like `ui-select`: `fixture/ui-sheets.css` is compiled with the Tailwind CLI into a
 * temp directory and `fixture/ui-sheets-fixture.tsx` is bundled in memory.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import { heightSpread, onlyRises, onlySinks, recordFrames } from './sheet-frames'
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
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-sheets-'))
  const cssOut = join(scratch, 'ui-sheets.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-sheets.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`ui-sheets: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-sheets-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-sheets: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-sheets</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, pointer: 'fine' | 'coarse'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-slot="select-trigger"]')
  await page.settle()
  return page
}

const IN = (id: string, selector: string): string => `[data-testid="${id}"] ${selector}`
const TRIGGER = (id: string): string => IN(id, '[data-slot="select-trigger"]')
const CONTENT = '[data-slot="select-content"]'
const SHEET = '[data-slot="sheet-content"]'

const focusSlot = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate(() => (document.activeElement as HTMLElement | null)?.textContent ?? '')

const count = (page: LayoutPage, selector: string): Promise<number> =>
  page.raw.evaluate((sel) => document.querySelectorAll(sel).length, selector)

type AxeResult = { violations: { id: string; impact: string; nodes: { html: string }[] }[] }
const BASE_UI_FOCUS_MACHINERY = ['[data-base-ui-focus-guard]', '[data-base-ui-inert]']
const axeViolations = async (page: LayoutPage): Promise<string[]> => {
  await page.raw.addScriptTag({ content: axeSource })
  return page.raw.evaluate(async (machinery) => {
    const axe = (
      window as unknown as {
        axe: { run: (context: { exclude: string[][] }) => Promise<AxeResult> }
      }
    ).axe
    const result = await axe.run({ exclude: machinery.map((selector) => [selector]) })
    return result.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
  }, BASE_UI_FOCUS_MACHINERY)
}

layout('list overlays on a phone', () => {
  describe('390 coarse: one motion, one height', () => {
    const MENU_TRIGGER = '[data-testid="us-menu"] button'

    /** Open and close once with the transition playing; the first open is the one that used to pop in. */
    async function openClose(
      trigger: string,
      ready: string,
    ): Promise<{
      opening: Awaited<ReturnType<typeof recordFrames>>
      closing: Awaited<ReturnType<typeof recordFrames>>
    }> {
      const page = await openFixture(EMPTY_SPEC, PHONE, documentPath, 'no-preference', 'coarse')
      await page.raw.waitForSelector('[data-slot="select-trigger"]')
      await page.settle()
      const opening = await recordFrames(page, SHEET, async () => {
        await page.raw.tap(trigger)
        await page.raw.waitForSelector(`${SHEET} ${ready}`)
      })
      const closing = await recordFrames(page, SHEET, async () => {
        await page.raw.keyboard.press('Escape')
      })
      return { opening, closing }
    }

    for (const [name, trigger, ready] of [
      ['a 4-option Select', TRIGGER('us-select'), '[role="option"]'],
      ['a Menu', MENU_TRIGGER, '[role="menuitem"]'],
    ] as const) {
      test(`${name} slides in from the bottom at its content's height and leaves at the same height`, async () => {
        const { opening, closing } = await openClose(trigger, ready)
        // It was seen mid-motion: first below its rest, then rising to it with no backtrack.
        const rest = opening.at(-1)!.top
        expect(opening[0]!.top).toBeGreaterThan(rest + 20)
        expect(opening.some((f) => f.starting)).toBe(true)
        expect(onlyRises(opening)).toBe(true)
        // One height from the first frame to the last: no second resize after it mounted.
        expect(heightSpread(opening)).toBeLessThan(0.5)
        // And on the way out: the list unmounts under it, the sheet keeps its height and sinks.
        expect(onlySinks(closing)).toBe(true)
        expect(heightSpread(closing)).toBeLessThan(0.5)
        expect(closing[0]!.height).toBeCloseTo(opening.at(-1)!.height, 0)
      })
    }
  })

  describe('390 coarse: a sheet', () => {
    test('a Select opens as a bottom sheet holding the list', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap(TRIGGER('us-select'))
      await page.raw.waitForSelector(`${SHEET} ${CONTENT}`)
      await page.settle()
      const geo = await page.raw.evaluate(
        ([sheetSel, listSel]) => {
          const sheet = document.querySelector<HTMLElement>(sheetSel!)!.getBoundingClientRect()
          const list = document.querySelector<HTMLElement>(listSel!)!.getBoundingClientRect()
          return {
            sheetBottom: sheet.bottom,
            sheetLeft: sheet.left,
            sheetRight: sheet.right,
            vh: innerHeight,
            vw: innerWidth,
            listH: list.height,
            options: document.querySelectorAll('[role="option"]').length,
            rowH: document.querySelector<HTMLElement>('[role="option"]')!.getBoundingClientRect()
              .height,
            popups: document.querySelectorAll('[data-slot="select-content"]').length,
          }
        },
        [SHEET, CONTENT],
      )
      expect(geo.sheetBottom).toBeCloseTo(geo.vh, 0)
      expect(geo.sheetLeft).toBe(0)
      expect(geo.sheetRight).toBe(geo.vw)
      expect(geo.options).toBe(4)
      expect(geo.rowH).toBeGreaterThanOrEqual(44)
      expect(geo.listH).toBeGreaterThan(100)
    })

    test('a row is selectable by touch, the sheet closes and focus returns to the trigger', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap(TRIGGER('us-select'))
      await page.raw.waitForSelector(`${SHEET} [role="option"]`)
      await page.settle()
      await page.raw.tap('[role="option"]:has-text("Gamma")')
      await page.settle()
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      expect(await page.raw.locator(TRIGGER('us-select')).innerText()).toContain('Gamma')
      const focused = await page.raw.evaluate(
        () => (document.activeElement as HTMLElement | null)?.getAttribute('data-slot') ?? '',
      )
      expect(focused).toBe('select-trigger')
    })

    test('the parts form and the searchable form open as sheets too', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap(TRIGGER('us-parts'))
      await page.raw.waitForSelector(`${SHEET} [role="option"]`)
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      await page.raw.tap(TRIGGER('us-search'))
      await page.settle()
      await page.raw.waitForSelector(`${SHEET} [data-slot="select-search"]`)
      await page.settle()
      await page.raw.fill('[data-slot="select-search"]', 'Option 07')
      await page.settle()
      expect(await count(page, `${SHEET} [role="option"]`)).toBe(1)
      await page.raw.tap('[role="option"]')
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      expect(await page.raw.locator(TRIGGER('us-search')).innerText()).toContain('Option 07')
    })

    test('present="popup" keeps the anchored popup on a phone', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap(TRIGGER('us-forced'))
      await page.raw.waitForSelector(CONTENT)
      expect(await count(page, SHEET)).toBe(0)
    })

    test('axe passes with the sheet open', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap(TRIGGER('us-select'))
      await page.raw.waitForSelector(`${SHEET} [role="option"]`)
      await page.settle()
      expect(await axeViolations(page)).toEqual([])
    })

    test('a Select inside a Sheet opens a nested sheet and the two close in order', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap('[data-testid="us-nested"] button')
      await page.raw.waitForSelector(SHEET)
      await page.settle()
      await page.raw.tap(`${SHEET} [data-slot="select-trigger"]`)
      await page.raw.waitForSelector(`${SHEET} ${CONTENT}`)
      await page.settle()
      expect(await count(page, SHEET)).toBe(2)
      await page.raw.keyboard.press('Escape')
      await page.settle()
      await page.raw.waitForFunction((sel) => document.querySelectorAll(sel).length === 1, SHEET)
      expect(await count(page, CONTENT)).toBe(0)
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
    })
  })

  describe('390 coarse: Menu, Combobox, Popover, DatePicker', () => {
    const MENU_TRIGGER = '[data-testid="us-menu"] button'

    test('a Menu opens as an action sheet: 44 px rows, the destructive row last, focus returns', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap(MENU_TRIGGER)
      await page.raw.waitForSelector(`${SHEET} [role="menuitem"]`)
      await page.settle()
      const rows = await page.raw.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '[data-slot="sheet-content"] [role="menuitem"]',
          ),
        ].map((el) => ({ text: el.textContent ?? '', h: el.getBoundingClientRect().height })),
      )
      expect(rows.map((r) => r.text)).toEqual(['Rename', 'Move to', 'Delete'])
      for (const row of rows) expect(row.h, row.text).toBeGreaterThanOrEqual(44)
      await page.raw.tap(`${SHEET} [role="menuitem"]:has-text("Rename")`)
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      expect(await focusSlot(page)).toBe('Actions')
    })

    test('a submenu is a second sheet and closes before its parent', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap(MENU_TRIGGER)
      await page.raw.waitForSelector(`${SHEET} [role="menuitem"]`)
      await page.settle()
      await page.raw.tap(`${SHEET} [role="menuitem"]:has-text("Move to")`)
      await page.raw.waitForFunction((sel) => document.querySelectorAll(sel).length === 2, SHEET)
      await page.raw.tap('[role="menuitem"]:has-text("Archive")')
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
    })

    test('axe passes with the action sheet open', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap(MENU_TRIGGER)
      await page.raw.waitForSelector(`${SHEET} [role="menuitem"]`)
      await page.settle()
      expect(await axeViolations(page)).toEqual([])
    })

    test('a Combobox opens a sheet with the search field on top; a row is chosen by touch', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap('[data-testid="us-combo"] [data-slot="combobox-input"]')
      await page.raw.waitForSelector(`${SHEET} [data-slot="select-search"]`)
      await page.settle()
      const top = await page.raw.evaluate(() => {
        const s = document.querySelector('[data-slot="select-search"]')!.getBoundingClientRect()
        const o = document.querySelector('[role="option"]')!.getBoundingClientRect()
        return { searchTop: s.top, optionTop: o.top }
      })
      expect(top.searchTop).toBeLessThan(top.optionTop)
      // the sheet's search row stays a 44 px target; its text is the desktop size (iOS's focus zoom is stopped in the head)
      const field = await page.raw.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-slot="select-search"]')!
        return {
          font: Number.parseFloat(getComputedStyle(el).fontSize),
          height: el.getBoundingClientRect().height,
        }
      })
      expect(field.font).toBeLessThan(16)
      expect(field.height).toBeGreaterThanOrEqual(44)
      await page.raw.fill('[data-slot="select-search"]', 'Option 12')
      await page.settle()
      expect(await count(page, `${SHEET} [role="option"]`)).toBe(1)
      await page.raw.tap(`${SHEET} [role="option"]`)
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      expect(
        await page.raw.locator('[data-testid="us-combo"] [data-slot="combobox-input"]').innerText(),
      ).toContain('Option 12')
      expect(await page.raw.evaluate(() => document.activeElement?.getAttribute('data-slot'))).toBe(
        'combobox-input',
      )
    })

    test('axe passes with the combobox sheet open', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap('[data-testid="us-combo"] [data-slot="combobox-input"]')
      await page.raw.waitForSelector(`${SHEET} [role="option"]`)
      await page.settle()
      expect(await axeViolations(page)).toEqual([])
    })

    test('a Popover that fits stays anchored; one that does not becomes a sheet', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap('[data-testid="us-popover-short"] button')
      await page.raw.waitForSelector('[data-slot="popover-content"]')
      await page.settle()
      expect(await count(page, SHEET)).toBe(0)
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector('[data-slot="popover-content"]', { state: 'detached' })
      await page.raw.tap('[data-testid="us-popover-tall"] button')
      await page.raw.waitForSelector(`${SHEET} [data-slot="popover-content"]`)
      await page.settle()
      expect(await count(page, SHEET)).toBe(1)
      expect(await axeViolations(page)).toEqual([])
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      expect(await focusSlot(page)).toBe('Tall')
    })

    test('a DatePicker opens a calendar sheet with Done; Done closes and focus returns', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap('[data-testid="us-date"] button')
      await page.raw.waitForSelector(`${SHEET} [role="grid"]`)
      await page.settle()
      const geo = await page.raw.evaluate(() => {
        const cell = document.querySelector<HTMLElement>(
          '[data-slot="sheet-content"] [role="gridcell"] button',
        )!
        const grid = document
          .querySelector<HTMLElement>('[data-slot="sheet-content"] [role="grid"]')!
          .getBoundingClientRect()
        return { cell: cell.getBoundingClientRect().height, gridRight: grid.right, vw: innerWidth }
      })
      expect(geo.cell).toBeGreaterThanOrEqual(44)
      expect(geo.gridRight).toBeLessThanOrEqual(geo.vw)
      expect(await axeViolations(page)).toEqual([])
      await page.raw.tap(`${SHEET} button:has-text("Done")`)
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      expect(await page.raw.evaluate(() => document.activeElement?.getAttribute('data-slot'))).toBe(
        'date-picker',
      )
    })
  })

  describe('390 coarse: Dialog and Dock', () => {
    test('a Dialog that holds a form is a full-height sheet; a confirm stays centred', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap('[data-testid="us-dialog-confirm"] button')
      await page.raw.waitForSelector('[data-slot="dialog-content"]')
      await page.settle()
      const confirm = await page.raw.evaluate(() => {
        const r = document.querySelector('[data-slot="dialog-content"]')!.getBoundingClientRect()
        return { left: r.left, bottom: r.bottom, vh: innerHeight }
      })
      expect(confirm.left).toBeGreaterThan(0)
      expect(confirm.bottom).toBeLessThan(confirm.vh)
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector('[data-slot="dialog-content"]', { state: 'detached' })
      await page.raw.tap('[data-testid="us-dialog-form"] button')
      await page.raw.waitForSelector('[data-slot="dialog-content"]')
      await page.settle()
      const form = await page.raw.evaluate(() => {
        const el = document.querySelector('[data-slot="dialog-content"]')!
        const r = el.getBoundingClientRect()
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          vw: innerWidth,
          vh: innerHeight,
          present: el.getAttribute('data-present'),
        }
      })
      expect(form.present).toBe('sheet')
      expect(form.left).toBe(0)
      expect(form.right).toBe(form.vw)
      expect(form.bottom).toBeCloseTo(form.vh, 0)
      expect(form.top).toBeLessThan(form.vh * 0.1)
      expect(await axeViolations(page)).toEqual([])
    })

    test('a Dock with a short record opens at its content height, one with a tall record rests at half', async () => {
      const page = await open(PHONE, 'coarse')
      await page.raw.tap('[data-testid="us-dock"] button')
      await page.raw.waitForSelector(SHEET)
      await page.settle()
      const short = await page.raw.evaluate(() => {
        const r = document.querySelector('[data-slot="sheet-content"]')!.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, vh: innerHeight }
      })
      // the content fits the first snap, so it has no snap points: it hugs and its foot is the viewport's
      expect(short.top).toBeGreaterThan(short.vh * 0.6)
      expect(short.bottom).toBeCloseTo(short.vh, 0)
      expect(await axeViolations(page)).toEqual([])
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      expect(await focusSlot(page)).toBe('Open dock')

      await page.raw.tap('[data-testid="us-dock-tall"] button')
      await page.raw.waitForSelector(SHEET)
      await page.settle()
      const tall = await page.raw.evaluate(() => {
        const r = document.querySelector('[data-slot="sheet-content"]')!.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, vh: innerHeight }
      })
      expect(tall.top).toBeGreaterThan(tall.vh * 0.4)
      expect(tall.top).toBeLessThan(tall.vh * 0.6)
      // a snapped sheet is 90dvh tall and rests with its top at half, so its foot is past the viewport
      expect(tall.bottom).toBeGreaterThan(tall.vh)
      expect(await axeViolations(page)).toEqual([])
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector(SHEET, { state: 'detached' })
      expect(await focusSlot(page)).toBe('Open tall dock')
    })
  })

  describe('1440 fine: the anchored popup', () => {
    test('a Select opens the popup, no sheet', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.click(TRIGGER('us-select'))
      await page.raw.waitForSelector(CONTENT)
      expect(await count(page, SHEET)).toBe(0)
    })

    test('a Select inside a right Sheet is a popup on a desktop', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.click('[data-testid="us-nested"] button')
      await page.raw.waitForSelector(SHEET)
      await page.raw.click(`${SHEET} [data-slot="select-trigger"]`)
      await page.raw.waitForSelector(CONTENT)
      expect(await count(page, SHEET)).toBe(1)
    })

    test('present="sheet" forces a sheet on a desktop', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.click('[data-testid="us-sheet-menu"] button')
      await page.raw.waitForSelector(`${SHEET} [role="menuitem"]`)
      expect(await count(page, SHEET)).toBe(1)
    })

    test('a Dialog form is centred and a Dock is the side panel', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.click('[data-testid="us-dialog-form"] button')
      await page.raw.waitForSelector('[data-slot="dialog-content"]')
      await page.settle()
      const left = await page.raw.evaluate(
        () => document.querySelector('[data-slot="dialog-content"]')!.getBoundingClientRect().left,
      )
      expect(left).toBeGreaterThan(100)
      await page.raw.keyboard.press('Escape')
      await page.raw.waitForSelector('[data-slot="dialog-content"]', { state: 'detached' })
      await page.raw.click('[data-testid="us-dock"] button')
      await page.raw.waitForSelector('[data-slot="dock"]')
      expect(await count(page, SHEET)).toBe(0)
    })

    test('Menu, Combobox and DatePicker open their anchored popups', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.click('[data-testid="us-menu"] button')
      await page.raw.waitForSelector('[data-slot="menu-content"]')
      expect(await count(page, SHEET)).toBe(0)
      await page.raw.keyboard.press('Escape')
      await page.raw.click('[data-testid="us-combo"] input')
      await page.raw.waitForSelector('[data-slot="combobox-content"]')
      expect(await count(page, SHEET)).toBe(0)
      await page.raw.keyboard.press('Escape')
      await page.raw.click('[data-testid="us-date"] button')
      await page.raw.waitForSelector('[data-slot="popover-content"]')
      expect(await count(page, SHEET)).toBe(0)
    })
  })
})
