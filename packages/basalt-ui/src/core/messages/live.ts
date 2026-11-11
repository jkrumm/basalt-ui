import type { BasaltMessages } from './index'

/** Replace with the area's keys when its Issue writes the strings. */
export type LiveMessages = Record<never, never>

export const live = {} satisfies Partial<BasaltMessages>
