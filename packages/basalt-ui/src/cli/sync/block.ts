/**
 * The managed block in `AGENTS.md`: a `basalt:begin … basalt:end` region spliced into a host the
 * consumer otherwise owns. Absent means append; a duplicate or half-open pair is an error naming
 * the lines, since splicing into a guessed region would leave the other copy stale forever.
 */
export const BLOCK_BEGIN = '<!-- basalt:begin'
export const BLOCK_END = '<!-- basalt:end -->'

export type BlockScan = { start: number; end: number } | 'absent' | { error: string }

type Marker = { line: number; offset: number }

/** Markers count on a line of their own, so a prose or code-span mention is never a block. */
function markers(host: string, marker: string, exact: boolean): Marker[] {
  let offset = 0
  return host.split('\n').flatMap((text, i) => {
    const at = offset + text.length - text.trimStart().length
    offset += text.length + 1
    const body = text.trim()
    return (exact ? body === marker : body.startsWith(marker)) ? [{ line: i + 1, offset: at }] : []
  })
}

export function scanBlock(host: string, label: string): BlockScan {
  const [begins, ends] = [markers(host, BLOCK_BEGIN, false), markers(host, BLOCK_END, true)]
  const fail = (why: string): { error: string } => ({ error: `${label}: ${why}` })
  const at = (found: Marker[]): string => found.map((m) => m.line).join(' and ')
  for (const [found, marker] of [
    [begins, BLOCK_BEGIN],
    [ends, BLOCK_END],
  ] as const) {
    if (found.length > 1) {
      return fail(
        `duplicate \`${marker}\` markers at lines ${at(found)} — remove one by hand, then re-run.`,
      )
    }
  }
  const [begin, end] = [begins[0], ends[0]]
  if (begin === undefined && end === undefined) return 'absent'
  if (begin === undefined)
    return fail(`\`${BLOCK_END}\` at line ${end?.line} has no \`${BLOCK_BEGIN}\`.`)
  if (end === undefined || end.offset < begin.offset) {
    return fail(
      `\`${BLOCK_BEGIN}\` at line ${begin.line} has no matching \`${BLOCK_END}\` after it.`,
    )
  }
  return { start: begin.offset, end: end.offset + BLOCK_END.length }
}

/** The host with `block` in place: the region replaced, or the block appended after a blank line. */
export function spliceBlock(
  host: string,
  scan: 'absent' | { start: number; end: number },
  block: string,
): string {
  if (scan !== 'absent') return `${host.slice(0, scan.start)}${block}${host.slice(scan.end)}`
  const base = host.trimEnd()
  return base === '' ? `${block}\n` : `${base}\n\n${block}\n`
}
