/**
 * Playwright, resolved from the CONSUMER (it is not a basalt dependency) and typed through the
 * minimal structural surface `shot` uses: the package never imports it at build time.
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

import type { Scheme } from './types'

export const INSTALL_LINE =
  'basalt-ui shot needs Playwright: bun add -d playwright && bunx playwright install chromium'

/** A headless Chromium reports `(hover: none)`; these make its primary input a mouse so `@media (hover: hover)` applies. */
export const POINTER_ARGS = [
  '--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4',
]

export type Box = { x: number; y: number; width: number; height: number }

export type ShotOptions = {
  path: string
  animations: 'disabled'
  caret: 'hide'
  fullPage?: boolean
  clip?: Box
  timeout?: number
}

export type PwLocator = {
  first(): PwLocator
  last(): PwLocator
  count(): Promise<number>
  hover(options?: { timeout?: number }): Promise<void>
  boundingBox(): Promise<Box | null>
  waitFor(options: { state: 'visible'; timeout: number }): Promise<void>
  screenshot(options: ShotOptions): Promise<unknown>
  evaluate<R>(fn: (el: Element) => R): Promise<R>
}

export type PwPage = {
  goto(url: string, options: { waitUntil: 'load' | 'networkidle' }): Promise<unknown>
  setDefaultTimeout(ms: number): void
  setViewportSize(size: { width: number; height: number }): Promise<void>
  locator(selector: string): PwLocator
  evaluate<R>(expression: string): Promise<R>
  evaluate<R, A>(fn: (arg: A) => R, arg: A): Promise<R>
  setContent(html: string, options: { waitUntil: 'load' }): Promise<void>
  keyboard: { press(key: string): Promise<void> }
  mouse: { move(x: number, y: number): Promise<void> }
  screenshot(options: ShotOptions): Promise<unknown>
}

export type PwContext = {
  newPage(): Promise<PwPage>
  addInitScript(script: string): Promise<unknown>
  close(): Promise<void>
}

export type ContextOptions = {
  viewport: { width: number; height: number }
  deviceScaleFactor: number
  isMobile: boolean
  hasTouch: boolean
  colorScheme: Scheme
  reducedMotion: 'reduce'
}

export type PwBrowser<C extends PwContext = PwContext> = {
  newContext(options: ContextOptions): Promise<C>
}

type PwServer = { wsEndpoint(): string; kill(): Promise<void> }
type LaunchOptions = { channel?: string; chromiumSandbox: boolean; args: string[] }
export type Playwright<B extends PwBrowser = PwBrowser> = {
  chromium: {
    launchServer(options: LaunchOptions): Promise<PwServer>
    connect(ws: string): Promise<B>
  }
}

/** Thrown for failures that print one line and exit 1 (no stack). */
export class ShotError extends Error {}

export type PlaywrightResolver = (cwd: string) => Playwright | null

export const isPlaywright = (mod: unknown): mod is Playwright => {
  const chromium = (mod as { chromium?: Record<string, unknown> } | null)?.chromium
  return (
    typeof chromium?.['launchServer'] === 'function' && typeof chromium['connect'] === 'function'
  )
}

export const resolvePlaywright: PlaywrightResolver = (cwd) => {
  const require = createRequire(join(cwd, 'package.json'))
  for (const name of ['playwright', 'playwright-core']) {
    try {
      const mod: unknown = require(name)
      if (isPlaywright(mod)) return mod
    } catch {
      // not installed under this name: try the next
    }
  }
  return null
}

const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? ''

/** `kill()` bounded by a hang guard: a graceful stop can wedge under Bun. */
function killBounded(server: PwServer): Promise<unknown> {
  const guard = new Promise((resolve) => setTimeout(resolve, 10_000).unref())
  return Promise.race([server.kill().catch(() => undefined), guard])
}

/**
 * One Chrome for `fn` (bundled, then `chrome`), killed afterwards: `launchServer` + `connect` +
 * `kill()`, because a graceful `close()` hangs under Bun. `stops` receives this run's kill.
 */
export async function withBrowser<B extends PwBrowser, T>(
  pw: Playwright<B>,
  fn: (browser: B, channel: string) => Promise<T>,
  {
    channels = [undefined, 'chrome'],
    stops,
  }: { channels?: readonly (string | undefined)[]; stops?: (() => unknown)[] } = {},
): Promise<T> {
  const chromiumSandbox = !process.env['CI']
  const failures: string[] = []
  for (const channel of channels) {
    let server: PwServer | undefined
    let browser: B
    try {
      server = await pw.chromium.launchServer({
        ...(channel && { channel }),
        chromiumSandbox,
        args: POINTER_ARGS,
      })
      browser = await pw.chromium.connect(server.wsEndpoint())
    } catch (error) {
      failures.push(`  ${channel ?? 'bundled chromium'}: ${firstLine(error)}`)
      if (server) await killBounded(server)
      continue
    }
    const live = server
    stops?.push(() => killBounded(live))
    try {
      return await fn(browser, channel ?? 'chromium')
    } finally {
      await killBounded(live)
    }
  }
  throw new ShotError([INSTALL_LINE, ...failures].join('\n'))
}
