import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { sourceFiles } from '../layout/index.ts'
import { transformCards } from './card/transform.ts'
import { emptyReport, mergeReport, renderReport } from './report.ts'
import type { Report } from './report.ts'
import { SERIES_REWRITE_ROWS } from './series/rows.ts'
import { transformSeries } from './series/transform.ts'

export type ChartsSummary = Report & { files: number; changedFiles: number }

export function runCharts(opts: { dir: string; write: boolean }): ChartsSummary {
  const report = emptyReport()
  for (const id of SERIES_REWRITE_ROWS) report.rewritten[id] = 0
  let files = 0
  let changedFiles = 0
  for (const rel of sourceFiles(opts.dir)) {
    const path = resolve(opts.dir, rel)
    const source = readFileSync(path, 'utf8')
    const hasCards = source.includes('ChartCard')
    if (!hasCards && !source.includes('basalt-ui')) continue
    files++
    let text = source
    if (hasCards) {
      const cards = transformCards(text, { file: rel })
      mergeReport(report, cards)
      text = cards.text
    }
    // The series codemods read the text the card codemods left, so one file is written once.
    const series = transformSeries(text, { file: rel })
    mergeReport(report, series)
    text = series.text
    if (text !== source) {
      changedFiles++
      if (opts.write) writeFileSync(path, text)
    }
  }
  return { ...report, files, changedFiles }
}

export function chartsCommand(args: string[]): number {
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
    console.error('usage: run.ts charts <app-dir> [--report <file>] [--dry-run]')
    return 2
  }
  const summary = runCharts({ dir: resolve(dir), write: !values['dry-run'] })
  const target = values.report
  if (target) {
    mkdirSync(dirname(resolve(target)), { recursive: true })
    const { rewritten, flagged } = summary
    writeFileSync(
      resolve(target),
      target.endsWith('.md')
        ? renderReport(summary)
        : JSON.stringify({ rewritten, flagged }, null, 2),
    )
  }
  const rewritten = Object.values(summary.rewritten).reduce((a, b) => a + b, 0)
  console.log(
    `charts: ${rewritten} rewrites in ${summary.changedFiles} files, ${summary.flagged.length} flagged${values['dry-run'] ? ' (dry run, nothing written)' : ''}`,
  )
  return 0
}
