// fallow-ignore-file unused-file unused-export
export { StatCard } from './stat-card'

/**
 * Builds a keyed counter store.
 *
 * A second paragraph that the doc must not carry.
 *
 * @useWhen a screen needs one counter shared by several components
 * @neverWhen the value belongs in the URL
 */
export function createCounter(options: { start?: number; step: number }): () => number {
  let n = options.start ?? 0
  return () => (n += options.step)
}

export type PickProps = { label: string } & (
  | { href: string; onSelect?: never }
  | { onSelect: () => void; href?: never }
  | { href?: never; onSelect?: never }
) & {
    /**
     * How the label is cased. Trailing detail the doc must cut.
     *
     * @default 'title'
     */
    casing?: 'title' | 'upper'
  }

/**
 * A pickable label: a link, a button or inert.
 *
 * @useWhen a label opens something
 * @neverWhen the label is plain text
 *
 * @example
 * ```tsx
 * pick({ label: 'Docs', href: '/docs' })
 * ```
 */
export function pick(props: PickProps): string {
  return props.label
}

export type Unrelated = { type: 'only' }
