/**
 * Measures the built playground (dist/) in a real browser and writes the raw results as JSON.
 *
 *   bun scripts/measure.ts [--out <file>] [--shots <dir>] [--parts a,b]
 *
 * Per part and render mode, at 1440 px in the light scheme: the JavaScript and CSS the page loads (gzip
 * bytes of each file plus the inline scripts and styles of the HTML), console and page errors (the
 * hydration ones counted apart), the layout shift and the largest contentful paint the page records.
 * Per part, the static page (no directive) against the client:only page at 1440 and 390, light and dark:
 * the section's size, its text and a pixel diff. Per family and mode the same page costs with every part
 * of the family on one page. The baseline part (a one-span island) is the framework runtime alone, so a
 * part's further-island cost is what its page loads beyond the baseline's files.
 *
 * It reads dist/ only; `bun run build` makes it. scripts/matrix.ts turns the JSON into the verdicts.
 */
import { gzipSync } from 'bun'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { chromium } from 'playwright-core'
import type { Browser, BrowserContext, Page } from 'playwright-core'
import {
  readTestBrowser,
  testBrowserOptions,
} from '../../../packages/basalt-ui/tests/support/test-browser'
import { FAMILIES, MODES, PARTS } from '../src/parts/registry'
import type { Mode } from '../src/parts/registry'
import type { FamilyResult, ModeResult, PartResult, Picture, Results } from './results'
import { VIEWS } from './results'

const ROOT = join(import.meta.dir, '..')
const DIST = join(ROOT, 'dist')
const { values } = parseArgs({
  options: {
    out: { type: 'string', default: join(ROOT, '.astro-matrix/results.json') },
    shots: { type: 'string', default: join(ROOT, '.astro-matrix/shots') },
    parts: { type: 'string' },
  },
})

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

/** Serves dist/ as a static host does: a directory is its index.html. */
function serve(): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    port: 0,
    async fetch(req) {
      const path = decodeURIComponent(new URL(req.url).pathname)
      let file = join(DIST, path)
      if (!file.startsWith(DIST)) return new Response('forbidden', { status: 403 })
      const s = await stat(file).catch(() => null)
      if (s?.isDirectory()) file = join(file, 'index.html')
      const body = await readFile(file).catch(() => null)
      if (!body) return new Response('not found', { status: 404 })
      return new Response(body, {
        headers: { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' },
      })
    },
  })
}

const gz = (bytes: Uint8Array | string): number =>
  gzipSync(typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes))
    .byteLength

const fileGz = new Map<string, number>()
async function distGz(pathname: string): Promise<number> {
  const hit = fileGz.get(pathname)
  if (hit !== undefined) return hit
  const size = gz(await readFile(join(DIST, pathname)))
  fileGz.set(pathname, size)
  return size
}

/** Keep the side-by-side picture of every view with a differing pixel, not only the charts'. */
const PIXEL_KEEP = 0

const HYDRATION = /hydrat|Minified React error #(418|419|421|422|423|425)/i

/** Waits until every island on the page has hydrated (Astro drops `ssr` from a hydrated island), or the timeout. */
async function settle(page: Page): Promise<boolean> {
  const hydrated = await page
    .waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0, undefined, {
      timeout: 15_000,
    })
    .then(() => true)
    .catch(() => false)
  await page.evaluate(async () => {
    await document.fonts.ready
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })
  await page.waitForTimeout(250)
  return hydrated
}

const OBSERVE = () => {
  const w = window as unknown as { __cls: number; __lcp: number }
  w.__cls = 0
  w.__lcp = 0
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as (PerformanceEntry & {
      value: number
      hadRecentInput: boolean
    })[]) {
      if (!e.hadRecentInput) w.__cls += e.value
    }
  }).observe({ type: 'layout-shift', buffered: true })
  new PerformanceObserver((list) => {
    const last = list.getEntries().at(-1)
    if (last) w.__lcp = last.startTime
  }).observe({ type: 'largest-contentful-paint', buffered: true })
}

type Load = ModeResult & { files: string[] }

