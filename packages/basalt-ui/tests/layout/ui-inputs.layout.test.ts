/**
 * P3a (docs/v3/concepts/primitives-distribution.md section 4, rows 3, 4 and 8): the `Textarea`,
 * `NumberField` and `Checkbox` primitives in real Chrome at 1440, 768, 390 and 320, each under a
 * fine and a coarse pointer. Asserted here because happy-dom has no geometry, no `::after` and no
 * real keyboard: the hit target (the control unioned with its `::after` overlay) is 24 px fine and
 * 44 px coarse while the drawn checkbox keeps its size, neighbouring overlays never overlap, the
 * text inputs compute 16 px under a coarse pointer, the number field prints `1.234,5` in `de-DE`,
 * Space toggles a checkbox, ArrowUp steps the number, the focus ring is a solid outline, and axe
 * finds nothing serious or critical.
 *
 * The page is self-contained: `fixture/ui-inputs.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/ui-inputs-fixture.tsx` is bundled in memory, both inlined into a document
 * served beside the shared fixture, so no shared fixture file carries a line for this suite.
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

const FLOOR: Record<Pointer, number> = { fine: 24, coarse: 44 }
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-inputs-'))
  const cssOut = join(scratch, 'ui-inputs.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-inputs.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`ui-inputs: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-inputs-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-inputs: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-inputs</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, pointer: Pointer): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-slot="checkbox"]')
  await page.settle()
  return page
}

type Hit = { testid: string; drawn: [number, number]; hit: [number, number]; box: DOMRect }

/**
 * Every checkbox and every number-field stepper: the drawn size and the hit size, the rect unioned
 * with the `::after` overlay (a stepper has none, its own rect is its target).
 */
const hitsOf = (page: LayoutPage): Promise<Hit[]> =>
  page.raw.evaluate(() => {
    const targets = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-slot="checkbox"], [data-slot="number-field"] button',
      ),
    ]
    return targets.map((el) => {
      const rect = el.getBoundingClientRect()
      const after = getComputedStyle(el, '::after')
      const w = Number.parseFloat(after.width)
      const h = Number.parseFloat(after.height)
      const cx = rect.x + rect.width / 2
      const cy = rect.y + rect.height / 2
      const hw = Math.max(rect.width, Number.isNaN(w) ? 0 : w)
      const hh = Math.max(rect.height, Number.isNaN(h) ? 0 : h)
      const owner = el.closest<HTMLElement>('[data-testid]')
      return {
        testid:
          el.dataset['slot'] === 'checkbox'
            ? (el.dataset['testid'] ?? '')
            : `${owner?.dataset['testid'] ?? ''}:${el.getAttribute('aria-label') ?? ''}`,
        drawn: [rect.width, rect.height] as [number, number],
        hit: [hw, hh] as [number, number],
        box: new DOMRect(cx - hw / 2, cy - hh / 2, hw, hh),
      }
    })
  })

const checkedOf = (page: LayoutPage, id: string): Promise<string | null> =>
  page.raw.getAttribute(`[data-testid="${id}"]`, 'aria-checked')

const inputValue = (page: LayoutPage, id: string): Promise<string> =>
  page.raw.evaluate(
    (sel) => document.querySelector<HTMLInputElement>(`[data-testid="${sel}"] input`)?.value ?? '',
    id,
  )

