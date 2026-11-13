/**
 * The WebKit lane's negative controls as a test: every seeded offender fails its own check on the
 * iPhone descriptor and the clean page passes them all. `make evidence` runs the same controls inside
 * the lane; this file is the fast loop while editing a check:
 *
 *   BASALT_QUALITY_CONTROLS=1 bun --config=packages/basalt-ui/tests/quality/matrix/bunfig.toml test packages/basalt-ui/tests/quality/webkit
 *
 * Unset (the root `bun test`, `make check`), it does nothing: it needs WebKit and no DOM preload.
 */
import { join } from 'node:path'
import { afterAll, expect, test } from 'bun:test'
import { launchWebkit, runWebkitControls } from './webkit'

// Under `bun test` the event loop wakes for the browser socket only on its next timer tick (matrix/harness.ts).
const keepAwake = setInterval(() => {}, 10)
const enabled = (process.env['BASALT_QUALITY_CONTROLS'] ?? '') !== ''

test.skipIf(!enabled)(
  'every WebKit offender fails its check and the clean page passes',
  async () => {
    const browser = await launchWebkit()
    try {
      const outcomes = await runWebkitControls(browser, (name) =>
        Bun.file(join(import.meta.dirname, 'offenders', `${name}.html`)).text(),
      )
      expect(outcomes.filter((o) => !o.ok)).toEqual([])
    } finally {
      await browser.close()
    }
  },
  120_000,
)

afterAll(() => clearInterval(keepAwake))
