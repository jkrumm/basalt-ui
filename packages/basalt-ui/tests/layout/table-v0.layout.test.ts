/**
 * `DataTable` tiers and pager in real Chrome at 1440, 768, 390, 360 and 320 (docs/v3/issues/g1/
 * v3-table-t2b-tiers.json). Geometry jsdom cannot hold: no horizontal overflow outside the scroll
 * tier, equal head geometry across ready, loading and error, every column reachable at 390, the
 * card tier as the same DOM (no second tree), and axe per width.
 *
 * Self-contained like `cards-lists`: `fixture/table-v0.css` is compiled with the Tailwind CLI into a
 * temp directory, the tier sheet `src/table/table.css` is inlined beside it, and
 * `fixture/table-v0-fixture.tsx` is bundled in memory.
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
const PHONE_360: Viewport = { name: 'Android 360', width: 360, height: 780 }
const VIEWPORTS: Viewport[] = [DESKTOP_1440, TABLET_768, PHONE, PHONE_360, PHONE_SMALL]
const EMPTY_SPEC = { sections: [] } as FixtureSpec
const TOLERANCE = 0.5
const PHASES = ['ready', 'loading', 'error'] as const
/** Tables that never scroll sideways: every probe except `phone: 'scroll'`. */
const FITTING = [
  'tv0-8-ready',
  'tv0-8-loading',
  'tv0-8-error',
  'tv0-14',
  'tv0-long',
  'tv0-empty',
  'tv0-pages',
  'tv0-detail',
  'tv0-activate',
  'tv0-none',
  'tv0-always',
]

let documentPath = ''
let axeSource = ''
let scratch = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'table-v0-'))
  const cssOut = join(scratch, 'table-v0.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'table-v0.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`table-v0: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'table-v0-fixture.tsx')],
    target: 'browser',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  })
  if (!build.success)
    throw new Error(`table-v0: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()
  const tiers = readFileSync(
    join(import.meta.dirname, '..', '..', 'src', 'table', 'table.css'),
    'utf8',
  )

  documentPath = serveDocument(
    `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
      `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
      `<title>table-v0</title><style>${readFileSync(cssOut, 'utf8')}</style>` +
      `<style>${tiers}</style></head>` +
      `<body><div id="root"></div><script type="module">${inlineScript(js)}</script></body></html>`,
  )
  axeSource = readFileSync(join(REPO_ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, documentPath, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="tv0-8-ready"] [data-slot="table-root"]')
  await page.settle()
  await page.raw.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))))
  await page.settle()
  return page
}

const within = (id: string, selector: string): string => `[data-testid="${id}"] ${selector}`

