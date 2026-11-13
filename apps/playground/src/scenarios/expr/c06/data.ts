/**
 * c06 fixture — one coding-agent session's context window. A fixed reading, no clock and no random:
 * four categories whose counts sum to the used total, one limit, one warning threshold.
 */

/** Tokens the model accepts in one window. */
export const LIMIT_TOKENS = 200_000

/** The share of the window at which the agent should compact. */
export const WARN_SHARE = 0.8

export const WARN_TOKENS = LIMIT_TOKENS * WARN_SHARE

export type ContextCategory = { key: string; label: string; tokens: number }

/**
 * In load order. `Memory files` is 0 on purpose (no project memory is loaded) and `Files read`
 * dominates, so the fixture carries both a zero and an extreme share.
 */
export const CATEGORIES: readonly ContextCategory[] = [
  { key: 'system', label: 'System and tools', tokens: 21_400 },
  { key: 'memory', label: 'Memory files', tokens: 0 },
  { key: 'files', label: 'Files read', tokens: 94_600 },
  { key: 'conversation', label: 'Conversation', tokens: 52_300 },
]

export const USED_TOKENS = CATEGORIES.reduce((sum, c) => sum + c.tokens, 0)

/** The largest category: what the reader would shed first. */
export const LARGEST = CATEGORIES.reduce((a, b) => (b.tokens > a.tokens ? b : a))
