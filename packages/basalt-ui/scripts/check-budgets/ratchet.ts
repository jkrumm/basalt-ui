/**
 * The ratchet: a ceiling goes down freely and up only with a named reason. Each area file is
 * compared with its `origin/master` version; a row whose ceiling rose needs a `raises` entry in the
 * file with the exact `from`/`to`, a consumer, and a repo other than argo (docs/v3/concepts/
 * migration-release.md § 10). No base file (a new area, no `origin/master` ref) passes.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { REPO_ROOT } from './lib'
import type { AreaModule, Raise } from './lib'

/** The base-branch source of an area file, or `null` when it has none. */
export type ReadBase = (file: string) => string | null

export function gitBase(file: string): string | null {
  const path = relative(REPO_ROOT, file).split(sep).join('/')
  const shown = Bun.spawnSync(['git', '-C', REPO_ROOT, 'show', `origin/master:${path}`], {
    stderr: 'ignore',
  })
  return shown.exitCode === 0 ? shown.stdout.toString() : null
}

/** Evaluate base-branch source: written to a temp file with its imports anchored to the real tree. */
async function loadBase(file: string, source: string): Promise<AreaModule> {
  const anchored = source.replace(
    /\bfrom\s*(['"])([^'"]+)\1/g,
    (_, quote: string, spec: string) => {
      try {
        return `from ${quote}${Bun.resolveSync(spec, dirname(file))}${quote}`
      } catch {
        return `from ${quote}${spec}${quote}`
      }
    },
  )
  const dir = mkdtempSync(join(tmpdir(), 'budget-base-'))
  try {
    const path = join(dir, basename(file))
    writeFileSync(path, anchored)
    return (await import(pathToFileURL(path).href)) as AreaModule
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Why no entry in `raises` covers `id` going `from` → `to`, or `null` when one does. */
function raiseProblem(raises: readonly Raise[], id: string, from: number, to: number) {
  const raise = raises.find((r) => r.ceiling === id && r.from === from && r.to === to)
  if (raise === undefined) return 'no raise row { ceiling, from, to, consumer, repo } covers it'
  if (raise.consumer.trim() === '') return 'its raise row names no consumer'
  const repo = raise.repo.trim().toLowerCase()
  if (repo === '') return 'its raise row names no repo'
  if (repo === 'argo') return 'its raise row names argo; a raise needs a consumer outside argo'
  return null
}

/**
 * One line per raised ceiling that no valid raise row covers. Rows join on `id` across every area
 * file, so a row moved between areas keeps its history; a row under a new id is a new row.
 */
export async function ratchetViolations({
  files,
  readBase,
}: {
  files: readonly string[]
  readBase: ReadBase
}): Promise<string[]> {
  const baseCeilings = new Map<string, number>()
  for (const file of files) {
    const source = readBase(file)
    if (source === null) continue
    for (const row of (await loadBase(file, source)).rows) baseCeilings.set(row.id, row.ceiling)
  }

  const violations: string[] = []
  for (const file of files) {
    const current = (await import(pathToFileURL(file).href)) as AreaModule
    for (const row of current.rows) {
      const from = baseCeilings.get(row.id)
      if (from === undefined || row.ceiling <= from) continue
      const problem = raiseProblem(current.raises ?? [], row.id, from, row.ceiling)
      if (problem === null) continue
      violations.push(
        `${basename(file, '.ts')}/${row.id}: ceiling ${from} → ${row.ceiling}, ${problem}`,
      )
    }
  }
  return violations
}
