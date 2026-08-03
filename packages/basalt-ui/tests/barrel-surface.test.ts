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

import * as agentBarrel from '../src/agent'
import * as agentChatBarrel from '../src/agent-chat'
import * as chartsBarrel from '../src/charts'
import * as rootBarrel from '../src/index'
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

  // ./agent — the headless part-renderer registry seam (B2 lane 2): `definePartRenderers` and
  // `narrowAgentPart` are the two runtime-checkable values `ThreadTranscript`'s open-registry
  // resolution order depends on. `ToolRenderer` (the pre-1.11.0 always-expanded tool renderer) was
  // never exported from this barrel, so there is nothing to assert removed. `isResumable` is the
  // B2 convergence-pass fix: it lived in transport.ts but was missing from this barrel.
  describe('./agent', () => {
    const AGENT_REQUIRED_KEYS = ['definePartRenderers', 'narrowAgentPart', 'isResumable'] as const

    for (const key of AGENT_REQUIRED_KEYS) {
      it(`exports '${key}'`, () => {
        expect((agentBarrel as Record<string, unknown>)[key]).toBeDefined()
      })
    }
  })

  // ./agent-chat — `ToolChip` replaces the internal `ToolRenderer`/`ToolChipRenderer` adapter as
  // the public collapsed tool-call row; neither adapter is (or was) exported here.
  describe('./agent-chat', () => {
    const AGENT_CHAT_REQUIRED_KEYS = [
      'ToolChip',
      'threadPartRenderers',
      'ThreadTranscript',
    ] as const

    for (const key of AGENT_CHAT_REQUIRED_KEYS) {
      it(`exports '${key}'`, () => {
        expect((agentChatBarrel as Record<string, unknown>)[key]).toBeDefined()
      })
    }

    it('does not export the internal ToolChipRenderer adapter', () => {
      expect(Object.prototype.hasOwnProperty.call(agentChatBarrel, 'ToolChipRenderer')).toBe(false)
    })
  })

  // root (.) — the B2 convergence-pass fix: `ToolChip` is documented ("from `./agent-chat` and
  // `.`") but was missing from the root's selective re-export of `./agent-chat`.
  describe('. (root)', () => {
    it("exports 'ToolChip'", () => {
      expect((rootBarrel as Record<string, unknown>)['ToolChip']).toBeDefined()
    })
  })
})
