/**
 * Area: controls — the `./controls` subpath's size (docs/v3/ARCHITECTURE.md section 3, quality-contract
 * section 6), G3 freeze. Forms fold into `./controls`, so one row covers filters, forms and the home
 * parts. Seed: first complete build plus 5 percent, rounded up to 0.5 KB, ratcheted down only;
 * `../ui-bundle` measures it (gzip B minus `base0`, peers bundled).
 */
import type { RowDef } from '../lib'
import { measureSource, reExportAll } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'controls-own',
    order: 420,
    label: 'controls own code: the whole ./controls entry (gzip B minus base0, peers bundled)',
    // 220379 B measured.
    ceiling: 231500,
    measure: () => measureSource(reExportAll({ controls: 'controls/index' })),
  },
]
