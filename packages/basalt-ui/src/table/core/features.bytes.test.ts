/**
 * Measures the engine fixture by the method of docs/v3/concepts/quality-contract.md section 6:
 * Vite production build with peers bundled, `gzipSync` over every chunk, minus `base0` built in
 * the same run. The number is the S5 input (data-table E1); the ceiling row is the spike's to set,
 * so this test guards only against a bundle that pulls in features outside the closed ten.
 */
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'bun:test'
import { BASE0, bundleApp, gzipBytes } from '../../../scripts/check-budgets/provider-v3'
import type { AppBundle } from '../../../scripts/check-budgets/provider-v3'
import { FEATURE_NAMES } from './features'

const FIXTURE = join(import.meta.dir, '../../../scripts/fixtures/table-engine.tsx')

/**
 * Measured 23,248 B on table-core 9.2.8 (2026-11-11) + 5%, rounded up to 0.5 KB (section 6). The
 * concept's 17,913 B was table-core alone through `bun build --minify`; this adds the React
 * adapter (`createTableHook`, the store) that every `DataTable` pays.
 */
const GUARD_BYTES = 24_500

/** Feature objects outside the closed ten. Some of their utils ride in (grouping orders columns). */
const NOT_REGISTERED = [
  'columnSizingFeature',
  'columnResizingFeature',
  'columnOrderingFeature',
  'rowPinningFeature',
  'rowAggregationFeature',
  'cellSelectionFeature',
  'cellSpanningFeature',
]

let engine: AppBundle
let engineGz = 0

beforeAll(async () => {
  const [app, base0] = [await bundleApp(FIXTURE), await bundleApp(BASE0)]
  engine = app
  engineGz = gzipBytes(app) - gzipBytes(base0)
  process.stdout.write(`table engine fixture (10 features): ${engineGz} B gz over base0\n`)
}, 60_000)

describe('engine bytes', () => {
  test('the 10-feature engine fixture is measured and stays inside the guard', () => {
    expect(engineGz).toBeGreaterThan(0)
    expect(engineGz).toBeLessThanOrEqual(GUARD_BYTES)
  })

  test('features outside the closed ten are absent from the bundle; the ten are present', () => {
    const features = new Set(
      engine.chunks
        .flatMap((c) => c.moduleIds)
        .flatMap(
          (id) =>
            /\/table-core\/dist\/features\/[a-z-]+\/(\w+Feature)\.js$/.exec(id)?.slice(1) ?? [],
        ),
    )
    for (const absent of NOT_REGISTERED) expect(features).not.toContain(absent)
    expect([...features].toSorted()).toEqual([...FEATURE_NAMES].toSorted())
  })
})
