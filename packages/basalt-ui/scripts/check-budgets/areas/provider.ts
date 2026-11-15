/**
 * Area: provider — what the v3 `BasaltProvider` costs a consumer's first paint, and the modules its
 * closure must not reach. The 2.x provider's rows left with `src/provider`.
 */
import { gate } from '../lib'
import type { RowDef } from '../lib'
import { measureProviderV3 } from '../provider-v3'

const PROVIDER_V3_LABEL =
  'v3 provider skeleton (src/core/provider), gzip B minus base0, peers bundled'
// Q1 (docs/v3/spikes/provider.md): 298 B measured (fixture 77032 - base0 76734), +5% = 313, rounded up
// to 0.5 KB = 500; the cap is 5000 and is never edited. Ratchets down only.
export const PROVIDER_V3_CEILING = 500

export const rows: readonly RowDef[] = [
  {
    id: 'provider-v3',
    order: 115,
    label: PROVIDER_V3_LABEL,
    ceiling: PROVIDER_V3_CEILING,
    measure: async (ctx) => (await ctx.once('provider-v3', measureProviderV3)).providerGzipBytes,
  },
  {
    id: 'provider-v3-banned',
    order: 116,
    label: 'v3 provider skeleton: persisted, Toast, cn, message and Intl modules in the closure',
    ceiling: 0,
    measure: async (ctx) => gate((await ctx.once('provider-v3', measureProviderV3)).bannedInChunk),
  },
]
