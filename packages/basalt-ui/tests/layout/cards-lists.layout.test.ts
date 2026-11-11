/**
 * `BarList` and `EventList` in real Chrome at 1440, 768, 390 and 320 (docs/v3/issues/g1/
 * v3-cards-2-lists.json). Geometry happy-dom cannot hold: one card height across the five phases
 * for each list, a scroller that is a keyboard stop only while it scrolls (and axe agrees), a
 * truncating label that never widens the card, a row that is a link only when it has an `href`, and
 * a page with no sideways scroll.
 *
 * The page is self-contained like `ui-status`: `fixture/cards-lists.css` is compiled with the
 * Tailwind CLI into a temp directory and `fixture/cards-lists-fixture.tsx` is bundled in memory, both
 * inlined into a document served beside the shared fixture.
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
const PHASES = ['ready', 'loading', 'stale', 'empty', 'error'] as const
const KINDS = ['bar', 'event'] as const
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TOLERANCE = 0.5

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'cards-lists-'))
  const cssOut = join(scratch, 'cards-lists.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'cards-lists.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`cards-lists: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'cards-lists-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`cards-lists: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>cards-lists</title><style>${readFileSync(cssOut, 'utf8')}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport, scheme?: 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-slot="bar-list"]')
  if (scheme === 'dark') {
    await page.raw.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  }
  await page.settle()
  // The scroller measures after paint; give the observer a frame.
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

const within = (id: string, selector: string): string => `[data-testid="${id}"] ${selector}`

layout('BarList and EventList', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      for (const kind of KINDS) {
        test(`${kind} list: card height is equal across ready, loading, stale, empty and error`, async () => {
          const page = await open(viewport)
          const heights: [string, number][] = []
          for (const phase of PHASES) {
            const { box } = await page.box(
              phase,
              within(`cl-${kind}-${phase}`, '[data-slot="card"]'),
            )
            heights.push([phase, box.height])
          }
          const first = heights[0]![1]
          for (const [phase, height] of heights) {
            expect(
              Math.abs(height - first),
              `${kind} ${phase} is ${height}px, ready is ${first}px`,
            ).toBeLessThanOrEqual(TOLERANCE)
          }
        })

        test(`${kind} list: every phase prints its own data-phase`, async () => {
          const page = await open(viewport)
          for (const phase of PHASES) {
            const printed = await page.raw.getAttribute(
              within(`cl-${kind}-${phase}`, '[data-slot="card-phase"]'),
              'data-phase',
            )
            expect(printed).toBe(phase)
          }
        })

        test(`${kind} list: the scroller is a keyboard stop only while it scrolls`, async () => {
          const page = await open(viewport)
          const long = within(`cl-${kind}-ready`, '[data-slot="list-scroll"]')
          const short = within(`cl-${kind}-short`, '[data-slot="list-scroll"]')
          const longInfo = await page.scroll(long)
          const shortInfo = await page.scroll(short)
          expect(longInfo.scrollHeight, 'the long list overflows').toBeGreaterThan(
            longInfo.clientHeight,
          )
          expect(shortInfo.scrollHeight, 'the short list fits').toBeLessThanOrEqual(
            shortInfo.clientHeight,
          )
          expect(await page.raw.getAttribute(long, 'tabindex')).toBe('0')
          expect(await page.raw.getAttribute(long, 'role')).toBe('region')
          expect(await page.raw.getAttribute(short, 'tabindex')).toBeNull()
          expect(await page.raw.getAttribute(short, 'role')).toBeNull()
        })
      }

      test('a long label truncates and never widens its card', async () => {
        const page = await open(viewport)
        const card = await page.box('card', within('cl-bar-ready', '[data-slot="card"]'))
        const label = await page.box(
          'label',
          within('cl-bar-ready', '[data-slot="bar-list-label"]'),
        )
        expect(label.box.right).toBeLessThanOrEqual(card.box.right + TOLERANCE)
        const truncated = await page.raw.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[data-slot="bar-list-label"]')].some(
            (el) => el.scrollWidth > el.clientWidth,
          ),
        )
        expect(truncated).toBe(true)
      })

      test('only a row with href is a link and only a row with onSelect is a button', async () => {
        const page = await open(viewport)
        expect(await page.count(within('cl-bar-link', 'a[data-slot="bar-list-target"]'))).toBe(1)
        expect(await page.count(within('cl-bar-link', 'button[data-slot="bar-list-target"]'))).toBe(
          1,
        )
        expect(await page.count(within('cl-bar-link', '[data-slot="bar-list-row"]'))).toBe(3)
        // A list whose rows carry neither has no link and no button in it.
        expect(await page.count(within('cl-bar-short', 'a'))).toBe(0)
        expect(await page.count(within('cl-bar-short', 'button'))).toBe(0)
      })

      test('the page has no sideways scroll', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the list cards', viewport)
      })

      for (const scheme of [undefined, 'dark'] as const) {
        test(`axe finds nothing serious or critical${scheme ? ` in ${scheme}` : ''}, scroller included`, async () => {
          const page = await open(viewport, scheme)
          await page.raw.addScriptTag({ content: axeSource })
          const violations = await page.raw.evaluate(async () => {
            const axe = (
              window as unknown as {
                axe: {
                  run: () => Promise<{
                    violations: {
                      id: string
                      impact: string
                      nodes: { html: string }[]
                    }[]
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
