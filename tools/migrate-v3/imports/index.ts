import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { parseRef, transformImports } from './transform.ts'
import type { ImportChange, RenameRow } from './transform.ts'

export const DEFAULT_ROWS_DIR = resolve(
  import.meta.dir,
  '../../../packages/basalt-ui/migrations/areas',
)

type RawRow = {
  id?: string
  kind?: string
  from?: string
  to?: string
  codemod?: string
  manual?: boolean
}

/** Row kinds that describe a symbol moving or being renamed; the shipped areas spell it three ways. */
const RENAME_KINDS = new Set(['rename', 'renamed', 'moved'])

/**
 * The pure-rename rows (codemod "imports") of a directory of area files. A row that has the shape of
 * a rename but names another codemod is reported, never dropped quietly: the count of rewritten
 * imports must not read as "nothing to do" when rows were left behind.
 */
export function loadRenameRows(dir: string): { rows: RenameRow[]; skipped: string[] } {
  const rows: RenameRow[] = []
  const skipped: string[] = []
  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const area = JSON.parse(readFileSync(join(dir, name), 'utf8')) as { rows?: RawRow[] }
    for (const r of area.rows ?? []) {
      if (r.manual === true) continue
      const from = r.from ? parseRef(r.from) : null
      const to = r.to ? parseRef(r.to) : null
      const renameShaped = RENAME_KINDS.has(r.kind ?? '') && from !== null && to !== null
      if (r.codemod !== 'imports') {
        if (renameShaped) {
          skipped.push(
            `${name}: row ${r.id ?? '?'} is a rename but its codemod is not "imports", so it is not applied`,
          )
        }
        continue
      }
      if (!renameShaped || !r.id || !from || !to) {
        skipped.push(
          `${name}: row ${r.id ?? '?'} is codemod "imports" but not a well-formed rename (kind rename|renamed|moved, from and to as pkg#Symbol)`,
        )
        continue
      }
      rows.push({ id: r.id, from, to })
    }
  }
  return { rows, skipped }
}

export type ImportsSummary = {
  files: number
  changedFiles: number
  changes: ImportChange[]
  skipped: string[]
}

export function runImports(opts: { dir: string; rowsDir: string; write: boolean }): ImportsSummary {
  const { rows, skipped } = loadRenameRows(opts.rowsDir)
  const summary: ImportsSummary = { files: 0, changedFiles: 0, changes: [], skipped }
  if (rows.length === 0) return summary
  const glob = new Bun.Glob('**/*.{ts,tsx,js,jsx,mts,cts}')
  const files = [...glob.scanSync({ cwd: opts.dir, onlyFiles: true })]
    .filter((f) => !/(^|\/)(node_modules|dist|build|\.git)\//.test(f) && !f.endsWith('.d.ts'))
    .sort()
  for (const rel of files) {
    const path = resolve(opts.dir, rel)
    const source = readFileSync(path, 'utf8')
    if (!rows.some((r) => source.includes(r.from.module))) continue
    summary.files++
    const result = transformImports(source, { file: rel, rows })
    if (result.parseFailed) summary.skipped.push(`${rel}: does not parse, skipped`)
    summary.changes.push(...result.changes)
    if (result.text !== source) {
      summary.changedFiles++
      if (opts.write) writeFileSync(path, result.text)
    }
  }
  return summary
}

export function importsCommand(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      report: { type: 'string' },
      rows: { type: 'string', default: DEFAULT_ROWS_DIR },
      'dry-run': { type: 'boolean', default: false },
    },
  })
  const dir = positionals[0]
  if (!dir) {
    console.error(
      'usage: run.ts imports <app-dir> [--rows <areas-dir>] [--report <file>] [--dry-run]',
    )
    return 2
  }
  const summary = runImports({
    dir: resolve(dir),
    rowsDir: resolve(values.rows),
    write: !values['dry-run'],
  })
  if (values.report) {
    mkdirSync(dirname(resolve(values.report)), { recursive: true })
    writeFileSync(resolve(values.report), JSON.stringify(summary, null, 2))
  }
  for (const s of summary.skipped) console.warn(`imports: skipped ${s}`)
  console.log(
    `imports: ${summary.changes.length} imports rewritten in ${summary.changedFiles} files${values['dry-run'] ? ' (dry run, nothing written)' : ''}`,
  )
  return 0
}
