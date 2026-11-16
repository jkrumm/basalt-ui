/**
 * The one switch for which browser the layout and quality-matrix harnesses launch:
 * `BASALT_TEST_BROWSER=shell|chrome`.
 *
 * - `chrome`: installed Google Chrome (`channel: 'chrome'`). playwright-core's per-platform table resolves
 *   `/opt/google/chrome/chrome` on linux and the .app bundle on darwin. NOTHING is ever downloaded. Use the
 *   channel, not `executablePath`, which Playwright documents as "at your own risk".
 * - `shell`: Playwright's bundled chromium-headless-shell (no `channel`, headless). It comes from
 *   `make browser-shell` (`playwright-core install --only-shell chromium`), an explicit step, never a launch side effect.
 */
import type { LaunchOptions } from 'playwright-core'

export type TestBrowser = 'shell' | 'chrome'

/**
 * The browser of a run: `BASALT_TEST_BROWSER`, else the shell. Measured 2026-11-16 on the mini: the layout
 * suite, the quality matrix and the print controls pass identically on both, the shell at a third to a half of
 * Chrome's peak memory and (matrix) 2.7x faster (AGENTS.md Gotchas).
 */
export const readTestBrowser = (): TestBrowser => {
  const value = process.env['BASALT_TEST_BROWSER']
  if (value === undefined || value === '') return 'shell'
  if (value === 'shell' || value === 'chrome') return value
  throw new Error(`BASALT_TEST_BROWSER must be "shell" or "chrome", got "${value}"`)
}

/** Launch options for one browser; `chromiumSandbox` is off on CI (see the harnesses). */
export const testBrowserOptions = (browser: TestBrowser): LaunchOptions => ({
  ...(browser === 'chrome' ? { channel: 'chrome' } : {}),
  chromiumSandbox: !process.env['CI'],
})
