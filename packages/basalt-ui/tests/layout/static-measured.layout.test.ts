/**
 * Parts that decide a layout from a size measured in the browser render it in the server HTML
 * (Issue 2603, from the Astro matrix): ArticleLayout, DataPanel, Resizable, VirtualList and Segmented
 * at 1440 and 390. The parts are rendered to a string, the HTML is measured in real Chrome with no
 * script (what an Astro page with no directive ships), then hydrated and measured again: the two
 * pictures must be one, and each part's static layout is asserted on its own terms.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openDocument,
} from './harness'
import type { LayoutPage, Viewport } from './harness'
import { Parts } from './fixture/static-measured-parts'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const FIXTURE_DIR = join(import.meta.dirname, 'fixture')
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..')
const VIEWPORTS: Viewport[] = [DESKTOP_1440, PHONE]
const TOLERANCE = 0.5

let scratch = ''
let staticDocument = ''
let hydratedDocument = ''

const inlineScript = (code: string): string => code.replaceAll('</script', '<\\/script')

beforeAll(async () => {
  if (!ready) return
  scratch = mkdtempSync(join(tmpdir(), 'static-measured-'))
  const cssOut = join(scratch, 'static-measured.generated.css')
  const cli = join(REPO_ROOT, 'node_modules', '.bin', 'tailwindcss')
  const css = Bun.spawnSync(
    [cli, '--input', join(FIXTURE_DIR, 'static-measured.css'), '--output', cssOut],
    { cwd: REPO_ROOT, stdout: 'pipe', stderr: 'pipe' },
  )
  if (css.exitCode !== 0)
    throw new Error(`static-measured: tailwind failed:\n${css.stderr.toString()}`)

  const build = await Bun.build({
    entrypoints: [join(FIXTURE_DIR, 'static-measured-fixture.tsx')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success)
    throw new Error(`static-measured: the fixture did not build:\n${build.logs.join('\n')}`)
  const js = await build.outputs[0]!.text()

  const html = renderToString(createElement(Parts))
  const head =
    '<!doctype html><html lang="en"><head><meta charset="utf-8" />' +
    '<meta name="viewport" content="width=device-width, initial-scale=1" />' +
    `<title>static-measured</title><style>${readFileSync(cssOut, 'utf8')}</style></head>`
  staticDocument = `${head}<body><div id="root">${html}</div></body></html>`
  hydratedDocument =
    `${head}<body><div id="root">${html}</div>` +
    '<script>window.staticMeasuredErrors = []</script>' +
    `<script type="module">${inlineScript(js)}</script></body></html>`
})

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

type Box = { w: number; h: number }
type Picture = {
  boxes: Record<'article' | 'panel' | 'resizable' | 'virtual' | 'segmented', Box>
  /** The rail and the trigger that take room, by the table of contents. */
  toc: { rail: boolean; trigger: boolean; railItems: number }
  panelWidths: number[]
  virtualRows: number
  /** The raised face: the pressed option's box. */
  face: { x: number; w: number } | null
  errors: string[]
}

/** What a page shows now: the boxes of each probe and the parts' own facts. */
const picture = (page: LayoutPage): Promise<Picture> =>
  page.raw.evaluate(() => {
    const rail = document.querySelector('nav[aria-label="On this page"]')
    const trigger = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === 'On this page',
    )
    const pressed = document.querySelector('[data-testid="segmented"] [aria-pressed="true"]')
    const track = document.querySelector('[data-testid="segmented"] [data-slot="segmented"]')!
    const at = pressed?.getBoundingClientRect()
    const from = track.getBoundingClientRect()
    return {
      boxes: Object.fromEntries(
        ['article', 'panel', 'resizable', 'virtual', 'segmented'].map((id) => {
          const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect()
          return [id, { w: r.width, h: r.height }]
        }),
      ) as Record<'article' | 'panel' | 'resizable' | 'virtual' | 'segmented', Box>,
      toc: {
        rail: rail instanceof HTMLElement && rail.offsetWidth > 0,
        trigger: trigger !== undefined && trigger.offsetWidth > 0,
        railItems: rail?.querySelectorAll('a').length ?? 0,
      },
      panelWidths: [...document.querySelectorAll('[data-testid="resizable"] [data-panel]')].map(
        (el) => el.getBoundingClientRect().width,
      ),
      virtualRows: document.querySelectorAll('[data-testid="virtual"] [data-row]').length,
      face: at === undefined ? null : { x: at.left - from.left, w: at.width },
      errors: (window as unknown as { staticMeasuredErrors?: string[] }).staticMeasuredErrors ?? [],
    }
  })

async function openStatic(viewport: Viewport): Promise<Picture> {
  const page = await openDocument(staticDocument, viewport)
  await page.settle()
  return picture(page)
}

async function openHydrated(viewport: Viewport): Promise<Picture> {
  const page = await openDocument(hydratedDocument, viewport)
  await page.raw.waitForFunction(
    () =>
      (window as unknown as { staticMeasuredHydrated?: boolean }).staticMeasuredHydrated === true,
  )
  await page.settle()
  return picture(page)
}

layout('measured layouts render statically', () => {
  for (const viewport of VIEWPORTS) {
    describe(`${viewport.name} ${viewport.width}`, () => {
      test('every part is the same size in the HTML as after hydration', async () => {
        const [before, after] = [await openStatic(viewport), await openHydrated(viewport)]
        expect(after.errors).toEqual([])
        for (const id of Object.keys(before.boxes) as (keyof Picture['boxes'])[]) {
          expect(Math.abs(before.boxes[id].w - after.boxes[id].w), `${id} width`).toBeLessThan(
            TOLERANCE,
          )
          expect(Math.abs(before.boxes[id].h - after.boxes[id].h), `${id} height`).toBeLessThan(
            TOLERANCE,
          )
        }
      })

      test('ArticleLayout: a container query picks the rail or the trigger, entries included', async () => {
        const [before, after] = [await openStatic(viewport), await openHydrated(viewport)]
        const wide = viewport.width >= 1200
        for (const pic of [before, after]) {
          expect(pic.toc.rail, 'rail').toBe(wide)
          expect(pic.toc.trigger, 'trigger').toBe(!wide)
        }
        if (wide) expect(before.toc.railItems).toBe(2)
      })

      test('DataPanel: a phone panel takes its height from the declared rows, not a measured width', async () => {
        const [before, after] = [await openStatic(viewport), await openHydrated(viewport)]
        expect(before.boxes.panel.h).toBeGreaterThan(0)
        expect(Math.abs(before.boxes.panel.h - after.boxes.panel.h)).toBeLessThan(TOLERANCE)
      })

      test('Resizable: the panels hold their default sizes in the HTML', async () => {
        const pic = await openStatic(viewport)
        const [list, detail] = pic.panelWidths as [number, number]
        expect(list / (list + detail)).toBeCloseTo(0.35, 1)
      })

      test('VirtualList: the first window is in the HTML', async () => {
        const [before, after] = [await openStatic(viewport), await openHydrated(viewport)]
        expect(before.virtualRows).toBeGreaterThan(5)
        expect(before.virtualRows).toBe(after.virtualRows)
      })

      test('Segmented: the selected option is raised in the HTML where it will be', async () => {
        const [before, after] = [await openStatic(viewport), await openHydrated(viewport)]
        expect(before.face).not.toBeNull()
        expect(Math.abs(before.face!.x - after.face!.x)).toBeLessThan(TOLERANCE)
        expect(Math.abs(before.face!.w - after.face!.w)).toBeLessThan(TOLERANCE)
      })
    })
  }
})
