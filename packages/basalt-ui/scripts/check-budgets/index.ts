/**
 * The runner. Every file in `areas/` exports `rows` (and optionally `raises`); this scans the
 * directory, so a lane adds its own area file and never edits this one. Rows print in `order`,
 * every number beside its ceiling, before any exit — a failing run always shows the full picture.
 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { PKG_ROOT, Unmeasured, summarizeError } from './lib'
import type { AreaModule, Budget, Ctx, RowDef } from './lib'
import { gitBase, ratchetViolations } from './ratchet'
import type { ReadBase } from './ratchet'

const AREAS_DIR = join(import.meta.dir, 'areas')
const PROVIDER_ONLY_DIST = join(PKG_ROOT, 'dist/index.js')

/** The area files in `dir`, sorted by name. */
export function areaFiles(dir: string): string[] {
  const names = [...new Bun.Glob('*.ts').scanSync({ cwd: dir, onlyFiles: true })]
  return names.toSorted().map((name) => join(dir, name))
}

/** Every row of every area, in print order. A repeated `id` is a bug in the lane that added it. */
async function loadRows(files: readonly string[]): Promise<RowDef[]> {
  const rows: RowDef[] = []
  for (const file of files) {
    const area = (await import(pathToFileURL(file).href)) as AreaModule
    rows.push(...area.rows)
  }
  const ids = new Set<string>()
  for (const { id } of rows) {
    if (ids.has(id)) throw new Error(`check-budgets: row id "${id}" is defined twice`)
    ids.add(id)
  }
  return rows.toSorted((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

async function measureRow(row: RowDef, ctx: Ctx): Promise<Budget> {
  const { label, ceiling } = row
  try {
    const measured = await row.measure(ctx)
    return typeof measured === 'number'
      ? { label, ceiling, value: measured }
      : { label, ceiling, ...measured }
  } catch (error) {
    const unmeasured =
      error instanceof Unmeasured
        ? { kind: error.kind, reason: error.message }
        : { kind: 'failed' as const, reason: summarizeError(error) }
    return { label, ceiling, value: null, unmeasured }
  }
}

export type RunBudgetsOptions = {
  /** `--report`: print everything, exit 0 regardless. */
  reportOnly: boolean
  /** The built root entry the provider-only fixture bundles. Defaults to this package's `dist`. */
  providerOnlyDist?: string
  log?: (line: string) => void
  /** Where the area files live. Defaults to `areas/` beside this file. */
  areasDir?: string
  /** The ratchet's base source for an area file. Defaults to `git show origin/master:<file>`. */
  readBase?: ReadBase
}

/** Print every budget row, then the verdict; returns the exit code instead of exiting. */
export async function runBudgets({
  reportOnly,
  providerOnlyDist = PROVIDER_ONLY_DIST,
  log = console.log,
  areasDir = AREAS_DIR,
  readBase = gitBase,
}: RunBudgetsOptions): Promise<0 | 1> {
  const files = areaFiles(areasDir)
  const memo = new Map<string, Promise<unknown>>()
  const ctx: Ctx = {
    providerOnlyDist,
    once: <T>(key: string, build: () => Promise<T>) => {
      if (!memo.has(key)) memo.set(key, build())
      return memo.get(key) as Promise<T>
    },
  }
  const rows: Budget[] = []
  for (const row of await loadRows(files)) rows.push(await measureRow(row, ctx))
  // An unmeasured row is a breach of the gate (it cannot vouch for the number) but not of the
  // report: `--report` prints it as skipped/failed and still exits 0.
  const breaches = rows.filter((b) => b.value === null || b.value > b.ceiling)
  const raised = await ratchetViolations({ files, readBase })

  const width = Math.max(...rows.map((b) => b.label.length))
  for (const b of rows) {
    if (b.value === null) {
      const { kind, reason } = b.unmeasured ?? { kind: 'skipped', reason: 'not measured' }
      const mark = kind === 'failed' ? '✖' : '-'
      log(`${mark} ${b.label.padEnd(width)}  ${kind}: ${reason} / ${b.ceiling}`)
      continue
    }
    const mark = b.value > b.ceiling ? '✖' : '✓'
    log(`${mark} ${b.label.padEnd(width)}  ${b.value} / ${b.ceiling}`)
    for (const line of b.detail ?? []) log(`    ${line}`)
  }
  for (const line of raised) log(`✖ ratchet: ${line}`)

  const failures = breaches.length + raised.length
  if (failures === 0) {
    log(`\n✓ check-budgets: all ${rows.length} budgets within ceiling.`)
    return 0
  }

  log(
    `\n${reportOnly ? '⚠' : '✖'} check-budgets: ${failures} of ${rows.length} budget${
      rows.length === 1 ? '' : 's'
    } over ceiling or unmeasured${raised.length > 0 ? ' or raised without a row' : ''}${
      reportOnly ? ' (--report: not failing the build)' : ''
    }.`,
  )
  return reportOnly ? 0 : 1
}
