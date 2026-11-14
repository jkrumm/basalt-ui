/**
 * Area: data — the `./data` subpath's size (docs/v3/ARCHITECTURE.md section 3), G1 freeze. Seed: the
 * first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract section 6), ratcheted
 * down only; `../ui-bundle` measures it (gzip B minus `base0`, peers bundled, whole barrel).
 */
import type { Raises, RowDef } from '../lib'
import { measureSource, reExportAll } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'data-subpath',
    order: 410,
    label: 'data, whole barrel (gzip B minus base0, src/data, peers bundled)',
    // 17526 B measured; 21706 B with `createChannel` (v3 state-1 wiring: the channel ships with the data layer).
    ceiling: 22000,
    measure: () => measureSource(reExportAll({ data: 'data/index' })),
  },
]

export const raises: Raises = {
  'data-subpath': [
    {
      from: 18500,
      to: 22000,
      consumer:
        '`createChannel` from `./data`: software-factory console src/lib/live.ts opens its push channel and binds it with `bindInvalidation`, so the channel runtime (fetch-SSE reader, reconnect, dedupe) joins the data barrel it already imports',
      repo: 'software-factory',
    },
  ],
}
