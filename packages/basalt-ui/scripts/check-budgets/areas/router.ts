/**
 * Area: router — the `./router` subpath's size (docs/v3/ARCHITECTURE.md section 3), G1 freeze. Seed:
 * the first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract section 6),
 * ratcheted down only; `../ui-bundle` measures it (gzip B minus `base0`, peers bundled, whole barrel).
 */
import type { RowDef } from '../lib'
import { measureSource, reExportAll } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'router-subpath',
    order: 420,
    label: 'router, whole barrel (gzip B minus base0, src/router, peers bundled)',
    // 8852 B measured.
    ceiling: 9500,
    measure: () => measureSource(reExportAll({ router: 'router/index' })),
  },
]
