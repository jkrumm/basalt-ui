/**
 * `ControlView` in real Chrome at 1440, 768, 390 and 320 (docs/v3/issues/g1/v3-ctl-4-control-view.
 * json): the override cue is text (not colour alone) in the pill, row and inline presentations and
 * Reset restores the global; every control of every kind stays inside its frame with no sideways
 * scroll; a coarse pointer gets a 44 px hit box on every interactive element; axe finds nothing
 * serious or critical.
 *
 * The page is self-contained like `cards-group`: `fixture/controls-view.css` is compiled with the
 * Tailwind CLI into a temp directory and `fixture/controls-view-fixture.tsx` is bundled in memory,
 * both inlined into a document served beside the shared fixture.
 *
 * Screenshots (1800x1200 and 390x844, dark and light) are written when `CONTROLS_VIEW_SHOTS` names a
 * directory; they are not part of the gate.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
  expectNoHorizontalOverflow,
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
const PRESENTATIONS = ['pill', 'row', 'inline'] as const
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const SHOTS = process.env['CONTROLS_VIEW_SHOTS']

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'controls-view-'))
  const cssOut = join(scratch, 'controls-view.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'controls-view.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`controls-view: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'controls-view-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`controls-view: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>controls-view</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(
  viewport: Viewport,
  scheme?: 'dark',
  pointer: 'fine' | 'coarse' = 'fine',
): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-testid="cv-kinds-row"] [data-slot="control-view"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    // The colour transition of every control runs for 150 ms after the scheme flips.
    await page.raw.waitForTimeout(300)
  }
  await page.settle()
  return page
}

const INTERACTIVE =
  'button, input:not([type="hidden"]), select, [role="switch"], [role="radio"], [role="combobox"], [role="checkbox"], [role="slider"]'

layout('ControlView', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('no horizontal overflow, and every frame holds its controls', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'ControlView', viewport)
        const wide = await page.raw.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-testid^="cv-"]')]
            .map((frame) => {
              const edge = frame.getBoundingClientRect().right
              const out = [...frame.querySelectorAll<HTMLElement>('*')].filter((el) => {
                const r = el.getBoundingClientRect()
                return r.width > 0 && r.right > edge + 0.5
              })
              return out.length === 0
                ? null
                : `${frame.dataset['testid']}: ${out
                    .slice(0, 3)
                    .map((el) => el.getAttribute('data-slot') ?? el.tagName)
                    .join(', ')}`
            })
            .filter((line) => line !== null),
        )
        expect(wide).toEqual([])
      })

      for (const presentation of PRESENTATIONS) {
        test(`${presentation}: an override says Local as text, and Reset restores the global`, async () => {
          const page = await open(viewport)
          const probe = `[data-testid="cv-${presentation}-override"]`
          const cue = await page.raw.evaluate((sel) => {
            const badge = document.querySelector<HTMLElement>(`${sel} [data-slot="override-badge"]`)
            const reset = document.querySelector<HTMLElement>(`${sel} [data-slot="override-reset"]`)
            if (!badge || !reset) return null
            const style = getComputedStyle(badge)
            return {
              text: badge.innerText,
              title: badge.title,
              visible: style.display !== 'none' && style.visibility === 'visible',
              resetName: reset.getAttribute('aria-label') ?? reset.innerText,
              value: document.querySelector(`${sel} [data-slot="select-value"]`)?.textContent,
              source: document
                .querySelector<HTMLElement>(`${sel} [data-slot="control-view"]`)
                ?.getAttribute('data-source'),
            }
          }, probe)
          expect(cue).not.toBeNull()
          expect(cue!.text).toBe('Local')
          expect(cue!.visible).toBe(true)
          expect(cue!.title).toBe('Overrides global: Last 24 hours')
          expect(cue!.resetName).toBe(
            presentation === 'row' ? 'Use global' : 'Reset Range to global',
          )
          expect(cue!.value).toBe('Last 7 days')
          expect(cue!.source).toBe('override')

          await page.raw.click(`${probe} [data-slot="override-reset"]`)
          await page.settle()
          const after = await page.raw.evaluate(
            (sel) => ({
              badge: document.querySelector(`${sel} [data-slot="override-badge"]`) !== null,
              reset: document.querySelector(`${sel} [data-slot="override-reset"]`) !== null,
              value: document.querySelector(`${sel} [data-slot="select-value"]`)?.textContent,
            }),
            probe,
          )
          expect(after).toEqual({ badge: false, reset: false, value: 'Last 24 hours' })
        })

        test(`${presentation}: a control that follows its global shows no cue`, async () => {
          const page = await open(viewport)
          const probe = `[data-testid="cv-${presentation}-bound"]`
          expect(await page.count(`${probe} [data-slot="override-badge"]`)).toBe(0)
          expect(await page.count(`${probe} [data-slot="override-reset"]`)).toBe(0)
        })
      }

      test('a coarse pointer gets a 44 px hit box on every interactive element', async () => {
        const page = await open(viewport, undefined, 'coarse')
        const { short, checked } = await page.raw.evaluate((selector) => {
          const HIT = 44
          const short: string[] = []
          let checked = 0
          for (const input of document.querySelectorAll<HTMLElement>(selector)) {
            // An input inside a number field or a chips box is judged by the box that takes the tap.
            const el =
              input instanceof HTMLInputElement
                ? (input.closest<HTMLElement>(
                    '[data-slot="number-field"], [data-slot="combobox-chips"]',
                  ) ?? input)
                : input
            const r = el.getBoundingClientRect()
            if (r.width < 4 || r.height < 4) continue
            const style = getComputedStyle(el)
            if (style.visibility === 'hidden' || style.pointerEvents === 'none') continue
            const after = getComputedStyle(el, '::after')
            const aw = parseFloat(after.width)
            const ah = parseFloat(after.height)
            const w = Math.max(r.width, Number.isNaN(aw) || after.content === 'none' ? 0 : aw)
            const h = Math.max(r.height, Number.isNaN(ah) || after.content === 'none' ? 0 : ah)
            checked++
            // A switch or checkbox is judged by height; its width may be the track.
            if (h + 0.5 < HIT || (w + 0.5 < HIT && el.getAttribute('role') !== 'switch'))
              short.push(
                `${el.tagName.toLowerCase()}[${el.getAttribute('data-slot') ?? ''}] "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}" ${w.toFixed(0)}x${h.toFixed(0)}`,
              )
          }
          return { short, checked }
        }, INTERACTIVE)
        expect(checked).toBeGreaterThan(20)
        expect(short).toEqual([])
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}`, async () => {
          const page = await open(viewport, scheme)
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
      }
    })
  }

  if (SHOTS !== undefined && SHOTS !== '') {
    describe('screenshots', () => {
      for (const [name, viewport] of [
        ['desktop', { name: 'shot', width: 1800, height: 1200 }],
        ['phone', { name: 'shot', width: 390, height: 844 }],
      ] as const) {
        for (const scheme of ['light', 'dark'] as const) {
          test(`${name} ${scheme}`, async () => {
            mkdirSync(SHOTS, { recursive: true })
            const page = await open(viewport, scheme === 'dark' ? 'dark' : undefined)
            await page.raw.screenshot({
              path: join(SHOTS, `controls-view-${name}-${scheme}.png`),
              fullPage: true,
            })
          })
        }
      }
    })
  }
})
