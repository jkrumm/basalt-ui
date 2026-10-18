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

const fakePage = (
  declared: string[],
  locator: Record<string, unknown>,
  absent: Record<string, string[]> = {},
) => ({
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
        ? { anchors: ['strip'], declared, absent }
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
    boundingBox: hangs,
    hover: hangs,
    waitFor: hangs,
    screenshot: hangs,
    evaluate: () => Promise.resolve('display: none'),
  }

  test('hover, focus and tooltip record `absent` with the reason in under 5 s, never a 30 s error', async () => {
    const started = Date.now()
    const out = await capture(input(fakePage([], hidden), ['hover', 'focus', 'tooltip']))
    expect(Date.now() - started).toBeLessThan(5_000)
    const strip = out.shots.filter((s) => s.name === 'strip' && s.status !== 'skipped')
    expect(strip.length).toBeGreaterThan(0)
    expect(strip.every((s) => s.status === 'absent' && s.file === null)).toBe(true)
    expect(strip.every((s) => /display: none/.test(s.note ?? ''))).toBe(true)
  }, 8_000)

  test('a hidden `rest` anchor is a fast error naming the reason, never a pass', async () => {
    const started = Date.now()
    const out = await capture(input(fakePage([], hidden), ['rest']))
    expect(Date.now() - started).toBeLessThan(5_000)
    const strip = out.shots.filter((s) => s.name === 'strip')
    expect(strip).toHaveLength(4)
    expect(
      strip.every(
        (s) => s.status === 'error' && s.note === 'not visible at this viewport: display: none',
      ),
    ).toBe(true)
  }, 8_000)

  test('a hidden `rest` anchor that declares itself absent there is `absent`', async () => {
    const out = await capture(input(fakePage([], hidden, { strip: ['rest'] }), ['rest']))
    const strip = out.shots.filter((s) => s.name === 'strip')
    expect(strip.every((s) => s.status === 'absent')).toBe(true)
  })
})

describe('framing an anchor', () => {
  const framed = (locator: Record<string, unknown>) => {
    const calls: string[] = []
    const page = fakePage([], locator)
    const evaluate = page.evaluate
    page.evaluate = (expression: unknown) => {
      if (typeof expression === 'function') calls.push(expression.name)
      return evaluate(expression)
    }
    return { page, calls }
  }

  test('a measure that rejects puts the chrome back and surfaces as the shot error', async () => {
    const broken = {
      first: () => broken,
      count: () => Promise.resolve(1),
      evaluate: () => Promise.reject(new Error('boom')),
      screenshot: () => Promise.resolve(),
    }
    const { page, calls } = framed(broken)
    const out = await capture(input(page, ['rest']))
    const strip = out.shots.filter((s) => s.name === 'strip')
    expect(strip.every((s) => s.status === 'error' && s.note === 'boom')).toBe(true)
    // Every hide is followed by its show, and the _page shot still runs with the chrome back.
    expect(calls.filter((n) => n === 'hideChrome')).toHaveLength(4)
    expect(calls.filter((n) => n === 'showChrome')).toHaveLength(4)
    expect(out.shots.find((s) => s.name === '_page')?.status).toBe('ok')
  })

  test('a missing anchor says so at once instead of timing out measuring it', async () => {
    const missing = {
      first: () => missing,
      count: () => Promise.resolve(0),
      evaluate: hangs,
    }
    const started = Date.now()
    const out = await capture(input(framed(missing).page, ['rest']))
    expect(Date.now() - started).toBeLessThan(5_000)
    const strip = out.shots.filter((s) => s.name === 'strip')
    expect(strip.every((s) => s.status === 'error' && s.note === 'anchor not found')).toBe(true)
  }, 8_000)
})

