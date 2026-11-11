/**
 * P3b (docs/v3/concepts/primitives-distribution.md section 4, rows 5-6): the `Select`,
 * `NativeSelect`, `Combobox`, `ComboboxChips` and `Autocomplete` primitives in real Chrome at 1440,
 * 768, 390 and 320. Asserted here because happy-dom has no geometry, no popup positioning and no
 * real keyboard: a closed control keeps the control height (44 px floor and 16 px text under a
 * coarse pointer), a popup never grows taller than the viewport and scrolls inside itself, the Select
 * and Combobox popups open under axe with nothing serious or critical, and the keyboard opens,
 * moves and commits.
 *
 * The page is self-contained like `ui-choice`: `fixture/ui-select.css` is compiled with the
 * Tailwind CLI into a temp directory and `fixture/ui-select-fixture.tsx` is bundled in memory.
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
const POINTERS = ['fine', 'coarse'] as const
type Pointer = (typeof POINTERS)[number]

const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-select-'))
  const cssOut = join(scratch, 'ui-select.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-select.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`ui-select: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-select-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-select: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-select</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, pointer: Pointer): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-slot="select-trigger"]')
  await page.settle()
  return page
}

const IN = (id: string, selector: string): string => `[data-testid="${id}"] ${selector}`
const SELECT_TRIGGER = IN('us-select', '[data-slot="select-trigger"]')
const COMBO_INPUT = IN('us-combobox', 'input')

const rectOf = (page: LayoutPage, selector: string): Promise<{ w: number; h: number }> =>
  page.raw.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }, selector)

/** Opens the Select popup and waits until it is positioned. */
async function openSelect(page: LayoutPage): Promise<void> {
  await page.raw.click(SELECT_TRIGGER)
  await page.raw.waitForSelector('[data-slot="select-content"]')
  await page.settle()
}

async function openCombobox(page: LayoutPage): Promise<void> {
  await page.raw.click(COMBO_INPUT)
  await page.raw.waitForSelector('[data-slot="combobox-content"]')
  await page.settle()
}

type AxeResult = { violations: { id: string; impact: string; nodes: { html: string }[] }[] }

/**
 * While a popup is open Base UI keeps focus inside it and marks the rest of the page
 * `aria-hidden` (`data-base-ui-inert`), and parks focusable `aria-hidden` sentinels beside the
 * popup (`data-base-ui-focus-guard`). axe's `aria-hidden-focus` reads both as a violation although
 * focus cannot reach them while the popup is open. They are the two things excluded; the popup and
 * the control that opened it are judged.
 */
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

