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

const ENTRY = new URL('./ssr/entry.tsx', import.meta.url).pathname
const SERVER = new URL('./ssr/server.tsx', import.meta.url).pathname
const CLOSE_BUDGET_MS = 30_000

type Boxes = Record<string, { x: number; y: number; width: number; height: number }>
type Phase = { boxes: Boxes; cls: number }

const PROBES = ['loaded', 'fallback'] as const

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

/** Server paint → hydrate; the boxes either side and the layout-shift sum in between. */
async function run(width: number): Promise<{ server: Phase; hydrated: Phase; errors: string[] }> {
  const context = await booted!.chrome.newContext({
    viewport: { width, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.goto(booted!.server.url.origin + '/')
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
  const server = await measure(page)
  await page.evaluate(() => {
    const w = window as unknown as { basaltCls: number }
    w.basaltCls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean }
        if (!shift.hadRecentInput) w.basaltCls += shift.value
      }
    }).observe({ type: 'layout-shift', buffered: false })
  })
  await page.addScriptTag({ type: 'module', url: '/entry.js' })
  await page.waitForFunction(
    () => (window as unknown as { basaltHydrated?: boolean }).basaltHydrated,
  )
  await frames(page)
  const hydrated = await measure(page)
  const { cls, errors } = await page.evaluate(() => ({
    cls: (window as unknown as { basaltCls: number }).basaltCls,
    errors: (window as unknown as { basaltHydrationErrors: string[] }).basaltHydrationErrors,
  }))
  await context.close()
  return { server: { boxes: server, cls: 0 }, hydrated: { boxes: hydrated, cls }, errors }
}

layout('SSR-first tables: hydration moves nothing', () => {
  for (const width of [1280, 390]) {
    test(`${width}px: the server boxes survive hydration and CLS is 0`, async () => {
      const { server, hydrated, errors } = await run(width)
      expect(errors).toEqual([])
      for (const name of PROBES) {
        expect(hydrated.boxes[name]).toEqual(server.boxes[name])
      }
      expect(hydrated.cls).toBe(0)
    }, 60_000)

    test(`${width}px: the loading fallback reserves the loaded table's height`, async () => {
      const { server } = await run(width)
      const loaded = server.boxes['loaded']!.height
      const fallback = server.boxes['fallback']!.height
      expect(Math.abs(fallback - loaded)).toBeLessThanOrEqual(1)
    }, 60_000)
  }
})
