/**
 * Area: charts-g4 — the Heatmap and BandStrip byte marginals, frozen by v3-freeze-g4 (docs/v3/
 * concepts/quality-contract.md section 6, ARCHITECTURE.md section 3: +4 KB each). A marginal is the
 * three-kind fixture (`charts-three-kind` in `charts.ts`: Sparkline, Lines, Bars) plus the kind,
 * minus the same fixture without it, each gzip over a build with peers bundled. Ceiling = measured
 * +5% rounded up to 0.5 KB, at most 4000 B (above that is an amendment, not a raise). Ratcheted down only.
 * Amendment (Decision, Issue 1227): Heatmap measures 4002 B, so its ceiling is 4500 B (+5% rounded up to
 * 0.5 KB) instead of the 4000 B cap; BandStrip holds the cap.
 * Amendment (Decision, Issue 1407): the three-kind fixture is the v3 parts since v3-teardown-views deleted the
 * 2.x Lines, Bars and Sparkline. BandStrip and Heatmap still compose 2.x modules (`CartesianChart.tsx`
 * ChartShell, `compile.ts`, `marks.ts`) that the v3 kinds do not, so their marginals read 17953 B and 5158 B
 * against the lighter baseline. Ceilings are the measured value +5%, up to 0.5 KB; they ratchet back down when
 * the follow-up ports both kinds onto `core/compile` and those 2.x modules go.
 */
import { reExportNamed, measureSource } from '../ui-bundle'
import type { Raise, RowDef } from '../lib'

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
    // 5158 B measured on the v3 three-kind fixture (4002 B on the 2.x one); amended by Decision, Issue 1407.
    ceiling: 5500,
    measure: () => marginal(HEATMAP),
  },
  {
    id: 'charts-band-strip-marginal',
    order: 25,
    label: 'charts BandStrip marginal (gzip B over Sparkline + Lines + Bars)',
    // 17953 B measured on the v3 three-kind fixture (2135 B on the 2.x one): BandStrip still reaches the 2.x
    // ChartShell and compile modules; amended by Decision, Issue 1407.
    ceiling: 18500,
    measure: () => marginal(BAND_STRIP),
  },
]

export const raises: readonly Raise[] = [
  {
    ceiling: 'charts-heatmap-marginal',
    from: 4500,
    to: 5500,
    consumer:
      '`Heatmap` over the v3 three-kind fixture (Issue 1407): linewatch renders two Heatmaps (the 2.x Lines, Bars and Sparkline that carried part of its closure are deleted, so the marginal reads 5158 B); a port onto `core/compile` brings it back down',
    repo: 'linewatch',
  },
  {
    ceiling: 'charts-band-strip-marginal',
    from: 2500,
    to: 18500,
    consumer:
      "`BandStrip` over the v3 three-kind fixture (Issue 1407): linewatch's availability strip (web/src/charts/availability-strip.tsx) renders it; it still reaches the 2.x ChartShell and compile modules the v3 kinds do not, so the marginal reads 17953 B until a port onto `core/compile`",
    repo: 'linewatch',
  },
]
