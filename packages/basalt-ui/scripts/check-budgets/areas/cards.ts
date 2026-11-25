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
    // 14150 -> 14200 (Issue 2716): 14157 B measured, +~40 B gz for the delta pill that draws no arrow for an unsigned value.
    // 14200 -> 14250 (Issue 3088): 14202 B measured, +~2 B gz for the default error line that says a cause.
    // 14250 -> 15600 (Issue 3295): ~15520 B measured, +~1270 B gz for the shared context-menu trigger (right click, long press, Shift+F10) the card menu now binds.
    ceiling: 15600,
    measure: () => measureSource(reExportNamed('cards/stat-card', ['StatCard'])),
  },
]

export const raises: Raises = {
  'cards-stat-card': [
    {
      from: 14250,
      to: 15600,
      consumer:
        'the owner review of 2026-11-25 (Issue 3295): a right click, a long press and Shift+F10 on a StatCard, DataPanel or ChartCard open the menu its "..." button opens, through the trigger logic the card menu shares with ui/context-menu',
      repo: 'basalt-ui',
    },
    {
      from: 14200,
      to: 14250,
      consumer:
        'the shipped parts raising design-check P1s on every page that uses them (Issue 3088): the default error line says a cause, "Could not load this. The request failed."',
      repo: 'basalt-ui',
    },
    {
      from: 14150,
      to: 14200,
      consumer:
        "n81's '2 of 3 scheduled' and n86's '53 % of all' (Issue 2716): a delta pill with an unsigned value drew an up arrow, so it draws none",
      repo: 'basalt-ui',
    },
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
