/**
 * `FilterSet({ specs })` in real Chrome at 1440, 768, 390 and 320
 * (docs/v3/issues/g1/v3-ctl-5-filterset.json): with long labels, eight filters and none, the row
 * never wraps and the page never scrolls sideways, `Filters (n)` reads the same on every surface, the
 * fold and the phone sheet open the row form (never a pill in a pill), an archived option is
 * disabled and not omitted, axe is clean with a surface open, and a coarse pointer gets a 44 px hit
 * box. A second document renders the probes on the server and hydrates them (S3): zero recoverable
 * errors and no sibling moves after the fold.
 *
 * The page is self-contained like `controls-home`: `fixture/controls-filter-set.css` is compiled with
 * the Tailwind CLI into a temp directory and the fixture entries are bundled in memory.
 *
 * Screenshots (1800x1200 and 390x844, dark and light) are written when `CONTROLS_FILTER_SET_SHOTS`
 * names a directory; they are not part of the gate.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FixtureSpec } from './fixture/spec'
import { Probe } from './fixture/controls-filter-set-probe'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  PHONE_SMALL,
  TABLET_768,
  closeLayoutSuite,
  expectNoHorizontalOverflow,
  initLayoutSuite,
  openDocument,
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
const SHOTS = process.env['CONTROLS_FILTER_SET_SHOTS']
const FRAMES = ['fs-8', 'fs-3', 'fs-w560', 'fs-bar'] as const

let documentPath = ''
let ssrHtml = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

async function bundle(entry: string): Promise<string> {
  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, entry)],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`controls-filter-set: ${entry} did not build:\n${build.logs.join('\n')}`)
  return build.outputs[0]!.text()
}

const shell = (body: string, css: string): string =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
  `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
  `<title>controls-filter-set</title><style>${css}</style></head><body>${body}</body></html>`

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'controls-filter-set-'))
  const cssOut = join(scratch, 'controls-filter-set.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'controls-filter-set.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`controls-filter-set: tailwind failed:\n${css.stderr.toString()}`)
  const styles = readFileSync(cssOut, 'utf8')

  const client = await bundle('controls-filter-set-fixture.tsx')
  documentPath = serveDocument(
    shell(`<div id="root"></div><script type="module">${inlineScript(client)}</script>`, styles),
  )

  // The server markup, then a classic script that records the siblings' boxes before the module
  // script hydrates (a classic inline script runs during parsing, the module afterwards).
  const record =
    `window.basaltBefore = Object.fromEntries(['fs-bar','fs-bar-after','fs-aside'].map((id) => {` +
    `const b = document.querySelector('[data-testid="' + id + '"]').getBoundingClientRect();` +
    `return [id, [b.left, b.top, b.width, b.height]] }))`
  ssrHtml = shell(
    `<div id="root">${renderToString(createElement(Probe))}</div>` +
      `<script>${record}</script>` +
      `<script type="module">${inlineScript(await bundle('controls-filter-set-ssr-fixture.tsx'))}</script>`,
    styles,
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
  await page.raw.waitForSelector('[data-testid="fs-8"] [data-slot="filter-set"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    // The colour transition of every control runs for 150 ms after the scheme flips.
    await page.raw.waitForTimeout(300)
  }
  await page.settle()
  return page
}

/** While a popup is open Base UI marks the rest inert and parks `aria-hidden` focus sentinels. */
const BASE_UI_FOCUS_MACHINERY = ['[data-base-ui-focus-guard]', '[data-base-ui-inert]']

/** Whether the phone button (and so the sheet) is what a frame shows at this width. */
const showsSheet = (page: LayoutPage, frame: string): Promise<boolean> =>
  page.raw.evaluate((sel) => {
    const row = document.querySelector<HTMLElement>(`${sel} [data-slot="filter-pills"]`)
    return row !== null && getComputedStyle(row).display === 'none'
  }, `[data-testid="${frame}"]`)

