/**
 * P3d (docs/v3/concepts/primitives-distribution.md section 4, rows 10-11): the `Slider` and
 * `Segmented` primitives in real Chrome at 1440, 768, 390 and 320. Asserted here because happy-dom
 * has no geometry, no focus movement on arrow keys and no pointer drag: the indicator sits under the
 * selected option and follows a click, ArrowRight and ArrowLeft move the selection in DOM order,
 * `multiple` draws no indicator, a drag fires `onValueChange` while moving and
 * `onValueCommitted` once on release, the value text is `1,5` in `de-DE`, the hit floor is 24 px
 * for a fine pointer and 44 px for a coarse one, nothing pushes the page sideways, and axe finds
 * nothing serious or critical in either colour scheme.
 *
 * The page is self-contained: `fixture/ui-range.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/ui-range-fixture.tsx` is bundled in memory, both inlined into a document
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

const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-range-'))
  const cssOut = join(scratch, 'ui-range.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-range.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`ui-range: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-range-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-range: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="de"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-range</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(
  viewport: Viewport,
  pointer: Pointer = 'fine',
  scheme?: 'dark',
): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-pill]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

const IN = (id: string, selector: string): string => `[data-testid="${id}"] ${selector}`
const ITEMS = (id: string): string => IN(id, '[data-slot="segmented-item"]')

const log = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate(() => document.querySelector('[data-testid="ur-log"]')!.textContent ?? '')

/** The pressed option's labels, in DOM order. */
const pressed = (page: LayoutPage, id: string): Promise<string[]> =>
  page.raw.evaluate(
    (sel) =>
      [...document.querySelectorAll(sel)]
        .filter((el) => el.getAttribute('aria-pressed') === 'true')
        .map((el) => el.textContent ?? ''),
    ITEMS(id),
  )

/** Where the indicator is drawn against the pressed option, in px. */
const indicatorGap = (page: LayoutPage, id: string): Promise<{ dx: number; dw: number } | null> =>
  page.raw.evaluate(
    ({ group, items }) => {
      const indicator = document.querySelector(`${group} [data-pill]`)
      const on = document.querySelector(`${items}[aria-pressed="true"]`)
      if (indicator === null || on === null) return null
      const a = indicator.getBoundingClientRect()
      const b = on.getBoundingClientRect()
      return { dx: a.left - b.left, dw: a.width - b.width }
    },
    { group: `[data-testid="${id}"]`, items: ITEMS(id) },
  )

/** The edge lengths of an element's hit box: its own rect unioned with its `::after`. */
const hitBox = (page: LayoutPage, selector: string): Promise<{ w: number; h: number }> =>
  page.raw.evaluate((sel) => {
    const el = document.querySelector(sel)!
    const own = el.getBoundingClientRect()
    const after = getComputedStyle(el, '::after')
    const w = Number.parseFloat(after.width)
    const h = Number.parseFloat(after.height)
    return {
      w: Math.max(own.width, Number.isFinite(w) ? w : 0),
      h: Math.max(own.height, Number.isFinite(h) ? h : 0),
    }
  }, selector)

type AxeResult = { violations: { id: string; impact: string; nodes: { html: string }[] }[] }

