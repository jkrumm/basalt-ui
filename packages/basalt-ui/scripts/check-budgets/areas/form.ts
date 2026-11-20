/**
 * Area: form — the `./form` subpath's size (docs/v3/verdicts/tanstack-map.md, Issue 2525). Seed:
 * the first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract section 6),
 * ratcheted down only; `../ui-bundle` measures it (gzip B minus `base0`, peers bundled, whole
 * barrel), so the TanStack Form engine an app already pays is counted in it.
 */
import type { Raises, RowDef } from '../lib'
import { measureSource, reExportAll } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'form-subpath',
    order: 425,
    label: 'form, whole barrel (gzip B minus base0, src/form, peers bundled)',
    // 37111 B measured at the first complete build (the TanStack Form engine is most of it), plus 5 percent.
    ceiling: 39000,
    measure: () => measureSource(reExportAll({ form: 'form/index' })),
  },
]

export const raises: Raises = {}
