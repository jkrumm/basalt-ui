import type { BasaltMessages } from './index'

/** Replace with the area's keys when its Issue writes the strings. */
export type BaseMessages = Record<never, never>

export const base = {} satisfies Partial<BasaltMessages>