describe('a route with no declared states', () => {
  const visible = {
    first: () => visible,
    count: () => Promise.resolve(1),
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
const REVEAL_FIXTURE = `<!doctype html><style>[hidden]{display:block}div{height:40px;background:#00f}</style>
<div data-shot=attr hidden></div><div data-shot=zero style="height:0"></div>
<div data-shot=vis style="visibility:hidden"></div><section style="display:none"><div data-shot=anc></div></section>
<div data-shot=gone-ok data-shot-absent="rest" hidden></div><div data-shot=seen></div>`

const FIXTURE = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;height:100%}
  main{height:100dvh;overflow:auto;padding-bottom:100px;box-sizing:border-box;background:#fff}
  header{position:sticky;top:0;height:56px;background:#f00;z-index:5}
  nav{position:fixed;left:0;right:0;bottom:0;height:80px;background:#f00;z-index:5}
  main{scroll-behavior:smooth}
  [data-shot=card]{height:200px;background:#00f}
  .nb{height:200px;background:#f0f;margin:24px 0}
  [data-shot=tall]{height:${TALL_PX}px;background:#00f;margin:24px 0}
  [data-shot=near]{height:780px;background:#00f;margin:24px 0}
  #end{height:40px;background:#0f0}
</style>
<nav><div role=menu hidden></div></nav>
<main><header></header>
  <div data-shot=near><button>near</button></div>
  <div data-shot=tall><button>tall</button></div>
  <div class=nb></div><div data-shot=card><button>card</button></div><div class=nb></div>
  <div id=end></div>
</main>`

const HOVER_FIXTURE = `<!doctype html><style>
  body{margin:0}
  [data-shot=btn]{display:block;width:200px;height:60px;background:#fff}
  @media (hover:hover){[data-shot=btn]:hover{background:#00f}}
</style><div data-shot=btn></div>`

const STATEFUL_FIXTURE = `<!doctype html><div data-shot=chart><section data-basalt-chart-card style="height:80px"></section></div>
<div data-shot=plain style="height:80px"></div>`

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
        : gr > 200 && r < 60 && b < 60 ? 'green' : r > 200 && b > 200 && gr < 60 ? 'magenta' : r > 240 && gr > 240 && b > 240 ? 'white' : 'other')
    }
    return rows
  })()`)
}

type Run = {
  shots: Awaited<ReturnType<typeof capture>>['shots']
  rows: (file: string | null) => Promise<string[]>
}

/** One capture of the fixture in real Chrome; `null` when no Chrome can start here. */
async function shoot(
  states: ShotState[],
  check: (run: Run) => Promise<void>,
  route = '/',
  inBrowser?: (browser: PwBrowser) => Promise<void>,
): Promise<void> {
  if (!pw) {
    if (process.env['CI']) throw new Error('no Playwright to run the real-Chrome tests in CI')
    return
  }
  // node:http, not Bun.serve: the unit-test preload replaces the global Response with happy-dom's.
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html')
    res.end(
      req.url === '/reveal'
        ? REVEAL_FIXTURE
        : req.url === '/hover'
          ? HOVER_FIXTURE
          : req.url === '/stateful'
            ? STATEFUL_FIXTURE
            : FIXTURE,
    )
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address() as AddressInfo
  const dir = mkdtempSync(join(out, 'run-'))
  try {
    await withBrowser(pw, async (browser: PwBrowser) => {
      if (inBrowser) return inBrowser(browser)
      const done = await capture({
        browser,
        base: `http://127.0.0.1:${port}`,
        routes: [route],
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
    // No Chrome to launch: the pixel tests cannot run here, but CI must have one.
    if (!(error instanceof ShotError) || process.env['CI']) throw error
  } finally {
    server.close()
  }
}

describe('real Chrome', () => {
  test('an undeclared state is marked stateful only on an anchor holding a state surface', async () => {
    await shoot(
      ['empty'],
      async ({ shots }) => {
        const flag = (name: string) =>
          shots.find((s) => s.name === name && s.state === 'empty')?.stateful
        expect(flag('chart')).toBe(true)
        expect(flag('plain')).toBeUndefined()
      },
      '/stateful',
    )
  }, 120_000)

  test('desktop reports a hovering fine pointer, mobile a coarse touch one', async () => {
    await shoot(
      [],
      async () => undefined,
      '/',
      async (browser) => {
        const probe = async (mobile: boolean) => {
          const context = await browser.newContext({
            viewport: { width: mobile ? 390 : 800, height: 600 },
            deviceScaleFactor: 1,
            isMobile: mobile,
            hasTouch: mobile,
            colorScheme: 'light',
            reducedMotion: 'reduce',
          })
          const page = await context.newPage()
          const media = await page.evaluate<string[]>(
            `['(hover: hover)', '(pointer: fine)', '(pointer: coarse)'].map((q) => String(matchMedia(q).matches))`,
          )
          await context.close()
          return media
        }
        expect(await probe(false)).toEqual(['true', 'true', 'false'])
        expect(await probe(true)).toEqual(['false', 'false', 'true'])
      },
    )
  }, 120_000)

  test('a (hover: hover) rule shows in the desktop hover crop, not at rest', async () => {
    await shoot(
      ['rest', 'hover'],
      async ({ shots, rows }) => {
        const crop = async (state: string) => {
          const s = shots.find(
            (x) => x.name === 'btn' && x.state === state && x.viewport === 'desktop',
          )
          expect(s?.status).toBe('ok')
          return rows(s?.file ?? null)
        }
        expect((await crop('rest')).includes('blue')).toBe(false)
        expect((await crop('hover')).includes('blue')).toBe(true)
      },
      '/hover',
    )
  }, 120_000)

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

  test('a focus crop (390 included) is the focused anchor, never shifted onto a neighbour', async () => {
    await shoot(['focus'], async ({ shots, rows }) => {
      const crops = shots.filter((s) => s.name === 'card' && s.state === 'focus')
      expect(crops.map((s) => s.status)).toEqual(['ok', 'ok', 'ok', 'ok'])
      expect(crops.some((s) => s.viewport === 'mobile')).toBe(true)
      for (const crop of crops) {
        const px = await rows(crop.file)
        expect(px.filter((r) => r === 'blue').length).toBeGreaterThanOrEqual(200 - 4)
        expect(px.filter((r) => r === 'magenta')).toEqual([])
      }
    })
  }, 120_000)

  test('a hidden anchor says why: hidden attribute, zero size, visibility, an ancestor', async () => {
    await shoot(
      ['rest', 'hover'],
      async ({ shots }) => {
        const note = (name: string, state: string) =>
          shots.find((s) => s.name === name && s.state === state && s.viewport === 'desktop')
        const rest = (name: string) => note(name, 'rest')
        expect(rest('attr')).toMatchObject({ status: 'error' })
        expect(rest('attr')?.note).toBe('not visible at this viewport: hidden attribute')
        expect(rest('zero')?.note).toBe('not visible at this viewport: zero size')
        expect(rest('vis')?.note).toBe('not visible at this viewport: visibility: hidden')
        expect(rest('anc')?.note).toBe('not visible at this viewport: display: none on an ancestor')
        expect(rest('gone-ok')?.status).toBe('absent')
        expect(rest('seen')?.status).toBe('ok')
        expect(note('attr', 'hover')?.status).toBe('absent')
      },
      '/reveal',
    )
  }, 120_000)
})
