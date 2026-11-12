// Asserts the argo census against a charts report: `bun census-assert.ts <report.json>`.
// Scratch run: git -C ~/SourceRoot/argo archive f5c49ca6 apps/dashboard/src | tar -x -C $tmp, then
// `bun tools/migrate-v3/run.ts charts $tmp --report $tmp/report.json`.
import { readFileSync } from 'node:fs'
import { FLAG_ROWS, REWRITE_ROWS } from './report.ts'
import type { Report } from './report.ts'

const report = JSON.parse(readFileSync(process.argv[2] ?? '', 'utf8')) as Report
const failures: string[] = []

const sitesOf = (row: string, bodyOnly: boolean) =>
  new Set(
    report.flagged
      .filter((f) => f.row === row && (!bodyOnly || f.reason.startsWith('body:')))
      .map((f) => `${f.file}:${f.line}`),
  ).size

// The census of docs/v3/concepts/charts-cards-kanban.md section 10 counts 24 pending fallbacks and
// 2 other self-closed. Argo has 23 literal `{ pending: true }` fallbacks; the 24th is
// flow-boundary.tsx, an error-boundary fallback with `state={{ error }}` that the census counted as
// pending. phase="loading" would hide its error, so it is flagged: 23 rewritten, 3 flagged.
const rewritten: Record<string, number> = { 'cc-body-chart': 26, 'cc-pending-loading': 23 }
// Expression flags count the body-shaped ones; prop-level expression flags are a separate worklist.
const flaggedSites: [string, number, boolean][] = [
  ['cc-body-datapanel', 19, false],
  ['cc-expression', 4, true],
  ['cc-other-self-closed', 3, false],
]

for (const [id, want] of Object.entries(rewritten)) {
  const got = report.rewritten[id] ?? 0
  if (got !== want) failures.push(`rewritten ${id}: ${got}, want ${want}`)
}
for (const [row, want, bodyOnly] of flaggedSites) {
  const got = sitesOf(row, bodyOnly)
  if (got !== want) failures.push(`flagged ${row}: ${got} sites, want ${want}`)
}
for (const f of report.flagged) {
  if (!f.file || !Number.isInteger(f.line) || f.line < 1)
    failures.push(`flagged entry without file and line: ${JSON.stringify(f)}`)
  if ((REWRITE_ROWS as readonly string[]).includes(f.row))
    failures.push(`${f.row} is flagged at ${f.file}:${f.line} but is a rewrite row`)
  else if (!(FLAG_ROWS as readonly string[]).includes(f.row))
    failures.push(`unknown row ${f.row} at ${f.file}:${f.line}`)
}
for (const id of FLAG_ROWS)
  if (id in report.rewritten) failures.push(`flagged row ${id} appears under rewritten`)

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log('census-assert: ok')
