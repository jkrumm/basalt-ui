/**
 * What a seam module is. A seam is one small, named answer to one consumer case: the registry
 * (`../seams.ts`) lists them, `applySeams` runs the spec-level ones in order, and every module
 * cites the linewatch or argo call site it exists for. The contract test of a seam goes through
 * the registry, so a seam dropped from the list fails its own test.
 */
import type { CartesianChartProps, YConfig } from '../contract'
import type { EngineSpec } from '../parts/cartesian-adapt'

/** The v3 props a seam may read. */
export type SeamProps<D> = Pick<CartesianChartProps<D>, 'data' | 'series' | 'x'> & {
  y?: YConfig | undefined
}

/** One seam: the engine spec in, the engine spec out, with the v3 props it came from. */
export type Seam = <D>(spec: EngineSpec<D>, props: SeamProps<D>) => EngineSpec<D>

/** Where a seam does its work. */
export type SeamLayer =
  /** `applySeams` rewrites the engine spec. */
  | 'spec'
  /** `toEngineSeries`/`toEngineSpec` or a kind already carries it; the entry is the registry's claim and the test's anchor. */
  | 'carried'
  /** A pure helper for a `marks` builder, which reads the plot, not the spec. */
  | 'plot'

export type SeamModule = {
  /** The prop the seam answers for, as a consumer writes it (`y.domain`, `plot.pxToY`). */
  readonly id: string
  /** The consumer case: `<repo> <file>:<line>, what it needed`. */
  readonly consumer: string
  readonly layer: SeamLayer
  readonly seam: Seam
}

/** A seam that rewrites nothing at the spec level. Same reference back: `applySeams` stays identity. */
export const untouched: Seam = (spec) => spec

type Describe = { id: string; consumer: string }

/** A seam `toEngineSeries` or a kind already carries: the registry names it, the test proves it. */
export const carried = ({ id, consumer }: Describe): SeamModule => ({
  id,
  consumer,
  layer: 'carried',
  seam: untouched,
})

/** A seam that is a helper for `marks` builders: no spec rewrite, its functions are the module's exports. */
export const planar = ({ id, consumer }: Describe): SeamModule => ({
  id,
  consumer,
  layer: 'plot',
  seam: untouched,
})

/** A seam that rewrites the engine spec. */
export const rewriting = ({ id, consumer, seam }: Describe & { seam: Seam }): SeamModule => ({
  id,
  consumer,
  layer: 'spec',
  seam,
})