layout('DataTable tiers and pager', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('the page has no sideways scroll', async () => {
        const page = await open(viewport)
        expectNoHorizontalOverflow(await page.horizontalOverflow(), 'the tables', viewport)
      })

      test('no table outside the scroll tier overflows its scroller', async () => {
        const page = await open(viewport)
        const wide = await page.raw.evaluate((ids) => {
          return ids.flatMap((id) => {
            const scroller = document.querySelector<HTMLElement>(
              `[data-testid="${id}"] [data-slot="table-scroller"]`,
            )
            return scroller !== null && scroller.scrollWidth > scroller.clientWidth + 1
              ? [`${id}: ${scroller.scrollWidth} > ${scroller.clientWidth}`]
              : []
          })
        }, FITTING)
        expect(wide).toEqual([])
      })

      test('the head has equal geometry across ready, loading and error', async () => {
        const page = await open(viewport)
        const heads = await page.raw.evaluate((phases) => {
          return phases.map((phase) =>
            [
              ...document.querySelectorAll<HTMLElement>(`[data-testid="tv0-8-${phase}"] thead th`),
            ].map((th) => {
              const r = th.getBoundingClientRect()
              return [Math.round(r.left), Math.round(r.width)]
            }),
          )
        }, PHASES)
        expect(heads[1]).toEqual(heads[0])
        expect(heads[2]).toEqual(heads[0])
        const widths = await page.raw.evaluate((phases) => {
          return phases.map(
            (phase) =>
              document
                .querySelector<HTMLElement>(`[data-testid="tv0-8-${phase}"] [data-slot="table"]`)
                ?.getBoundingClientRect().width ?? 0,
          )
        }, PHASES)
        for (const width of widths)
          expect(Math.abs(width - widths[0]!)).toBeLessThanOrEqual(TOLERANCE)
      })

      test('the card tier is the same DOM: one tbody, one row per record, no card tree', async () => {
        const page = await open(viewport)
        expect(await page.count('[data-slot="table-card"]')).toBe(0)
        expect(await page.count(within('tv0-8-ready', 'tbody'))).toBe(1)
        expect(await page.count(within('tv0-8-ready', 'tbody tr'))).toBe(12)
        expect(await page.count(within('tv0-8-ready', 'thead'))).toBe(1)
      })

      test('the pager names its page-size select and keeps the current size an option', async () => {
        const page = await open(viewport)
        const info = await page.raw.evaluate(() => {
          const select = document.querySelector<HTMLSelectElement>(
            '[data-testid="tv0-pages"] [data-slot="table-pager"] select',
          )
          return {
            label: select?.getAttribute('aria-label') ?? null,
            current: select?.value ?? null,
            options: [...(select?.options ?? [])].map((o) => o.value),
          }
        })
        expect(info.label).not.toBeNull()
        expect(info.options).toContain(info.current ?? '')
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
            .map(
              (v) =>
                `${v.id} (${v.impact}): ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`,
            )
        })
        expect(violations).toEqual([])
      })
    })
  }

  describe('tiers apply', () => {
    test('priority 3 hides when the width is under data-full-at and shows when it is not', async () => {
      const page = await open(DESKTOP_1440)
      const info = await page.raw.evaluate(() => {
        const read = (id: string) => {
          const root = document.querySelector(`[data-testid="${id}"] [data-slot="table-root"]`)!
          const td = root.querySelector('tbody tr td[data-priority="3"]')!
          return {
            fullAt: root.getAttribute('data-full-at'),
            width: root.getBoundingClientRect().width,
            display: getComputedStyle(td).display,
          }
        }
        return { wide: read('tv0-14'), narrow: read('tv0-8-ready') }
      })
      for (const { fullAt, width, display } of [info.wide, info.narrow]) {
        const hidden = fullAt === null || width < Number(fullAt)
        expect(display === 'none', `fullAt ${fullAt} at ${width}px`).toBe(hidden)
      }
      expect(info.wide.display).toBe('none')
    })

    test('at 390 rows are cards: cells are blocks and the head is clipped, not display none', async () => {
      const page = await open(PHONE)
      const info = await page.raw.evaluate(() => {
        const td = document.querySelector('[data-testid="tv0-8-ready"] tbody td')!
        const th = document.querySelector('[data-testid="tv0-8-ready"] thead')!
        return { cell: getComputedStyle(td).display, head: getComputedStyle(th).display }
      })
      expect(info.cell).toBe('block')
      expect(info.head).not.toBe('none')
    })

    test('a scroll table scrolls inside its scroller at 320 and the page stays put', async () => {
      const page = await open(PHONE_SMALL)
      const info = await page.raw.evaluate(() => {
        const el = document.querySelector<HTMLElement>(
          '[data-testid="tv0-scroll"] [data-slot="table-scroller"]',
        )!
        return { scroll: el.scrollWidth, client: el.clientWidth }
      })
      expect(info.scroll).toBeGreaterThan(info.client)
    })
  })

  describe('reachability at 390', () => {
    for (const id of ['tv0-detail', 'tv0-activate', 'tv0-none']) {
      test(`${id}: every column of a row is drawn and visible`, async () => {
        const page = await open(PHONE)
        const hidden = await page.raw.evaluate((probe) => {
          const row = document.querySelector(`[data-testid="${probe}"] tbody tr`)
          return [...(row?.querySelectorAll<HTMLElement>('td') ?? [])].flatMap((td, i) => {
            const r = td.getBoundingClientRect()
            return r.width > 0 && r.height > 0 ? [] : [`cell ${i}`]
          })
        }, id)
        expect(hidden).toEqual([])
      })
    }
  })
})
