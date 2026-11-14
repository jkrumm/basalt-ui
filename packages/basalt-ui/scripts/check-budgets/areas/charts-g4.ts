/**
 * Area: charts-g4 — the Heatmap and BandStrip byte marginals, frozen by v3-freeze-g4 (docs/v3/
 * concepts/quality-contract.md section 6, ARCHITECTURE.md section 3: +4 KB each). A marginal is the
 * three-kind fixture (`charts-three-kind` in `charts.ts`: Sparkline, Lines, Bars) plus the kind,
 * minus the same fixture without it, each gzip over a build with peers bundled. Ceiling = measured
 * +5% rounded up to 0.5 KB, at most 4000 B (above that is an amendment, not a raise). Ratcheted down only.
 * Amendment (Decision, Issue 1227): Heatmap measures 4002 B, so its ceiling is 4500 B (+5% rounded up to
 * 0.5 KB) instead of the 4000 B cap; BandStrip holds the cap.
 */
import { reExportNamed, measureSource } from '../ui-bundle'
import type { RowDef } from '../lib'

const THREE_KIND = [
  reExportNamed('charts/Sparkline', ['Sparkline']),
  reExportNamed('charts/Lines', ['Lines']),
  reExportNamed('charts/Bars', ['Bars']),
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
    // 4002 B measured; amended above the 4000 B cap by owner-path Decision, ratchets down only.
    ceiling: 4500,
    measure: () => marginal(HEATMAP),
  },
  {
    id: 'charts-band-strip-marginal',
    order: 25,
    label: 'charts BandStrip marginal (gzip B over Sparkline + Lines + Bars)',
    // 2135 B measured.
    ceiling: 2500,
    measure: () => marginal(BAND_STRIP),
  },
]