/** Opens one page in a fresh context (cold cache) and records what it costs and what it reports. */
async function load(browser: Browser, base: string, path: string): Promise<Load> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  await page.addInitScript(OBSERVE)
  const scripts = new Set<string>()
  const styles = new Set<string>()
  const errors: string[] = []
  page.on('response', (res) => {
    const url = new URL(res.url())
    const type = res.request().resourceType()
    if (url.origin !== new URL(base).origin) return
    if (type === 'script') scripts.add(url.pathname)
    if (type === 'stylesheet') styles.add(url.pathname)
  })
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 300)))
  const res = await page.goto(base + path, { waitUntil: 'load' })
  const html = (await res?.text()) ?? ''
  const hydrated = await settle(page)
  const { cls, lcp, inlineJs, inlineCss, scriptTags } = await page.evaluate(() => {
    const w = window as unknown as { __cls: number; __lcp: number }
    return {
      cls: w.__cls,
      lcp: w.__lcp,
      inlineJs: [...document.querySelectorAll('script:not([src])')]
        .filter(
          (s) => !s.getAttribute('type') || /module|javascript/.test(s.getAttribute('type') ?? ''),
        )
        .map((s) => s.textContent ?? '')
        .join('\n'),
      inlineCss: [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n'),
      scriptTags: document.querySelectorAll('script').length,
    }
  })
  await context.close()
  const files = [...scripts].sort()
  const filesGz = await Promise.all(files.map(distGz))
  const cssGz = await Promise.all([...styles].map(distGz))
  return {
    files,
    hydrated,
    htmlScriptTags: (html.match(/<script\b/g) ?? []).length,
    scriptTags,
    js: filesGz.reduce((a, b) => a + b, 0) + (inlineJs ? gz(inlineJs) : 0),
    jsInline: inlineJs ? gz(inlineJs) : 0,
    css: cssGz.reduce((a, b) => a + b, 0) + (inlineCss ? gz(inlineCss) : 0),
    cls: Math.round(cls * 10_000) / 10_000,
    lcp: Math.round(lcp),
    errors,
    hydrationErrors: errors.filter((e) => HYDRATION.test(e)).length,
  }
}

type Shot = { png: Buffer; w: number; h: number; text: string }

async function shoot(context: BrowserContext, url: string): Promise<Shot> {
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'load' })
  await settle(page)
  const cell = page.locator('section[data-cell]').first()
  const box = (await cell.boundingBox()) ?? { width: 0, height: 0 }
  const text = (await cell.innerText()).replace(/\s+/g, ' ').trim()
  const png = box.height > 0 ? await cell.screenshot({ animations: 'disabled' }) : Buffer.alloc(0)
  await page.close()
  return { png, w: Math.round(box.width), h: Math.round(box.height), text }
}

/** Pixel diff of two PNGs in the browser's canvas: the share of pixels whose largest channel moved by more than 8. */
async function diff(
  page: Page,
  a: Shot,
  b: Shot,
): Promise<{ changed: number; ratio: number; composite: string }> {
  return page.evaluate(
    async ({ a, b }) => {
      const img = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image()
          i.onload = () => resolve(i)
          i.onerror = reject
          i.src = src
        })
      if (!a && !b) return { changed: 0, ratio: 0, composite: '' }
      if (!a || !b) return { changed: Number.POSITIVE_INFINITY, ratio: 1, composite: '' }
      const [ia, ib] = await Promise.all([img(a), img(b)])
      const w = Math.max(ia.width, ib.width)
      const h = Math.max(ia.height, ib.height)
      const read = (i: HTMLImageElement) => {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const x = c.getContext('2d')!
        x.drawImage(i, 0, 0)
        return x.getImageData(0, 0, w, h).data
      }
      const da = read(ia)
      const db = read(ib)
      const out = document.createElement('canvas')
      out.width = w * 3
      out.height = h
      const ctx = out.getContext('2d')!
      ctx.drawImage(ia, 0, 0)
      ctx.drawImage(ib, w, 0)
      const mask = ctx.createImageData(w, h)
      let changed = 0
      for (let p = 0; p < da.length; p += 4) {
        const d = Math.max(
          Math.abs(da[p]! - db[p]!),
          Math.abs(da[p + 1]! - db[p + 1]!),
          Math.abs(da[p + 2]! - db[p + 2]!),
          Math.abs(da[p + 3]! - db[p + 3]!),
        )
        const hit = d > 8
        if (hit) changed++
        mask.data[p] = hit ? 220 : 255
        mask.data[p + 1] = hit ? 30 : 255
        mask.data[p + 2] = hit ? 30 : 255
        mask.data[p + 3] = 255
      }
      ctx.putImageData(mask, w * 2, 0)
      return { changed, ratio: changed / (w * h), composite: out.toDataURL('image/png') }
    },
    {
      a: a.png.length ? 'data:image/png;base64,' + a.png.toString('base64') : '',
      b: b.png.length ? 'data:image/png;base64,' + b.png.toString('base64') : '',
    },
  )
}

