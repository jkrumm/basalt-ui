/**
 * Wave 37 "the harness": a hidden or tall anchor never costs a 30 s timeout, a tall anchor is
 * captured whole, fixed chrome never covers a crop, and a route with no `data-shot-states` is loud.
 * The fake-browser half pins the recorded outcomes; the real-Chrome half pins the pixels.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { capture } from './capture'
import type { PwBrowser, PwPage } from './playwright'
import { ShotError, resolvePlaywright, withBrowser } from './playwright'
import type { ShotState } from './types'

/** Never settles: what a 30 s Playwright wait looks like from the outside. */
const hangs = (): Promise<never> => new Promise(() => undefined)

const fakeBrowser = (page: Record<string, unknown>) =>
  ({
    newContext: () =>
      Promise.resolve({
        newPage: () => Promise.resolve(page),
        addInitScript: () => Promise.resolve(),
        close: () => Promise.resolve(),
      }),
  }) as never

const fakePage = (declared: string[], locator: Record<string, unknown>) => ({
  setDefaultTimeout: () => undefined,
  setViewportSize: () => Promise.resolve(),
  goto: () => Promise.resolve(),
  locator: () => locator,
  screenshot: () => Promise.resolve(),
  setContent: () => Promise.resolve(),
  mouse: { move: () => Promise.resolve() },
  keyboard: { press: () => Promise.resolve() },
  evaluate: (expression: unknown) =>
    Promise.resolve(
      typeof expression === 'string' && expression.includes('data-shot-states')
        ? { anchors: ['strip'], declared }
        : undefined,
    ),
})

const input = (page: Record<string, unknown>, states: ShotState[], log: string[] = []) => ({
  browser: fakeBrowser(page),
  base: 'http://x',
  routes: ['/'],
  states,
  pngDir: '/unused',
  log: (line: string) => void log.push(line),
})

describe('a target that is not visible', () => {
  // Every Playwright wait hangs; only the page-side probe answers, and it says the anchor is hidden.
  const hidden = {
    first: () => hidden,
    count: () => Promise.resolve(1),
    isVisible: () => Promise.resolve(false),
    scrollIntoViewIfNeeded: hangs,
    boundingBox: hangs,
    hover: hangs,
    waitFor: hangs,
    screenshot: hangs,
    evaluate: () => Promise.resolve('display: none'),
  }

  test('is recorded `absent` with its reason in under 5 s, never an error after 30 s', async () => {
    const started = Date.now()
    const out = await capture(input(fakePage([], hidden), ['rest', 'hover', 'focus', 'tooltip']))
    expect(Date.now() - started).toBeLessThan(5_000)
    const strip = out.shots.filter((s) => s.name === 'strip')
    expect(strip.length).toBeGreaterThan(0)
    expect(strip.filter((s) => s.status === 'error')).toEqual([])
    const absent = strip.filter((s) => s.status === 'absent')
    expect(absent.length).toBeGreaterThan(0)
    expect(absent.every((s) => /display: none/.test(s.note ?? '') && s.file === null)).toBe(true)
  }, 8_000)
})

describe('a route with no declared states', () => {
  const visible = {
    first: () => visible,
    count: () => Promise.resolve(1),
    isVisible: () => Promise.resolve(true),
    scrollIntoViewIfNeeded: () => Promise.resolve(),
    boundingBox: () => Promise.resolve({ x: 0, y: 0, width: 10, height: 10 }),
    screenshot: () => Promise.resolve(),
    evaluate: () => Promise.resolve(''),
  }

  test('warns once per route and tells the board why nothing rendered', async () => {
    const log: string[] = []
    const out = await capture(
      input(fakePage([], visible), ['rest', 'empty', 'loading', 'error'], log),
    )
    const warned = log.filter((l) => /no data-shot-states/.test(l))
    expect(warned).toHaveLength(1)
    expect(warned[0]).toContain('/')
    const skipped = out.shots.filter((s) => s.status === 'not-declared')
    expect(skipped.length).toBe(12)
    expect(skipped.every((s) => /declares no data-shot-states/.test(s.note ?? ''))).toBe(true)
  })

  test('a route that declares one state does not warn', async () => {
    const log: string[] = []
    await capture(input(fakePage(['empty'], visible), ['rest', 'empty'], log))
    expect(log.filter((l) => /no data-shot-states/.test(l))).toEqual([])
  })
})

// ── Real Chrome ────────────────────────────────────────────────────────────────────────────────

