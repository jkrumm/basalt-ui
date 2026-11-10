/**
 * Spike shell-frame (docs/v3/concepts/shell-nav-router.md section 6: S1, S6, S8). Throwaway harness, no tests.
 *
 * One fixture (fixture/app.tsx, plain React + Tailwind 4) in real Chrome:
 *
 *   S1  five views x three viewports (1800x1200 @1x and @2x, 390x844 @3x). A rAF probe samples, every frame, the
 *       band's top in Main's coordinates, every other sticky element (table head, day header, sticky column) against
 *       band bottom + its gap, and the aside header bottom minus the band bottom. Passes: a scripted wheel scroll down
 *       and up, anchor jumps and a cold `#hash` load (argo), a reload with restored scroll (probe armed from document
 *       start), and a window resize sweep. `offsetFlicker` = any sampled frame off its sticky offset by more than 0.5 px.
 *   S6  shutterflow's header cluster (3 badges, 2 actions, job progress) at window 1024, 1200, 1440, rail expanded and
 *       collapsed (6 cells), plus a 1024..1500 sweep as information. Items are checked visible-in-row or listed in the kebab.
 *   S8  shutterflow viewer, 320 px aside, dock="always" at window 900, 1024, 1200, rail expanded and collapsed (6 cells).
 *       resizeLagMs: from the in-page `resize` event until Main's width has held its final value for 3 frames.
 *
 * Prints ONE JSON object on stdout and exits 0 (0 = the harness ran, not "hypothesis held"). Progress goes to stderr.
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext, Page } from 'playwright-core'

const ROOT = import.meta.dir
const SHOTS = resolve(ROOT, 'shots')
const BUILD = resolve(ROOT, '.build')
const FLICKER_PX = 0.5
const SEAM_PX = 1
const MAIN_MIN_PX = 480
const LAG_MAX_MS = 100
const WINDOW_H = 720

const log = (msg: string): void => {
  process.stderr.write(`${msg}\n`)
}
const r2 = (n: number): number => Math.round(n * 100) / 100
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))
const maxAbs = (xs: number[]): number => xs.reduce((m, x) => Math.max(m, Math.abs(x)), 0)

// ── In-page probe, installed on every document before it runs ────────────────────────────────

type Frame = {
  t: number
  st: number
  band: number
  bh: number
  seam: number | null
  stk: (number | null)[]
}
type ProbeResult = { frames: Frame[]; kinds: string[]; paintSeams: number[] }
type ProbeApi = { start: (opts?: { sticky?: boolean }) => void; stop: () => ProbeResult }

function installProbe(): void {
  const w = window as unknown as { __probe: ProbeApi }
  const q = (s: string): Element | null => document.querySelector(s)
  const state = {
    paintSeams: [] as number[],
    observed: null as Element | null,
    running: false,
    sticky: false,
    frames: [] as Frame[],
    kinds: [] as string[],
    els: [] as Element[],
    nat: [] as number[],
    bottom: [] as number[],
    gap: [] as number[],
  }
  const frame = (t: number): void => {
    if (!state.running) return
    const main = q('[data-slot=shell-main]')
    const band = q('[data-slot=page-bar]')
    if (main && band) {
      // A ResizeObserver on the band runs after layout and before paint: the seam read there is the seam that paints.
      if (state.observed !== band) {
        state.observed = band
        new ResizeObserver(() => {
          const ah = q('[data-slot=shell-aside-header]')
          if (state.running && ah && ah.getClientRects().length > 0)
            state.paintSeams.push(
              ah.getBoundingClientRect().bottom - band.getBoundingClientRect().bottom,
            )
        }).observe(band)
      }
      const m = main.getBoundingClientRect()
      const b = band.getBoundingClientRect()
      const ah = q('[data-slot=shell-aside-header]')
      const seam =
        ah && ah.getClientRects().length > 0 ? ah.getBoundingClientRect().bottom - b.bottom : null
      const st = main.scrollTop
      const stk = state.els.map((el, i) => {
        const r = el.getBoundingClientRect()
        const expected = b.bottom - m.top + (state.gap[i] ?? 0)
        const nat = state.nat[i] ?? 0
        const bottom = state.bottom[i] ?? 0
        const stuck = nat - st <= expected && bottom - st - r.height >= expected
        return stuck ? r.top - m.top - expected : null
      })
      state.frames.push({ t, st, band: b.top - m.top, bh: b.height, seam, stk })
    }
    requestAnimationFrame(frame)
  }
  w.__probe = {
    start: (opts) => {
      state.sticky = Boolean(opts?.sticky)
      state.frames = []
      state.paintSeams = []
      state.els = []
      state.kinds = []
      if (state.sticky) {
        const main = q('[data-slot=shell-main]')
        const m = main?.getBoundingClientRect()
        const st = main?.scrollTop ?? 0
        for (const el of document.querySelectorAll<HTMLElement>(
          '[data-sticky]:not([data-sticky=band])',
        )) {
          const scope = el.closest('[data-sticky-scope]') ?? el.closest('table') ?? el.parentElement
          const r = el.getBoundingClientRect()
          state.els.push(el)
          state.kinds.push(el.dataset.sticky ?? '')
          state.gap.push(Number(el.dataset.gap ?? 0))
          state.nat.push(r.top - (m?.top ?? 0) + st)
          state.bottom.push((scope?.getBoundingClientRect().bottom ?? 0) - (m?.top ?? 0) + st)
        }
      }
      state.running = true
      requestAnimationFrame(frame)
    },
    stop: () => {
      state.running = false
      return { frames: state.frames, kinds: state.kinds, paintSeams: state.paintSeams }
    },
  }
  if (sessionStorage.getItem('probe-auto') === '1') w.__probe.start()
}

// ── Build and serve ───────────────────────────────────────────────────────────────────────────

async function buildAssets(): Promise<{ js: string; css: string }> {
  mkdirSync(BUILD, { recursive: true })
  const css = Bun.spawnSync(
    [
      resolve(ROOT, 'node_modules/.bin/tailwindcss'),
      '-i',
      'fixture/app.css',
      '-o',
      '.build/app.css',
    ],
    { cwd: ROOT, stderr: 'pipe' },
  )
  if (css.exitCode !== 0) throw new Error(`tailwind failed: ${css.stderr.toString()}`)
  const out = await Bun.build({
    entrypoints: [resolve(ROOT, 'fixture/app.tsx')],
    target: 'browser',
    minify: false,
  })
  if (!out.success) throw new Error(`build failed: ${out.logs.join('\n')}`)
  const first = out.outputs[0]
  if (!first) throw new Error('build produced no output')
  return { js: await first.text(), css: await Bun.file(resolve(BUILD, 'app.css')).text() }
}

const HTML =
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>shell-frame</title><link rel="stylesheet" href="/app.css"></head><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>'

// ── Page helpers ──────────────────────────────────────────────────────────────────────────────

type Cfg = { width: number; height: number; dpr?: number; scheme?: 'light' | 'dark' }
type Env = { browser: Browser; base: string }

async function withPage<T>(
  env: Env,
  cfg: Cfg,
  fn: (page: Page, ctx: BrowserContext) => Promise<T>,
): Promise<T> {
  const ctx = await env.browser.newContext({
    viewport: { width: cfg.width, height: cfg.height },
    deviceScaleFactor: cfg.dpr ?? 1,
    colorScheme: cfg.scheme ?? 'light',
  })
  try {
    await ctx.addInitScript(installProbe)
    return await fn(await ctx.newPage(), ctx)
  } finally {
    await ctx.close()
  }
}

async function open(page: Page, env: Env, query: string, hash = ''): Promise<void> {
  await page.goto(`${env.base}/?${query}${hash}`)
  await page.waitForSelector('[data-slot=shell-main]')
  await page.waitForFunction(
    () =>
      document.querySelector('[data-slot=page-bar]') !== null ||
      document.querySelector('[data-slot=contact-sheet]') !== null,
  )
  await sleep(250)
}

const scrollMax = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const m = document.querySelector('[data-slot=shell-main]')
    return m ? m.scrollHeight - m.clientHeight : 0
  })

const probeStart = (page: Page, sticky: boolean): Promise<void> =>
  page.evaluate(
    (s) => (window as unknown as { __probe: ProbeApi }).__probe.start({ sticky: s }),
    sticky,
  )
const probeStop = (page: Page): Promise<ProbeResult> =>
  page.evaluate(() => (window as unknown as { __probe: ProbeApi }).__probe.stop())

async function wheelPass(page: Page, vw: number, vh: number): Promise<void> {
  await page.mouse.move(vw / 2, vh / 2)
  const pos = (): Promise<number> =>
    page.evaluate(() => document.querySelector('[data-slot=shell-main]')?.scrollTop ?? 0)
  for (const dir of [1, -1]) {
    let still = 0
    let last = await pos()
    for (let i = 0; i < 400 && still < 6; i++) {
      await page.mouse.wheel(0, dir * 90)
      await sleep(16)
      const now = await pos()
      still = now === last ? still + 1 : 0
      last = now
    }
  }
}

// ── S1 ────────────────────────────────────────────────────────────────────────────────────────

const S1_VIEWS = ['argo', 'map', 'week', 'month', 'agenda'] as const
const S1_VIEWPORTS: Cfg[] = [
  { width: 1800, height: 1200, dpr: 1 },
  { width: 1800, height: 1200, dpr: 2 },
  { width: 390, height: 844, dpr: 3 },
  { width: 1440, height: 560, dpr: 1 },
  { width: 1440, height: 460, dpr: 1 }, // main 412 < the fill `min` 420 plus the band: the fill pages scroll here
]
const TOC = ['overview', 'runs', 'latency', 'errors', 'capacity']

type S1Cell = {
  view: string
  viewport: string
  scrollRangePx: number
  frames: number
  maxBandDevPx: number
  maxStickyDevPx: Record<string, number>
  offsetFlickerFrames: number
  asideSeamPx: number | null
  restoredDeltaPx: number | null
  restoredFirstFrameDeltaPx: number | null
  restoreFlickerFrames: number | null
}

function summarize(res: ProbeResult): {
  frames: number
  band: number
  sticky: Record<string, number>
  flicker: number
  seam: number | null
  st: number[]
} {
  const sticky: Record<string, number> = {}
  let flicker = 0
  const seams: number[] = []
  for (const f of res.frames) {
    let bad = Math.abs(f.band) > FLICKER_PX
    f.stk.forEach((d, i) => {
      if (d === null) return
      const kind = res.kinds[i] ?? 'x'
      sticky[kind] = Math.max(sticky[kind] ?? 0, Math.abs(d))
      if (Math.abs(d) > FLICKER_PX) bad = true
    })
    if (bad) flicker++
    if (f.seam !== null) seams.push(f.seam)
  }
  return {
    frames: res.frames.length,
    band: r2(maxAbs(res.frames.map((f) => f.band))),
    sticky: Object.fromEntries(Object.entries(sticky).map(([k, v]) => [k, r2(v)])),
    flicker,
    seam: seams.length ? r2(maxAbs(seams)) : null,
    st: res.frames.map((f) => f.st),
  }
}

async function s1Cell(env: Env, view: string, cfg: Cfg): Promise<S1Cell> {
  const viewport = `${cfg.width}x${cfg.height}@${cfg.dpr}x`
  return withPage(env, cfg, async (page) => {
    await open(page, env, `view=${view}`)
    const range = await scrollMax(page)
    await probeStart(page, true)
    await wheelPass(page, cfg.width, cfg.height)
    const sum = summarize(await probeStop(page))
    const cell: S1Cell = {
      view,
      viewport,
      scrollRangePx: Math.round(range),
      frames: sum.frames,
      maxBandDevPx: sum.band,
      maxStickyDevPx: sum.sticky,
      offsetFlickerFrames: sum.flicker,
      asideSeamPx: sum.seam,
      restoredDeltaPx: null,
      restoredFirstFrameDeltaPx: null,
      restoreFlickerFrames: null,
    }
    if (range > 50) {
      const target = Math.round(range * 0.4)
      await page.evaluate((y) => {
        const m = document.querySelector('[data-slot=shell-main]')
        if (m) m.scrollTop = y
      }, target)
      await sleep(150)
      const saved = await page.evaluate(
        () => document.querySelector('[data-slot=shell-main]')?.scrollTop ?? 0,
      )
      await page.evaluate(() => sessionStorage.setItem('probe-auto', '1'))
      await page.reload()
      await page.waitForSelector('[data-slot=page-bar]')
      await sleep(1200)
      const res = await probeStop(page)
      await page.evaluate(() => sessionStorage.removeItem('probe-auto'))
      const s = summarize(res)
      cell.restoredDeltaPx = r2(Math.abs((s.st.at(-1) ?? 0) - saved))
      cell.restoredFirstFrameDeltaPx = r2(Math.abs((s.st[0] ?? 0) - saved))
      cell.restoreFlickerFrames = s.flicker
    }
    log(
      `s1 ${view} ${viewport}: range ${cell.scrollRangePx}, flicker frames ${cell.offsetFlickerFrames}, seam ${cell.asideSeamPx}`,
    )
    return cell
  })
}

// Negative control: the same pass with the table head pinned to top:0 instead of the band's bottom. The probe must flag it.
async function s1Control(
  env: Env,
): Promise<{ detected: boolean; flickerFrames: number; maxStickyDevPx: Record<string, number> }> {
  return withPage(env, { width: 1800, height: 1200 }, async (page) => {
    await open(page, env, 'view=argo&control=head')
    await probeStart(page, true)
    await wheelPass(page, 1800, 1200)
    const sum = summarize(await probeStop(page))
    return { detected: sum.flicker > 0, flickerFrames: sum.flicker, maxStickyDevPx: sum.sticky }
  })
}

async function s1Anchors(env: Env): Promise<{
  jumps: Record<string, number | null>
  anchorOffsetPx: number
  coldHashOffsetPx: number
}> {
  const cfg: Cfg = { width: 1800, height: 1200 }
  const measure = (page: Page, id: string): Promise<{ off: number; atEnd: boolean }> =>
    page.evaluate((i) => {
      const m = document.querySelector('[data-slot=shell-main]')
      const el = document.getElementById(i)
      const band = document.querySelector('[data-slot=page-bar]')
      if (!m || !el || !band) return { off: Number.NaN, atEnd: true }
      return {
        off: el.getBoundingClientRect().top - band.getBoundingClientRect().bottom,
        atEnd: m.scrollTop >= m.scrollHeight - m.clientHeight - 1,
      }
    }, id)
  return withPage(env, cfg, async (page) => {
    await open(page, env, 'view=argo')
    const jumps: Record<string, number | null> = {}
    for (const id of TOC) {
      await page.evaluate((i) => {
        location.hash = `#${i}`
      }, id)
      await sleep(200)
      const m = await measure(page, id)
      jumps[id] = m.atEnd ? null : r2(m.off)
    }
    const cold = await withPage(env, cfg, async (p) => {
      await open(p, env, 'view=argo', '#runs')
      await sleep(300)
      return measure(p, 'runs')
    })
    const vals = Object.values(jumps).filter((v): v is number => v !== null)
    return { jumps, anchorOffsetPx: r2(maxAbs(vals)), coldHashOffsetPx: r2(Math.abs(cold.off)) }
  })
}

async function s1Resize(
  env: Env,
  query = 'view=argo',
): Promise<{
  frames: number
  asideSeamTransientPx: number
  framesOverSeam: number
  paintSeamPx: number
  paintSeamsOver: number
  paintSeamSamples: number
  bandChanged: boolean
}> {
  return withPage(env, { width: 1800, height: 1200 }, async (page) => {
    await open(page, env, query)
    await probeStart(page, false)
    const widths: number[] = []
    for (let w = 1800; w >= 1300; w -= 50) widths.push(w)
    for (let w = 1350; w <= 1800; w += 50) widths.push(w)
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: 1200 })
      await sleep(70)
    }
    const res = await probeStop(page)
    const seams = res.frames.map((f) => f.seam).filter((s): s is number => s !== null)
    const heights = new Set(res.frames.map((f) => Math.round(f.bh * 100)))
    log(`s1 resize: ${res.frames.length} frames, transient seam ${r2(maxAbs(seams))}`)
    log(
      `s1 resize: paint-time seam ${r2(maxAbs(res.paintSeams))} over ${res.paintSeams.length} observer calls`,
    )
    return {
      frames: res.frames.length,
      asideSeamTransientPx: r2(maxAbs(seams)),
      framesOverSeam: seams.filter((s) => Math.abs(s) > SEAM_PX).length,
      paintSeamPx: r2(maxAbs(res.paintSeams)),
      paintSeamsOver: res.paintSeams.filter((s) => Math.abs(s) > SEAM_PX).length,
      paintSeamSamples: res.paintSeams.length,
      bandChanged: heights.size > 1,
    }
  })
}

// ── S6 ────────────────────────────────────────────────────────────────────────────────────────

type S6Cell = {
  window: number
  rail: string
  itemsShown: string[]
  inKebab: string[]
  itemsLost: string[]
  wraps: boolean
  overflow: boolean
  breadcrumbPx: number
  labelsLong: boolean
  labelsOk: boolean
  yieldOk: boolean
}

const ITEM_IDS = ['badges', 'progress', 'import', 'tag']
const PRIORITY: Record<string, number> = { badges: 1, progress: 2, import: 3, tag: 3 }

async function s6Measure(page: Page, width: number, rail: string): Promise<S6Cell> {
  const kebabOpen = await page.evaluate(() => {
    const k = document.querySelector<HTMLElement>('[data-slot=shell-kebab]')
    if (!k || getComputedStyle(k).display === 'none') return false
    k.click()
    return true
  })
  await sleep(80)
  const m = await page.evaluate((ids) => {
    const q = (s: string): HTMLElement | null => document.querySelector<HTMLElement>(s)
    const header = q('[data-slot=shell-header]')
    const cluster = q('[data-slot=shell-cluster]')
    const crumb = q('[data-slot=shell-breadcrumb]')
    const hr = header?.getBoundingClientRect()
    const cr = cluster?.getBoundingClientRect()
    const shown = ids.filter((id) => {
      const n = q(`[data-item=${id}]`)
      if (!n || getComputedStyle(n).display === 'none') return false
      const r = n.getBoundingClientRect()
      return r.width > 0 && !!hr && r.left >= hr.left - 0.5 && r.right <= hr.right + 0.5
    })
    const inKebab = [...document.querySelectorAll<HTMLElement>('[data-kebab-item]')].map(
      (n) => n.dataset.kebabItem ?? '',
    )
    const badge = q('[data-badge]')?.textContent ?? ''
    return {
      shown,
      inKebab,
      wraps: !!cr && cr.height > 33,
      overflow: !!header && header.scrollWidth > header.clientWidth + 0.5,
      breadcrumbPx: crumb?.getBoundingClientRect().width ?? 0,
      long: badge.includes('·'),
    }
  }, ITEM_IDS)
  void kebabOpen
  await page.evaluate(() => {
    if (document.querySelector('[data-slot=shell-kebab-menu]'))
      document.querySelector<HTMLElement>('[data-slot=shell-kebab]')?.click()
  })
  const lost = ITEM_IDS.filter((id) => !m.shown.includes(id) && !m.inKebab.includes(id))
  const hidden = ITEM_IDS.filter((id) => !m.shown.includes(id))
  const prio = (id: string): number => PRIORITY[id] ?? 0
  const yieldOk = hidden.every((h) =>
    ITEM_IDS.every((o) => prio(o) < prio(h) || !m.shown.includes(o) || prio(o) === prio(h)),
  )
  return {
    window: width,
    rail,
    itemsShown: m.shown,
    inKebab: m.inKebab,
    itemsLost: lost,
    wraps: m.wraps,
    overflow: m.overflow,
    breadcrumbPx: r2(m.breadcrumbPx),
    labelsLong: m.long,
    labelsOk: m.long === width >= 1200,
    yieldOk,
  }
}

async function s6(env: Env): Promise<{
  cells: S6Cell[]
  sweep: { window: number; wraps: boolean; lost: number; breadcrumbPx: number }[]
}> {
  const cells: S6Cell[] = []
  for (const rail of ['expanded', 'collapsed']) {
    for (const width of [1024, 1200, 1440]) {
      cells.push(
        await withPage(env, { width, height: WINDOW_H }, async (page) => {
          await open(page, env, `view=viewer&rail=${rail}`)
          const c = await s6Measure(page, width, rail)
          log(
            `s6 ${width} ${rail}: shown ${c.itemsShown.join(',')} kebab ${c.inKebab.join(',')} lost ${c.itemsLost.length} wraps ${c.wraps}`,
          )
          return c
        }),
      )
    }
  }
  const sweep = await withPage(env, { width: 1024, height: WINDOW_H }, async (page) => {
    await open(page, env, 'view=viewer&rail=expanded')
    const out: { window: number; wraps: boolean; lost: number; breadcrumbPx: number }[] = []
    for (let w = 1024; w <= 1500; w += 12) {
      await page.setViewportSize({ width: w, height: WINDOW_H })
      await sleep(60)
      const c = await s6Measure(page, w, 'expanded')
      out.push({
        window: w,
        wraps: c.wraps || c.overflow,
        lost: c.itemsLost.length,
        breadcrumbPx: c.breadcrumbPx,
      })
    }
    return out
  })
  return { cells, sweep }
}

// ── S8 ────────────────────────────────────────────────────────────────────────────────────────

type Lag = { events: number[]; frames: { t: number; w: number; ok: boolean }[] }

async function lagRun(page: Page, to: number): Promise<{ resizeMs: number; gridMs: number }> {
  await page.evaluate(() => {
    const w = window as unknown as { __lag: Lag; __lagStop?: () => void }
    // One recorder per call: the previous call's listener and rAF loop are stopped, so no frame is recorded twice.
    w.__lagStop?.()
    const rec: Lag = { events: [], frames: [] }
    w.__lag = rec
    let live = true
    const onResize = (): void => void rec.events.push(performance.now())
    addEventListener('resize', onResize)
    w.__lagStop = () => {
      live = false
      removeEventListener('resize', onResize)
    }
    const tick = (t: number): void => {
      if (!live) return
      const main = document.querySelector('[data-slot=shell-main]')
      const sheet = document.querySelector<HTMLElement>('[data-slot=contact-sheet]')
      let ok = false
      if (sheet) {
        const rows = [...sheet.querySelectorAll('[data-row]')]
        const target = sheet.clientWidth - 16
        ok =
          rows.length > 1 &&
          rows
            .slice(0, -1)
            .every(
              (r) =>
                Math.abs(
                  [...r.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0) - target,
                ) < 1.5,
            )
      }
      rec.frames.push({ t, w: main?.getBoundingClientRect().width ?? 0, ok })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await page.setViewportSize({ width: to, height: WINDOW_H })
  await sleep(700)
  const lag = await page.evaluate(() => {
    const w = window as unknown as { __lag: Lag; __lagStop?: () => void }
    w.__lagStop?.()
    return w.__lag
  })
  const start = lag.events[0] ?? lag.frames[0]?.t ?? 0
  const final = lag.frames.at(-1)?.w ?? 0
  const settle = (pred: (f: { w: number; ok: boolean }) => boolean): number => {
    const after = lag.frames.filter((f) => f.t >= start)
    for (let i = 0; i + 2 < after.length; i++) {
      if ([0, 1, 2].every((k) => pred(after[i + k] as { w: number; ok: boolean })))
        return (after[i + 2] as { t: number }).t - start
    }
    return Number.POSITIVE_INFINITY
  }
  void final
  return {
    resizeMs: r2(settle((f) => f.w === final)),
    gridMs: r2(settle((f) => f.w === final && f.ok)),
  }
}

async function s8(env: Env): Promise<{
  mainWidthPxByCell: Record<string, number>
  dockedByCell: Record<string, boolean>
  dockAutoByCell: Record<string, { docked: boolean; mainWidthPx: number }>
  resizeLagMs: number
  lagByCell: Record<
    string,
    { toCellMs: number; fromCellMs: number; gridToCellMs: number; gridFromCellMs: number }
  >
  gridJustified: Record<string, boolean>
}> {
  const mainWidthPxByCell: Record<string, number> = {}
  const dockedByCell: Record<string, boolean> = {}
  const dockAutoByCell: Record<string, { docked: boolean; mainWidthPx: number }> = {}
  const lagByCell: Record<
    string,
    { toCellMs: number; fromCellMs: number; gridToCellMs: number; gridFromCellMs: number }
  > = {}
  const gridJustified: Record<string, boolean> = {}
  const read = (page: Page): Promise<{ w: number; docked: boolean; ok: boolean }> =>
    page.evaluate(() => {
      const main = document.querySelector('[data-slot=shell-main]')
      const aside = document.querySelector('[data-slot=shell-aside]')
      const sheet = document.querySelector<HTMLElement>('[data-slot=contact-sheet]')
      const rows = sheet ? [...sheet.querySelectorAll('[data-row]')] : []
      const target = (sheet?.clientWidth ?? 0) - 16
      return {
        w: main?.getBoundingClientRect().width ?? 0,
        docked: !!aside && aside.getClientRects().length > 0,
        ok:
          rows.length > 1 &&
          rows
            .slice(0, -1)
            .every(
              (r) =>
                Math.abs(
                  [...r.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0) - target,
                ) < 1.5,
            ),
      }
    })
  for (const rail of ['expanded', 'collapsed']) {
    for (const width of [900, 1024, 1200]) {
      const key = `${width}-${rail}`
      await withPage(env, { width, height: WINDOW_H }, async (page) => {
        await open(page, env, `view=viewer&rail=${rail}&dock=always`)
        const a = await read(page)
        mainWidthPxByCell[key] = r2(a.w)
        dockedByCell[key] = a.docked
        gridJustified[key] = a.ok
      })
      await withPage(env, { width, height: WINDOW_H }, async (page) => {
        await open(page, env, `view=viewer&rail=${rail}&dock=auto`)
        const a = await read(page)
        dockAutoByCell[key] = { docked: a.docked, mainWidthPx: r2(a.w) }
      })
      lagByCell[key] = await withPage(env, { width: 1440, height: WINDOW_H }, async (page) => {
        await open(page, env, `view=viewer&rail=${rail}&dock=always`)
        const to = await lagRun(page, width)
        const from = await lagRun(page, 1440)
        return {
          toCellMs: to.resizeMs,
          fromCellMs: from.resizeMs,
          gridToCellMs: to.gridMs,
          gridFromCellMs: from.gridMs,
        }
      })
      log(`s8 ${key}: main ${mainWidthPxByCell[key]} px, lag ${JSON.stringify(lagByCell[key])}`)
    }
  }
  const lags = Object.values(lagByCell).flatMap((l) => [l.toCellMs, l.fromCellMs])
  return {
    mainWidthPxByCell,
    dockedByCell,
    dockAutoByCell,
    resizeLagMs: Math.max(...lags),
    lagByCell,
    gridJustified,
  }
}

// ── Shots ─────────────────────────────────────────────────────────────────────────────────────

async function shots(env: Env): Promise<string[]> {
  mkdirSync(SHOTS, { recursive: true })
  const files: string[] = []
  const shoot = async (
    cfg: Cfg,
    query: string,
    name: string,
    before?: (page: Page) => Promise<void>,
  ): Promise<void> => {
    await withPage(env, cfg, async (page) => {
      await open(page, env, query)
      if (before) await before(page)
      const file = `${name}-${cfg.scheme}.png`
      await page.screenshot({ path: resolve(SHOTS, file) })
      files.push(file)
    })
  }
  for (const scheme of ['light', 'dark'] as const) {
    for (const [width, height] of [
      [1800, 1200],
      [390, 844],
    ] as const) {
      for (const view of [...S1_VIEWS, 'viewer'])
        await shoot({ width, height, scheme }, `view=${view}`, `${view}-${width}x${height}`)
    }
    for (const rail of ['expanded', 'collapsed']) {
      for (const width of [900, 1024, 1200])
        await shoot(
          { width, height: WINDOW_H, scheme },
          `view=viewer&rail=${rail}&dock=always`,
          `viewer-${width}-${rail}`,
        )
    }
    await shoot({ width: 1440, height: WINDOW_H, scheme }, 'view=viewer', 'header-1440')
    await shoot(
      { width: 1024, height: WINDOW_H, scheme },
      'view=viewer&rail=expanded',
      'header-1024-kebab',
      async (page) => {
        await page.click('[data-slot=shell-kebab]')
      },
    )
  }
  return files
}

// ── Main ──────────────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const assets = await buildAssets()
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      const { pathname } = new URL(req.url)
      if (pathname === '/app.js')
        return new Response(assets.js, { headers: { 'content-type': 'text/javascript' } })
      if (pathname === '/app.css')
        return new Response(assets.css, { headers: { 'content-type': 'text/css' } })
      return new Response(HTML, { headers: { 'content-type': 'text/html' } })
    },
  })
  const browser = await chromium.launch({ channel: 'chrome' })
  const env: Env = { browser, base: `http://localhost:${server.port}` }
  try {
    const cells: S1Cell[] = []
    for (const view of S1_VIEWS)
      for (const cfg of S1_VIEWPORTS) cells.push(await s1Cell(env, view, cfg))
    const anchors = await s1Anchors(env)
    const resize = await s1Resize(env)
    const control = {
      head: await s1Control(env),
      mirror: await s1Resize(env, 'view=argo&control=mirror'),
    }
    log(
      `s1 control: head ${control.head.detected}, mirror paint seam ${control.mirror.paintSeamPx}`,
    )
    const six = await s6(env)
    const eight = await s8(env)
    const files = await shots(env)

    const seams = cells.map((c) => c.asideSeamPx).filter((s): s is number => s !== null)
    const offsetFlicker = cells.some(
      (c) => c.offsetFlickerFrames > 0 || (c.restoreFlickerFrames ?? 0) > 0,
    )
    const asideSeamPx = seams.length ? r2(maxAbs(seams)) : 0
    const itemsLost = six.cells.reduce((n, c) => n + c.itemsLost.length, 0)
    const wraps = six.cells.filter((c) => c.wraps || c.overflow).length
    const labelsOk = six.cells.every((c) => c.labelsOk)
    const yieldOk = six.cells.every((c) => c.yieldOk)
    const collapsedMain = Object.entries(eight.mainWidthPxByCell).filter(([k]) =>
      k.endsWith('collapsed'),
    )
    const s1v = !offsetFlicker && asideSeamPx <= SEAM_PX
    const s6v = itemsLost === 0 && wraps === 0 && labelsOk && yieldOk
    const s8v = collapsedMain.every(([, w]) => w >= MAIN_MIN_PX) && eight.resizeLagMs <= LAG_MAX_MS
    const pass = (b: boolean): 'PASS' | 'REFUTED' => (b ? 'PASS' : 'REFUTED')

    process.stdout.write(
      `${JSON.stringify(
        {
          harness: {
            chrome: browser.version(),
            flickerPx: FLICKER_PX,
            seamPx: SEAM_PX,
            mainMinPx: MAIN_MIN_PX,
            lagMaxMs: LAG_MAX_MS,
            windowHeight: WINDOW_H,
          },
          s1: {
            offsetFlicker,
            asideSeamPx,
            asideSeamTransientPx: resize.asideSeamTransientPx,
            anchors,
            resize,
            control,
            cells,
          },
          s6: { itemsLost, wraps, labelsOk, yieldOk, cells: six.cells, sweep: six.sweep },
          s8: eight,
          shots: files,
          verdict: {
            S1: pass(s1v),
            S6: pass(s6v),
            S8: pass(s8v),
            Verdict: pass(s1v && s6v && s8v),
          },
        },
        null,
        2,
      )}\n`,
    )
  } finally {
    await browser.close()
    void server.stop(true)
  }
}

await main()
