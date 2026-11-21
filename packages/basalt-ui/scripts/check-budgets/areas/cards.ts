/**
 * Area: cards — the `./cards` subpath's size (docs/v3/ARCHITECTURE.md section 3), G1 freeze. The
 * ceiling is the first complete build plus 5 percent, rounded up to 0.5 KB (quality-contract section 6),
 * ratcheted down only; `../ui-bundle` measures it (gzip B minus `base0`, peers bundled).
 */
import type { Raises, RowDef } from '../lib'
import { measureSource, reExportNamed } from '../ui-bundle'

export const rows: readonly RowDef[] = [
  {
    id: 'cards-stat-card',
    order: 400,
    label: 'cards StatCard, no chart (gzip B minus base0, src/cards, peers bundled)',
    // 12928 B measured. Informative target 16 KB (J); the seed is the measurement.
    // 14000 -> 14100 (Issue 2500): 14011 B measured, +~11 B gz for the card taking its grid row's height.
    // 14100 -> 14150 (Issue 2696): 14117 B measured, +~17 B gz for `chartHeight`, the chart box's own height.
    ceiling: 14150,
    measure: () => measureSource(reExportNamed('cards/stat-card', ['StatCard'])),
  },
]

export const raises: Raises = {
  'cards-stat-card': [
    {
      from: 14100,
      to: 14150,
      consumer:
        'the Keeper rate card of n71 (Issue 2696, Spec artifact_01a1fbc2): a Meter in the chart slot left a 55 px empty band in the fixed 72 px box, so the box takes a height of its own',
      repo: 'basalt-ui',
    },
    {
      from: 14000,
      to: 14100,
      consumer:
        "the expression cycle 14 contract (Issue 2500, Spec artifact_01a1f6fb): n64's chart card ended 24 px above its table panel and n65's friction panel 7 px above its neighbour, so every card of a grid row takes the row's height",
      repo: 'basalt-ui',
    },
  ],
}
