/**
 * Area: provider — what the v3 `BasaltProvider` costs a consumer's first paint, and the modules its
 * closure must not reach. The 2.x provider's rows left with `src/provider`.
 */
import { gate } from '../lib'
import type { RowDef } from '../lib'
import { measureIsland, measureProviderV3 } from '../provider-v3'

const PROVIDER_V3_LABEL =
  'v3 provider skeleton alone, no router (src/core/provider), gzip B minus base0, peers bundled'
// Q1 (docs/v3/spikes/provider.md): 298 B measured (fixture 77032 - base0 76734), +5% = 313, rounded up
// to 0.5 KB = 500; the cap is 5000 and is never edited. Ratchets down only. 386 B on 2026-11-20
// (fixture 77120 - base0 76734): the provider alone with no router, no `link`, no query client.
export const PROVIDER_V3_CEILING = 500

// The smallest island (an Astro island's own root): a router-less provider plus one `Button`. 9049 B
// on 2026-11-20, +5% = 9502, rounded up to 0.5 KB = 10000. Nearly all of it is the button's `cn`
// and its cva table (the `button` row in ui.ts: 8574 B), not the provider. Ratchets down only.
export const ISLAND_BUTTON_CEILING = 10000

export const rows: readonly RowDef[] = [
  {
    id: 'provider-v3',
    order: 115,
    label: PROVIDER_V3_LABEL,
    ceiling: PROVIDER_V3_CEILING,
    measure: async (ctx) => (await ctx.once('provider-v3', measureProviderV3)).providerGzipBytes,
  },
  {
    id: 'island-button',
    order: 117,
    label:
      'smallest island: router-less BasaltProvider + Button, gzip B minus base0, peers bundled',
    ceiling: ISLAND_BUTTON_CEILING,
    measure: (ctx) => ctx.once('island-button', measureIsland),
  },
  {
    id: 'provider-v3-banned',
    order: 116,
    label: 'v3 provider skeleton: persisted, Toast, cn, message and Intl modules in the closure',
    ceiling: 0,
    measure: async (ctx) => gate((await ctx.once('provider-v3', measureProviderV3)).bannedInChunk),
  },
]
