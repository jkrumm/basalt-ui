/**
 * P5a (docs/v3/concepts/primitives-distribution.md section 4, rows 24-26 and 30): the `ScrollArea`,
 * `Separator`, `Skeleton`, `Spinner` and `Kbd` primitives in real Chrome at 1440, 768, 390 and 320.
 * Asserted here because happy-dom has no geometry and no animations: a skeleton is exactly the
 * height of the text it stands for (the skeleton floor, ported from the 2.x table), a spinner leaves
 * its line as tall as it was, nothing animates under `prefers-reduced-motion: reduce` and a
 * skeleton pulses without it, the scroller is a tab stop only while it scrolls (and can then be
 * scrolled from the keyboard), the separators are one hairline, and axe finds nothing serious or
 * critical.
 *
 * The page is self-contained: `fixture/ui-base.css` is compiled with the Tailwind CLI into a temp
 * directory and `fixture/ui-base-fixture.tsx` is bundled in memory, both inlined into a document
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
const EMPTY_SPEC = { sections: [] } as FixtureSpec

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ui-base-'))
  const cssOut = join(scratch, 'ui-base.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'ui-base.css'), '--output', cssOut],
    {
      cwd: REPO_ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  if (css.exitCode !== 0) throw new Error(`ui-base: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'ui-base-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`ui-base: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>ui-base</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(
  viewport: Viewport,
  motion: 'reduce' | 'no-preference' = 'reduce',
): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, motion, 'fine')
  await page.raw.waitForSelector('[data-slot="scroll-area"]')
  await page.settle()
  return page
}

const heightOf = (page: LayoutPage, id: string): Promise<number> =>
  page.raw.evaluate(
    (sel) => document.querySelector(`[data-testid="${sel}"]`)!.getBoundingClientRect().height,
    id,
  )

const tabindexOf = (page: LayoutPage, id: string): Promise<string | null> =>
  page.raw.getAttribute(`[data-testid="${id}"]`, 'tabindex')

layout('ScrollArea, Separator, Skeleton, Spinner and Kbd', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('a Skeleton box equals the height of the text it stands for', async () => {
        const page = await open(viewport)
        for (const size of ['sm', 'lg']) {
          const text = await heightOf(page, `ui-text-${size}`)
          const box = await heightOf(page, `ui-skel-${size}`)
          expect(box, `skeleton ${size}`).toBe(text)
        }
        expect(await heightOf(page, 'ui-skel-lg')).toBeGreaterThan(
          await heightOf(page, 'ui-skel-sm'),
        )
      })

      test('a Spinner leaves its line as tall as it was and is one line high', async () => {
        const page = await open(viewport)
        expect(await heightOf(page, 'ui-line-spin')).toBe(await heightOf(page, 'ui-line-plain'))
        expect(await heightOf(page, 'ui-spin')).toBe(await heightOf(page, 'ui-line-plain'))
      })

      test('the scroller is a tab stop only while it scrolls', async () => {
        const page = await open(viewport)
        expect(await tabindexOf(page, 'ui-scroll-fit')).toBeNull()
        expect(await tabindexOf(page, 'ui-scroll-long')).toBe('0')
        expect(await tabindexOf(page, 'ui-scroll-wide')).toBe('0')
        expect(await tabindexOf(page, 'ui-scroll-grow')).toBeNull()
      })

      test('a scroller that grows past its box becomes a tab stop', async () => {
        const page = await open(viewport)
        await page.raw.click('[data-testid="ui-grow"]')
        await page.raw.waitForFunction(
          () =>
            document.querySelector('[data-testid="ui-scroll-grow"]')?.getAttribute('tabindex') ===
            '0',
        )
        expect(await tabindexOf(page, 'ui-scroll-grow')).toBe('0')
      })

      test('the separators are one hairline and the vertical one fills its row', async () => {
        const page = await open(viewport)
        const h = await page.raw.evaluate(() => {
          const r = document.querySelector('[data-testid="ui-sep-h"]')!.getBoundingClientRect()
          return [r.width, r.height]
        })
        expect(h[1]).toBe(1)
        expect(h[0]).toBeGreaterThan(100)
        const v = await page.raw.evaluate(() => {
          const r = document.querySelector('[data-testid="ui-sep-v"]')!.getBoundingClientRect()
          const row = document.querySelector('[data-testid="ui-row"]')!.getBoundingClientRect()
          return { w: r.width, h: r.height, rowH: row.height }
        })
        expect(v.w).toBe(1)
        expect(v.h).toBe(v.rowH)
      })

      test('the page does not scroll sideways and the wide scroller keeps its own overflow', async () => {
        const page = await open(viewport)
        const { scrollWidth, innerWidth, wideScrolls } = await page.raw.evaluate(() => {
          const wide = document.querySelector<HTMLElement>('[data-testid="ui-scroll-wide"]')!
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            wideScrolls: wide.scrollWidth > wide.clientWidth,
          }
        })
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
        expect(wideScrolls).toBe(true)
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

  describe('motion, desktop', () => {
    const running = (page: LayoutPage): Promise<number> =>
      page.raw.evaluate(() =>
        [
          ...document.querySelectorAll(
            '[data-slot="skeleton"], [data-slot="spinner"], [data-slot="spinner"] svg',
          ),
        ].reduce((n, el) => n + el.getAnimations().length, 0),
      )

    test('no CSS animation runs under reduced motion', async () => {
      const page = await open(DESKTOP_1440, 'reduce')
      expect(await running(page)).toBe(0)
    })

    test('the same primitives do animate when motion is allowed', async () => {
      const page = await open(DESKTOP_1440, 'no-preference')
      expect(await running(page)).toBeGreaterThanOrEqual(3)
    })
  })

  describe('keyboard, desktop', () => {
    test('a focused scroller scrolls with the arrow keys and paints a solid outline', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus('[data-testid="ui-scroll-long"]')
      await page.raw.keyboard.press('Shift+Tab')
      await page.raw.keyboard.press('Tab')
      expect(await page.computed('[data-testid="ui-scroll-long"]', 'outline-style')).toBe('solid')
      await page.raw.keyboard.press('ArrowDown')
      await page.raw.keyboard.press('ArrowDown')
      await page.raw.waitForFunction(
        () => document.querySelector('[data-testid="ui-scroll-long"]')!.scrollTop > 0,
      )
    })

    test('tabbing skips a scroller that fits', async () => {
      const page = await open(DESKTOP_1440)
      await page.raw.focus('[data-testid="ui-scroll-long"]')
      await page.raw.keyboard.press('Shift+Tab')
      expect(
        await page.raw.evaluate(() => document.activeElement?.getAttribute('data-testid')),
      ).not.toBe('ui-scroll-fit')
    })
  })

  test('Mod prints a key cap and the Kbd has a hairline border', async () => {
    const page = await open(DESKTOP_1440)
    const text = await page.raw.evaluate(
      () => document.querySelector('[data-testid="ui-kbd-mod"]')!.textContent,
    )
    expect(['⌘', 'Ctrl']).toContain(text ?? '')
    expect(await page.computed('[data-testid="ui-kbd-key"]', 'border-top-width')).toBe('1px')
  })
})
