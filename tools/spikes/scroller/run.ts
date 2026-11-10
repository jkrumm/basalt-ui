/**
 * Spike 621 (docs/v3/concepts/ai-mdx.md section 7, P12). Throwaway harness, no tests.
 *
 * One fixture (fixture/app.tsx), two candidates plus the own-hook fallback (candidates/*.tsx), each in real Chrome at 390x844
 * for 90 s of streamed, growing markdown:
 *
 *   t = 1..90 s   sample the pixel gap to the bottom of the scroll element once a second
 *   t = 20 s      user wheels up 700 px: released iff scrollTop moves by <= 2 px over the next 3 s
 *   t = 24 s      user wheels back to 6 px above the bottom: re-pinned iff the gap is <= 2 px 1 s later
 *   t = 40 s      an image above the bottom loads late (0 -> ~220 px): reflowGapPx = gap 1 s after onload
 *   t = 60 s      soft-keyboard model, viewport 390x844 -> 390x484: keyboardGapPx = gap 1 s later
 *   t = 70 s      keyboard closes, viewport back to 390x844
 *
 * `sticks` = maxGapPx <= 2 && releasedOnScrollUp && repinnedOnReturn && reflowGapPx <= 2 &&
 * keyboardGapPx <= 2. maxGapPx is the maximum of the 1 s samples taken while pinned, leaving out
 * the windows each event owns (release/return, reflow, keyboard open, keyboard close).
 * gzipBytes is the gzip of a minified Bun.build of the candidate's adapter with react external.
 *
 * Prints ONE JSON object on stdout and exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr.
 */
import { gzipSync } from 'node:zlib'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Page } from 'playwright-core'

type Candidate = 'use-stick-to-bottom' | 'message-scroller' | 'own-hook'
// The first two are the Issue's candidates; `own-hook` is the fallback, run through the same
// fixture so the verdict's code is measured and not just written.
const PACKAGES = ['use-stick-to-bottom', 'message-scroller'] as const
const CANDIDATES: readonly Candidate[] = [...PACKAGES, 'own-hook']

const ROOT = import.meta.dir
const STREAM_S = 90
const PIN_TOLERANCE_PX = 2
const RETURN_PX = 6 // lands inside the 8 px re-pin band of both candidates
const WIDTH = 390
const FULL_HEIGHT = 844
const KEYBOARD_HEIGHT = 484

const log = (msg: string): void => {
  process.stderr.write(`${msg}\n`)
}
const r2 = (n: number): number => Math.round(n * 100) / 100
const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, Math.max(0, ms)))

const CSS = `
*{box-sizing:border-box}
body{margin:0;font:15px/1.5 system-ui,sans-serif;color:#222;background:#fff}
.page{height:100dvh;display:flex;flex-direction:column}
header{height:48px;flex:none;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid #ddd;font-weight:600}
footer{height:56px;flex:none;padding:8px 16px;border-top:1px solid #ddd}
footer input{width:100%;height:40px;font:inherit;padding:0 12px}
.root{flex:1;min-height:0;display:flex;flex-direction:column}
.scroller{flex:1;min-height:0;overflow-y:auto;padding:12px 16px}
.msg{margin-bottom:16px}
.msg p,.msg h3,.msg ul,.msg pre{margin:0 0 8px}
.user{background:#eee;border-radius:8px;padding:8px 12px}
img{display:block;width:100%;height:auto}
pre{background:#f5f5f5;padding:8px;overflow:hidden;font-size:13px}
`

