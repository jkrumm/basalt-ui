/**
 * The quality matrix (quality-contract section 4): every playground route x viewport x scheme, each
 * cell running the same assertions consumers import as `quality.*`, plus one 390 dark pseudo-locale
 * cell per route.
 *
 *   BASALT_MATRIX=sampled  routes x {1800x1200 light en, 390x844 dark pseudo}      (make check)
 *   BASALT_MATRIX=full     routes x {1800x1200, 390x844} x {light, dark} + pseudo   (make evidence)
 *
 * Unset (the root `bun test`), the file does nothing: it needs Chrome and no happy-dom preload.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { runCell } from './assertions'
import { classify, KNOWN } from './known'
import type { KnownFinding } from './known'
import { bootMatrix } from './harness'
import { routePaths } from './routes'

const mode = process.env['BASALT_MATRIX']
const enabled = mode === 'sampled' || mode === 'full'
const harness = enabled ? await bootMatrix() : null

type Cell = {
  route: string
  width: number
  height: number
  scheme: 'light' | 'dark'
  pseudo: boolean
}

const DESKTOP = { width: 1800, height: 1200 }
const PHONE = { width: 390, height: 844 }

function cells(): Cell[] {
  const out: Cell[] = []
  for (const route of routePaths()) {
    if (mode === 'full') {
      for (const size of [DESKTOP, PHONE]) {
        for (const scheme of ['light', 'dark'] as const) {
          out.push({ route, ...size, scheme, pseudo: false })
        }
      }
      out.push({ route, ...PHONE, scheme: 'dark', pseudo: true })
    } else {
      out.push({ route, ...DESKTOP, scheme: 'light', pseudo: false })
      out.push({ route, ...PHONE, scheme: 'dark', pseudo: true })
    }
  }
  return out
}

const used = new Set<KnownFinding>()

afterAll(async () => {
  await harness?.close()
}, 30_000)

describe.skipIf(harness === null)(`quality matrix (${mode})`, () => {
  test.each(enabled ? cells() : [])(
    '$route $width x $height $scheme pseudo=$pseudo',
    async (cell) => {
      if (harness === null) return
      const page = await harness.open({
        width: cell.width,
        height: cell.height,
        pointer: cell.width <= 600 ? 'coarse' : 'fine',
      })
      try {
        const { quality } = await import('../../../src/testing/quality')
        await quality.setScheme(page, cell.scheme)
        await page.goto((cell.pseudo ? harness.pseudoOrigin : harness.origin) + cell.route)
        await page.waitForSelector('[data-slot], main', { timeout: 15_000 })
        const failures = await runCell(page, { pointer: cell.width <= 600 ? 'coarse' : 'fine' })
        const { unexpected, matched } = classify(cell.route, failures)
        for (const entry of matched) used.add(entry)
        expect(unexpected.join('\n')).toBe('')
      } finally {
        await page.context().close()
      }
    },
    90_000,
  )
})

// Only the full run visits every cell, so only it can say an entry no longer matches anything.
describe.skipIf(harness === null || mode !== 'full')('known findings', () => {
  test('every entry still matches a failing item', () => {
    const stale = KNOWN.filter((entry) => !used.has(entry)).map(
      (e) => `${e.route} ${e.assertion} ${String(e.item)}`,
    )
    expect(stale).toEqual([])
  })
})
