/**
 * The print lane's negative controls as a test: every seeded offender fails its own assertion and the
 * clean page passes them all. `make evidence` runs the same controls inside the lane; this file is
 * the fast loop while editing an assertion:
 *
 *   BASALT_QUALITY_CONTROLS=1 bun --config=packages/basalt-ui/tests/quality/matrix/bunfig.toml test packages/basalt-ui/tests/quality/print
 *
 * Unset (the root `bun test`, `make check`), it does nothing: it needs Chrome and no DOM preload.
 */
import { join } from 'node:path'
import { afterAll, expect, test } from 'bun:test'
import { chromium } from 'playwright-core'
import { runControls } from './print'

// Under `bun test` the event loop wakes for the browser socket only on its next timer tick (matrix/harness.ts).
const keepAwake = setInterval(() => {}, 10)
const enabled = (process.env['BASALT_QUALITY_CONTROLS'] ?? '') !== ''

test.skipIf(!enabled)(
  'every print offender fails its assertion and the clean page passes',
  async () => {
    const browser = await chromium.launch({ channel: 'chrome' })
    try {
      const page = await (await browser.newContext()).newPage()
      const outcomes = await runControls(page, (name) =>
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
