/**
 * `provider.budget` (docs/v3/concepts/quality-contract.md section 10): the v3 provider chunk is at
 * most its `provider-v3` row, the row is at most the 5.0 KB cap, and none of the hard zeros
 * (`cn` tables, message tables, Intl caches, the `en` catalog) is in it.
 */
import { beforeAll, describe, expect, test } from 'bun:test'

import { PROVIDER_V3_CEILING, rows } from '../../scripts/check-budgets/areas/provider'
import {
  PROVIDER_V3_CAP,
  ceilingFor,
  measureProviderV3,
} from '../../scripts/check-budgets/provider-v3'
import type { ProviderV3Measure } from '../../scripts/check-budgets/provider-v3'

let measured: ProviderV3Measure

beforeAll(async () => {
  measured = await measureProviderV3()
}, 60_000)

describe('provider.budget', () => {
  test('the provider-v3 row is the exported ceiling and sits under the cap', () => {
    const row = rows.find((r) => r.id === 'provider-v3')
    expect(row?.ceiling).toBe(PROVIDER_V3_CEILING)
    expect(PROVIDER_V3_CEILING).toBeLessThanOrEqual(PROVIDER_V3_CAP)
  })

  test('the provider chunk fits its row', () => {
    expect(measured.providerGzipBytes).toBeGreaterThan(0)
    expect(measured.providerGzipBytes).toBeLessThanOrEqual(PROVIDER_V3_CEILING)
  })

  test('the hard zeros are absent', () => {
    expect(measured.bannedInChunk).toEqual([])
  })
})

describe('ceilingFor', () => {
  test.each([
    [298, 500],
    [476, 500],
    [477, 1000],
    [4760, 5000],
    [9000, PROVIDER_V3_CAP],
  ])('%i B measured → %i B', (bytes, ceiling) => {
    expect(ceilingFor(bytes)).toBe(ceiling)
  })
})
