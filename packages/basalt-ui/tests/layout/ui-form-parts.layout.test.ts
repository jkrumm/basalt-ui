/**
 * bench-form-parts: choice cards, the checkbox matrix, tag input, one-time code, swatch picker and
 * quick picks, in real Chrome at 1440 and 390, light and dark. Each part draws its states (selected,
 * invalid, disabled, focus, hover) with the border and the ring the spec names, never a fill alone;
 * nothing overflows the phone; the matrix moves cell by cell on the arrow keys; the code is six boxes
 * on one row; axe finds nothing serious or critical. Asserted here because happy-dom has no geometry
 * and no focus-visible.
 *
 * Self-contained like `ui-groups.layout.test.ts`: the fixture CSS is compiled with the Tailwind CLI and
 * the fixture bundled in memory, both inlined into one document.
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
const VIEWPORTS: Viewport[] = [DESKTOP_1440, PHONE]
const EMPTY_SPEC = { sections: [] } as FixtureSpec

const near = (got: number, want: number, label: string): void => {
  expect(Math.abs(got - want), `${label}: ${got} against ${want}`).toBeLessThan(0.6)
}

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-form-parts-'))
  const cssOut = join(scratch, 'ui-form-parts.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-form-parts.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`ui-form-parts: tailwind failed:\n${css.stderr.toString()}`)
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-form-parts-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-form-parts: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-form-parts</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme: 'light' | 'dark' = 'light'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="picks"] [role="radio"]')
  if (scheme === 'dark')
    await page.raw.evaluate(() => {
      document.documentElement.dataset['theme'] = 'dark'
    })
  await page.settle()
  return page
}

type Rect = {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

/** The drawn box of every element a selector finds inside a probe. */
const rectsOf = (page: LayoutPage, id: string, selector: string): Promise<Rect[]> =>
  page.raw.evaluate(
    ({ id, selector }) =>
      [...document.querySelectorAll<HTMLElement>(`[data-testid="${id}"] ${selector}`)].map((el) => {
        const r = el.getBoundingClientRect()
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        }
      }),
    { id, selector },
  )

/** A computed style of the first element a selector finds inside a probe. */
const styleOf = (page: LayoutPage, id: string, selector: string, prop: string): Promise<string> =>
  page.raw.evaluate(
    ({ id, selector, prop }) =>
      getComputedStyle(
        document.querySelector<HTMLElement>(`[data-testid="${id}"] ${selector}`)!,
      ).getPropertyValue(prop),
    { id, selector, prop },
  )

/** Moves focus by keyboard onto `selector`, so `:focus-visible` matches as it does for a user. */
async function keyboardFocus(page: LayoutPage, selector: string): Promise<void> {
  await page.raw.focus(selector)
  await page.raw.keyboard.press('Shift+Tab')
  await page.raw.keyboard.press('Tab')
}

