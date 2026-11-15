/**
 * The G4 freeze (v3-freeze-g4): the `./charts` value-export list is frozen at 12, and the Heatmap
 * and BandStrip marginals hold a ceiling no higher than 4.0 KB that only a raise row can lift.
 */
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

import { CHART_SUBPATH } from '../surface-gates'
import { ALLOWED, LEGACY, chartsApiViolations } from './areas/charts-api'
import { readSurface } from './lib'
import type { AreaModule } from './lib'
import { ratchetViolations } from './ratchet'

const API_AREA = join(import.meta.dir, 'areas/charts-api.ts')
const G4_AREA = join(import.meta.dir, 'areas/charts-g4.ts')
const g4 = (await import('./areas/charts-g4')) as AreaModule

describe('charts-api', () => {
  test('the frozen set is twelve names', () => {
    expect(new Set(ALLOWED).size).toBe(12)
    expect(ALLOWED.filter((name) => LEGACY.includes(name))).toEqual([])
  })

  test('the current ./charts surface is green', () => {
    expect(chartsApiViolations(readSurface()[CHART_SUBPATH] ?? [])).toEqual([])
  })

  test('useChartFocus and chartLabels are green', () => {
    expect(chartsApiViolations(['useChartFocus', 'chartLabels'])).toEqual([])
  })

  test('a thirteenth value export is red', () => {
    expect(chartsApiViolations([...ALLOWED, 'ThirteenthKind'])).toHaveLength(1)
  })
})

describe('charts-g4', () => {
  test('both marginals carry the Issue 1407 amendment, each with a raise row', () => {
    const ceiling = (id: string) => g4.rows.find((r) => r.id === id)?.ceiling ?? 0
    expect(ceiling('charts-band-strip-marginal')).toBe(18500)
    expect(ceiling('charts-heatmap-marginal')).toBe(5500)
    expect(Object.keys(g4.raises).toSorted()).toEqual([
      'charts-band-strip-marginal',
      'charts-heatmap-marginal',
    ])
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
})
