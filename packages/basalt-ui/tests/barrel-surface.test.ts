/**
 * Barrel surface guard: `./tokens` and `./charts` are the published, Mantine-free surfaces —
 * consumers must reach for `VX` / `alpha` / the factory helpers, never the raw palette data
 * (`ACCENT`, `BP`, `FILL`, `INK`, `NEUTRAL`, `p`, `SEMANTIC`, `SHADOW`, `STATUS`, `SURFACE`) that
 * backs them. Locks down that boundary so a future re-export of the raw data is a red test, not a
 * silent surface-area leak.
 */
import { describe, expect, it } from 'bun:test'

import * as chartsBarrel from '../src/charts'
import * as tokensBarrel from '../src/tokens'

const RAW_PALETTE_KEYS = [
  'ACCENT',
  'BP',
  'FILL',
  'INK',
  'NEUTRAL',
  'p',
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

describe('barrel surface', () => {
  describe('./tokens', () => {
    for (const key of RAW_PALETTE_KEYS) {
      it(`does not export raw palette data '${key}'`, () => {
        expect(Object.prototype.hasOwnProperty.call(tokensBarrel, key)).toBe(false)
        expect((tokensBarrel as Record<string, unknown>)[key]).toBeUndefined()
      })
    }

    for (const key of REQUIRED_KEYS) {
      it(`still exports '${key}'`, () => {
        expect((tokensBarrel as Record<string, unknown>)[key]).toBeDefined()
      })
    }
  })

  describe('./charts', () => {
    for (const key of RAW_PALETTE_KEYS) {
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