layout('form parts', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('nothing makes the page scroll sideways', async () => {
        const page = await open(viewport)
        const [scroll, inner] = await page.raw.evaluate(() => [
          document.documentElement.scrollWidth,
          window.innerWidth,
        ])
        expect(scroll).toBeLessThanOrEqual(inner!)
      })

      for (const scheme of ['light', 'dark'] as const) {
        test(`${scheme}: a selected choice card is told by its border and ring, an invalid one by red`, async () => {
          const page = await open(viewport, scheme)
          const cards = await rectsOf(page, 'cards', '[data-slot="choice-card"]')
          expect(cards).toHaveLength(3)
          for (const card of cards) expect(card.height).toBeGreaterThanOrEqual(63.5)
          const card = (n: number): string => `[data-slot="choice-card"]:nth-of-type(${n})`
          const selected = await styleOf(page, 'cards', card(1), 'border-top-color')
          const plain = await styleOf(page, 'cards', card(2), 'border-top-color')
          expect(selected).not.toBe(plain)
          expect(await styleOf(page, 'cards', card(1), 'box-shadow')).not.toBe('none')
          expect(await styleOf(page, 'cards', card(2), 'box-shadow')).toBe('none')
          const invalid = await styleOf(page, 'cards-invalid', card(1), 'border-top-color')
          expect(invalid).not.toBe(plain)
          expect(Number(await styleOf(page, 'cards', card(3), 'opacity'))).toBeLessThan(1)
        })

        test(`${scheme}: a card shows hover and keyboard focus on the whole card`, async () => {
          const page = await open(viewport, scheme)
          const sel = '[data-testid="cards"] [data-slot="choice-card"]:nth-of-type(2)'
          const before = await page.raw.$eval(sel, (el) => getComputedStyle(el).backgroundColor)
          await page.raw.hover(sel)
          const after = await page.raw.$eval(sel, (el) => getComputedStyle(el).backgroundColor)
          expect(after).not.toBe(before)
          await keyboardFocus(page, '[data-testid="cards"] [role="radio"][aria-checked="true"]')
          const outline = await page.raw.$eval(
            '[data-testid="cards"] [data-slot="choice-card"]:nth-of-type(1)',
            (el) => getComputedStyle(el).outlineStyle,
          )
          expect(outline).toBe('solid')
        })
      }

      test('tiles wrap into a grid inside the page and keep their preview on top', async () => {
        const page = await open(viewport)
        const tiles = await rectsOf(page, 'tiles', '[data-slot="choice-card"]')
        expect(tiles).toHaveLength(3)
        for (const tile of tiles) {
          expect(tile.right).toBeLessThanOrEqual(viewport.width + 0.5)
          expect(tile.width).toBeGreaterThanOrEqual(140)
        }
        const rows = new Set(tiles.map((t) => Math.round(t.top)))
        expect(rows.size).toBe(viewport.width > 600 ? 1 : 2)
      })

      test('the matrix is a table with scoped headings that scrolls inside its frame', async () => {
        const page = await open(viewport)
        const shape = await page.raw.evaluate(() => {
          const table = document.querySelector('[data-testid="matrix"] table')!
          const frame = document.querySelector<HTMLElement>(
            '[data-testid="matrix"] [data-slot="checkbox-matrix"]',
          )!
          return {
            colHeads: table.querySelectorAll('th[scope="col"]').length,
            rowHeads: table.querySelectorAll('th[scope="row"]').length,
            boxes: table.querySelectorAll('[role="checkbox"]').length,
            frameFits: frame.getBoundingClientRect().right <= window.innerWidth + 0.5,
            // Four roles and the toggles read whole at 390: no column hides behind a sideways scroll.
            noScroll: frame.scrollWidth <= frame.clientWidth + 1,
          }
        })
        expect(shape.colHeads).toBe(6)
        expect(shape.rowHeads).toBe(3)
        expect(shape.boxes).toBe(3 * 4 + 3 + 4)
        expect(shape.frameFits).toBe(true)
        expect(shape.noScroll).toBe(true)
      })

      test('the matrix moves cell by cell on the arrow keys and skips a disabled cell', async () => {
        const page = await open(viewport)
        const cell = (r: number, c: number): string =>
          `[data-testid="matrix"] [data-matrix-row="${r}"][data-matrix-col="${c}"]`
        const at = (): Promise<string | undefined> =>
          page.raw.evaluate(() => {
            const el = document.activeElement as HTMLElement | null
            return `${el?.dataset['matrixRow']},${el?.dataset['matrixCol']}`
          })
        await page.raw.focus(cell(1, 0))
        await page.raw.keyboard.press('ArrowRight')
        expect(await at()).toBe('1,1')
        await page.raw.keyboard.press('ArrowDown')
        expect(await at()).toBe('2,1')
        await page.raw.keyboard.press('ArrowRight')
        await page.raw.keyboard.press('ArrowRight')
        // (2,3) is disabled: focus stays on (2,2), the last enabled cell of the row before the all-toggle.
        expect(await at()).toBe('2,4')
        await page.raw.keyboard.press('Space')
        expect(await page.raw.$eval(cell(2, 4), (el) => el.getAttribute('aria-checked'))).toBe(
          'true',
        )
      })

      test('an invalid matrix reddens every cell box', async () => {
        const page = await open(viewport)
        const plain = await styleOf(
          page,
          'matrix',
          '[role="checkbox"][aria-checked="false"]',
          'border-top-color',
        )
        const red = await styleOf(page, 'matrix-invalid', '[role="checkbox"]', 'border-top-color')
        expect(red).not.toBe(plain)
      })

      test('tag input: a field one control high that grows as chips wrap; an invalid chip is ringed', async () => {
        const page = await open(viewport)
        const [one] = await rectsOf(page, 'tags', '[data-slot="tag-input"]')
        const [many] = await rectsOf(page, 'tags-many', '[data-slot="tag-input"]')
        expect(one!.height).toBeGreaterThanOrEqual(29.5)
        expect(many!.height).toBeGreaterThan(one!.height)
        expect(many!.right).toBeLessThanOrEqual(viewport.width + 0.5)
        const chips = '[data-chip]'
        const ok = await styleOf(page, 'tags', `${chips}:not([data-invalid])`, 'box-shadow')
        const bad = await styleOf(page, 'tags', `${chips}[data-invalid]`, 'box-shadow')
        expect(bad).not.toBe(ok)
        expect(await styleOf(page, 'tags', '[data-slot="tag-input"]', 'border-top-color')).not.toBe(
          await styleOf(page, 'tags-many', '[data-slot="tag-input"]', 'border-top-color'),
        )
      })

      test('one-time code: six boxes on one row, 40 by 44, red when invalid', async () => {
        const page = await open(viewport)
        const boxes = await rectsOf(
          page,
          'otp',
          'input:not([type="hidden"]):not([aria-hidden="true"])',
        )
        expect(boxes).toHaveLength(6)
        for (const box of boxes) {
          near(box.width, 40, 'box width')
          near(box.height, 44, 'box height')
          near(box.top, boxes[0]!.top, 'one row')
          expect(box.right).toBeLessThanOrEqual(viewport.width + 0.5)
        }
        const input = 'input:not([type="hidden"]):not([aria-hidden="true"])'
        expect(await styleOf(page, 'otp-invalid', input, 'border-top-color')).not.toBe(
          await styleOf(page, 'otp', input, 'border-top-color'),
        )
        expect(
          await styleOf(page, 'otp', input, 'font-size'),
          'the box text is 16 px: iOS Safari zooms the page on focus below that',
        ).toBe('16px')
      })

      test('swatches: 28 px discs, the picked one set off by a ring; the menu opens the grid', async () => {
        const page = await open(viewport)
        const discs = await rectsOf(page, 'swatch', '[role="radio"]')
        expect(discs).toHaveLength(8)
        for (const disc of discs) {
          near(disc.width, 28, 'swatch width')
          near(disc.height, 28, 'swatch height')
        }
        const picked = '[role="radio"][data-checked]'
        expect(await styleOf(page, 'swatch', picked, 'box-shadow')).not.toBe('none')
        expect(
          await styleOf(page, 'swatch', '[role="radio"]:not([data-checked])', 'box-shadow'),
        ).toBe('none')
        await page.raw.click('[data-testid="swatch-menu"] button')
        await page.raw.waitForSelector('[role="radiogroup"][aria-label="Label color"]')
        const inside = await page.raw.evaluate(() => {
          const r = document
            .querySelector('[role="radiogroup"][aria-label="Label color"]')!
            .getBoundingClientRect()
          return r.left >= 0 && r.right <= window.innerWidth
        })
        expect(inside).toBe(true)
      })

      test('quick picks: 24 px pills, the picked one filled, wrapping inside the page', async () => {
        const page = await open(viewport)
        const pills = await rectsOf(page, 'picks', '[role="radio"]')
        expect(pills).toHaveLength(4)
        for (const pill of pills) {
          near(pill.height, 24, 'pill height')
          expect(pill.right).toBeLessThanOrEqual(viewport.width + 0.5)
        }
        const pill = '[role="radio"]'
        expect(await styleOf(page, 'picks', `${pill}[data-checked]`, 'background-color')).not.toBe(
          await styleOf(page, 'picks', `${pill}:not([data-checked])`, 'background-color'),
        )
      })

      test('axe finds nothing serious or critical', async () => {
        const page = await open(viewport)
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
    })
  }
})
