/**
 * `ui/tabs`, `ui/accordion` and `ui/collapsible` in a real browser (docs/v3/concepts/
 * primitives-distribution.md sections 12 and 13). One fixture, four viewports (1440, 768, 390, 320):
 * the page never scrolls sideways (a six-trigger list scrolls inside itself), every trigger meets
 * the 44 px floor under a coarse pointer, Tabs follow the keyboard model (ArrowRight and ArrowLeft
 * move focus in DOM order, a disabled tab stays reachable, Enter or Space activates), a `hiddenUntilFound`
 * panel opens when the browser searches it (`beforematch`), `keepMounted` keeps typed state, and
 * axe finds nothing serious or critical.
 *
 * The fixture is bundled here, not by the harness: the shared host builds `fixture/main.tsx`, which
 * mounts specs through `fixtures.tsx`, and this group owns neither. The bundle plus the compiled
 * Tailwind sheet are inlined into one document and served beside the host with `openDocument`.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
} from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_SMALL]
const HIT_FLOOR = 44

const escapeScript = (js: string): string => js.replaceAll('</script', '<\\/script')

/** The fixture bundle and its stylesheet as one self-contained document. */
async function buildDocument(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'basalt-ui-disclose-'))
  try {
    const build = await Bun.build({
      entrypoints: [new URL('./fixture/ui-disclose-fixture.tsx', import.meta.url).pathname],
      outdir: dir,
      naming: '[name].[ext]',
      target: 'browser',
      define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
    })
    if (!build.success) {
      throw new Error(`FAILED: the ui-disclose fixture did not build: ${build.logs.join('\n')}`)
    }
    const js = await Bun.file(join(dir, 'ui-disclose-fixture.js')).text()
    const css = await Bun.file(join(dir, 'ui-disclose-fixture.css')).text()
    return (
      '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      `<title>ui disclose</title><style>${css}</style></head>` +
      `<body><div id="root"></div><script type="module">${escapeScript(js)}</script></body></html>`
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const html = ready ? await buildDocument() : ''
const axeSource = await Bun.file(
  new URL('../../../../node_modules/axe-core/axe.min.js', import.meta.url).pathname,
).text()

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openDocument(html, viewport)
  await page.raw.waitForSelector('[data-testid="tabs-md"] [role="tab"]')
  await page.settle()
  return page
}

const tabSel = (box: string, name: string): string =>
  `[data-testid="${box}"] [role="tab"]:has-text("${name}")`

/** The name of the focused element, or an empty string. */
const focusedName = (page: LayoutPage): Promise<string> =>
  page.raw.evaluate(() => document.activeElement?.textContent ?? '')

type AxeViolation = { id: string; impact: string; nodes: { target: string[] }[] }

/** Serious and critical axe violations of the whole document, printed with their targets. */
async function axeSerious(page: LayoutPage): Promise<string[]> {
  await page.raw.addScriptTag({ content: axeSource })
  const violations = await page.raw.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: { run: (c: Document, o: object) => Promise<{ violations: unknown[] }> }
      }
    ).axe
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations
  })
  return (violations as AxeViolation[])
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
}

