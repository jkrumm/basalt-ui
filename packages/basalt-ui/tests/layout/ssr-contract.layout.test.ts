/**
 * The SSR-first contract in real Chrome (W10): the server HTML is painted BEFORE any script runs,
 * then the client bundle hydrates it. Nothing may move.
 *
 * The page is the same `App` on both sides (`ssr/app.tsx`). Phase 1 measures the boxes of the
 * server-rendered markup with no JS loaded; phase 2 loads `ssr/entry.tsx`, waits for `hydrateRoot`
 * to finish, and measures again. A `layout-shift` observer started after the first paint
 * (and after web fonts settle, so a font swap is not blamed on hydration) must sum to 0.
 *
 * Second law, same page: the `isLoading` table — the `<Suspense fallback>` of a streamed section —
 * reserves exactly the height of the table it stands in for (`skeletonRows` = the row count).
 *
 * Assertions are relations (equal boxes, zero shift), never pixels.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserServer, Page } from 'playwright-core'
import { CHART_PROBES, PROBES } from './ssr/probes'

const ENTRY = new URL('./ssr/entry.tsx', import.meta.url).pathname
const SERVER = new URL('./ssr/server.tsx', import.meta.url).pathname
const CLOSE_BUDGET_MS = 30_000

type Boxes = Record<string, { x: number; y: number; width: number; height: number }>
type Phase = { boxes: Boxes; cls: number }

async function boot(): Promise<{
  dir: string
  server: ReturnType<typeof Bun.serve>
  chrome: Browser
  process: BrowserServer
} | null> {
  const dir = await mkdtemp(join(tmpdir(), 'basalt-ssr-layout-'))
  const build = await Bun.build({
    entrypoints: [ENTRY],
    outdir: dir,
    naming: '[name].[ext]',
    target: 'browser',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!build.success) {
    for (const log of build.logs) {
      // oxlint-disable-next-line no-console -- silence on failure is the worst output for a gate
      console.error(String(log))
    }
    throw new Error('FAILED: the SSR layout entry did not build — bundler logs above.')
  }
  const ssr = await Bun.build({
    entrypoints: [SERVER],
    outdir: join(dir, 'server'),
    target: 'node',
    define: { 'process.env': JSON.stringify({ NODE_ENV: 'production' }) },
  })
  if (!ssr.success) throw new Error('FAILED: the SSR layout server bundle did not build.')
  const { renderApp } = (await import(join(dir, 'server', 'server.js'))) as {
    renderApp: () => string
  }
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<link rel="stylesheet" href="/entry.css"></head>' +
    `<body><div id="root">${renderApp()}</div></body></html>`
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/') return new Response(html, { headers: { 'content-type': 'text/html' } })
      const file = Bun.file(join(dir, path))
      if (!(await file.exists())) return new Response(null, { status: 404 })
      return new Response(file)
    },
  })
  try {
    const process = await chromium.launchServer({
      channel: 'chrome',
      chromiumSandbox: !Bun.env['CI'],
    })
    const chrome = await chromium.connect(process.wsEndpoint())
    return { dir, server, chrome, process }
  } catch (error) {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
    if (Bun.env['CI']) throw new Error('FAILED: no Google Chrome and CI is set.', { cause: error })
    // oxlint-disable-next-line no-console -- a skipped gate must announce itself
    console.warn('[layout] SKIPPED — no Google Chrome found (ssr-contract).')
    return null
  }
}

const booted = await boot()
const layout = booted ? describe : describe.skip

afterAll(async () => {
  if (!booted) return
  await booted.chrome.close()
  await booted.process.kill()
  booted.server.stop(true)
  await rm(booted.dir, { recursive: true, force: true })
}, CLOSE_BUDGET_MS)

const measure = (page: Page): Promise<Boxes> =>
  page.evaluate((probes) => {
    const out: Boxes = {}
    for (const name of probes) {
      const el = document.querySelector(`[data-probe="${name}"]`)
      if (!el) throw new Error(`LAYOUT: no element matched [data-probe="${name}"]`)
      const r = el.getBoundingClientRect()
      out[name] = { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    return out
  }, PROBES)

const frames = (page: Page): Promise<void> =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )

type Facts = {
  /** The painted svg's height beside its box's (the engine measures the box). */
  svgFill: Record<string, { box: number; svg: number }>
  /** `display` of each legend swatch kind, per probe that has a legend. */
  legend: Record<string, { dot: string; chip: string; row: string }>
  donut: { ringRight: number; legendLeft: number; legendTop: number; ringBottom: number }
  headerLegend: { titleBottom: number; legendTop: number; chartTop: number }
  /** Each Donut's ring (the element its box fills) against its box and painted svg. */
  rings: Record<string, { ringW: number; ringH: number; box: number; svg: number }>
  /** The header's top padding on a card in the narrow / wide band. */
  headerInset: number
  /** The chart root's width against the flex row it sits in. */
  flexRow: { root: number; row: number }
  /** A card with only a header legend: how many children it has, and whether legend precedes plot. */
  legendOnly: { children: number; legendFirst: boolean }
  /** `Heatmap matchHeight`: its parent's height against the box that fills it. */
  fill: { parent: number; frame: number; box: number }
  /** The short card's subtitle is folded (not rendered) — in the server HTML, by CSS. */
  shortSubtitleRendered: boolean
}
type Run = {
  server: Phase
  hydrated: Phase
  errors: string[]
  /** Geometry of the pre-hydration server paint, and of the hydrated page. */
  serverFacts: Facts
  facts: Facts
  /** The `[data-probe]` names the page rendered, in order. */
  probes: string[]
  shifts: string[]
}