layout('Slider and Segmented', () => {
  for (const viewport of VIEWPORTS) {
    for (const pointer of POINTERS) {
      describe(`${viewport.name} ${viewport.width}, ${pointer} pointer`, () => {
        test('the indicator sits exactly under the selected option', async () => {
          const page = await open(viewport, pointer)
          for (const id of ['ur-seg', 'ur-seg-small', 'ur-seg-long']) {
            const gap = await indicatorGap(page, id)
            expect(gap, id).not.toBeNull()
            expect(Math.abs(gap!.dx), `${id} dx`).toBeLessThan(0.6)
            expect(Math.abs(gap!.dw), `${id} dw`).toBeLessThan(0.6)
          }
        })

        test('multiple draws no indicator and shows each pressed option', async () => {
          const page = await open(viewport, pointer)
          expect(await page.count(IN('ur-seg-multi', '[data-pill]'))).toBe(0)
          await page.raw.click(IN('ur-seg-multi', 'button:nth-of-type(2)'))
          expect(await pressed(page, 'ur-seg-multi')).toEqual(['Alpha', 'Beta'])
          const faces = await page.raw.evaluate(() =>
            [
              ...document.querySelectorAll('[data-testid="ur-seg-multi"] [aria-pressed="true"]'),
            ].map((el) => getComputedStyle(el).backgroundColor),
          )
          for (const face of faces) expect(face).not.toBe('rgba(0, 0, 0, 0)')
        })

        test('the hit box is 24 px for a fine pointer and 44 px for a coarse one', async () => {
          const page = await open(viewport, pointer)
          const floor = pointer === 'coarse' ? 44 : 24
          const probes = [
            IN('ur-seg', '[data-slot="segmented-item"]'),
            IN('ur-seg-small', '[data-slot="segmented-item"]'),
            IN('ur-slider', '[data-thumb]'),
            IN('ur-range', '[data-thumb]'),
          ]
          for (const sel of probes) {
            const box = await hitBox(page, sel)
            expect(box.h, `${sel} height`).toBeGreaterThanOrEqual(floor)
            expect(box.w, `${sel} width`).toBeGreaterThanOrEqual(floor)
          }
        })

        test('a long-label group and the sliders do not push the page sideways', async () => {
          const page = await open(viewport, pointer)
          const { scrollWidth, innerWidth } = await page.raw.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }))
          expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
        })

        test('the slider reads 1,5 in de-DE and a range has two named thumbs', async () => {
          const page = await open(viewport, pointer)
          const text = await page.raw.evaluate(() => ({
            single: document
              .querySelector('[data-testid="ur-slider"] input[type="range"]')!
              .getAttribute('aria-valuetext'),
            names: [
              ...document.querySelectorAll('[data-testid="ur-range"] input[type="range"]'),
            ].map((el) => el.getAttribute('aria-label')),
          }))
          expect(text.single).toBe('1,5')
          expect(text.names).toEqual(['Minimum', 'Maximum'])
        })

        for (const scheme of [undefined, 'dark'] as const) {
          test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}`, async () => {
            const page = await open(viewport, pointer, scheme)
            await page.raw.addScriptTag({ content: axeSource })
            const violations = await page.raw.evaluate(async () => {
              const axe = (window as unknown as { axe: { run: () => Promise<AxeResult> } }).axe
              const result = await axe.run()
              return result.violations
                .filter((v) => v.impact === 'serious' || v.impact === 'critical')
                .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html).join(' | ')}`)
            })
            expect(violations).toEqual([])
          })
        }
      })
    }
  }

  describe('keyboard and pointer, desktop fine pointer', () => {
    test('a click moves the selection and the indicator follows', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.click(IN('ur-seg', 'button:nth-of-type(3)'))
      await page.settle()
      expect(await pressed(page, 'ur-seg')).toEqual(['Month'])
      expect(await log(page)).toContain('picked:month')
      const gap = await indicatorGap(page, 'ur-seg')
      expect(Math.abs(gap!.dx)).toBeLessThan(0.6)
    })

    test('ArrowRight and ArrowLeft move the selection in DOM order', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus(`${ITEMS('ur-seg')}[aria-pressed="true"]`)
      await page.raw.keyboard.press('ArrowRight')
      expect(await pressed(page, 'ur-seg')).toEqual(['Week'])
      await page.raw.keyboard.press('ArrowRight')
      expect(await pressed(page, 'ur-seg')).toEqual(['Month'])
      await page.raw.keyboard.press('ArrowLeft')
      expect(await pressed(page, 'ur-seg')).toEqual(['Week'])
      await page.settle()
      expect(Math.abs((await indicatorGap(page, 'ur-seg'))!.dx)).toBeLessThan(0.6)
      expect(await log(page)).toContain('picked:week')
    })

    test('Tab into the group does not change the selection', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus(`${ITEMS('ur-seg')}[aria-pressed="true"]`)
      await page.raw.keyboard.press('Tab')
      await page.raw.keyboard.press('Shift+Tab')
      expect(await pressed(page, 'ur-seg')).toEqual(['Day'])
    })

    test('a drag fires onValueChange while moving and onValueCommitted once on release', async () => {
      const page = await open(DESKTOP_1440)
      const thumb = await page.raw.evaluate(() => {
        const r = document
          .querySelector('[data-testid="ur-slider"] [data-thumb]')!
          .getBoundingClientRect()
        const track = document
          .querySelector('[data-testid="ur-slider"] [data-slot="slider"]')!
          .getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: track.width }
      })
      await page.raw.mouse.move(thumb.x, thumb.y)
      await page.raw.mouse.down()
      await page.raw.mouse.move(thumb.x + thumb.width * 0.3, thumb.y, { steps: 12 })
      expect(await log(page)).toMatch(/changes:([2-9]|\d\d)/)
      expect(await log(page)).toContain('commits:0')
      await page.raw.mouse.up()
      await page.settle()
      expect(await log(page)).toContain('commits:1')
    })

    test('the arrow keys step a slider thumb', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus(IN('ur-slider', 'input[type="range"]'))
      await page.raw.keyboard.press('ArrowRight')
      const valuetext = await page.raw.evaluate(() =>
        document
          .querySelector('[data-testid="ur-slider"] input[type="range"]')!
          .getAttribute('aria-valuetext'),
      )
      expect(valuetext).toBe('2')
      expect(await log(page)).toContain('commits:1')
    })
  })
})
