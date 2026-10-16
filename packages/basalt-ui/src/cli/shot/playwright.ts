/**
 * Playwright, resolved from the CONSUMER (it is not a basalt dependency) and typed through the
 * minimal structural surface `shot` uses — the package never imports Playwright at build time.
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'

export const INSTALL_LINE =
  'basalt-ui shot needs Playwright: bun add -d playwright && bunx playwright install chromium'

export type Box = { x: number; y: number; width: number; height: number }

export type PwLocator = {
  first(): PwLocator
  count(): Promise<number>
  hover(options?: { timeout?: number }): Promise<void>
  isVisible(): Promise<boolean>
  boundingBox(): Promise<Box | null>
  scrollIntoViewIfNeeded(): Promise<void>
  waitFor(options: { state: 'visible'; timeout: number }): Promise<void>
  screenshot(options: { path: string; animations: 'disabled'; caret: 'hide' }): Promise<unknown>
  evaluate<R>(fn: (el: Element) => R): Promise<R>
}

export type PwPage = {
  goto(url: string, options: { waitUntil: 'load' | 'networkidle' }): Promise<unknown>
  setDefaultTimeout(ms: number): void
  locator(selector: string): PwLocator
  evaluate<R>(fn: string): Promise<R>
  keyboard: { press(key: string): Promise<void> }
  mouse: { move(x: number, y: number): Promise<void> }
  screenshot(options: {
    path: string
    fullPage?: boolean
    clip?: Box
    animations: 'disabled'
    caret: 'hide'
  }): Promise<unknown>
}

export type PwContext = {
  newPage(): Promise<PwPage>
  addInitScript(script: string): Promise<void>
  close(): Promise<void>
}

export type PwBrowser = {
  newContext(options: {
    viewport: { width: number; height: number }
    deviceScaleFactor: number
    isMobile: boolean
    hasTouch: boolean
    colorScheme: 'light' | 'dark'
    reducedMotion: 'reduce'
  }): Promise<PwContext>
}

type PwServer = { wsEndpoint(): string; kill(): Promise<void> }
export type Playwright = {
  chromium: {
    launchServer(options: { channel?: string; chromiumSandbox: boolean }): Promise<PwServer>
    connect(wsEndpoint: string): Promise<PwBrowser>
  }
}

/** Thrown for failures that print one line and exit 1 (no stack). */
export class ShotError extends Error {}

export type PlaywrightResolver = (cwd: string) => Playwright | null

export const resolvePlaywright: PlaywrightResolver = (cwd) => {
  const require = createRequire(join(cwd, 'package.json'))
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return require(name) as Playwright
    } catch {
      // not installed under this name: try the next
    }
  }
  return null
}

/**
 * One Chrome for `fn`, killed afterwards. `launchServer` + `connect` + `kill()` — a graceful
 * `close()` hangs under Bun. Bundled chromium first, then the system `chrome` channel.
 */
export async function withBrowser<T>(pw: Playwright, fn: (b: PwBrowser) => Promise<T>): Promise<T> {
  const chromiumSandbox = !process.env['CI']
  for (const channel of [undefined, 'chrome']) {
    let server: PwServer | undefined
    let browser: PwBrowser
    try {
      server = await pw.chromium.launchServer(
        channel ? { channel, chromiumSandbox } : { chromiumSandbox },
      )
      browser = await pw.chromium.connect(server.wsEndpoint())
    } catch {
      await server?.kill().catch(() => undefined)
      continue
    }
    try {
      return await fn(browser)
    } finally {
      await server.kill().catch(() => undefined)
    }
  }
  throw new ShotError(INSTALL_LINE)
}