const facts = (page: Page): Promise<Facts> =>
  page.evaluate(() => {
    const probe = (name: string): Element => {
      const el = document.querySelector(`[data-probe="${name}"]`)
      if (!el) throw new Error(`LAYOUT: no element matched [data-probe="${name}"]`)
      return el
    }
    const out: Facts = {
      svgFill: {},
      legend: {},
      donut: { ringRight: 0, legendLeft: 0, legendTop: 0, ringBottom: 0 },
      headerLegend: { titleBottom: 0, legendTop: 0, chartTop: 0 },
      shortSubtitleRendered: true,
      fill: { parent: 0, frame: 0, box: 0 },
      rings: {},
      headerInset: 0,
      flexRow: { root: 0, row: 0 },
      legendOnly: { children: 0, legendFirst: false },
    }
    for (const name of [
      'lines',
      'bars',
      'stacked-area',
      'band-strip',
      'heatmap',
      'heatmap-fill',
      'dual-panel',
      'mirrored-bars',
      'cartesian-chart',
      'lines-fixed-height',
      'lines-responsive-height',
    ]) {
      const svg = probe(name).querySelector('svg.ts-chart')
      const host = svg?.closest('.ts-chart-host')?.parentElement
      if (!svg || !host) throw new Error(`LAYOUT: no chart svg in ${name}`)
      out.svgFill[name] = {
        box: host.getBoundingClientRect().height,
        svg: svg.getBoundingClientRect().height,
      }
    }
    for (const name of ['lines', 'stacked-area', 'card-header-legend']) {
      const row = probe(name).querySelector('[data-basalt-chart-legend]')
      const dot = row?.querySelector('span[aria-hidden]')
      const chip = row?.querySelector('svg[aria-hidden], span[aria-hidden]:nth-of-type(2)')
      if (!row || !dot) throw new Error(`LAYOUT: no legend in ${name}`)
      out.legend[name] = {
        row: getComputedStyle(row).display,
        dot: getComputedStyle(dot).display,
        chip: chip ? getComputedStyle(chip).display : 'none',
      }
    }
    const donut = probe('donut')
    const ring = donut.querySelector('svg.ts-chart')!.getBoundingClientRect()
    const legend = donut.querySelector('[data-basalt-chart-legend]')!.getBoundingClientRect()
    out.donut = {
      ringRight: ring.right,
      legendLeft: legend.left,
      legendTop: legend.top,
      ringBottom: ring.bottom,
    }
    const card = probe('card-header-legend')
    out.headerLegend = {
      titleBottom: card.querySelector('h1, h2, h3, h4, [data-basalt-tier]')!.getBoundingClientRect()
        .bottom,
      legendTop: card.querySelector('[data-basalt-chart-legend]')!.getBoundingClientRect().top,
      chartTop: card.querySelector('svg.ts-chart')!.getBoundingClientRect().top,
    }
    for (const name of ['donut', 'donut-fixed', 'donut-responsive']) {
      const frame = probe(name).querySelector('[data-basalt-box]')
      const ring = frame?.parentElement
      const svg = probe(name).querySelector('svg.ts-chart')
      if (!frame?.firstElementChild || !ring || !svg) throw new Error(`LAYOUT: no ring in ${name}`)
      const r = ring.getBoundingClientRect()
      out.rings[name] = {
        ringW: r.width,
        ringH: r.height,
        box: frame.firstElementChild.getBoundingClientRect().height,
        svg: svg.getBoundingClientRect().height,
      }
    }
    const header = probe('card-header-legend').querySelector(
      '[data-basalt-chart-card]',
    )?.firstElementChild
    out.headerInset = Number.parseFloat(getComputedStyle(header!).paddingTop)
    const flexRoot = probe('lines-in-flex-row')
    out.flexRow = {
      root: flexRoot.querySelector('[data-basalt-chart]')!.getBoundingClientRect().width,
      row: flexRoot.firstElementChild!.getBoundingClientRect().width,
    }
    const only = probe('card-legend-only').querySelector('[data-basalt-chart-card]')!
    out.legendOnly = {
      children: only.children.length,
      legendFirst:
        (only
          .querySelector('[data-basalt-chart-legend]')
          ?.compareDocumentPosition(only.querySelector('.ts-chart-host')!) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING
          ? true
          : false,
    }
    const fillProbe = probe('heatmap-fill')
    const frame = fillProbe.querySelector('[data-basalt-box]')
    if (!frame?.parentElement || !frame.firstElementChild) throw new Error('LAYOUT: no fill box')
    out.fill = {
      // The probe's own wrapper: the 300px div `Heatmap` fills.
      parent: fillProbe.firstElementChild!.getBoundingClientRect().height,
      frame: frame.getBoundingClientRect().height,
      box: frame.firstElementChild.getBoundingClientRect().height,
    }
    const subtitle = [...probe('card-short-chart').querySelectorAll('*')].find(
      (el) => el.children.length === 0 && el.textContent === 'Short card subtitle',
    )
    out.shortSubtitleRendered = subtitle !== undefined && subtitle.getClientRects().length > 0
    return out
  })

/** Server paint → hydrate; the boxes either side and the layout-shift sum in between. */
async function run(width: number): Promise<Run> {
  const context = await booted!.chrome.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(booted!.server.url.origin + '/')
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
  const server = await measure(page)
  const serverFacts = await facts(page)
  const probes = await page.evaluate(() =>
    [...document.querySelectorAll('[data-probe]')].map((el) => el.getAttribute('data-probe') ?? ''),
  )
  await page.evaluate(() => {
    const w = window as unknown as { basaltCls: number; basaltShifts: string[] }
    w.basaltCls = 0
    w.basaltShifts = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number
          hadRecentInput: boolean
          sources: { node: Node | null }[]
        }
        if (shift.hadRecentInput) continue
        w.basaltCls += shift.value
        const named = shift.sources.map((source) => {
          const probe = (source.node as Element | null)?.closest?.('[data-probe]')
          return probe?.getAttribute('data-probe') ?? source.node?.nodeName ?? '?'
        })
        w.basaltShifts.push(`${shift.value.toFixed(4)} ${[...new Set(named)].join(',')}`)
      }
    }).observe({ type: 'layout-shift', buffered: false })
  })
  await page.addScriptTag({ type: 'module', url: '/entry.js' })
  await page.waitForFunction(
    () => (window as unknown as { basaltHydrated?: boolean }).basaltHydrated,
  )
  await frames(page)
  const hydrated = await measure(page)
  const { cls, errors, shifts } = await page.evaluate(() => ({
    cls: (window as unknown as { basaltCls: number }).basaltCls,
    errors: (window as unknown as { basaltHydrationErrors: string[] }).basaltHydrationErrors,
    shifts: (window as unknown as { basaltShifts: string[] }).basaltShifts,
  }))
  const measured = await facts(page)
  await context.close()
  return {
    server: { boxes: server, cls: 0 },
    hydrated: { boxes: hydrated, cls },
    errors,
    serverFacts,
    facts: measured,
    probes,
    shifts,
  }
}

