/**
 * The seam registry `CartesianChart` calls (`docs/v3/concepts/charts-cards-kanban.md` § 3,
 * "Consumer seams"). A seam is one small transform of the engine-side spec, written against one
 * consumer case; the chart runs its spec through every registered seam, in order, before it compiles.
 *
 * Identity until `v3-charts-2b-seams` fills it: `y.domain` objects and functions, `y.gutter`,
 * per-datum fill and the pixel-extent rules are accepted by the contract types and not yet applied.
 */
import type { CartesianChartProps, YConfig } from './contract'
import type { EngineSpec } from './parts/cartesian-adapt'

/** The v3 props a seam may read. */
export type SeamProps<D> = Pick<CartesianChartProps<D>, 'data' | 'series' | 'x'> & {
  y?: YConfig | undefined
}

/** One seam: the engine spec in, the engine spec out, with the v3 props it came from. */
export type Seam = <D>(spec: EngineSpec<D>, props: SeamProps<D>) => EngineSpec<D>

/** The registered seams, in the order they run. */
export const SEAMS: readonly Seam[] = []

export function applySeams<D>(
  spec: EngineSpec<D>,
  props: SeamProps<D>,
  seams: readonly Seam[] = SEAMS,
): EngineSpec<D> {
  return seams.reduce<EngineSpec<D>>((acc, seam) => seam(acc, props), spec)
}
