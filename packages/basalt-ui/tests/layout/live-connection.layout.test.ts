/**
 * P4 layout half (docs/v3/concepts/live-realtime.md sections 4.7 and 7): `ConnectionIndicator` and
 * `RefreshButton` in real Chrome at 1440, 768, 390 and 320. Asserted here because happy-dom has no
 * geometry: below 840 px the word is sr-only while each state keeps its own glyph shape, the hit
 * area lifts to 44 px on a coarse pointer, nothing scrolls sideways, paper hides the indicator and
 * prints when the data was taken, and axe finds nothing serious or critical with the popover open.
 *
 * The page is self-contained: `fixture/live-connection.css` is compiled with the Tailwind CLI into
 * a temp directory and `fixture/live-connection-fixture.tsx` is bundled in memory, both inlined
 * into a document served beside the shared fixture.
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
  scratch = mkdtempSync(join(tmpdir(), 'live-connection-'))
  const cssOut = join(scratch, 'live-connection.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'live-connection.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`live-connection: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'live-connection-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`live-connection: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>live-connection</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )

  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(
  viewport: Viewport,
  pointer: 'coarse' | 'fine' = 'coarse',
): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', pointer)
  await page.raw.waitForSelector('[data-testid="lc-live"] [data-trigger]')
  await page.settle()
  return page
}

const COMPACT_MAX = 840
const STATES = ['live', 'polling', 'reconnecting', 'offline', 'unauthorized'] as const

type WordProbe = {
  word: string
  visible: boolean
  width: number
  glyph: string | null
  shape: string
}

/** The word span of one indicator: its text, and whether it takes room on the page. */
const probeState = (page: LayoutPage, name: string): Promise<WordProbe> =>
  page.raw.evaluate((testid) => {
    const trigger = document.querySelector<HTMLElement>(`[data-testid="${testid}"] [data-trigger]`)!
    const word = trigger.querySelector<HTMLElement>('span')!
    const svg = trigger.querySelector('svg')!
    const box = word.getBoundingClientRect()
    return {
      word: word.textContent ?? '',
      visible: box.width > 2 && box.height > 2,
      width: box.width,
      glyph: svg.getAttribute('data-glyph'),
      shape: svg.innerHTML,
    }
  }, `lc-${name}`)

