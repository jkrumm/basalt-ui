/**
 * P5c (docs/v3/concepts/primitives-distribution.md section 4, rows 33, 34, 36): the `Toolbar`,
 * `Num` and `VirtualList` primitives in real Chrome at 1440, 768, 390 and 320, and the toolbar's
 * roving focus (shell-nav-router S9) at 1024x700. Asserted here because happy-dom has no geometry,
 * no real focus and no font features: the group is `role=group` at exactly the height of a `Button`,
 * the arrow keys cross a Select trigger, a Segmented and a Button, absent and non-finite figures
 * print a muted dash while a finite one has tabular numerals, 10 000 rows mount fewer than 60 nodes,
 * 100 rows prepended keep the focused row mounted, and axe finds nothing serious or critical.
 *
 * The page is self-contained: `fixture/ui-bar.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/ui-bar-fixture.tsx` is bundled in memory, both inlined into a document
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
const PHOTOS: Viewport = { name: 'photos', width: 1024, height: 700 }
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-bar-'))
  const cssOut = join(scratch, 'ui-bar.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync([cli, '--input', join(FIXTURE_DIR, 'ui-bar.css'), '--output', cssOut], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (css.exitCode !== 0) throw new Error(`ui-bar: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-bar-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-bar: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="de"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-bar</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
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
  await page.raw.waitForSelector('[data-testid="ui-vl"] [data-row]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  return page
}

const height = (page: LayoutPage, testid: string): Promise<number> =>
  page.raw.evaluate(
    (id) =>
      document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!.getBoundingClientRect().height,
    testid,
  )

/** What holds focus: its slot and its name, so a sequence reads as a path through the row. */
const focusPath = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return `${el?.getAttribute('data-slot') ?? el?.tagName}:${el?.getAttribute('aria-label') ?? el?.textContent?.trim()}`
  })

