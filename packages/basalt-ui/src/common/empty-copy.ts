/**
 * The empty tile's copy from the one string a host carries (`ChartState.empty`, `StatCard`'s
 * `emptyText`), as `EmptyState` reads it (SPEC § 6.11): the title (why it is empty) and the muted
 * line (what to do).
 *
 * One rule: the title is everything up to the first `.`, `!` or `?` that is followed by whitespace
 * or ends the string; the description is the rest. Both parts are trimmed, and a trailing `.` is
 * dropped from the title only (a `?` or `!` stays, the description keeps its own punctuation). An
 * abbreviation such as `e.g. ` or `approx. ` ends the title early: write the copy without one, or
 * as a single sentence.
 */
export function splitEmptyCopy(label: string): { title: string; description: string | undefined } {
  const at = label.search(/[.!?](\s|$)/)
  const head = (at < 0 ? label : label.slice(0, at + 1)).trim()
  const rest = at < 0 ? '' : label.slice(at + 1).trim()
  return { title: head.replace(/\.$/, ''), description: rest === '' ? undefined : rest }
}