layout('ConnectionIndicator and RefreshButton', () => {
  for (const viewport of VIEWPORTS) {
    const compact = viewport.width < COMPACT_MAX
    describe(`${viewport.name} ${viewport.width}`, () => {
      test(`the word is ${compact ? 'sr-only' : 'on screen'} and each state keeps its own glyph`, async () => {
        const page = await open(viewport)
        const probes = await Promise.all(STATES.map((s) => probeState(page, s)))
        for (const probe of probes) {
          expect(probe.word.length).toBeGreaterThan(0)
          expect(probe.visible, `${probe.word} visible`).toBe(!compact)
        }
        expect(probes.map((p) => p.glyph)).toEqual(['dot', 'ring', 'dashed', 'slash', 'bang'])
        expect(new Set(probes.map((p) => p.shape)).size).toBe(STATES.length)
      })

      test('the hit area is 44 px on a coarse pointer and 24 px on a fine one', async () => {
        for (const pointer of ['coarse', 'fine'] as const) {
          const page = await open(viewport, pointer)
          const hit = await page.raw.evaluate(() => {
            const trigger = document.querySelector<HTMLElement>(
              '[data-testid="lc-live"] [data-trigger]',
            )!
            const after = getComputedStyle(trigger, '::after')
            return {
              minHeight: after.minHeight,
              height: trigger.getBoundingClientRect().height,
              target:
                document
                  .elementFromPoint(
                    trigger.getBoundingClientRect().left + 4,
                    trigger.getBoundingClientRect().top - 8,
                  )
                  ?.closest('[data-trigger]') !== null,
            }
          })
          expect(hit.minHeight).toBe(pointer === 'coarse' ? '44px' : '24px')
          expect(hit.height).toBe(24)
          expect(hit.target, `${pointer}: 8 px above the control still hits it`).toBe(
            pointer === 'coarse',
          )
        }
      })

      test('the live region carries the word of the state, politely', async () => {
        const page = await open(viewport)
        const regions = await page.raw.evaluate(() =>
          ['live', 'offline'].map((name) => {
            const region = document.querySelector<HTMLElement>(`[data-testid="lc-${name}"] output`)!
            const box = region.getBoundingClientRect()
            return { text: region.textContent, srOnly: box.width <= 1 && box.height <= 1 }
          }),
        )
        expect(regions).toEqual([
          { text: 'Live', srOnly: true },
          { text: 'Offline', srOnly: true },
        ])
      })

      test('the refresh button shows its label and age from 840 px, a short age below', async () => {
        const page = await open(viewport)
        const form = await page.raw.evaluate(() => {
          const button = document.querySelector<HTMLElement>(
            '[data-testid="lc-refresh-page"] [data-scope]',
          )!
          const visible = (el: Element | null) => {
            if (el === null) return false
            const box = el.getBoundingClientRect()
            return box.width > 2 && getComputedStyle(el).display !== 'none'
          }
          const ages = [...button.querySelectorAll('[data-slot="refresh-button-age"]')]
          return {
            label: visible(button.querySelectorAll('span')[0] ?? null),
            long: visible(ages.find((a) => !a.hasAttribute('data-age')) ?? null),
            short: visible(ages.find((a) => a.hasAttribute('data-age')) ?? null),
            height: button.getBoundingClientRect().height,
            global: document.querySelector<HTMLElement>('[data-testid="lc-refresh-global"] button')!
              .textContent,
          }
        })
        expect(form.label).toBe(!compact)
        expect(form.long).toBe(!compact)
        expect(form.short).toBe(compact)
        expect(form.global).toBe('')
      })

      test('the page does not scroll sideways', async () => {
        const page = await open(viewport)
        const { scrollWidth, innerWidth } = await page.raw.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }))
        expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
      })

      test('on paper the indicator and the button are gone and the data time is printed', async () => {
        const page = await open(viewport)
        await page.raw.emulateMedia({ media: 'print' })
        const paper = await page.raw.evaluate(() => {
          const shown = (selector: string) => {
            const el = document.querySelector<HTMLElement>(selector)
            return el !== null && getComputedStyle(el).display !== 'none'
          }
          return {
            indicator: shown('[data-testid="lc-live"] [data-slot="connection-indicator"]'),
            button: shown('[data-testid="lc-refresh-page"] [data-scope]'),
            line: shown('[data-testid="lc-refresh-page"] [data-slot="refresh-button-print"]'),
            text: document.querySelector(
              '[data-testid="lc-refresh-page"] [data-slot="refresh-button-print"]',
            )?.textContent,
          }
        })
        await page.raw.emulateMedia({ media: 'screen' })
        expect(paper).toMatchObject({ indicator: false, button: false, line: true })
        expect(paper.text).toStartWith('Updated ')
      })

      test('the popover opens from the glyph with the three rows', async () => {
        const page = await open(viewport)
        await page.raw.click('[data-testid="lc-open"] [data-trigger]')
        await page.raw.waitForSelector('[data-slot="connection-indicator-detail"]')
        const rows = await page.raw.evaluate(() => {
          const detail = document.querySelector('[data-slot="connection-indicator-detail"]')!
          const popup = detail
            .closest<HTMLElement>('[data-slot="popover-content"]')!
            .getBoundingClientRect()
          return {
            text: detail.textContent,
            inside: popup.left >= 0 && popup.right <= window.innerWidth,
          }
        })
        expect(rows.text).toContain('StreamConnected')
        expect(rows.text).toContain('Last event2 minutes ago')
        expect(rows.text).toContain('Data5 minutes ago')
        expect(rows.inside).toBe(true)
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical with the popover open${scheme ? ` in ${scheme}` : ''}`, async () => {
          const page = await open(viewport)
          if (scheme === 'dark') {
            await page.raw.evaluate(() =>
              document.documentElement.setAttribute('data-theme', 'dark'),
            )
          }
          await page.raw.click('[data-testid="lc-open"] [data-trigger]')
          await page.raw.waitForSelector('[data-slot="popover-content"]')
          await page.settle()
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
