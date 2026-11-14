import type { EngineSpec } from '../parts/cartesian-adapt'
import { rewriting } from './define'
import type { Seam } from './define'

/** The engine spec with the y gutter a pane asks for; `compileCartesian` locks it as the left margin. */
export type GutteredSpec<D> = EngineSpec<D> & { yGutter?: number }

function withGutter<D>(spec: EngineSpec<D>, yGutter: number): EngineSpec<D> {
  const next: GutteredSpec<D> = { ...spec, yGutter }
  return next
}

const seam: Seam = (spec, props) => {
  const gutter = props.y?.gutter
  if (gutter === undefined || !Number.isFinite(gutter) || gutter < 0) return spec
  return withGutter(spec, gutter)
}

/**
 * `y.gutter`: a fixed y-axis width in px, so stacked panes put one x on one pixel column. The seam
 * puts it on the spec as `yGutter`; `core/compile.ts` locks it as the left margin (the other sides
 * stay measured). It must hold the widest tick label: a wider label is clipped, never widened.
 */
export const yGutter = rewriting({
  id: 'y.gutter',
  consumer:
    'argo features/strength-tracker/charts/momentum-chart.tsx, two panes under one cursor (S10) need x aligned across them',
  seam,
})
