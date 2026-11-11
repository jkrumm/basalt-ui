/**
 * P3c (docs/v3/concepts/primitives-distribution.md section 4, rows 7-9): the `RadioGroup` and
 * `Switch` primitives in real Chrome at 1440, 768, 390 and 320, each under a fine and a coarse
 * pointer. Asserted here because happy-dom has no geometry, no `::after` and no real keyboard:
 * the hit target (the control unioned with its `::after` overlay) is 24 px fine and 44 px coarse
 * while the drawn control keeps its size, neighbouring overlays never overlap, arrow keys move the
 * selection in DOM order, Space toggles the switch, the focus ring is a solid outline, and axe finds
 * nothing serious or critical.
 *
 * The page is self-contained: `fixture/ui-choice.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/ui-choice-fixture.tsx` is bundled in memory, both inlined into a document
 * served beside the shared fixture, so no shared fixture file carries a line for this suite.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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
  scratch = mkdtempSync(join(tmpdir(), 'ui-choice-'))
  const cssOut = join(scratch, 'ui-choice.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-choice.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`ui-choice: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-choice-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-choice: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-choice</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  // axe-core is a transitive dependency (through lighthouse); resolve it from there.
  const lighthouse = realpathSync(Bun.resolveSync('lighthouse/package.json', import.meta.dirname))
  axeSource = readFileSync(Bun.resolveSync('axe-core/axe.min.js', dirname(lighthouse)), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, pointer: Pointer): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-slot="radio"]')
  await page.settle()
  return page
}

type Hit = { testid: string; drawn: [number, number]; hit: [number, number]; box: DOMRect }

/** Every control's drawn size and its hit size: the rect unioned with the `::after` overlay. */
const hitsOf = (page: LayoutPage): Promise<Hit[]> =>
  page.raw.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-slot="radio"], [data-slot="switch"]')].map(
      (el) => {
        const rect = el.getBoundingClientRect()
        const after = getComputedStyle(el, '::after')
        const w = Number.parseFloat(after.width)
        const h = Number.parseFloat(after.height)
        const cx = rect.x + rect.width / 2
        const cy = rect.y + rect.height / 2
        const hw = Math.max(rect.width, Number.isNaN(w) ? 0 : w)
        const hh = Math.max(rect.height, Number.isNaN(h) ? 0 : h)
        return {
          testid: el.dataset['testid'] ?? '',
          drawn: [rect.width, rect.height] as [number, number],
          hit: [hw, hh] as [number, number],
          box: new DOMRect(cx - hw / 2, cy - hh / 2, hw, hh),
        }
      },
    ),
  )

const checkedRadio = (page: LayoutPage): Promise<string | null> =>
  page.raw.evaluate(
    () =>
      document
        .querySelector('[data-slot="radio"][aria-checked="true"]')
        ?.getAttribute('data-testid') ?? null,
  )

layout('RadioGroup and Switch', () => {
  for (const viewport of VIEWPORTS) {
    for (const pointer of POINTERS) {
      describe(`${viewport.name} ${viewport.width}, ${pointer} pointer`, () => {
        test('hit target is at least 24 px fine and 44 px coarse; the drawn control keeps its size', async () => {
          const page = await open(viewport, pointer)
          const hits = await hitsOf(page)
          expect(hits.map((h) => h.testid)).toEqual([
            'uc-radio-free',
            'uc-radio-team',
            'uc-radio-pro',
            'uc-switch-sync',
            'uc-switch-beta',
            'uc-switch-lock',
          ])
          for (const { testid, drawn, hit } of hits) {
            const radio = testid.startsWith('uc-radio')
            expect(drawn, `${testid} drawn`).toEqual(radio ? [16, 16] : [36, 20])
            expect(hit[0], `${testid} hit width`).toBeGreaterThanOrEqual(FLOOR[pointer])
            expect(hit[1], `${testid} hit height`).toBeGreaterThanOrEqual(FLOOR[pointer])
          }
        })

        test('no two hit areas overlap', async () => {
          const page = await open(viewport, pointer)
          const hits = await hitsOf(page)
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

  describe('keyboard, desktop fine pointer', () => {
    test('arrow keys move the selection in DOM order and wrap', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      expect(await checkedRadio(page)).toBe('uc-radio-team')
      await page.raw.keyboard.press('Tab') // the checked radio is the one tab stop
      const seen: (string | null)[] = []
      for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp']) {
        await page.raw.keyboard.press(key)
        seen.push(await checkedRadio(page))
      }
      expect(seen).toEqual(['uc-radio-pro', 'uc-radio-free', 'uc-radio-team', 'uc-radio-free'])
    })

    test('Space toggles the switch and a disabled one is skipped', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      const state = (id: string): Promise<string | null> =>
        page.raw.getAttribute(`[data-testid="${id}"]`, 'aria-checked')
      await page.raw.focus('[data-testid="uc-switch-beta"]')
      expect(await state('uc-switch-beta')).toBe('false')
      await page.raw.keyboard.press('Space')
      expect(await state('uc-switch-beta')).toBe('true')
      await page.raw.keyboard.press('Space')
      expect(await state('uc-switch-beta')).toBe('false')
      await page.raw.keyboard.press('Tab')
      expect(
        await page.raw.evaluate(() => document.activeElement?.getAttribute('data-testid')),
      ).not.toBe('uc-switch-lock')
    })

    test('a keyboard-focused radio and switch paint a solid outline', async () => {
      const page = await open(DESKTOP_1440, 'fine')
      for (const id of ['uc-radio-team', 'uc-switch-sync']) {
        await page.raw.focus(`[data-testid="${id}"]`)
        await page.raw.keyboard.press('Shift+Tab')
        await page.raw.keyboard.press('Tab')
        expect(await page.computed(`[data-testid="${id}"]`, 'outline-style'), id).toBe('solid')
        expect(await page.computed(`[data-testid="${id}"]`, 'outline-width'), id).toBe('2px')
      }
    })
  })
})
