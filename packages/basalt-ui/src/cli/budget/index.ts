/**
 * The consumer budget, `.basalt/budget.json` (docs/v3/ARCHITECTURE.md section 2, guardrails
 * section 9): the one schema, reader, writer and base-ref ratchet. `init` seeds it, `lint` and
 * `doctor` read and count it, the migration PR lands the counted waivers and escapes into it.
 * Nothing here is a verb. A ceiling only goes up through `eject --raise` (G1), so `landBudget`
 * never writes `ejects`, `adopted`, `raises` or `profileFloor`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { PROFILES } from '../manifest'
import type { Profile } from '../manifest'

export const BUDGET_PATH = '.basalt/budget.json'

/** The ceilings `lint` fails above. `adopted` is a record, not a ceiling. */
export const CEILINGS = ['ejects', 'waivers', 'escapes'] as const
export type Ceiling = (typeof CEILINGS)[number]

export type Budget = {
  ejects: number
  adopted: number
  waivers: number
  escapes: number
  profileFloor: Profile
  /** Written by `eject --raise` only (G1); its row shape is that verb's to define. */
  raises: Record<string, unknown>[]
}

/** What a lint or doctor run counted; a ceiling whose count is absent is not checked. */
export type BudgetCounts = Partial<Record<Ceiling, number>>

export type Breach = { name: Ceiling; count: number; ceiling: number }

export type BudgetRead = { budget: Budget } | { error: string }

const SEED = { ejects: 3, adopted: 0, waivers: 0, escapes: 3 } as const

/** The section 2 defaults for a profile: three ejects and three escapes, no waivers. */
export function seedBudget(profile: Profile): Budget {
  return { ...SEED, profileFloor: profile, raises: [] }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

const bad = (why: string): BudgetRead => ({ error: `${BUDGET_PATH}: ${why}` })

/** Parses budget text; an `error` names the first thing wrong. */
export function parseBudget(text: string): BudgetRead {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return bad('not valid JSON')
  }
  if (!isRecord(raw)) return bad('must be a JSON object')
  for (const key of ['ejects', 'adopted', 'waivers', 'escapes'] as const) {
    if (!(key in raw)) return bad(`missing \`${key}\``)
    if (!isCount(raw[key])) return bad(`\`${key}\` must be a non-negative integer`)
  }
  const { ejects, adopted, waivers, escapes, profileFloor, raises } = raw
  if (!PROFILES.includes(profileFloor as Profile)) {
    return bad(`\`profileFloor\` must be one of ${PROFILES.join(' | ')}`)
  }
  if (!Array.isArray(raises) || !raises.every(isRecord)) {
    return bad('`raises` must be an array of objects')
  }
  return {
    budget: {
      ejects: ejects as number,
      adopted: adopted as number,
      waivers: waivers as number,
      escapes: escapes as number,
      profileFloor: profileFloor as Profile,
      raises,
    },
  }
}

/** The canonical bytes: fixed key order, two-space indent, one trailing newline. */
export function serializeBudget(b: Budget): string {
  const { ejects, adopted, waivers, escapes, profileFloor, raises } = b
  return `${JSON.stringify({ ejects, adopted, waivers, escapes, profileFloor, raises }, null, 2)}\n`
}

/** `<dir>/.basalt/budget.json` parsed; a missing file is an error too, never a default. */
export function readBudget(dir: string): BudgetRead {
  let text: string
  try {
    text = readFileSync(resolve(dir, BUDGET_PATH), 'utf8')
  } catch {
    return { error: `${BUDGET_PATH}: not found; \`basalt-ui init\` or \`migrate\` seeds it` }
  }
  return parseBudget(text)
}

export function writeBudget(dir: string, budget: Budget): void {
  const path = resolve(dir, BUDGET_PATH)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, serializeBudget(budget), 'utf8')
}

/** Every counted figure above its ceiling, in ceiling order. */
export function countBreaches(budget: Budget, counts: BudgetCounts): Breach[] {
  const breaches: Breach[] = []
  for (const name of CEILINGS) {
    const count = counts[name]
    if (count !== undefined && count > budget[name]) {
      breaches.push({ name, count, ceiling: budget[name] })
    }
  }
  return breaches
}

/**
 * `<dir>/.basalt/budget.json` as committed at `baseRef`: its text, null when the ref resolves but
 * holds no copy (the migration PR), or an error when the ref does not resolve (a misspelled ref or
 * a shallow clone must not read as "no copy": the ratchet would fail open).
 */
function readBase(dir: string, baseRef: string): string | null | { error: string } {
  const git = (...args: string[]) =>
    Bun.spawnSync(['git', '-C', dir, ...args], { stderr: 'ignore' })
  if (git('rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`).exitCode !== 0) {
    return { error: `${BUDGET_PATH}: base ref \`${baseRef}\` does not resolve; fetch it first` }
  }
  const shown = git('show', `${baseRef}:./${BUDGET_PATH}`)
  return shown.exitCode === 0 ? shown.stdout.toString() : null
}

/**
 * Writes the counted `waivers` and `escapes` into `<dir>/.basalt/budget.json`. With no copy at
 * `baseRef` (the migration PR) any count lands; with one, a count above it is refused, the error
 * names `eject --raise`, and nothing is written.
 */
export function landBudget({
  counts,
  baseRef,
  dir = process.cwd(),
}: {
  counts: Pick<Budget, 'waivers' | 'escapes'>
  baseRef: string
  dir?: string
}): BudgetRead {
  const { waivers, escapes } = counts
  if (!isCount(waivers) || !isCount(escapes)) {
    return { error: 'counted waivers and escapes must be non-negative integers' }
  }
  const current = readBudget(dir)
  if ('error' in current) return current

  const baseText = readBase(dir, baseRef)
  if (typeof baseText === 'object' && baseText !== null) return baseText
  if (baseText !== null) {
    const base = parseBudget(baseText)
    if ('error' in base) return { error: `${baseRef}: ${base.error}` }
    const above = (['waivers', 'escapes'] as const).filter((k) => counts[k] > base.budget[k])
    if (above.length > 0) {
      const lines = above.map((k) => `${k} ${counts[k]} > ${base.budget[k]} at ${baseRef}`)
      return {
        error: `${BUDGET_PATH}: ${lines.join(', ')}; a ceiling only goes up with \`basalt-ui eject --raise "<named consumer>"\``,
      }
    }
  }

  const budget = { ...current.budget, waivers, escapes }
  writeBudget(dir, budget)
  return { budget }
}