async function picture(
  browser: Browser,
  base: string,
  id: string,
  keep: boolean,
): Promise<{ views: Record<string, Picture>; textMatch: boolean }> {
  const views: Record<string, Picture> = {}
  let textMatch = true
  for (const view of VIEWS) {
    const [width, scheme] = view.split('-') as [string, 'light' | 'dark']
    const context = await browser.newContext({
      viewport: { width: Number(width), height: 900 },
      colorScheme: scheme,
      reducedMotion: 'reduce',
    })
    const s = await shoot(context, `${base}/m/${id}/static/`)
    const o = await shoot(context, `${base}/m/${id}/only/`)
    const page = await context.newPage()
    const { changed, ratio, composite } = await diff(page, s, o)
    await context.close()
    if (s.text !== o.text) textMatch = false
    // The count decides (matrix.ts); the rounded share is what the matrix prints.
    views[view] = {
      changed: Number.isFinite(changed) ? changed : s.w * s.h,
      ratio: Math.round(ratio * 100_000) / 100_000,
      static: [s.w, s.h],
      only: [o.w, o.h],
    }
    if ((keep || changed > PIXEL_KEEP || s.w !== o.w || s.h !== o.h) && composite) {
      await mkdir(values.shots!, { recursive: true })
      await writeFile(
        join(values.shots!, `${id}.${view}.png`),
        Buffer.from(composite.split(',')[1]!, 'base64'),
      )
    }
  }
  return { views, textMatch }
}

async function pool<T, R>(
  items: readonly T[],
  size: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = Array.from({ length: items.length })
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await run(items[i]!)
      }
    }),
  )
  return out
}

const server = serve()
const base = `http://localhost:${server.port}`
const browser = await chromium.launch(testBrowserOptions(readTestBrowser()))
const only = values.parts ? new Set(values.parts.split(',')) : null
const parts = PARTS.filter((p) => !only || only.has(p.id))
const started = Date.now()

const baseline: Record<string, Load> = {}
for (const mode of MODES) baseline[mode] = await load(browser, base, `/m/baseline/${mode}/`)
const runtime = new Set(baseline['load']!.files)

const partResults = await pool(parts, 4, async (part): Promise<PartResult> => {
  const modes = {} as Record<Mode, ModeResult & { further: number }>
  for (const mode of MODES) {
    const { files, ...rest } = await load(browser, base, `/m/${part.id}/${mode}/`)
    const extra = await Promise.all(files.filter((f) => !runtime.has(f)).map(distGz))
    modes[mode] = { ...rest, further: extra.reduce((a, b) => a + b, 0) }
  }
  const html = await readFile(join(DIST, `m/${part.id}/static/index.html`), 'utf8')
  const ssr = (html.match(/data-ssr="(ok|partial|fail)"/)?.[1] ?? 'fail') as PartResult['ssr']
  const ssrError = html.match(/data-ssr-error="([^"]*)"/)?.[1] ?? ''
  const { views, textMatch } = await picture(browser, base, part.id, part.chart === true)
  console.log(`measured ${part.id}`)
  return { id: part.id, ssr, ssrError, modes, views, textMatch }
})

const families: FamilyResult[] = []
for (const family of FAMILIES) {
  const count = PARTS.filter((p) => p.family === family).length
  if (!count || !parts.some((p) => p.family === family)) continue
  const modes = {} as Record<Mode, ModeResult>
  for (const mode of MODES) {
    const { files: _files, ...rest } = await load(browser, base, `/f/${family}/${mode}/`)
    modes[mode] = rest
  }
  families.push({ family, parts: count, modes })
}
const index = await load(browser, base, '/')

await browser.close()
server.stop(true)

const results: Results = {
  browser: readTestBrowser(),
  seconds: Math.round((Date.now() - started) / 1000),
  ...(only ? { only: parts.map((p) => p.id) } : {}),
  baseline: Object.fromEntries(
    Object.entries(baseline).map(([m, { files: _f, ...r }]) => [m, r]),
  ) as Results['baseline'],
  parts: partResults,
  families,
  index: (({ files: _f, ...r }) => r)(index),
}
await mkdir(join(values.out!, '..'), { recursive: true })
await writeFile(values.out!, JSON.stringify(results, null, 2) + '\n')
console.log(`measure: ${parts.length} parts in ${results.seconds}s -> ${values.out}`)