layout('Textarea, NumberField and Checkbox', () => {
  for (const viewport of VIEWPORTS) {
    for (const pointer of POINTERS) {
      describe(`${viewport.name} ${viewport.width}, ${pointer} pointer`, () => {
        test('hit target is at least 24 px fine and 44 px coarse; a checkbox keeps its 16 px', async () => {
          const page = await open(viewport, pointer)
          const hits = await hitsOf(page)
          expect(hits.map((h) => h.testid)).toEqual([
            'ui-qty:Decrease',
            'ui-qty:Increase',
            'ui-qty-sm:Decrease',
            'ui-qty-sm:Increase',
            'ui-tag-ops',
            'ui-tag-team',
            'ui-tag-dev',
            'ui-agree',
            'ui-mixed',
            'ui-lock',
          ])
          for (const { testid, drawn, hit } of hits) {
            if (
              testid.startsWith('ui-tag') ||
              ['ui-agree', 'ui-mixed', 'ui-lock'].includes(testid)
            ) {
              expect(drawn, `${testid} drawn`).toEqual([16, 16])
            }
            expect(hit[0], `${testid} hit width`).toBeGreaterThanOrEqual(FLOOR[pointer])
            expect(hit[1], `${testid} hit height`).toBeGreaterThanOrEqual(FLOOR[pointer])
          }
        })

        test('no two checkbox hit areas overlap', async () => {
          const page = await open(viewport, pointer)
          const hits = (await hitsOf(page)).filter((h) => !h.testid.includes(':'))
          for (const [i, a] of hits.entries()) {
            for (const b of hits.slice(i + 1)) {
              const overlap =
                a.box.left < b.box.right - 0.5 &&
                b.box.left < a.box.right - 0.5 &&
                a.box.top < b.box.bottom - 0.5 &&
                b.box.top < a.box.bottom - 0.5
              expect(overlap, `${a.testid} overlaps ${b.testid}`).toBe(false)
            }
          }
        })

        test('the text inputs compute 16 px under a coarse pointer and keep the 44 px floor', async () => {
          const page = await open(viewport, pointer)
          const probes = await page.raw.evaluate(() =>
            [
              '[data-testid="ui-note"]',
              '[data-testid="ui-qty"] input',
              '[data-testid="ui-qty-sm"] input',
            ].map((sel) => {
              const el = document.querySelector<HTMLElement>(sel)!
              return {
                sel,
                fontSize: getComputedStyle(el).fontSize,
                height: (el.closest('[data-slot="number-field"]') ?? el).getBoundingClientRect()
                  .height,
              }
            }),
          )
          for (const { sel, fontSize, height } of probes) {
            if (pointer === 'coarse') {
              expect(fontSize, `${sel} font-size`).toBe('16px')
              expect(height, `${sel} height`).toBeGreaterThanOrEqual(44)
            } else {
              expect(Number.parseFloat(fontSize), `${sel} font-size`).toBeLessThan(16)
            }
          }
        })

        test('the number field prints 1.234,5 in de-DE', async () => {
          const page = await open(viewport, pointer)
          expect(await inputValue(page, 'ui-qty')).toBe('1.234,5')
          expect(await inputValue(page, 'ui-qty-sm')).toBe('1.234,5')
        })

        test('the page does not scroll sideways', async () => {
          const page = await open(viewport, pointer)
          const { scrollWidth, innerWidth } = await page.raw.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }))
          expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
        })

        test('axe finds nothing serious or critical', async () => {
          const page = await open(viewport, pointer)
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
  }

  describe('keyboard and pointer, desktop fine pointer', () => {
    test('Space toggles a checkbox and a disabled one is skipped', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.focus('[data-testid="ui-agree"]')
      expect(await checkedOf(page, 'ui-agree')).toBe('false')
      await page.raw.keyboard.press('Space')
      expect(await checkedOf(page, 'ui-agree')).toBe('true')
      await page.raw.keyboard.press('Space')
      expect(await checkedOf(page, 'ui-agree')).toBe('false')
      await page.raw.focus('[data-testid="ui-mixed"]')
      expect(await checkedOf(page, 'ui-mixed')).toBe('mixed')
      await page.raw.keyboard.press('Tab')
      expect(
        await page.raw.evaluate(() => document.activeElement?.getAttribute('data-testid')),
      ).not.toBe('ui-lock')
    })

    test('clicking a group checkbox leaves the others as they were', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.click('[data-testid="ui-tag-dev"]')
      expect(await checkedOf(page, 'ui-tag-dev')).toBe('true')
      expect(await checkedOf(page, 'ui-tag-team')).toBe('true')
      expect(await checkedOf(page, 'ui-tag-ops')).toBe('false')
    })

    test('ArrowUp steps the number and the text keeps its locale', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.focus('[data-testid="ui-qty"] input')
      await page.raw.keyboard.press('ArrowUp')
      expect(await inputValue(page, 'ui-qty')).toBe('1.235,5')
    })

    test('a keyboard-focused checkbox and number field paint a solid outline', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      await page.raw.focus('[data-testid="ui-agree"]')
      await page.raw.keyboard.press('Shift+Tab')
      await page.raw.keyboard.press('Tab')
      expect(await page.computed('[data-testid="ui-agree"]', 'outline-style')).toBe('solid')
      expect(await page.computed('[data-testid="ui-agree"]', 'outline-width')).toBe('2px')

      await page.raw.focus('[data-testid="ui-qty"] input')
      await page.raw.keyboard.press('Shift+Tab')
      await page.raw.keyboard.press('Tab')
      expect(await page.computed('[data-testid="ui-qty"]', 'outline-style')).toBe('solid')
      expect(await page.computed('[data-testid="ui-qty"]', 'outline-width')).toBe('2px')
    })
  })
})