const TALL_PX = 2300
const FIXTURE = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%}
  main{height:100dvh;overflow:auto;padding-bottom:100px;box-sizing:border-box;background:#fff}
  header{position:sticky;top:0;height:56px;background:#f00;z-index:5}
  nav{position:fixed;left:0;right:0;bottom:0;height:80px;background:#f00;z-index:5}
  [data-shot=tall]{height:${TALL_PX}px;background:#00f;margin:24px 0}
  [data-shot=near]{height:780px;background:#00f;margin:24px 0}
  #end{height:40px;background:#0f0}
</style>
<nav></nav>
<main><header></header>
  <div data-shot=near><button>near</button></div>
  <div data-shot=tall><button>tall</button></div>
  <div id=end></div>
</main>`

const pw = resolvePlaywright(process.cwd())
const out = mkdtempSync(join(tmpdir(), 'basalt-harness-'))
afterAll(() => rmSync(out, { recursive: true, force: true }))

/** Per-row verdict of a PNG, decoded by the browser itself: `blue`, `green`, `red`, `white` or `other`. */
const rowsOf = async (page: PwPage, file: string): Promise<string[]> => {
  const uri = `data:image/png;base64,${readFileSync(file).toString('base64')}`
  return page.evaluate<string[]>(`(async () => {
    const img = new Image(); img.src = ${JSON.stringify(uri)}; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const rows = []
    for (let y = 0; y < img.height; y++) {
      const [r, gr, b] = g.getImageData(Math.floor(img.width / 2), y, 1, 1).data
      rows.push(r > 200 && gr < 60 && b < 60 ? 'red' : b > 200 && r < 60 && gr < 60 ? 'blue'
        : gr > 200 && r < 60 && b < 60 ? 'green' : r > 240 && gr > 240 && b > 240 ? 'white' : 'other')
    }
    return rows
  })()`)
}

type Run = {
  shots: Awaited<ReturnType<typeof capture>>['shots']
  rows: (file: string | null) => Promise<string[]>
}

/** One capture of the fixture in real Chrome; `null` when no Chrome can start here. */
async function shoot(states: ShotState[], check: (run: Run) => Promise<void>): Promise<void> {
  if (!pw) return
  // node:http, not Bun.serve: the unit-test preload replaces the global Response with happy-dom's.
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html')
    res.end(FIXTURE)
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  const dir = mkdtempSync(join(out, 'run-'))
  try {
    await withBrowser(pw, async (browser: PwBrowser) => {
      const done = await capture({
        browser,
        base: `http://127.0.0.1:${port}`,
        routes: ['/'],
        states,
        pngDir: dir,
        log: () => undefined,
      })
      const context = await browser.newContext({
        viewport: { width: 800, height: 600 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        colorScheme: 'light',
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      await check({
        shots: done.shots,
        rows: (file) => rowsOf(page, join(dir, (file ?? '').replace(/^png\//, ''))),
      })
    })
  } catch (error) {
    if (!(error instanceof ShotError)) throw error // no Chrome to launch: the pixel tests cannot run
  } finally {
    server.close()
  }
}

describe('real Chrome', () => {
  test('a 2.5-viewport-tall anchor is captured whole, with no blank or chrome rows', async () => {
    await shoot(['rest', 'focus'], async ({ shots, rows }) => {
      for (const state of ['rest', 'focus'] as const) {
        for (const record of shots.filter((s) => s.name === 'tall' && s.state === state)) {
          expect(record.status).toBe('ok')
          const px = await rows(record.file)
          expect(px.length).toBeGreaterThanOrEqual(TALL_PX)
          // A focus crop adds a margin; the anchor body itself is blue top to bottom.
          expect(px.filter((r) => r === 'blue').length).toBeGreaterThanOrEqual(TALL_PX - 4)
          expect(px.filter((r) => r === 'white' || r === 'red').length).toBeLessThanOrEqual(
            state === 'focus' ? 16 : 0,
          )
        }
      }
    })
  }, 120_000)

  test('fixed and sticky chrome is absent from anchor crops', async () => {
    await shoot(['rest', 'hover', 'focus'], async ({ shots, rows }) => {
      const crops = shots.filter((s) => s.name === 'near' && s.status === 'ok')
      expect(crops.length).toBeGreaterThan(0)
      for (const crop of crops)
        expect((await rows(crop.file)).filter((r) => r === 'red')).toEqual([])
    })
  }, 120_000)

  test('the mobile page shot reaches the end of the page, with the chrome kept', async () => {
    await shoot(['rest'], async ({ shots, rows }) => {
      const page = shots.find(
        (s) => s.name === '_page' && s.viewport === 'mobile' && s.scheme === 'light',
      )
      expect(page?.status).toBe('ok')
      const px = await rows(page?.file ?? null)
      expect(px.length).toBeGreaterThan(844 + 400)
      expect(px.includes('green')).toBe(true)
      expect(px.includes('red')).toBe(true)
    })
  }, 120_000)
})
