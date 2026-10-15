/**
 * Barrel surface guard: `./tokens` and `./charts` are the published, Mantine-free surfaces.
 * `./tokens` is the ONE home of the token layer — consumers reach for `VX` / `alpha` / the factory
 * helpers plus the two doctrine-prescribed
 * building blocks `BP` (raw hue families) and `p` (pair-picker), which every consumer series
 * module composes (`hrv: p(BP.blue)` — argo's series.ts, the DESIGN.md recipe). The REST of the
 * raw palette data (`ACCENT`, `FILL`, `INK`, `NEUTRAL`, `SEMANTIC`, `SHADOW`, `STATUS`,
 * `SURFACE`) stays internal. Locks down that boundary so a future re-export of the internal data
 * is a red test, not a silent surface-area leak — and so BP/p can never silently drop off the
 * barrel again (they were missing at 1.0.0 and hard-failed argo's build). `./charts` (2.0,
 * docs/V2-SPEC.md § 9) is exactly its five values and re-exports nothing from `./tokens`,
 * `./format` or the engine.
 */
import { describe, expect, it } from 'bun:test'

import * as agentBarrel from '../src/agent'
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
const TOKENS_ONLY_KEYS = ['BP', 'p'] as const

const CHART_VALUES = [
  'BandStrip',
  'Bars',
  'CartesianChart',
  'ChartCard',
  'Donut',
  'DualPanel',
  'Heatmap',
  'Lines',
  'MirroredBars',
  'Sparkline',
  'StackedArea',
  'chartCursor',
  'chartCurve',
  'foldBands',
] as const

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
    it('exports exactly the 2.0 chart values', () => {
      expect(Object.keys(chartsBarrel).toSorted()).toEqual([...CHART_VALUES])
    })

    for (const key of [...RAW_PALETTE_KEYS, ...TOKENS_ONLY_KEYS, ...REQUIRED_KEYS]) {
      it(`does not re-export the token layer's '${key}'`, () => {
        expect(Object.prototype.hasOwnProperty.call(chartsBarrel, key)).toBe(false)
      })
    }
  })

  // ./agent — the V2-SPEC section 1 surface: the transport and runner plus the chat UI folded in from
  // the former ./agent-chat. `ToolChipRenderer` (the internal adapter) was never exported.
  describe('./agent', () => {
    const AGENT_REQUIRED_KEYS = [
      'aiSdkTransport',
      'useAgentThreadRuns',
      'parseAgentPart',
      'ThreadFeed',
      'ThreadFeedRow',
      'Composer',
      'ToolChip',
    ] as const

    for (const key of AGENT_REQUIRED_KEYS) {
      it(`exports '${key}'`, () => {
        expect((agentBarrel as Record<string, unknown>)[key]).toBeDefined()
      })
    }

    it('does not export the internal ToolChipRenderer adapter', () => {
      expect(Object.prototype.hasOwnProperty.call(agentBarrel, 'ToolChipRenderer')).toBe(false)
    })
  })
})
