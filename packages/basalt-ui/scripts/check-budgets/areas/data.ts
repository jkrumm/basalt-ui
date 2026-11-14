/**
 * Area: data — the `./data` subpath's size (docs/v3/ARCHITECTURE.md section 3), G1 freeze. Seed: the
 * first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract section 6), ratcheted
 * down only; `../ui-bundle` measures it (gzip B minus `base0`, peers bundled, whole barrel).
 */
import type { RowDef } from '../lib'
import { measureSource, reExportAll } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'data-subpath',
    order: 410,
    label: 'data, whole barrel (gzip B minus base0, src/data, peers bundled)',
    // 17526 B measured.
    ceiling: 18500,
    measure: () => measureSource(reExportAll({ data: 'data/index' })),
  },
]
