import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { transformSource } from './transform.ts'
import type { Reason, WorklistItem } from './transform.ts'

export type { Reason, WorklistItem } from './transform.ts'

export type ControlsSummary = {
  files: number
  changedFiles: number
  filterSets: number
  renames: number
  worklist: WorklistItem[]
}

export function sourceFiles(dir: string): string[] {
  const glob = new Bun.Glob('**/*.{ts,tsx}')
  return [...glob.scanSync({ cwd: dir, onlyFiles: true })]
    .filter((f) => !/(^|\/)(node_modules|dist|build|\.git)\//.test(f) && !f.endsWith('.d.ts'))
    .toSorted()
}

export function runControls(opts: { dir: string; write: boolean }): ControlsSummary {
  const summary: ControlsSummary = {
    files: 0,
    changedFiles: 0,
    filterSets: 0,
    renames: 0,
    worklist: [],
  }
  for (const rel of sourceFiles(opts.dir)) {
    const path = resolve(opts.dir, rel)
    const source = readFileSync(path, 'utf8')
    if (!source.includes('basalt-ui')) continue
    summary.files++
    const result = transformSource(source, { file: rel })
    summary.filterSets += result.filterSets
    summary.renames += result.renames
    summary.worklist.push(...result.worklist)
    if (result.text !== source) {
      summary.changedFiles++
      if (opts.write) writeFileSync(path, result.text)
    }
  }
  return summary
}

const REASON_NOTES: Record<Reason, string> = {
  parse: 'The file does not parse; nothing was read or written.',
  'create-search-store':
    'Hand-migrate to defineControls (row ctl-createSearchStore); key becomes id.',
  'create-local-store': 'Either defineControls (it has a URL field) or persisted() (it has none).',
  'url-persist':
    'The 2.x URL-field persist mirror is removed. Adopt the recipe stub or drop it; storage: read-legacy once, delete if no recipe is adopted.',
  'link-search': 'A link by reference is the typed Link now.',
  'validate-search': 'A spread validator becomes extend(); a migrating wrapper becomes aliases.',
  'filterset-child':
    'The FilterSet holds something other than plain filter elements, so it was left whole.',
  'filter-prop': 'A filter prop spec() does not take, so the FilterSet was left whole.',
  'filter-label': 'spec() requires a label; add one, then re-run.',
  'standalone-filter': 'A filter outside a FilterSet; move it into specs by hand.',
  'form-section-prop': 'Section does not take this prop; the tag was renamed anyway.',
  'form-footer-props': 'FormFooter takes form and actions as data; the tag was renamed anyway.',
  'custom-picker': 'DateRangePicker customPicker is removed.',
  'rename-conflict': 'A name was already bound, so nothing was renamed here.',
  'manual-row': 'A removed symbol with a manual row; rewrite it by hand.',
}

/** Markdown for a PR body: counts, then the worklist grouped by reason. */
export function renderReport(summary: ControlsSummary): string {
  const lines = [
    '# Controls codemod report',
    '',
    `- Files that import basalt-ui: ${summary.files}`,
    `- Files changed: ${summary.changedFiles}`,
    `- FilterSets moved to specs: ${summary.filterSets}`,
    `- FormSection and FormActions renames: ${summary.renames}`,
    `- Worklist items: ${summary.worklist.length}`,
    '',
    'The report is a worklist, never an exemption: every item is resolved in a manual commit or becomes a waiver with a reason.',
    '',
  ]
  const byReason = new Map<Reason, WorklistItem[]>()
  for (const item of summary.worklist) {
    byReason.set(item.reason, [...(byReason.get(item.reason) ?? []), item])
  }
  for (const [reason, items] of byReason) {
    lines.push(`## ${reason} (${items.length})`, '', REASON_NOTES[reason], '')
    for (const i of items) {
      lines.push(`- \`${i.file}:${i.line}\` (${i.row}): ${i.text}`)
      if (i.stub !== undefined)
        lines.push('', '  ```ts', ...i.stub.split('\n').map((l) => `  ${l}`), '  ```', '')
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function controlsCommand(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      report: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  })
  const dir = positionals[0]
  if (!dir) {
    console.error('usage: run.ts controls <app-dir> [--report <file>] [--dry-run]')
    return 2
  }
  const summary = runControls({ dir: resolve(dir), write: !values['dry-run'] })
  const report = values.report
  if (report) {
    mkdirSync(dirname(resolve(report)), { recursive: true })
    writeFileSync(
      resolve(report),
      report.endsWith('.json') ? JSON.stringify(summary, null, 2) : renderReport(summary),
    )
  }
  console.log(
    `controls: ${summary.filterSets} FilterSets to specs, ${summary.renames} renames in ${summary.changedFiles} files, ${summary.worklist.length} worklist items${values['dry-run'] ? ' (dry run, nothing written)' : ''}`,
  )
  return 0
}
