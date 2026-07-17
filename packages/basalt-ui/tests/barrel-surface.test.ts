/**
 * Barrel surface guard: `./tokens` and `./charts` are the published, Mantine-free surfaces —
 * consumers reach for `VX` / `alpha` / the factory helpers plus the two doctrine-prescribed
 * building blocks `BP` (raw hue families) and `p` (pair-picker), which every consumer series
 * module composes (`hrv: p(BP.blue)` — argo's series.ts, the DESIGN.md recipe). The REST of the
 * raw palette data (`ACCENT`, `FILL`, `INK`, `NEUTRAL`, `SEMANTIC`, `SHADOW`, `STATUS`,
 * `SURFACE`) stays internal. Locks down that boundary so a future re-export of the internal data
 * is a red test, not a silent surface-area leak — and so BP/p can never silently drop off the
 * barrel again (they were missing at 1.0.0 and hard-failed argo's build).
 */
import { describe, expect, it } from 'bun:test'

import * as chartsBarrel from '../src/charts'
import * as tokensBarrel from '../src/tokens'

const RAW_PALETTE_KEYS = [
  'ACCENT',
  'FILL',
  'INK',
  'NEUTRAL',
  'SEMANTIC',
  'SHADOW',
  'STATUS',
  'SURFACE',
] as const

const REQUIRED_KEYS = [
  'VX',
  'alpha',
  'buildPaletteCss',
  'defineSeries',
  'seriesTokens',
  'groupTokens',
] as const

// BP/p are `./tokens`-only: a series module imports its building blocks from basalt-ui/tokens.
// `./charts` re-exports the token REFS it needs, not the raw hue families.
const TOKENS_ONLY_KEYS = ['BP', 'p'] as const

describe('barrel surface', () => {
  describe('./tokens', () => {
    for (const key of RAW_PALETTE_KEYS) {
      it(`does not export raw palette data '${key}'`, () => {
        expect(Object.prototype.hasOwnProperty.call(tokensBarrel, key)).toBe(false)
        expect((tokensBarrel as Record<string, unknown>)[key]).toBeUndefined()
      })
    }

    for (const key of [...REQUIRED_KEYS, ...TOKENS_ONLY_KEYS]) {
      it(`still exports '${key}'`, () => {
        expect((tokensBarrel as Record<string, unknown>)[key]).toBeDefined()
      })
    }
  })

  describe('./charts', () => {
    for (const key of [...RAW_PALETTE_KEYS, ...TOKENS_ONLY_KEYS]) {
      it(`does not export raw palette data '${key}'`, () => {
        expect(Object.prototype.hasOwnProperty.call(chartsBarrel, key)).toBe(false)
        expect((chartsBarrel as Record<string, unknown>)[key]).toBeUndefined()
      })
    }

    for (const key of REQUIRED_KEYS) {
      it(`still exports '${key}'`, () => {
        expect((chartsBarrel as Record<string, unknown>)[key]).toBeDefined()
      })
    }
  })
})
