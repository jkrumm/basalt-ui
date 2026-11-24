import type { BasaltMessages } from '../../core/messages'

/**
 * The catalog entries an MDX island takes: the ones whose value is a string. Astro serialises an
 * island's props, so an entry that is a function cannot cross into the island.
 */
export type IslandMessages = Partial<{
  [K in keyof BasaltMessages as BasaltMessages[K] extends string ? K : never]: string
}>
