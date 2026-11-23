/**
 * The text model of the composer's mentions: plain text plus typed tokens over ranges of it. Nothing
 * here renders. A token is `@Label` in the text and its value beside it; an edit before a token
 * moves it, an edit into it drops it (the text stays, as plain text), so a token never names text
 * the person changed.
 */

/** One mention the person picked: the option's value, the label it inserted, and where it sits. */
export type Mention<Value = unknown> = {
  value: Value
  label: string
  /** The index of the `@`. */
  start: number
  /** One past the label's last character. */
  end: number
}

/** The `@query` the caret is in: where the `@` sits and the text typed after it. */
export type MentionQuery = { start: number; query: string }

/** A query longer than this is prose that happens to follow an `@`, not a search. */
const QUERY_MAX = 40

/**
 * The open mention query at `caret`, or undefined. The `@` starts the text or follows white space,
 * and the text between it and the caret holds no white space. A caret inside a token opens none.
 */
export function mentionQuery(
  text: string,
  caret: number,
  tokens: readonly Mention[],
  trigger = '@',
): MentionQuery | undefined {
  if (tokens.some((token) => caret > token.start && caret <= token.end)) return undefined
  for (let at = caret - 1; at >= 0 && caret - at <= QUERY_MAX + 1; at -= 1) {
    const char = text[at] as string
    if (char === trigger) {
      const before = at === 0 ? '' : (text[at - 1] as string)
      if (before !== '' && !/\s/.test(before)) return undefined
      return { start: at, query: text.slice(at + 1, caret) }
    }
    if (/\s/.test(char)) return undefined
  }
  return undefined
}

/**
 * The tokens after the text changed from `prev` to `next`. The changed span is what lies between
 * the longest common prefix and the longest common suffix: a token wholly before it stays, a token
 * wholly after it shifts by the length change, a token it touches is dropped.
 */
export function rebaseMentions<Value>(
  tokens: readonly Mention<Value>[],
  prev: string,
  next: string,
): Mention<Value>[] {
  if (prev === next || tokens.length === 0) return [...tokens]
  const shortest = Math.min(prev.length, next.length)
  let head = 0
  while (head < shortest && prev[head] === next[head]) head += 1
  let tail = 0
  while (tail < shortest - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) {
    tail += 1
  }
  const changedEnd = prev.length - tail
  const delta = next.length - prev.length
  const kept: Mention<Value>[] = []
  for (const token of tokens) {
    if (token.end <= head) kept.push(token)
    else if (token.start >= changedEnd) {
      kept.push({ ...token, start: token.start + delta, end: token.end + delta })
    }
  }
  return kept
}

/**
 * The text and tokens after a pick: the `@query` from `start` to `caret` becomes `@Label `, the new
 * token is recorded and every later token moves. Returns the caret after the inserted space.
 */
export function insertMention<Value>(input: {
  text: string
  tokens: readonly Mention<Value>[]
  start: number
  caret: number
  value: Value
  label: string
  trigger?: string
}): { text: string; tokens: Mention<Value>[]; caret: number } {
  const { text, tokens, start, caret, value, label, trigger = '@' } = input
  const inserted = `${trigger}${label}`
  const after = text.slice(caret)
  const spacer = after.startsWith(' ') ? '' : ' '
  const next = `${text.slice(0, start)}${inserted}${spacer}${after}`
  const moved = rebaseMentions(tokens, text, `${text.slice(0, start)}${after}`)
  const shift = inserted.length + spacer.length
  const others = moved.map((token) =>
    token.start >= start ? { ...token, start: token.start + shift, end: token.end + shift } : token,
  )
  const token: Mention<Value> = { value, label, start, end: start + inserted.length }
  return {
    text: next,
    tokens: [...others, token].toSorted((a, b) => a.start - b.start),
    caret: start + inserted.length + 1,
  }
}
