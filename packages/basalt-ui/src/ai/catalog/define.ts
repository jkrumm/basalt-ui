import type { Block, Catalog, DefineBlockOptions, StandardSchemaV1 } from '../contract'
import { createBlockView } from './block'
import { BLOCK_KEY, MAX_LIMITS, check } from './validate'

const NAME = /^[a-z][a-z0-9-]*$/
const within = (n: number, max: number): boolean => n > 0 && n <= max

/**
 * Declares one block a model may show: its name and description (what a tool definition reads),
 * a Standard Schema for its props, at least one `sample` (what `expectCatalog` renders and fuzzes)
 * and `render`, which returns the composite as its root so `Block` can hand it the phase. `limits`
 * default to 32 KiB and depth 6 and may tighten that or raise it to 512 KiB and depth 12.
 * `textKeys` names url-named keys (`href`, `src`, `url`, `link`) the block draws as text, so a data
 * cell holding `http://…` is not a refusal; `expectCatalog` still fuzzes them for an attribute. `reserve` is the escape rung for a layout block
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
  const l = b.limits
  if (l && !(within(l.maxBytes, MAX_LIMITS.maxBytes) && within(l.maxDepth, MAX_LIMITS.maxDepth)))
    throw new Error(
      `defineBlock: "${b.name}" limits must stay within ${MAX_LIMITS.maxBytes} bytes and depth ${MAX_LIMITS.maxDepth}`,
    )
  return { ...b }
}

/**
 * The one validator between model output and render. `validate(spec)` resolves a spec to its block
 * or returns a model-readable error that ends in advice; `Block` validates, renders inside a
 * per-block error boundary, draws the composite's own phase skeleton and prints a quiet "could not
 * be displayed" for a spec it refused or a render that threw, so its siblings keep rendering.
 * A spec names its block in `block`; `{ discriminator: 'type' }` names another field, and that
 * field then stays in the props the schema sees (the block's own literal).
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
export function defineCatalog(
  blocks: readonly Block[],
  options: { discriminator?: string } = {},
): Catalog {
  const discriminator = options.discriminator ?? BLOCK_KEY
  const byName = new Map<string, Block>()
  for (const block of blocks) {
    if (byName.has(block.name))
      throw new Error(`defineCatalog: two blocks are named "${block.name}"`)
    byName.set(block.name, block)
  }
  return {
    blocks,
    discriminator,
    validate(x) {
      const checked = check(x, byName, discriminator)
      return checked.ok ? { ok: true, block: checked.block } : { ok: false, error: checked.error }
    },
    Block: createBlockView(byName, discriminator),
  }
}
