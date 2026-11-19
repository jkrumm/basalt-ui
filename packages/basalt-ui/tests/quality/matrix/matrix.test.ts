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
import { hoverFindings, KNOWN_SHIFTS, REBUILT_PAGES, TRIAL_PAGES } from './hover-shift'
import { routePaths, scenarioPaths } from './routes'
import { inShard, parseShard, shardLine } from './shard'

const mode = process.env['BASALT_MATRIX']
const enabled = mode === 'sampled' || mode === 'full'
const harness = enabled ? await bootMatrix() : null
// `BASALT_MATRIX_SHARD=<i>/<n>` runs a share of the cells (CI: one job per share); shard.ts has the rule.
const shard = parseShard(process.env['BASALT_MATRIX_SHARD'])
let ran = 0
let total = 0

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
  // `scripts/check-matrix-shards.ts` sums these lines over the shard logs: the shards ran every cell.
  if (harness !== null) process.stdout.write(`${shardLine(shard, ran, total)}\n`)
}, 30_000)

describe.skipIf(harness === null)(`quality matrix (${mode})`, () => {
  const all = enabled ? cells() : []
  total += all.length
  test.each(inShard(all, shard))(
    '$route $width x $height $scheme pseudo=$pseudo',
    async (cell) => {
      if (harness === null) return
      ran += 1
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

// The hover guard: every route and every scenario at the owner's two review widths, a fine pointer
// swept across each chart plot. A plot that moves under the pointer, a tooltip that changes side more
// than once, or a card whose text or widths change outside its readout line fails its page.
describe.skipIf(harness === null)('hover changes the readout, never the chart or its card', () => {
  const pages = [...new Set([...routePaths(), ...scenarioPaths()])]
  const sizes = [DESKTOP, PHONE] as const
  const all = enabled ? pages.flatMap((route) => sizes.map((size) => ({ route, ...size }))) : []
  total += all.length
  test.each(inShard(all, shard))(
    '$route $width x $height',
    async (cell) => {
      if (harness === null) return
      ran += 1
      const page = await harness.open({ width: cell.width, height: cell.height, pointer: 'fine' })
      try {
        await page.goto(harness.origin + cell.route)
        await page.waitForSelector('[data-slot], main', { timeout: 15_000 })
        const found = await hoverFindings(page)
        const of = (kind: string): string =>
          found
            .filter((f) => f.kind === kind)
            .map((f) => f.text)
            .join('\n')
        expect(of('tooltip')).toBe('')
        // A trial build's card follows the focus until its rerun (`TRIAL_PAGES`): only its card check is skipped.
        const trial = TRIAL_PAGES.some((prefix) => cell.route.startsWith(prefix))
        const rebuilt = REBUILT_PAGES.some((prefix) => cell.route.startsWith(prefix))
        if (!trial || rebuilt) expect(of('card')).toBe('')
        const moved = of('moved')
        const known = KNOWN_SHIFTS[`${cell.route} ${cell.width}`]
        if (known === undefined) expect(moved).toBe('')
        // A known shift that no longer moves is fixed: its entry goes.
        else
          expect(
            moved,
            `fixed? remove KNOWN_SHIFTS "${cell.route} ${cell.width}": ${known}`,
          ).not.toBe('')
      } finally {
        await page.context().close()
      }
    },
    90_000,
  )
})

// Only the full run visits every cell, so only it can say an entry no longer matches anything.
// A shard sees a part of the cells, so the stale check belongs to the whole run.
describe.skipIf(harness === null || mode !== 'full' || shard !== null)('known findings', () => {
  test('every entry still matches a failing item', () => {
    const stale = KNOWN.filter((entry) => !used.has(entry)).map(
      (e) => `${e.route} ${e.assertion} ${String(e.item)}`,
    )
    expect(stale).toEqual([])
  })
})
