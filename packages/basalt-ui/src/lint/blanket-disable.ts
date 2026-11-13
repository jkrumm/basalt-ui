/**
 * A file-level `disable` that hides `basalt/waiver-needs-reason`'s own finding, found by text.
 *
 * The host applies a directive before a plugin's diagnostic reaches the reporter, so a bare
 * `/* oxlint-disable -- why *\/` (no rule list) or one that names `waiver-needs-reason` silences
 * the rule that exists to flag it. No rule can see that, and RuleTester does not model host
 * suppression. This scan is the half a rule cannot be: it reads comments, not diagnostics, so the
 * weakened-config check (`v3-gr-5`) and the guard hook run it over each source file.
 *
 * It tokenises just enough to skip string and template literals, so a directive quoted in a string
 * is not a finding; a directive only counts at the start of its comment, as in the rule itself.
 */

export type BlanketDisable = {
  /** 1-based line of the comment. */
  readonly line: number
  /** The comment text without its delimiters, trimmed. */
  readonly text: string
  /** Why it silences the rule: no rule list, or the list names `waiver-needs-reason`. */
  readonly reach: 'every rule' | 'waiver-needs-reason'
}

const DIRECTIVE = /^\s*(?:oxlint|eslint)-disable(?=\s|$)([\s\S]*)$/
const REASON_SEPARATOR = /(?:^|\s)--+(?:\s|$)/
const SELF_IDS: ReadonlySet<string> = new Set([
  'waiver-needs-reason',
  'basalt/waiver-needs-reason',
  'basalt/*',
])

function classify(comment: string): BlanketDisable['reach'] | undefined {
  const match = DIRECTIVE.exec(comment)
  if (!match) return undefined
  const rest = (match[1] ?? '').trim()
  const separator = REASON_SEPARATOR.exec(rest)
  const list = (separator ? rest.slice(0, separator.index) : rest)
    .split(',')
    .map((rule) => rule.trim())
    .filter(Boolean)
  if (list.length === 0) return 'every rule'
  return list.some((rule) => SELF_IDS.has(rule)) ? 'waiver-needs-reason' : undefined
}

/** Every file-level `disable` in `source` that leaves `waiver-needs-reason` unable to report. */
export function findBlanketDisables(source: string): BlanketDisable[] {
  const found: BlanketDisable[] = []
  let line = 1
  let i = 0
  const record = (start: number, end: number, startLine: number): void => {
    const text = source.slice(start, end).trim()
    const reach = classify(text)
    if (reach) found.push({ line: startLine, text, reach })
  }
  while (i < source.length) {
    const ch = source[i]
    const next = source[i + 1]
    if (ch === '\n') {
      line++
      i++
    } else if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      record(i + 2, stop, line)
      i = stop
    } else if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end
      record(i + 2, stop, line)
      line += source.slice(i, stop).split('\n').length - 1
      i = end === -1 ? source.length : end + 2
    } else if (ch === '"' || ch === "'" || ch === '`') {
      i++
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\\') i++
        else if (source[i] === '\n') {
          line++
          if (ch !== '`') break
        }
        i++
      }
      i++
    } else {
      i++
    }
  }
  return found
}