layout('ui disclosure group', () => {
  for (const viewport of VIEWPORTS) {
    describe(viewport.name, () => {
      test('the page does not scroll sideways', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(
          await page.horizontalOverflow(),
          'tabs, accordion and collapsible stay inside the viewport',
          viewport,
        )
      })

      test('the six-trigger list scrolls inside itself', async () => {
        const page = await open(viewport)
        const info = await page.raw.evaluate(() => {
          const list = document.querySelector('[data-testid="tabs-many"] [data-slot="tabs-list"]')
          return list ? { scrollWidth: list.scrollWidth, clientWidth: list.clientWidth } : null
        })
        expect(info).not.toBeNull()
        if (viewport.width <= 768) expect(info!.scrollWidth).toBeGreaterThan(info!.clientWidth)
        expect(info!.clientWidth).toBeLessThanOrEqual(viewport.width)
      })

      test('every trigger meets the 44 px floor under a coarse pointer', async () => {
        const page = await open(viewport)
        const heights = await page.raw.evaluate((sel) => {
          return [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect().height)
        }, '[data-slot="tabs-trigger"], [data-slot="accordion-trigger"]')
        expect(heights.length).toBeGreaterThan(8)
        for (const h of heights) expect(h).toBeGreaterThanOrEqual(HIT_FLOOR - 0.5)
      })

      test('ArrowRight and ArrowLeft move focus in DOM order, through the disabled tab', async () => {
        const page = await open(viewport)
        await page.raw.focus(tabSel('tabs-md', 'Overview'))
        await page.raw.keyboard.press('ArrowRight')
        expect(await focusedName(page)).toBe('Activity')
        await page.raw.keyboard.press('ArrowRight')
        expect(await focusedName(page)).toBe('Billing')
        await page.raw.keyboard.press('ArrowRight')
        expect(await focusedName(page)).toBe('Members')
        await page.raw.keyboard.press('ArrowLeft')
        expect(await focusedName(page)).toBe('Billing')
        // Focus moved without activating: Overview is still the selected tab.
        expect(await page.raw.getAttribute(tabSel('tabs-md', 'Overview'), 'aria-selected')).toBe(
          'true',
        )
      })

      for (const key of ['Enter', 'Space']) {
        test(`${key} activates the focused tab and shows its panel`, async () => {
          const page = await open(viewport)
          await page.raw.focus(tabSel('tabs-md', 'Overview'))
          await page.raw.keyboard.press('ArrowRight')
          await page.raw.keyboard.press(key)
          await page.settle()
          expect(await page.raw.getAttribute(tabSel('tabs-md', 'Activity'), 'aria-selected')).toBe(
            'true',
          )
          const panel = await page.raw.textContent('[data-testid="tabs-md"] [role="tabpanel"]')
          expect(panel).toBe('Activity panel')
        })
      }

      test('a hiddenUntilFound panel opens when the browser searches it', async () => {
        const page = await open(viewport)
        const panel = '[data-testid="accordion-found"] [data-slot="accordion-content"]'
        expect(await page.count(panel)).toBe(2)
        expect(await page.raw.getAttribute(`${panel} >> nth=1`, 'hidden')).toBe('until-found')
        // The browser fires `beforematch` on the panel that holds a find-in-page hit.
        await page.raw.evaluate((sel) => {
          document
            .querySelectorAll(sel)[1]
            ?.dispatchEvent(new Event('beforematch', { bubbles: true }))
        }, panel)
        await page.settle()
        const trigger =
          '[data-testid="accordion-found"] [data-slot="accordion-trigger"]:has-text("Returns")'
        expect(await page.raw.getAttribute(trigger, 'aria-expanded')).toBe('true')
        expect(await page.raw.getAttribute(`${panel} >> nth=1`, 'hidden')).toBeNull()
      })

      test('keepMounted keeps a typed value across a close (accordion and collapsible)', async () => {
        const page = await open(viewport)
        const cases = [
          ['accordion-keep', 'Delivery notes', 'Gate code'],
          ['collapsible-keep', 'Webhook secret', 'Secret'],
        ] as const
        for (const [box, trigger, label] of cases) {
          const input = `[data-testid="${box}"] input[aria-label="${label}"]`
          const button = `[data-testid="${box}"] button:has-text("${trigger}")`
          await page.raw.fill(input, 'persisted')
          await page.raw.click(button)
          await page.settle()
          expect(await page.raw.getAttribute(button, 'aria-expanded')).toBe('false')
          expect(await page.raw.inputValue(input, { timeout: 2000 })).toBe('persisted')
        }
      })

      test('axe: zero serious or critical on the fixture, closed and with every item open', async () => {
        const page = await open(viewport)
        expect(await axeSerious(page)).toEqual([])
        for (const trigger of await page.raw.$$(
          '[data-slot="accordion-trigger"][aria-expanded="false"]',
        )) {
          await trigger.click()
        }
        await page.raw.click('[data-testid="collapsible-found"] button')
        await page.settle()
        expect(await axeSerious(page)).toEqual([])
      })
    })
  }
})
