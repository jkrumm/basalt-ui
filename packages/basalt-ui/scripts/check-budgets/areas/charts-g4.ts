/**
 * Area: charts-g4 — the Heatmap and BandStrip byte marginals, frozen by v3-freeze-g4 (docs/v3/
 * concepts/quality-contract.md section 6, ARCHITECTURE.md section 3: +4 KB each). A marginal is the
 * three-kind fixture (`charts-three-kind` in `charts.ts`: Sparkline, Lines, Bars) plus the kind,
 * minus the same fixture without it, each gzip over a build with peers bundled. Ceiling = measured
 * +5% rounded up to 0.5 KB, at most 4000 B (above that is an amendment, not a raise). Ratcheted down only.
 * BandStrip and Heatmap compose `core/compile`, the host and the card portal like the v3 kinds (Issue 1417), so
 * the Issue 1227 and 1407 amendments are gone: Heatmap measures 3969 B (ceiling at the 4000 B cap), BandStrip
 * 2438 B (3000 B).
 */
import { reExportNamed, measureSource } from '../ui-bundle'
import type { Raises, RowDef } from '../lib'

const THREE_KIND = [
  reExportNamed('charts/parts/sparkline', ['Sparkline']),
  reExportNamed('charts/parts/lines', ['Lines']),
  reExportNamed('charts/parts/bars', ['Bars']),
].join('\n')

const HEATMAP = reExportNamed('charts/parts/heatmap', ['Heatmap'])
const BAND_STRIP = reExportNamed('charts/parts/band-strip', ['BandStrip'])

/** Gzip bytes the kind adds to the three-kind fixture. */
export async function marginal(kind: string): Promise<number> {
  const [withKind, without] = [
    await measureSource(`${THREE_KIND}\n${kind}`),
    await measureSource(THREE_KIND),
  ]
  return withKind - without
}

export const rows: readonly RowDef[] = [
  {
    id: 'charts-heatmap-marginal',
    order: 24,
    label: 'charts Heatmap marginal (gzip B over Sparkline + Lines + Bars)',
    // 3969 B measured on the v3 three-kind fixture; at the cap.
    ceiling: 4000,
    measure: () => marginal(HEATMAP),
  },
  {
    id: 'charts-band-strip-marginal',
    order: 25,
    label: 'charts BandStrip marginal (gzip B over Sparkline + Lines + Bars)',
    // 2438 B measured on the v3 three-kind fixture (+5%, rounded up to 0.5 KB).
    ceiling: 3000,
    measure: () => marginal(BAND_STRIP),
  },
]

export const raises: Raises = {}
