/**
 * The seam registry `CartesianChart` calls (`docs/v3/concepts/charts-cards-kanban.md` § 3,
 * "Consumer seams"). A seam is one small answer to one consumer case, one module in `./seams/`
 * that cites the linewatch or argo call site it exists for. The chart runs its spec through every
 * registered seam, in order, before it compiles; a seam with nothing to do returns the same spec.
 *
 * This file is the registration list and nothing else: `seams/*.contract.test.ts` goes through it,
 * so a module left off the list fails its own test.
 */
import type { EngineSpec } from './parts/cartesian-adapt'
import { barOpacity } from './seams/bar-opacity'
import type { Seam, SeamModule, SeamProps } from './seams/define'
import { lonePoint } from './seams/lone-point'
import { pixelExtentRule } from './seams/pixel-extent'
import { plotData } from './seams/plot-data'
import { plotPx } from './seams/plot-px'
import { plotScalesSeam } from './seams/plot-scales'
import { axis } from './seams/series-axis'
import { dash } from './seams/series-dash'
import { format } from './seams/series-format'
import { gaps } from './seams/series-gaps'
import { legendTooltipFalse } from './seams/series-legend-tooltip'
import { getMarker } from './seams/series-marker'
import { note } from './seams/series-note'
import { parent } from './seams/series-parent'
import { role } from './seams/series-role'
import { weight } from './seams/series-weight'
import { xDomain } from './seams/x-domain'
import { yDomain } from './seams/y-domain'
import { yGutter } from './seams/y-gutter'

export type { Seam, SeamLayer, SeamModule, SeamProps } from './seams/define'

/** The registered seam modules, in the order their spec rewrites run. */
export const SEAM_MODULES: readonly SeamModule[] = [
  format,
  weight,
  dash,
  parent,
  legendTooltipFalse,
  gaps,
  note,
  role,
  axis,
  getMarker,
  yDomain,
  yGutter,
  xDomain,
  plotData,
  barOpacity,
  lonePoint,
  plotPx,
  pixelExtentRule,
  plotScalesSeam,
]

/** The spec-level seams, in order. */
export const SEAMS: readonly Seam[] = SEAM_MODULES.map((m) => m.seam)

export function applySeams<D>(
  spec: EngineSpec<D>,
  props: SeamProps<D>,
  seams: readonly Seam[] = SEAMS,
): EngineSpec<D> {
  return seams.reduce<EngineSpec<D>>((acc, seam) => seam(acc, props), spec)
}
