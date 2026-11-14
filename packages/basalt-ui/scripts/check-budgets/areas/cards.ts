/**
 * Area: cards — the `./cards` subpath's size (docs/v3/ARCHITECTURE.md section 3), G1 freeze. The
 * ceiling is the first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract section 6),
 * ratcheted down only; `../ui-bundle` measures it (gzip B minus `base0`, peers bundled).
 */
import type { RowDef } from '../lib'
import { measureSource, reExportNamed } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'cards-stat-card',
    order: 400,
    label: 'cards StatCard, no chart (gzip B minus base0, src/cards, peers bundled)',
    // 12928 B measured. Informative target 16 KB (J); the seed is the measurement.
    ceiling: 14000,
    measure: () => measureSource(reExportNamed('cards/stat-card', ['StatCard'])),
  },
]