layout('FilterSet', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('no horizontal overflow, no wrap, nothing past its frame', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'FilterSet', viewport)
        const report = await page.raw.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-testid^="fs-"]')].map((frame) => {
            const edge = frame.getBoundingClientRect().right
            const out = [...frame.querySelectorAll<HTMLElement>('*')].filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 0 && r.right > edge + 0.5
            })
            const row = frame.querySelector<HTMLElement>('[data-slot="filter-pills"]')
            const shown =
              row === null || getComputedStyle(row).display === 'none'
                ? []
                : [...row.children].filter((c) => c.getBoundingClientRect().width > 0)
            const tops = new Set(shown.map((c) => Math.round(c.getBoundingClientRect().top)))
            return {
              id: frame.dataset['testid'],
              past: out.slice(0, 3).map((el) => el.getAttribute('data-slot') ?? el.tagName),
              lines: tops.size,
              clipped:
                row === null || shown.length === 0
                  ? 0
                  : shown.filter(
                      (c) =>
                        c.getBoundingClientRect().right > row.getBoundingClientRect().right + 0.5,
                    ).length,
            }
          }),
        )
        for (const frame of report) {
          expect(frame.past, `${frame.id} past its frame`).toEqual([])
          expect(frame.lines, `${frame.id} wraps`).toBeLessThanOrEqual(1)
          expect(frame.clipped, `${frame.id} has a pill the row clips`).toBe(0)
        }
      })

      test('no specs draws nothing', async () => {
        const page = await open(viewport)
        expect(await page.count('[data-testid="fs-0"] *')).toBe(0)
      })

      test('Filters (n) reads the same in every frame, whichever surface shows', async () => {
        const page = await open(viewport)
        const counts = await page.raw.evaluate(
          (frames) => {
            return frames.map(
              (id) =>
                document.querySelector(`[data-testid="${id}"] [data-slot="filter-count"]`)
                  ?.textContent,
            )
          },
          [...FRAMES],
        )
        expect(counts).toEqual(['Filters (3)', 'Filters (3)', 'Filters (3)', 'Filters (3)'])
      })

      test('a pill prints the value at its default and the filter names it', async () => {
        const page = await open(viewport)
        const pills = await page.raw.evaluate(() =>
          [
            ...document.querySelectorAll('[data-testid="fs-8"] [data-slot="filter-pill"] button'),
          ].map((b) => [b.textContent, b.getAttribute('aria-label')]),
        )
        expect(pills).toEqual([
          [
            'Staging deployment with preview data',
            'Environment of the deployment: Staging deployment with preview data',
          ],
          ['2 selected', 'Operating regions worldwide: 2 selected'],
          ['latency regression', 'Search the full text: latency regression'],
          ['Free', 'Subscription tier: Free'],
          ['20', 'Maximum rows per page: 20'],
          ['Live updates: On', 'Live updates: On'],
          ['Everything', 'View: Everything'],
          ['Most recent first', 'Sort order: Most recent first'],
        ])
      })

      test('the surface opens the row form; an archived option is disabled, not omitted', async () => {
        const page = await open(viewport)
        const frame = '[data-testid="fs-8"]'
        const sheet = await showsSheet(page, 'fs-8')
        if (sheet) {
          await page.raw.click(`${frame} [data-slot="filter-count"]`)
          await page.raw.waitForSelector('[data-slot="sheet-content"] [data-slot="control-view"]')
          const inside = await page.raw.evaluate(() => {
            const popup = document.querySelector('[data-slot="sheet-content"]')!
            return {
              pills: popup.querySelectorAll('[data-presentation="pill"], [data-slot="filter-pill"]')
                .length,
              rows: popup.querySelectorAll('[data-slot="control-view"][data-presentation="row"]')
                .length,
              reset: popup.querySelector<HTMLButtonElement>('[data-slot="filter-reset"]')?.disabled,
            }
          })
          expect(inside).toEqual({ pills: 0, rows: 8, reset: false })
        } else {
          await page.raw.click(`${frame} button[aria-label="Subscription tier: Free"]`)
          await page.raw.waitForSelector('[data-slot="popover-content"] [data-slot="control-view"]')
          const inside = await page.raw.evaluate(() => {
            const popup = document.querySelector('[data-slot="popover-content"]')!
            return {
              pills: popup.querySelectorAll('[data-presentation="pill"], [data-slot="filter-pill"]')
                .length,
              rows: popup.querySelectorAll('[data-slot="control-view"][data-presentation="row"]')
                .length,
            }
          })
          expect(inside).toEqual({ pills: 0, rows: 1 })
        }
        await page.raw.click(
          '[data-slot="sheet-content"] [data-slot="select-trigger"][aria-label="Subscription tier"], [data-slot="popover-content"] [data-slot="select-trigger"]',
        )
        await page.raw.waitForSelector('[data-slot="select-item"]')
        const items = await page.raw.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-slot="select-item"]')].map((el) => ({
            text: el.textContent,
            disabled: el.hasAttribute('data-disabled'),
          })),
        )
        expect(items.find((i) => i.text?.includes('Legacy plan'))).toEqual({
          text: expect.stringContaining('Legacy plan'),
          disabled: true,
        })
      })

      test('Reset all returns every active filter to its default', async () => {
        const page = await open(viewport)
        const frame = '[data-testid="fs-8"]'
        if (await showsSheet(page, 'fs-8')) {
          await page.raw.click(`${frame} [data-slot="filter-count"]`)
          await page.raw.waitForSelector('[data-slot="sheet-content"] [data-slot="filter-reset"]')
          await page.raw.click('[data-slot="sheet-content"] [data-slot="filter-reset"]')
        } else {
          // Desktop: the fold panel holds Reset all when something folded; otherwise every pill is
          // reachable and the census is judged through the sheet markup that stays in the DOM.
          const fold = await page.count(`${frame} [data-fold-trigger]`)
          if (fold === 0) return
          await page.raw.click(`${frame} [data-fold-trigger]`)
          await page.raw.waitForSelector('[data-slot="filter-fold"] [data-slot="filter-reset"]')
          await page.raw.click('[data-slot="filter-fold"] [data-slot="filter-reset"]')
        }
        await page.settle()
        const count = await page.raw.evaluate(
          (sel) => document.querySelector(`${sel} [data-slot="filter-count"]`)?.textContent,
          frame,
        )
        expect(count).toBe('Filters')
      })

      test('a folded pill opens as a row, and a select inside keeps the panel open', async () => {
        const page = await open(viewport)
        const frame = '[data-testid="fs-w560"]'
        if (await showsSheet(page, 'fs-w560')) return
        const split = await page.raw.evaluate((sel) => {
          const row = document.querySelector(`${sel} [data-slot="filter-pills"]`)!
          const visible = [...row.querySelectorAll('[data-fold-key]')].filter(
            (el) => !el.hasAttribute('hidden'),
          ).length
          const trigger = row.querySelector<HTMLElement>('[data-fold-trigger]')
          return { visible, total: 8, fold: trigger?.textContent ?? null }
        }, frame)
        expect(split.visible).toBeLessThan(8)
        expect(split.fold).toBe(`+${8 - split.visible}`)

        await page.raw.click(`${frame} [data-fold-trigger]`)
        await page.raw.waitForSelector('[data-slot="filter-fold"] [data-slot="control-view"]')
        const inside = await page.raw.evaluate(() => {
          const fold = document.querySelector('[data-slot="filter-fold"]')!
          return {
            pills: fold.querySelectorAll('[data-presentation="pill"], [data-slot="filter-pill"]')
              .length,
            rows: fold.querySelectorAll('[data-slot="control-view"][data-presentation="row"]')
              .length,
          }
        })
        expect(inside).toEqual({ pills: 0, rows: 8 - split.visible })

        // A nested portal must not read as an outside click: pick an option, the panel stays.
        await page.raw.click('[data-slot="filter-fold"] [data-slot="select-trigger"]')
        await page.raw.waitForSelector('[data-slot="select-item"]')
        await page.raw.click('[data-slot="select-item"]:nth-child(2)')
        await page.settle()
        expect(await page.count('[data-slot="filter-fold"]')).toBe(1)
      })

      test('a coarse pointer gets a 44 px hit box on every button', async () => {
        const page = await open(viewport, undefined, 'coarse')
        const { short, checked } = await page.raw.evaluate(() => {
          const short: string[] = []
          let checked = 0
          for (const el of document.querySelectorAll<HTMLElement>(
            '[data-testid^="fs-"] button, [data-testid^="fs-"] input',
          )) {
            const r = el.getBoundingClientRect()
            if (r.width < 4 || r.height < 4) continue
            // An input inside a number field or a chips box is judged by the box that takes the tap;
            // a small button by its `::after` hit area.
            const box =
              el.closest<HTMLElement>('[data-slot="number-field"], [data-slot="combobox-chips"]') ??
              el
            const after = getComputedStyle(box, '::after')
            const ah = parseFloat(after.height)
            const h = Math.max(
              box.getBoundingClientRect().height,
              Number.isNaN(ah) || after.content === 'none' ? 0 : ah,
            )
            checked++
            if (h + 0.5 < 44)
              short.push(`${el.getAttribute('aria-label') ?? el.textContent} ${h.toFixed(0)}`)
          }
          return { short, checked }
        })
        expect(checked).toBeGreaterThan(8)
        expect(short).toEqual([])
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical with the surface open${scheme ? ` in ${scheme}` : ''}`, async () => {
          const page = await open(viewport, scheme)
          const frame = '[data-testid="fs-8"]'
          if (await showsSheet(page, 'fs-8')) {
            await page.raw.click(`${frame} [data-slot="filter-count"]`)
            await page.raw.waitForSelector('[data-slot="sheet-content"] [data-slot="control-view"]')
          } else {
            await page.raw.click(`${frame} [data-slot="filter-pill"] button >> nth=0`)
            await page.raw.waitForSelector(
              '[data-slot="popover-content"] [data-slot="control-view"]',
            )
          }
          await page.raw.waitForTimeout(400)
          await page.raw.addScriptTag({ content: axeSource })
          const violations = await page.raw.evaluate(async (machinery) => {
            const axe = (
              window as unknown as {
                axe: {
                  run: (context: { exclude: string[][] }) => Promise<{
                    violations: { id: string; impact: string; nodes: { html: string }[] }[]
                  }>
                }
              }
            ).axe
            const result = await axe.run({ exclude: machinery.map((selector) => [selector]) })
            return result.violations
              .filter((v) => v.impact === 'serious' || v.impact === 'critical')
              .map(
                (v) =>
                  `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html.slice(0, 160)).join(' | ')}`,
              )
          }, BASE_UI_FOCUS_MACHINERY)
          expect(violations).toEqual([])
        })
      }

      test('in an aside home the set is stacked row forms', async () => {
        const page = await open(viewport)
        const aside = await page.raw.evaluate(() => {
          const frame = document.querySelector('[data-testid="fs-aside"]')!
          return {
            pills: frame.querySelectorAll('[data-slot="filter-pill"] button').length,
            rows: frame.querySelectorAll('[data-slot="control-view"][data-presentation="row"]')
              .length,
          }
        })
        // The `aside` fieldset itself has `filter-row`; the set inside draws no pill button.
        expect(aside).toEqual({ pills: 0, rows: 3 })
      })

      test('SSR then hydrate: no recoverable error and no sibling moves after the fold', async () => {
        const page = await openDocument(ssrHtml, viewport)
        await page.raw.waitForFunction(
          () => document.querySelector('[data-testid="fs-8"] [data-fold-key]') !== null,
        )
        await page.raw.waitForTimeout(600)
        await page.settle()
        const result = await page.raw.evaluate(() => {
          const w = window as unknown as {
            basaltBefore: Record<string, number[]>
            basaltHydration: { recoverable: string[]; errors: string[] }
          }
          const after = Object.fromEntries(
            Object.keys(w.basaltBefore).map((id) => {
              const b = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect()
              return [id, [b.left, b.top, b.width, b.height]]
            }),
          )
          return { before: w.basaltBefore, after, seen: w.basaltHydration }
        })
        expect(result.seen).toEqual({ recoverable: [], errors: [] })
        expect(result.after).toEqual(result.before)
        expectNoHorizontalOverflow(
          await page.horizontalOverflow(),
          'FilterSet (hydrated)',
          viewport,
        )
      })
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
              path: join(SHOTS, `controls-filter-set-${name}-${scheme}.png`),
              fullPage: true,
            })
          })
        }
      }
    })
  }
})
