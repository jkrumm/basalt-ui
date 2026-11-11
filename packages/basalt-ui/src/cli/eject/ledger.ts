/**
 * The eject half of the ledger (primitives-distribution section 5): the typed `manifest.ejected`
 * row the shared manifest reader keeps as an opaque object, the per-root base copy, and
 * `.basalt/budget.json`, which `eject` writes only through `--raise` (CE4).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { Manifest } from '../manifest'

export const ORIGINS = ['seed', 'adopted', 'local'] as const
export type Origin = (typeof ORIGINS)[number]

export type EjectedRow = {
  /** The ejected file, relative to the install root. */
  path: string
  fromVersion: string
  /** sha256 of the shipped seed plus guard (`merge/seed.ts`); null for `origin: 'local'`. */
  seedDigest: string | null
  reason: string
  origin: Origin
}

/** Starting ceiling per root when no budget.json exists (ARCHITECTURE 4.2, J). */
export const DEFAULT_EJECTS = 3
export const BUDGET_PATH = '.basalt/budget.json'

export const rowKey = (root: string, name: string): string => `${root}#${name}`

/** `apps/dashboard/src` -> `apps-dashboard-src`; the root `.` -> `root`. */
export const dashedRoot = (root: string): string =>
  root === '.' ? 'root' : root.replaceAll('/', '-')

/** The merge base of an ejected seed, relative to the install root. */
export const basePath = (root: string, name: string): string =>
  `.basalt/base/${dashedRoot(root)}/${name}.tsx`

export function readRow(value: Record<string, unknown>): EjectedRow | null {
  const { path, fromVersion, seedDigest, reason, origin } = value
  if (typeof path !== 'string' || typeof fromVersion !== 'string' || typeof reason !== 'string') {
    return null
  }
  if (seedDigest !== null && typeof seedDigest !== 'string') return null
  if (!ORIGINS.includes(origin as Origin)) return null
  return { path, fromVersion, seedDigest, reason, origin: origin as Origin }
}

/** The rows of one root, by primitive name. A malformed row is kept out and named in `bad`. */
export function rowsOfRoot(
  manifest: Manifest,
  root: string,
): { rows: Map<string, EjectedRow>; bad: string[] } {
  const rows = new Map<string, EjectedRow>()
  const bad: string[] = []
  for (const [key, value] of Object.entries(manifest.ejected)) {
    const hash = key.lastIndexOf('#')
    if (hash === -1 || key.slice(0, hash) !== root) continue
    const row = readRow(value)
    if (row === null) bad.push(key)
    else rows.set(key.slice(hash + 1), row)
  }
  return { rows, bad }
}

/** The two ceilings eject counts against: `ejects` (seed and local) and `adopted`, per root. */
export type Counts = { ejects: number; adopted: number }

export function countRows(rows: ReadonlyMap<string, EjectedRow>): Counts {
  let ejects = 0
  let adopted = 0
  for (const row of rows.values()) {
    if (row.origin === 'adopted') adopted++
    else ejects++
  }
  return { ejects, adopted }
}

export type Raise = { field: string; from: unknown; to: unknown; consumer: string }

/** budget.json as written, key order kept; null when the install has none. */
export type BudgetRead = { data: Record<string, unknown> } | { error: string } | null

export function readBudget(installRoot: string): BudgetRead {
  const path = join(installRoot, BUDGET_PATH)
  if (!existsSync(path)) return null
  try {
    const data: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      return { error: `${BUDGET_PATH} must be a JSON object` }
    }
    return { data: data as Record<string, unknown> }
  } catch {
    return { error: `${BUDGET_PATH} is not valid JSON` }
  }
}

/** The ceiling a field holds, or its starting value when unset. */
export function ceilingOf(budget: Record<string, unknown> | null, field: keyof Counts): number {
  const value = budget?.[field]
  if (typeof value === 'number') return value
  return field === 'ejects' ? DEFAULT_EJECTS : 0
}

/**
 * The budget after a raise: `field` set to `max(ceiling, needed)` and one `raises` row appended.
 * A missing budget.json starts as `{ ejects, raises }` only; `migrate` owns the other fields.
 */
export function raiseBudget(
  budget: Record<string, unknown> | null,
  field: keyof Counts,
  needed: number,
  consumer: string,
): Record<string, unknown> {
  const from = ceilingOf(budget, field)
  const to = Math.max(from, needed)
  const next: Record<string, unknown> = budget === null ? { ejects: DEFAULT_EJECTS } : { ...budget }
  next[field] = to
  const raises = Array.isArray(next['raises']) ? [...(next['raises'] as unknown[])] : []
  raises.push({ field, from, to, consumer } satisfies Raise)
  next['raises'] = raises
  return next
}

export function writeBudget(installRoot: string, budget: Record<string, unknown>): void {
  const path = join(installRoot, BUDGET_PATH)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(budget, null, 2)}\n`)
}
