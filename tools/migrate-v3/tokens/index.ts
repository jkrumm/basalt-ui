import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { NAME_SHAPE, transformTokens } from './transform.ts'
import type { TokenChange, TokenRows } from './transform.ts'

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

/** Row kinds a name rewrite carries out: the name moved, was renamed, or folded into another. */
const NAME_KINDS = new Set(['renamed', 'moved', 'merged'])

/**
 * The `codemod: "tokens"` rows of a directory of area files, split into name rows and prefix rows. A tokens row
 * a text rewrite cannot carry out (manual, a removal, a `to` that is prose) is reported, never dropped quietly.
 */
export function loadTokenRows(dir: string): { rows: TokenRows; skipped: string[] } {
  const rows: TokenRows = { names: [], prefixes: [] }
  const skipped: string[] = []
  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const area = JSON.parse(readFileSync(join(dir, name), 'utf8')) as { rows?: RawRow[] }
    for (const r of area.rows ?? []) {
      if (r.codemod !== 'tokens') continue
      const { id, from, to } = r
      if (r.manual === true || !id || !from || !to || !NAME_KINDS.has(r.kind ?? '')) {
        skipped.push(`${name}: row ${id ?? '?'} (${r.kind ?? '?'}) is not a name rewrite`)
        continue
      }
      if (from.endsWith('*') && to.endsWith('*')) {
        rows.prefixes.push({ id, from, to })
        continue
      }
      if (!NAME_SHAPE.test(from) || !NAME_SHAPE.test(to)) {
        skipped.push(`${name}: row ${id} maps to '${to}', which a text rewrite cannot place`)
        continue
      }
      rows.names.push({ id, from, to })
    }
  }
  return { rows, skipped }
}

export type TokensSummary = {
  files: number
  changedFiles: number
  changes: TokenChange[]
  skipped: string[]
}

const FILES = '**/*.{ts,tsx,js,jsx,mts,cts,css,scss,md,mdx,astro,html,vue,svelte}'

export function runTokens(opts: { dir: string; rowsDir: string; write: boolean }): TokensSummary {
  const { rows, skipped } = loadTokenRows(opts.rowsDir)
  const summary: TokensSummary = { files: 0, changedFiles: 0, changes: [], skipped }
  const files = [...new Bun.Glob(FILES).scanSync({ cwd: opts.dir, onlyFiles: true })]
    .filter((f) => !/(^|\/)(node_modules|dist|build|\.git)\//.test(f) && !f.endsWith('.d.ts'))
    .sort()
  for (const rel of files) {
    const path = resolve(opts.dir, rel)
    const source = readFileSync(path, 'utf8')
    summary.files++
    const result = transformTokens(source, { file: rel, rows })
    summary.changes.push(...result.changes)
    if (result.text === source) continue
    summary.changedFiles++
    if (opts.write) writeFileSync(path, result.text)
  }
  return summary
}

export function tokensCommand(args: string[]): number {
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
      'usage: run.ts tokens <app-dir> [--rows <areas-dir>] [--report <file>] [--dry-run]',
    )
    return 2
  }
  const summary = runTokens({
    dir: resolve(dir),
    rowsDir: resolve(values.rows),
    write: !values['dry-run'],
  })
  if (values.report) {
    mkdirSync(dirname(resolve(values.report)), { recursive: true })
    writeFileSync(resolve(values.report), JSON.stringify(summary, null, 2))
  }
  const uses = summary.changes.reduce((n, c) => n + c.count, 0)
  console.log(
    `tokens: ${uses} token names rewritten in ${summary.changedFiles} files (${summary.skipped.length} rows need a hand, see --report)${values['dry-run'] ? ' (dry run, nothing written)' : ''}`,
  )
  return 0
}