const HTML = (candidate: Candidate): string =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${candidate}</title><style>${CSS}</style></head><body><div id="app"></div><script type="module" src="/app.js"></script></body></html>`

const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="240" viewBox="0 0 390 240"><rect width="390" height="240" fill="#cbd5e1"/><circle cx="195" cy="120" r="60" fill="#64748b"/></svg>'

async function bundle(entry: string): Promise<string> {
  const out = await Bun.build({ entrypoints: [entry], target: 'browser', minify: false })
  if (!out.success) throw new Error(`build failed: ${out.logs.join('\n')}`)
  const first = out.outputs[0]
  if (!first) throw new Error('build produced no output')
  return first.text()
}

async function gzipClosure(candidate: Candidate): Promise<number> {
  const out = await Bun.build({
    entrypoints: [resolve(ROOT, `candidates/${candidate}.tsx`)],
    target: 'browser',
    minify: true,
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  })
  if (!out.success) throw new Error(`closure build failed: ${out.logs.join('\n')}`)
  const text = await Promise.all(out.outputs.map((o) => o.text()))
  return gzipSync(Buffer.from(text.join('\n')), { level: 9 }).length
}

type Sample = { s: number; tMs: number; gap: number }

const measure = (page: Page): Promise<{ gap: number; scrollTop: number }> =>
  page.evaluate(() => {
    const el = document.querySelector('[data-scroller]')
    if (!el) throw new Error('no [data-scroller]')
    return { gap: el.scrollHeight - el.scrollTop - el.clientHeight, scrollTop: el.scrollTop }
  })

type Run = {
  samples: Sample[]
  releasedOnScrollUp: boolean
  releaseDriftPx: number
  releaseGapPx: number
  repinnedOnReturn: boolean
  returnGapPx: number
  repinGapPx: number
  reflowGapPx: number
  reflowPeakGapPx: number
  keyboardGapPx: number
  keyboardPeakGapPx: number
  windows: [number, number][]
}

async function drive(page: Page, baseUrl: string, candidate: Candidate): Promise<Run> {
  await page.setViewportSize({ width: WIDTH, height: FULL_HEIGHT })
  await page.goto(`${baseUrl}/?c=${candidate}`)
  await page.waitForFunction(() => '__fixture' in window)
  await page.mouse.move(WIDTH / 2, 400)
  await page.evaluate(() => window.__fixture.start())
  const t0 = performance.now()
  const at = (ms: number): Promise<void> => sleep(t0 + ms - performance.now())
  const elapsed = (): number => performance.now() - t0

  const samples: Sample[] = []
  const sampler = async (): Promise<void> => {
    for (let s = 1; s <= STREAM_S; s++) {
      await at(s * 1000)
      const { gap } = await measure(page)
      samples.push({ s, tMs: Math.round(elapsed()), gap: r2(gap) })
    }
  }

  const out: Omit<Run, 'samples'> = {
    releasedOnScrollUp: false,
    releaseDriftPx: Number.NaN,
    releaseGapPx: Number.NaN,
    repinnedOnReturn: false,
    returnGapPx: Number.NaN,
    repinGapPx: Number.NaN,
    reflowGapPx: Number.NaN,
    reflowPeakGapPx: Number.NaN,
    keyboardGapPx: Number.NaN,
    keyboardPeakGapPx: Number.NaN,
    windows: [],
  }

  const scenario = async (): Promise<void> => {
    // Release: wheel up, then watch scrollTop for 3 s while the stream keeps growing.
    await at(20_000)
    const releaseStart = elapsed()
    await page.mouse.wheel(0, -700)
    await sleep(200)
    const afterWheel = await measure(page)
    await at(releaseStart + 3200)
    const later = await measure(page)
    out.releaseDriftPx = r2(Math.abs(later.scrollTop - afterWheel.scrollTop))
    out.releaseGapPx = r2(later.gap)
    out.releasedOnScrollUp = out.releaseDriftPx <= 2 && later.gap > 8

    // Return: wheel down to RETURN_PX above the bottom (at most three corrections), then 1 s.
    await at(24_000)
    for (let attempt = 0; attempt < 3; attempt++) {
      const { gap } = await measure(page)
      if (gap <= 8) break
      await page.mouse.wheel(0, gap - RETURN_PX)
      await sleep(30)
    }
    out.returnGapPx = r2((await measure(page)).gap)
    const returned = elapsed()
    await at(returned + 1000)
    out.repinGapPx = r2((await measure(page)).gap)
    out.repinnedOnReturn = out.returnGapPx <= 8 && out.repinGapPx <= PIN_TOLERANCE_PX
    out.windows.push([20_000, elapsed() + 600])

    // Reflow: the image above the bottom loads late. Gap 1 s after its onload.
    await at(40_000)
    await page.evaluate(() => {
      window.__fixture.mark()
      window.__fixture.loadImage()
    })
    const reflowStart = elapsed()
    await page.waitForFunction(() => window.__fixture.reflowAt !== null)
    await sleep(1000)
    out.reflowGapPx = r2((await measure(page)).gap)
    out.reflowPeakGapPx = r2(await page.evaluate(() => window.__fixture.peak()))
    out.windows.push([reflowStart, elapsed() + 600])

    // Keyboard: viewport shrinks to 390x484, gap 1 s later; then it closes again.
    await at(60_000)
    await page.evaluate(() => window.__fixture.mark())
    const keyboardStart = elapsed()
    await page.setViewportSize({ width: WIDTH, height: KEYBOARD_HEIGHT })
    await sleep(1000)
    out.keyboardGapPx = r2((await measure(page)).gap)
    out.keyboardPeakGapPx = r2(await page.evaluate(() => window.__fixture.peak()))
    out.windows.push([keyboardStart, elapsed() + 600])
    await at(70_000)
    const closeStart = elapsed()
    await page.setViewportSize({ width: WIDTH, height: FULL_HEIGHT })
    out.windows.push([closeStart, closeStart + 1600])
  }

  await Promise.all([sampler(), scenario()])
  return { samples, ...out }
}

const inWindow = (t: number, windows: [number, number][]): boolean =>
  windows.some(([a, b]) => t >= a && t <= b)

async function main(): Promise<void> {
  const bundles = new Map<Candidate, string>()
  for (const c of CANDIDATES) bundles.set(c, await bundle(resolve(ROOT, `fixture/${c}.tsx`)))

  let active: Candidate = CANDIDATES[0] ?? 'use-stick-to-bottom'
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/app.js')
        return new Response(bundles.get(active), {
          headers: { 'content-type': 'text/javascript' },
        })
      if (url.pathname === '/late.svg') {
        await Bun.sleep(400)
        return new Response(SVG, { headers: { 'content-type': 'image/svg+xml' } })
      }
      return new Response(HTML(active), { headers: { 'content-type': 'text/html' } })
    },
  })
  const baseUrl = `http://localhost:${server.port}`

  const browser = await chromium.launch({ channel: 'chrome' })
  const version = browser.version()
  const candidates: Record<string, unknown> = {}
  const sticks: Record<string, boolean> = {}
  const gzip: Record<string, number> = {}
  try {
    for (const c of CANDIDATES) {
      active = c
      log(`${c}: streaming ${STREAM_S} s`)
      const page = await browser.newPage()
      const run = await drive(page, baseUrl, c)
      await page.close()
      const pinned = run.samples.filter((s) => !inWindow(s.tMs, run.windows))
      const maxGapPx = r2(Math.max(...pinned.map((s) => s.gap)))
      const gzipBytes = await gzipClosure(c)
      const ok =
        maxGapPx <= PIN_TOLERANCE_PX &&
        run.releasedOnScrollUp &&
        run.repinnedOnReturn &&
        run.reflowGapPx <= PIN_TOLERANCE_PX &&
        run.keyboardGapPx <= PIN_TOLERANCE_PX
      sticks[c] = ok
      gzip[c] = gzipBytes
      log(`${c}: maxGapPx ${maxGapPx}, sticks ${ok}`)
      candidates[c] = {
        maxGapPx,
        releasedOnScrollUp: run.releasedOnScrollUp,
        repinnedOnReturn: run.repinnedOnReturn,
        reflowGapPx: run.reflowGapPx,
        keyboardGapPx: run.keyboardGapPx,
        gzipBytes,
        sticks: ok,
        detail: {
          pinnedSamples: pinned.length,
          releaseDriftPx: run.releaseDriftPx,
          releaseGapPx: run.releaseGapPx,
          returnGapPx: run.returnGapPx,
          repinGapPx: run.repinGapPx,
          reflowPeakGapPx: run.reflowPeakGapPx,
          keyboardPeakGapPx: run.keyboardPeakGapPx,
          gapSamples: run.samples.map((s) => s.gap),
        },
      }
    }
  } finally {
    await browser.close()
    void server.stop(true)
  }

  const [a, b] = PACKAGES
  let choice: 'use-stick-to-bottom' | 'message-scroller' | 'own-hook'
  if (sticks[a] && sticks[b]) choice = (gzip[a] ?? 0) <= (gzip[b] ?? 0) ? a : b
  else if (sticks[a]) choice = a
  else if (sticks[b]) choice = b
  else choice = 'own-hook'

  process.stdout.write(
    `${JSON.stringify(
      {
        harness: {
          chrome: version,
          viewport: `${WIDTH}x${FULL_HEIGHT}`,
          keyboardViewport: `${WIDTH}x${KEYBOARD_HEIGHT}`,
          streamSeconds: STREAM_S,
          pinTolerancePx: PIN_TOLERANCE_PX,
        },
        candidates,
        choice,
      },
      null,
      2,
    )}\n`,
  )
}

await main()