const runs = new Map<number, Promise<Run>>()
const runAt = (width: number): Promise<Run> => {
  const cached = runs.get(width)
  if (cached) return cached
  const fresh = run(width)
  runs.set(width, fresh)
  return fresh
}

layout('SSR-first contract: hydration moves nothing', () => {
  for (const width of [1280, 390]) {
    describe(`${width}px`, () => {
      test('no hydration warning, every box survives hydration, CLS is 0', async () => {
        const { server, hydrated, errors, shifts } = await runAt(width)
        expect(errors).toEqual([])
        for (const name of PROBES) {
          expect({ name, box: hydrated.boxes[name] }).toEqual({ name, box: server.boxes[name] })
        }
        expect({ cls: hydrated.cls, shifts }).toEqual({ cls: 0, shifts: [] })
      }, 60_000)

      test('the page renders exactly the probes the test knows', async () => {
        const { probes } = await runAt(width)
        expect(probes.toSorted()).toEqual([...PROBES].toSorted())
      }, 60_000)

      // Geometry holds on the server paint (no script yet) and on the hydrated page alike.
      for (const phase of ['serverFacts', 'facts'] as const) {
        test(`${phase}: the engine fills the CSS-owned box, never a height of its own`, async () => {
          const f = (await runAt(width))[phase]
          expect(f.svgFill['lines-fixed-height']!.box).toBe(200)
          expect(f.svgFill['lines-responsive-height']!.box).toBe(width >= 800 ? 300 : 180)
          for (const [name, { box, svg }] of Object.entries(f.svgFill)) {
            expect({ name, delta: Math.abs(box - svg) <= 1 }).toEqual({ name, delta: true })
          }
        }, 60_000)

        test(`${phase}: each Donut ring holds its box, and is square beside the legend`, async () => {
          const { rings } = (await runAt(width))[phase]
          for (const [name, r] of Object.entries(rings)) {
            expect({
              name,
              fits: Math.abs(r.ringH - r.box) <= 1 && Math.abs(r.box - r.svg) <= 1,
            }).toEqual({
              name,
              fits: true,
            })
            if (width >= 480)
              expect({ name, square: Math.abs(r.ringW - r.ringH) <= 1 }).toEqual({
                name,
                square: true,
              })
          }
          // unstated is the 240 default, numeric is 200, responsive is base 150 / wide 260.
          if (width >= 800) {
            expect(rings['donut']!.ringH).toBe(240)
            expect(rings['donut-fixed']!.ringH).toBe(200)
            expect(rings['donut-responsive']!.ringH).toBe(260)
          }
        }, 60_000)

        test(`${phase}: Heatmap matchHeight fills its parent, frame and box`, async () => {
          const { fill } = (await runAt(width))[phase]
          expect(fill.parent).toBe(300)
          expect(fill.frame).toBe(fill.parent)
          expect(fill.box).toBe(fill.parent)
        }, 60_000)
      }

      test('the legend mode follows the width in CSS, in the server HTML', async () => {
        const { serverFacts, facts: hydratedFacts } = await runAt(width)
        for (const f of [serverFacts, hydratedFacts]) {
          for (const name of ['lines', 'stacked-area', 'card-header-legend']) {
            const mode = f.legend[name]!
            expect(mode.row).toBe('flex')
            if (width >= 480) {
              expect(mode.dot).toBe('none')
              expect(mode.chip).not.toBe('none')
            } else {
              expect(mode.dot).not.toBe('none')
              expect(mode.chip).toBe('none')
            }
          }
        }
      }, 60_000)

      test('the card header inset follows the card width, and the card is a container', async () => {
        const { serverFacts, facts: f } = await runAt(width)
        for (const inset of [serverFacts.headerInset, f.headerInset]) {
          // narrow (< 480): the trimmed 4px; wide: the card's own inset (11px at density 0).
          if (width >= 480) expect(inset).toBeGreaterThan(4)
          else expect(inset).toBe(4)
        }
      }, 60_000)

      test('a chart root fills a flex row instead of collapsing', async () => {
        const { serverFacts, facts: f } = await runAt(width)
        for (const r of [serverFacts.flexRow, f.flexRow]) {
          expect(r.root).toBeGreaterThan(100)
          expect(Math.abs(r.root - r.row)).toBeLessThanOrEqual(1)
        }
      }, 60_000)

      test('a card with only a header legend has no header row, legend before the plot', async () => {
        const { serverFacts, facts: f } = await runAt(width)
        for (const l of [serverFacts.legendOnly, f.legendOnly]) {
          expect(l).toEqual({ children: 1, legendFirst: true })
        }
      }, 60_000)

      test('the header legend sits under the header, above the plot', async () => {
        const { serverFacts, facts: f } = await runAt(width)
        for (const h of [serverFacts.headerLegend, f.headerLegend]) {
          expect(h.legendTop).toBeGreaterThanOrEqual(h.titleBottom)
          expect(h.chartTop).toBeGreaterThan(h.legendTop)
        }
      }, 60_000)

      test('a short card (stated chart height 120) folds its header in the server HTML', async () => {
        const { serverFacts, facts: f, server, hydrated } = await runAt(width)
        // At 1280 px the width fold is off, so only the height fold can hide the subtitle.
        expect(serverFacts.shortSubtitleRendered).toBe(false)
        expect(f.shortSubtitleRendered).toBe(false)
        expect(hydrated.boxes['card-short-chart']).toEqual(server.boxes['card-short-chart'])
      }, 60_000)

      test("the pending ChartCard reserves the loaded card's height", async () => {
        const { server } = await runAt(width)
        const loaded = server.boxes['card-loaded']!.height
        const fallback = server.boxes['card-fallback']!.height
        expect(Math.abs(fallback - loaded)).toBeLessThanOrEqual(1)
      }, 60_000)

      test("a pending chart reserves the loaded chart's height", async () => {
        const { server } = await runAt(width)
        const loaded = server.boxes['lines-no-legend']!.height
        const pending = server.boxes['lines-pending']!.height
        expect(Math.abs(pending - loaded)).toBeLessThanOrEqual(1)
      }, 60_000)

      // A state chart conceals its legend rather than removing it: nothing shifts on arrival.
      for (const [state, loaded] of [
        ['band-strip-pending', 'band-strip-loaded'],
        ['band-strip-error', 'band-strip-loaded'],
        ['band-strip-empty', 'band-strip-loaded'],
        ['mirrored-bars-pending', 'mirrored-bars-loaded'],
        ['heatmap-states-pending', 'heatmap-states-loaded'],
        ['lines-legend-pending', 'lines-legend-loaded'],
      ] as const)
        test(`${state} keeps ${loaded}'s height`, async () => {
          const { server } = await runAt(width)
          expect(
            Math.abs(server.boxes[state]!.height - server.boxes[loaded]!.height),
          ).toBeLessThanOrEqual(1)
        }, 60_000)

      test("the loading table reserves the loaded table's height", async () => {
        const { server } = await runAt(width)
        const loaded = server.boxes['table-loaded']!.height
        const fallback = server.boxes['table-fallback']!.height
        expect(Math.abs(fallback - loaded)).toBeLessThanOrEqual(1)
      }, 60_000)

      test('the unsized chart follows the height law, a stated height is exact', async () => {
        const { server } = await runAt(width)
        const w = server.boxes['lines-no-legend']!.width
        const law = w < 240 ? 0.5 : w < 480 ? 0.62 : w < 800 ? 0.5 : 0.4
        expect(server.boxes['lines-no-legend']!.height).toBeCloseTo(
          Math.min(Math.max(w * law, 160), 420),
          0,
        )
        expect(CHART_PROBES).toContain('lines-fixed-height')
      }, 60_000)
    })
  }

  test('1280px: the donut puts its legend beside the ring', async () => {
    const { serverFacts, facts: f } = await runAt(1280)
    for (const d of [serverFacts.donut, f.donut])
      expect(d.legendLeft).toBeGreaterThanOrEqual(d.ringRight)
  }, 60_000)

  test('390px: the donut stacks its legend under the ring', async () => {
    const { serverFacts, facts: f } = await runAt(390)
    for (const d of [serverFacts.donut, f.donut])
      expect(d.legendTop).toBeGreaterThanOrEqual(d.ringBottom)
  }, 60_000)

  test('a coarse pointer caps the box at 45svh, default and stated height alike', async () => {
    const context = await booted!.chrome.newContext({
      viewport: { width: 390, height: 360 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    await page.goto(booted!.server.url.origin + '/')
    await page.evaluate(() => document.fonts.ready)
    await frames(page)
    const boxes = await page.evaluate(() => {
      const box = (name: string): number =>
        document
          .querySelector(`[data-probe="${name}"] [data-basalt-box]`)!
          .firstElementChild!.getBoundingClientRect().height
      return {
        law: box('lines-no-legend'),
        stated: box('lines-tall'),
        viewport: window.innerHeight,
      }
    })
    await context.close()
    const cap = boxes.viewport * 0.45
    // The law gives 222 px at 358 px wide, the stated height 300: both exceed the 162 px cap.
    expect(boxes.law).toBeCloseTo(cap, 0)
    expect(boxes.stated).toBeCloseTo(cap, 0)
  }, 60_000)
})
