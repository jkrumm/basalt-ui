import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { parsePropRef, parseValueRef, transformNames } from './transform.ts'
import type { NameChange, PropRow, RuleRow, ValueRow } from './transform.ts'

const DEFAULT_ROWS_DIR = resolve(import.meta.dir, '../../../packages/basalt-ui/migrations/areas')

type RawRow = {
  id?: string
  kind?: string
  from?: string
  to?: string
  codemod?: string
  manual?: boolean
}
type RawArea = { rows?: RawRow[]; rules?: { old?: string; new?: string }[] }

export type NameRows = { props: PropRow[]; values: ValueRow[]; rules: RuleRow[]; skipped: string[] }

/**
 * The rows this codemod applies: `renamed-prop` rows naming codemod `props`, `map` rows naming codemod
 * `values`, and every `rules` entry. A row that names one of the two codemods but does not parse is
 * reported, never dropped quietly.
 */
export function loadNameRows(dir: string): NameRows {
  const out: NameRows = { props: [], values: [], rules: [], skipped: [] }
  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const area = JSON.parse(readFileSync(join(dir, name), 'utf8')) as RawArea
    for (const r of area.rows ?? []) {
      if (r.manual === true || (r.codemod !== 'props' && r.codemod !== 'values')) continue
      if (r.codemod === 'props') {
        const ref = r.kind === 'renamed-prop' && r.from ? parsePropRef(r.from) : null
        if (!ref || !r.id || !r.to || !/^[A-Za-z_$][\w$]*$/.test(r.to)) {
          out.skipped.push(
            `${name}: row ${r.id ?? '?'} is codemod "props" but not a renamed-prop row of the form pkg#Part.prop to prop`,
          )
          continue
        }
        out.props.push({ id: r.id, module: ref.module, part: ref.part, from: ref.prop, to: r.to })
        continue
      }
      const ref = r.kind === 'map' && r.from ? parseValueRef(r.from) : null
      const to = r.to ? /^'([^']*)'$/.exec(r.to)?.[1] : undefined
      if (!ref || !r.id || to === undefined) {
        out.skipped.push(
          `${name}: row ${r.id ?? '?'} is codemod "values" but not a map row of the form pkg#Type 'old' to 'new'`,
        )
        continue
      }
      out.values.push({ id: r.id, module: ref.module, type: ref.type, from: ref.value, to })
    }
    for (const rule of area.rules ?? []) {
      if (rule.old && rule.new) out.rules.push({ old: rule.old, new: rule.new })
    }
  }
  return out
}

export type NamesSummary = {
  files: number
  changedFiles: number
  changes: NameChange[]
  skipped: string[]
}

const TEXT = '**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,json,jsonc,css}'

export function runNames(opts: { dir: string; rowsDir: string; write: boolean }): NamesSummary {
  const rows = loadNameRows(opts.rowsDir)
  const summary: NamesSummary = { files: 0, changedFiles: 0, changes: [], skipped: rows.skipped }
  const files = [...new Bun.Glob(TEXT).scanSync({ cwd: opts.dir, onlyFiles: true, dot: true })]
    .filter((f) => !/(^|\/)(node_modules|dist|build|\.git)\//.test(f) && !f.endsWith('.d.ts'))
    .sort()
  for (const rel of files) {
    const path = resolve(opts.dir, rel)
    const source = readFileSync(path, 'utf8')
    summary.files++
    const result = transformNames(source, { file: rel, ...rows })
    if (result.parseFailed) summary.skipped.push(`${rel}: does not parse, skipped`)
    summary.changes.push(...result.changes)
    if (result.text !== source) {
      summary.changedFiles++
      if (opts.write) writeFileSync(path, result.text)
    }
  }
  return summary
}

export function namesCommand(args: string[]): number {
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
      'usage: run.ts names <app-dir> [--rows <areas-dir>] [--report <file>] [--dry-run]',
    )
    return 2
  }
  const summary = runNames({
    dir: resolve(dir),
    rowsDir: resolve(values.rows),
    write: !values['dry-run'],
  })
  if (values.report) {
    mkdirSync(dirname(resolve(values.report)), { recursive: true })
    writeFileSync(resolve(values.report), JSON.stringify(summary, null, 2))
  }
  for (const s of summary.skipped) console.warn(`names: skipped ${s}`)
  console.log(
    `names: ${summary.changes.length} names rewritten in ${summary.changedFiles} files${values['dry-run'] ? ' (dry run, nothing written)' : ''}`,
  )
  return 0
}
