/**
 * The G4 freeze (v3-freeze-g4): the `./charts` value-export list is frozen at 13 (12, amended by
 * Issue 2306 for `IntervalTrack`), and the Heatmap and BandStrip marginals hold a ceiling no higher
 * than 4.0 KB that only a raise row can lift; the IntervalTrack marginal is seeded at its own.
 */
import { describe, expect, test } from 'bun:test'
import { dirname, join, resolve } from 'node:path'

import { CHART_SUBPATH } from '../surface-gates'
import { ALLOWED, LEGACY, chartsApiViolations } from './areas/charts-api'
import { readSurface } from './lib'
import type { AreaModule } from './lib'
import { ratchetViolations } from './ratchet'

const API_AREA = join(import.meta.dir, 'areas/charts-api.ts')
const G4_AREA = join(import.meta.dir, 'areas/charts-g4.ts')
const g4 = (await import('./areas/charts-g4')) as AreaModule

describe('charts-api', () => {
  test('the frozen set is fifteen names', () => {
    expect(new Set(ALLOWED).size).toBe(15)
    expect(ALLOWED.filter((name) => LEGACY.includes(name))).toEqual([])
  })

  test('the current ./charts surface is green', () => {
    expect(chartsApiViolations(readSurface()[CHART_SUBPATH] ?? [])).toEqual([])
  })

  test('useChartFocus and chartLabels are green', () => {
    expect(chartsApiViolations(['useChartFocus', 'chartLabels'])).toEqual([])
  })

  test('a fourteenth value export is red', () => {
    expect(chartsApiViolations([...ALLOWED, 'FourteenthKind'])).toHaveLength(1)
  })
})

describe('charts-g4', () => {
  test('both marginals hold their cap; the heat grid has raise rows, 4000 to 4500 B (Issues 1627, 1872 and 2468)', () => {
    const frozen = g4.rows.filter((r) => r.id !== 'charts-interval-track-marginal')
    for (const row of frozen) expect(row.ceiling).toBeLessThanOrEqual(4500)
    expect(g4.rows.map((r) => r.id)).toEqual([
      'charts-heatmap-marginal',
      'charts-band-strip-marginal',
      'charts-interval-track-marginal',
    ])
    expect(Object.keys(g4.raises)).toEqual(['charts-heatmap-marginal'])
  })

  test('no chart module imports the deleted 2.x shell or compile', async () => {
    const root = join(import.meta.dir, '../../src/charts')
    const offenders: string[] = []
    for await (const file of new Bun.Glob('**/*.{ts,tsx}').scan(root)) {
      const source = await Bun.file(join(root, file)).text()
      for (const [, from] of source.matchAll(/from '(\.[^']*)'/g)) {
        const target = resolve(root, dirname(file), from ?? '')
        if (target === join(root, 'CartesianChart') || target === join(root, 'compile'))
          offenders.push(file)
      }
    }
    expect(offenders).toEqual([])
  })

  test('a raised marginal ceiling with no raise row fails the ratchet', async () => {
    const source = await Bun.file(G4_AREA).text()
    const lowered = source.replace(
      /(id: 'charts-band-strip-marginal'[\s\S]*?ceiling: )\d+/,
      '$11000',
    )
    expect(lowered).not.toBe(source)
    const violations = await ratchetViolations({
      files: [G4_AREA, API_AREA],
      readBase: (file) => (file === G4_AREA ? lowered : null),
    })
    expect(violations).toHaveLength(1)
    expect(violations[0]).toContain('charts-band-strip-marginal')
  })

  test('a base that imports a module this branch deleted is skipped, not an error', async () => {
    const base = "import { gone } from '../does-not-exist'\nexport const rows = [gone]\n"
    const violations = await ratchetViolations({
      files: [G4_AREA],
      readBase: (file) => (file === G4_AREA ? base : null),
    })
    expect(violations).toEqual([])
  })
})
