/**
 * P6 port of epos `schema.ts`: what `schema.contract.test.ts` imports. `showSpec` is derived from the
 * blocks' `props` (the test reads each option's `shape.type.value`), and `parseShowSpec` is
 * `catalog.validate` behind the one adapter the engine needs: epos names a block by `type`, the
 * engine by `block`, so the spec carries both and the props schema still sees its `type` literal.
 */
import { z } from 'zod'
import { catalog } from './catalog'
import { CHART_MAX_SERIES_STORED } from './schema.orig'

export { CHART_MAX_SERIES_STORED }

type Leaf = Parameters<typeof z.discriminatedUnion>[1][number]
export const showSpec = z.discriminatedUnion(
  'type',
  catalog.blocks.map((b) => b.props) as unknown as [Leaf, ...Leaf[]],
)

/** The spec when it fits the catalog, else null. Never throws. */
export function parseShowSpec(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || !('type' in input)) return null
  const result = catalog.validate({ ...input, block: input.type })
  return result.ok ? result.block.props : null
}