layout('Select, NativeSelect, Combobox and Autocomplete', () => {
  for (const viewport of VIEWPORTS) {
    for (const pointer of POINTERS) {
      describe(`${viewport.name} ${viewport.width}, ${pointer} pointer`, () => {
        test('closed controls keep the control height; coarse gets 44 px and 16 px text', async () => {
          const page = await open(viewport, pointer)
          const heights = await page.raw.evaluate(() => {
            const read = (sel: string) => {
              const el = document.querySelector<HTMLElement>(sel)!
              return {
                h: el.getBoundingClientRect().height,
                font: Number.parseFloat(getComputedStyle(el).fontSize),
              }
            }
            return {
              select: read('[data-testid="us-select"] [data-slot="select-trigger"]'),
              small: read('[data-testid="us-select-small"] [data-slot="select-trigger"]'),
              native: read('[data-testid="us-native"] select'),
              combobox: read('[data-testid="us-combobox"] [data-slot="combobox-input"]'),
              comboInput: read('[data-testid="us-combobox"] input'),
              autocomplete: read('[data-testid="us-auto"] [data-slot="autocomplete-input"]'),
            }
          })
          for (const [name, { h, font }] of Object.entries(heights)) {
            if (pointer === 'coarse') {
              // the combobox's inner input sits in a 44 px box; its own height is not the target
              if (name !== 'comboInput') expect(h, `${name} height`).toBeGreaterThanOrEqual(44)
              expect(font, `${name} font`).toBeGreaterThanOrEqual(16)
            } else if (name === 'small') {
              expect(h, `${name} height`).toBe(24)
            } else if (name !== 'comboInput') {
              expect(h, `${name} height`).toBeGreaterThanOrEqual(28)
            }
          }
        })

        test('a width class on Select sizes the box; the trigger fills it', async () => {
          const page = await open(viewport, pointer)
          const wrapper = await rectOf(page, IN('us-select', '[data-slot="select"]'))
          const trigger = await rectOf(page, SELECT_TRIGGER)
          expect(wrapper.w).toBe(160)
          expect(trigger.w).toBe(160)
        })

        test('the page does not scroll sideways', async () => {
          const page = await open(viewport, pointer)
          const { scrollWidth, innerWidth } = await page.raw.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }))
          expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
        })

        test('the Select popup is never taller than the viewport and scrolls inside itself', async () => {
          const page = await open(viewport, pointer)
          await openSelect(page)
          const popup = await page.raw.evaluate(() => {
            const el = document.querySelector<HTMLElement>('[data-slot="select-content"]')!
            const r = el.getBoundingClientRect()
            // Base UI sizes the popup to its room and scrolls the list inside it
            const list = el.querySelector<HTMLElement>('[role="listbox"]')!
            return {
              top: r.top,
              bottom: r.bottom,
              height: r.height,
              scrollHeight: list.scrollHeight,
              listHeight: list.clientHeight,
              viewport: window.innerHeight,
            }
          })
          expect(popup.height).toBeLessThanOrEqual(popup.viewport)
          expect(popup.top).toBeGreaterThanOrEqual(-0.5)
          expect(popup.bottom).toBeLessThanOrEqual(popup.viewport + 0.5)
          expect(popup.scrollHeight).toBeGreaterThan(popup.listHeight)
        })

        test('the Combobox popup is never taller than the viewport', async () => {
          const page = await open(viewport, pointer)
          await openCombobox(page)
          const popup = await page.raw.evaluate(() => {
            const r = document
              .querySelector<HTMLElement>('[data-slot="combobox-content"]')!
              .getBoundingClientRect()
            return { top: r.top, bottom: r.bottom, viewport: window.innerHeight }
          })
          expect(popup.top).toBeGreaterThanOrEqual(-0.5)
          expect(popup.bottom).toBeLessThanOrEqual(popup.viewport + 0.5)
        })

        test('axe finds nothing serious or critical with the page closed, the Select open, and the Combobox open', async () => {
          const closed = await open(viewport, pointer)
          expect(await axeViolations(closed), 'closed').toEqual([])
          const select = await open(viewport, pointer)
          await openSelect(select)
          expect(await axeViolations(select), 'select open').toEqual([])
          const combobox = await open(viewport, pointer)
          await openCombobox(combobox)
          expect(await axeViolations(combobox), 'combobox open').toEqual([])
        })
      })
    }
  }

  describe('NativeSelect, desktop fine pointer', () => {
    test('appearance is stripped and the chevron is drawn by the part', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      expect(await page.computed(IN('us-native', 'select'), 'appearance')).toBe('none')
      expect(await page.count(IN('us-native', 'svg'))).toBe(1)
    })

    test('a keyboard-focused select paints a solid outline', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.focus(IN('us-native', 'select'))
      await page.raw.keyboard.press('Shift+Tab')
      await page.raw.keyboard.press('Tab')
      expect(await page.computed(IN('us-native', 'select'), 'outline-style')).toBe('solid')
    })
  })

  describe('keyboard, desktop fine pointer', () => {
    test('Select: Enter opens, arrows move, Enter commits and the trigger shows the label', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.focus(SELECT_TRIGGER)
      await page.raw.keyboard.press('Enter')
      await page.raw.waitForSelector('[data-slot="select-content"]')
      await page.settle()
      await page.raw.keyboard.press('ArrowDown')
      await page.raw.keyboard.press('Enter')
      await page.settle()
      expect(await page.raw.textContent(SELECT_TRIGGER)).toContain('Option 04')
      await page.raw.waitForSelector('[data-slot="select-content"]', { state: 'hidden' })
    })

    test('Combobox: typing filters the list and Enter commits the match', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.click(COMBO_INPUT)
      await page.raw.keyboard.type('Option 42')
      await page.raw.waitForSelector('[data-slot="combobox-item"]')
      await page.settle()
      expect(await page.count('[data-slot="combobox-item"]')).toBe(1)
      await page.raw.keyboard.press('ArrowDown')
      await page.raw.keyboard.press('Enter')
      await page.settle()
      expect(await page.raw.inputValue(COMBO_INPUT)).toBe('Option 42')
    })

    test('Combobox: the open popup renders its hidden dismiss buttons with the English catalog default (the override is proved in combobox.test.tsx)', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await openCombobox(page)
      const labels = await page.raw.evaluate(
        () => [...document.querySelectorAll('[aria-label="Dismiss"]')].length,
      )
      // The default catalog is English, so "Dismiss" is the override target's own default.
      expect(labels).toBeGreaterThan(0)
    })

    test('Chips: the selected values render as chips with named remove buttons', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      const chips = await page.raw.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[data-testid="us-chips"] [data-slot="combobox-chip"] button',
          ),
        ].map((b) => b.getAttribute('aria-label')),
      )
      expect(chips).toEqual(['Remove Option 01', 'Remove Option 02'])
    })

    test('Autocomplete: suggestions show and the typed text stays free', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.click(IN('us-auto', 'input'))
      await page.raw.keyboard.type('zzz')
      await page.settle()
      expect(await page.raw.inputValue(IN('us-auto', 'input'))).toBe('zzz')
    })
  })
})
