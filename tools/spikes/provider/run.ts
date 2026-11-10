/**
 * Spike Q1 (docs/v3/concepts/quality-contract.md section 10, Q1). Throwaway harness, no tests.
 *
 * Builds the v3 `BasaltProvider` skeleton fixture and `base0` (React + react-dom `createRoot`) with
 * the same code the gate runs (`packages/basalt-ui/scripts/check-budgets/provider-v3.ts`), reports
 * the provider's gzip share against the `provider-v3` row and the 5.0 KB cap, then loads the built
 * fixture in Chrome to prove the measured code does what a provider is for: `lang`, `data-theme`
 * and the raw `basalt:scheme` key. `base0` is the control: the same checks must find nothing there.
 *
 * Prints ONE JSON object on stdout and always exits 0 (0 = the harness ran, not "hypothesis held").
 * Progress goes to stderr.
 */
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import type { Browser, Page } from 'playwright-core'

import { PROVIDER_V3_CEILING } from '../../../packages/basalt-ui/scripts/check-budgets/areas/provider'
import {
  PROVIDER_V3_CAP,
  measureProviderV3,
} from '../../../packages/basalt-ui/scripts/check-budgets/provider-v3'
import type { AppBundle } from '../../../packages/basalt-ui/scripts/check-budgets/provider-v3'

const log = (msg: string): void => void process.stderr.write(`${msg}\n`)

type Observed = { lang: string; dataTheme: string | null; stored: string | null; errors: string[] }

/** Serve one bundle in a bare page and read what it wrote on `<html>` and in storage. */
async function observe(browser: Browser, bundle: AppBundle): Promise<Observed> {
  const [chunk] = bundle.chunks
  if (bundle.chunks.length !== 1 || chunk === undefined) throw new Error('expected one chunk')
  const server = Bun.serve({
    port: 0,
    fetch: (req) =>
      new URL(req.url).pathname === '/app.js'
        ? new Response(chunk.code, { headers: { 'content-type': 'text/javascript' } })
        : new Response(
            '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Q1</title></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
            { headers: { 'content-type': 'text/html' } },
          ),
  })
  const errors: string[] = []
  const ctx = await browser.newContext()
  try {
    const page: Page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://localhost:${server.port}/`)
    await page.waitForSelector('#root > div', { state: 'attached' })
    // Effects run after the first commit; two frames is enough for both.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    const seen = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      stored: localStorage.getItem('basalt:scheme'),
    }))
    return { ...seen, errors }
  } finally {
    await ctx.close()
    await server.stop(true)
  }
}

log('measuring')
const m = await measureProviderV3()
const reactVersion = (
  createRequire(resolve(import.meta.dir, 'package.json'))('react/package.json') as {
    version: string
  }
).version

let browserResult:
  | { ran: true; fixture: Observed; control: Observed; held: boolean; detectorWorks: boolean }
  | { ran: false; reason: string }
log('browser')
try {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    const fixture = await observe(browser, m.app)
    const control = await observe(browser, m.base0)
    const held =
      fixture.lang === 'de-DE' &&
      fixture.dataTheme === 'dark' &&
      fixture.stored === 'dark' &&
      fixture.errors.length === 0
    // The control has no provider: if it shows the same marks the detector reads the page, not the code.
    const detectorWorks =
      control.lang === 'en' && control.dataTheme === null && control.stored === null
    browserResult = { ran: true, fixture, control, held, detectorWorks }
  } finally {
    await browser.close()
  }
} catch (error) {
  browserResult = {
    ran: false,
    reason: error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error),
  }
}

process.stdout.write(
  `${JSON.stringify({
    providerGzipBytes: m.providerGzipBytes,
    rowCeilingBytes: PROVIDER_V3_CEILING,
    bannedInChunk: m.bannedInChunk.map((l) =>
      l.replace(/^(\w[\w-]*): .*\/(packages\/.*)$/, '$1: $2'),
    ),
    verdict: m.providerGzipBytes <= PROVIDER_V3_CAP ? 'pass' : 'refuted',
    detail: {
      capBytes: PROVIDER_V3_CAP,
      fixtureGzipBytes: m.fixtureGzipBytes,
      base0GzipBytes: m.base0GzipBytes,
      chunkCount: m.chunkCount,
      withinRow: m.providerGzipBytes <= PROVIDER_V3_CEILING,
      reactVersion,
      browser: browserResult,
    },
  })}\n`,
)
