// The report of the chart codemods: counts of what was rewritten, a worklist of what was not.
// The row ids are fixed here; the migration rows (v3-charts-7c) write one row per id.

/** Rows the codemod rewrites. */
export const REWRITE_ROWS = [
  'cc-body-chart',
  'cc-pending-loading',
  'cc-height',
  'cc-state-phase',
  'cc-facts-figure',
] as const

/** Rows the codemod only flags. A flagged row id never appears under `rewritten`. */
export const FLAG_ROWS = [
  'cc-body-datapanel',
  'cc-removed-props',
  'cc-actions',
  'cc-tone-status',
  'cc-expression',
  'cc-other-self-closed',
] as const

export type Flag = { row: string; file: string; line: number; reason: string }
export type Report = { rewritten: Record<string, number>; flagged: Flag[] }

export function emptyReport(): Report {
  return { rewritten: Object.fromEntries(REWRITE_ROWS.map((id) => [id, 0])), flagged: [] }
}

export function mergeReport(into: Report, from: Report): void {
  for (const [id, n] of Object.entries(from.rewritten))
    into.rewritten[id] = (into.rewritten[id] ?? 0) + n
  into.flagged.push(...from.flagged)
}

/** Markdown for a PR body: counts, then the worklist grouped by row. The report is a worklist, never an exemption. */
export function renderReport(report: Report): string {
  const lines = ['# Chart codemod report', '', '## Rewritten', '']
  for (const [id, n] of Object.entries(report.rewritten)) lines.push(`- ${id}: ${n}`)
  lines.push(
    '',
    'The flagged sites below are a worklist, never an exemption: each is resolved by hand or becomes a waiver with a reason.',
    '',
  )
  const byRow = new Map<string, Flag[]>()
  for (const f of report.flagged) byRow.set(f.row, [...(byRow.get(f.row) ?? []), f])
  for (const [row, flags] of byRow) {
    lines.push(`## ${row} (${flags.length})`, '')
    for (const f of flags) lines.push(`- \`${f.file}:${f.line}\` ${f.reason}`)
    lines.push('')
  }
  return lines.join('\n')
}
