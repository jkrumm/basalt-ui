import type { Block, Catalog, DefineBlockOptions, StandardSchemaV1 } from '../contract'
import { createBlockView } from './block'
import { check, DEFAULT_LIMITS } from './validate'

const NAME = /^[a-z][a-z0-9-]*$/

/**
 * Declares one block a model may show: its name and description (what a tool definition reads),
 * a Standard Schema for its props, at least one `sample` (what `expectCatalog` renders and fuzzes)
 * and `render`, which returns the composite as its root so `Block` can hand it the phase. `limits`
 * may only tighten the default (32 KiB, depth 6). `reserve` is the escape rung for a layout block
 * that composes several composites: its loading and error arms draw a box that tall.
 *
 * @useWhen a model may ask the page to show a typed piece of UI (a stat, a list, a table) through a tool call or a data part
 * @neverWhen the content is model text (use partView, which renders it as untrusted markdown) or the UI is authored by the app, not chosen by a model
 *
 * @example
 * export const stat = defineBlock({
 *   name: 'stat',
 *   description: 'One headline number with a delta. Never for lists.',
 *   props: z.object({ label: z.string().max(40), value: z.number(), delta: z.number().optional() }),
 *   sample: [{ label: 'Shipped', value: 388, delta: 12 }],
 *   render: (p) => (
 *     <StatCard
 *       title={p.label}
 *       value={p.value}
 *       {...(p.delta !== undefined && { delta: { value: p.delta, polarity: 'up-good' } })}
 *     />
 *   ),
 * })
 */
export function defineBlock<S extends StandardSchemaV1>(b: DefineBlockOptions<S>): Block<S> {
  if (!NAME.test(b.name)) throw new Error(`defineBlock: "${b.name}" is not a kebab-case name`)
  if (b.sample.length === 0) throw new Error(`defineBlock: "${b.name}" needs at least one sample`)
  const { limits } = b
  if (
    limits !== undefined &&
    !(
      limits.maxBytes > 0 &&
      limits.maxBytes <= DEFAULT_LIMITS.maxBytes &&
      limits.maxDepth > 0 &&
      limits.maxDepth <= DEFAULT_LIMITS.maxDepth
    )
  ) {
    throw new Error(`defineBlock: "${b.name}" limits may only tighten the default`)
  }
  return { ...b }
}

/**
 * The one validator between model output and render. `validate(spec)` resolves a spec to its block
 * or returns a model-readable error that ends in advice; `Block` validates, renders inside a
 * per-block error boundary, draws the composite's own phase skeleton and prints a quiet "could not
 * be displayed" for a spec it refused or a render that threw, so its siblings keep rendering.
 *
 * @useWhen an app renders blocks a model chose: every spec passes `validate` or `Block` before any render
 * @neverWhen there is one fixed component and no model picks it (render the composite directly)
 *
 * @example
 * export const catalog = defineCatalog([stat, table])
 * // in a tool part's renderer:
 * <catalog.Block spec={part.input} phase={part.state === 'output-available' ? 'ready' : 'loading'} />
 * // in a test file:
 * test('catalog', () => expectCatalog(catalog))
 */
export function defineCatalog(blocks: readonly Block[]): Catalog {
  const byName = new Map<string, Block>()
  for (const block of blocks) {
    if (byName.has(block.name))
      throw new Error(`defineCatalog: two blocks are named "${block.name}"`)
    byName.set(block.name, block)
  }
  return {
    blocks,
    validate(x) {
      const checked = check(x, byName)
      return checked.ok ? { ok: true, block: checked.block } : { ok: false, error: checked.error }
    },
    Block: createBlockView(byName),
  }
}
