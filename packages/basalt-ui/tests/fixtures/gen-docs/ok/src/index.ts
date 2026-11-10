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

export type Unrelated = { type: 'only' }
