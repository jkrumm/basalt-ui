import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { transformSource } from './transform.ts'
import type { WorklistItem } from './transform.ts'

export type LayoutSummary = {
  files: number
  changedFiles: number
  targets: number
  converted: number
  worklist: WorklistItem[]
}

export function sourceFiles(dir: string): string[] {
  const glob = new Bun.Glob('**/*.{tsx,jsx}')
  return [...glob.scanSync({ cwd: dir, onlyFiles: true })]
    .filter((f) => !/(^|\/)(node_modules|dist|build|\.git)\//.test(f))
    .sort()
}

export function runLayout(opts: { dir: string; cnImport: string; write: boolean }): LayoutSummary {
  const summary: LayoutSummary = {
    files: 0,
    changedFiles: 0,
    targets: 0,
    converted: 0,
    worklist: [],
  }
  for (const rel of sourceFiles(opts.dir)) {
    const path = resolve(opts.dir, rel)
    const source = readFileSync(path, 'utf8')
    if (!source.includes('@mantine/core')) continue
    summary.files++
    const result = transformSource(source, { file: rel, cnImport: opts.cnImport })
    summary.targets += result.targets
    summary.converted += result.converted
    summary.worklist.push(...result.worklist)
    if (result.text !== source) {
      summary.changedFiles++
      if (opts.write) writeFileSync(path, result.text)
    }
  }
  return summary
}

/** Markdown for a PR body: counts, then the worklist grouped by reason. */
export function renderReport(summary: LayoutSummary): string {
  const lines = [
    '# Layout codemod report',
    '',
    `- Files with Mantine imports: ${summary.files}`,
    `- Files changed: ${summary.changedFiles}`,
    `- Target elements: ${summary.targets}, converted ${summary.converted}, left in place ${summary.targets - summary.converted}`,
    `- Worklist items: ${summary.worklist.length}`,
    '',
    'The report is a worklist, never an exemption: every item is resolved in a manual commit or becomes a waiver with a reason.',
    '',
  ]
  const byKind = new Map<string, WorklistItem[]>()
  for (const item of summary.worklist)
    byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item])
  for (const [kind, items] of byKind) {
    lines.push(`## ${kind} (${items.length})`, '')
    for (const i of items)
      lines.push(`- \`${i.file}:${i.line}\` <${i.tag}> \`${i.prop}\`: ${i.reason}`)
    lines.push('')
  }
  return lines.join('\n')
}

export function layoutCommand(args: string[]): number {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      report: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'cn-import': { type: 'string', default: '@/lib/utils' },
    },
  })
  const dir = positionals[0]
  if (!dir) {
    console.error(
      'usage: run.ts layout <app-dir> [--report <file>] [--dry-run] [--cn-import <module>]',
    )
    return 2
  }
  const summary = runLayout({
    dir: resolve(dir),
    cnImport: values['cn-import'],
    write: !values['dry-run'],
  })
  const report = values.report
  if (report) {
    mkdirSync(dirname(resolve(report)), { recursive: true })
    writeFileSync(
      resolve(report),
      report.endsWith('.json') ? JSON.stringify(summary, null, 2) : renderReport(summary),
    )
  }
  console.log(
    `layout: ${summary.converted}/${summary.targets} elements converted in ${summary.changedFiles} files, ${summary.worklist.length} worklist items${values['dry-run'] ? ' (dry run, nothing written)' : ''}`,
  )
  return 0
}