layout('Toolbar, Num and VirtualList', () => {
  describe('toolbar roving focus (S9) at 1024x700', () => {
    test('arrow keys cross a Button, a Select trigger, a Segmented and a Button', async () => {
      const page = await open(PHOTOS)
      await page.raw.focus('[data-testid="ui-bar-first"]')
      const path = [await focusPath(page)]
      for (let i = 0; i < 6; i += 1) {
        await page.raw.keyboard.press('ArrowRight')
        path.push(await focusPath(page))
      }
      expect(path).toEqual([
        'toolbar-button:Back',
        'toolbar-button:Fit',
        'toolbar-button:100%',
        'select-trigger:Range',
        'segmented-item:Grid',
        'segmented-item:List',
        'toolbar-button:Export',
      ])
      await page.raw.keyboard.press('ArrowLeft')
      expect(await focusPath(page)).toBe('segmented-item:List')
    })

    test('the row is one tab stop', async () => {
      const page = await open(PHOTOS)
      const stops = await page.raw.evaluate(
        () =>
          document.querySelectorAll(
            '[data-testid="ui-bar-toolbar"] [tabindex="0"], [data-testid="ui-bar-toolbar"] button:not([tabindex])',
          ).length,
      )
      expect(stops).toBeGreaterThan(0)
      await page.raw.focus('[data-testid="ui-bar-first"]')
      await page.raw.keyboard.press('Tab')
      expect(
        await page.raw.evaluate(() => document.activeElement?.closest('[role="toolbar"]')),
      ).toBeNull()
    })
  })

  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      for (const pointer of ['fine', 'coarse'] as const) {
        test(`the group is role=group at the height of a Button (${pointer} pointer)`, async () => {
          const page = await open(viewport, undefined, pointer)
          const role = await page.raw.evaluate(() =>
            document.querySelector('[data-testid="ui-bar-group"]')!.getAttribute('role'),
          )
          expect(role).toBe('group')
          const [group, button, toolbarButton] = await Promise.all([
            height(page, 'ui-bar-group'),
            height(page, 'ui-bar-plain'),
            height(page, 'ui-bar-first'),
          ])
          expect(group).toBe(button)
          expect(toolbarButton).toBe(button)
        })
      }

      test('the toolbar stays inside the page and wraps instead of overflowing', async () => {
        const page = await open(viewport)
        const info = await page.raw.evaluate(() => {
          const bar = document.querySelector<HTMLElement>('[data-testid="ui-bar-toolbar"]')!
          return {
            scroll: bar.scrollWidth,
            client: bar.clientWidth,
            page: document.documentElement.scrollWidth,
            inner: window.innerWidth,
          }
        })
        expect(info.scroll).toBeLessThanOrEqual(info.client)
        expect(info.page).toBeLessThanOrEqual(info.inner)
      })

      test('absent and non-finite figures print a muted dash; a finite one has tabular numerals', async () => {
        const page = await open(viewport)
        const figures = await page.raw.evaluate(() => {
          const read = (id: string) => {
            const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
            const style = getComputedStyle(el)
            return { text: el.textContent, color: style.color, numeric: style.fontVariantNumeric }
          }
          const body = getComputedStyle(document.body).color
          return {
            body,
            nul: read('ui-num-null'),
            nan: read('ui-num-nan'),
            inf: read('ui-num-inf'),
            finite: read('ui-num-finite'),
            tone: read('ui-num-tone'),
          }
        })
        for (const dash of [figures.nul, figures.nan, figures.inf]) {
          expect(dash.text).toBe('—')
          expect(dash.color).not.toBe(figures.body)
        }
        expect(figures.nul.color).toBe(figures.nan.color)
        expect(figures.finite.text).toBe('1.234,5')
        expect(figures.finite.numeric).toContain('tabular-nums')
        expect(figures.tone.text).toBe('-3')
        expect(figures.tone.color).not.toBe(figures.finite.color)
      })

      test('10 000 rows mount fewer than 60 row nodes and scroll through the spacer', async () => {
        const page = await open(viewport)
        const mounted = () => page.count('[data-testid="ui-vl"] [data-row]')
        expect(await mounted()).toBeLessThan(60)
        await page.raw.evaluate(() => {
          document.querySelector('[data-testid="ui-vl"]')!.scrollTop = 5000 * 32
        })
        await page.settle()
        const first = await page.raw.evaluate(() =>
          document.querySelector('[data-testid="ui-vl"] [data-row]')!.getAttribute('data-row'),
        )
        expect(await mounted()).toBeLessThan(60)
        expect(await mounted()).toBeGreaterThan(0)
        // 5000 rows down, minus the 100 ids that sit in front of r100: row r5100, less overscan.
        expect(Number(first!.slice(1))).toBeGreaterThan(5000)
        expect(Number(first!.slice(1))).toBeLessThan(5200)
      })

      test('prepending 100 rows keeps the focused row mounted and keyed by id', async () => {
        const page = await open(viewport)
        await page.raw.evaluate(() => {
          document.querySelector('[data-testid="ui-vl"]')!.scrollTop = 5000 * 32
        })
        await page.settle()
        const id = await page.raw.evaluate(() => {
          const el = document.querySelectorAll<HTMLElement>('[data-testid="ui-vl"] [data-row]')[4]!
          ;(el as unknown as { __mark: boolean }).__mark = true
          el.focus()
          return el.getAttribute('data-row')
        })
        await page.raw.evaluate(() =>
          (window as unknown as { uiBarPrepend: () => void }).uiBarPrepend(),
        )
        await page.settle()
        const after = await page.raw.evaluate((row) => {
          const el = document.querySelector<HTMLElement>(`[data-row="${row}"]`)
          return {
            same: (el as unknown as { __mark?: boolean } | null)?.__mark === true,
            focused: document.activeElement === el,
            rows: document.querySelectorAll('[data-testid="ui-vl"] [data-row]').length,
          }
        }, id)
        expect(after.same).toBe(true)
        expect(after.focused).toBe(true)
        expect(after.rows).toBeLessThan(60)
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
})
