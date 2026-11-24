/**
 * The consumer budget, `.basalt/budget.json` (docs/v3/ARCHITECTURE.md section 2, guardrails
 * section 9): the one schema, reader, writer and base-ref ratchet. `init` seeds it, `lint` and
 * `doctor` read and count it, the migration PR lands the counted waivers and escapes into it.
 * Nothing here is a verb. `waivers` is a record that follows the count: a full `lint` writes it, so
 * a new waiver shows in the diff of this file and the base-ref ratchet names the growth. `ejects`
 * and `escapes` are ceilings that only go up through a raise row naming a consumer (G1):
 * `eject --raise` for `ejects` and `adopted`, `lint --raise escapes --consumer` for `escapes`
 * (`raiseCeiling`). `landBudget` never writes `ejects`, `adopted`, `raises` or `profileFloor`.
 * The file carries `format`; an older format is rewritten by `sync`, and keys this version does
 * not know are kept (`rest`), so a newer budget survives an older CLI.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { PROFILES } from '../manifest'
import type { Profile } from '../manifest'

export const BUDGET_PATH = '.basalt/budget.json'

/** The format this version writes; a file without the field is format 0. */
export const BUDGET_FORMAT = 1

/** The ceilings `lint` fails above. `adopted` and `waivers` are records, not ceilings. */
export const CEILINGS = ['ejects', 'escapes'] as const
export type Ceiling = (typeof CEILINGS)[number]

export type Budget = {
  ejects: number
  adopted: number
  waivers: number
  escapes: number
  profileFloor: Profile
  /** Written by `eject --raise` and `lint --raise` only (G1): `{ field, from, to, consumer }`. */
  raises: Record<string, unknown>[]
  /** Fields this version does not know, kept so a newer budget survives an older CLI. */
  rest?: Record<string, unknown>
}

/** What a lint or doctor run counted; a ceiling whose count is absent is not checked. */
export type BudgetCounts = Partial<Record<Ceiling | 'waivers', number>>

export type Breach = { name: Ceiling; count: number; ceiling: number }

export type BudgetRead = { budget: Budget; format?: number } | { error: string }

const SEED = { ejects: 3, adopted: 0, waivers: 0, escapes: 3 } as const

/** The section 2 defaults for a profile: three ejects and three escapes, no waivers yet. */
export function seedBudget(profile: Profile): Budget {
  return { ...SEED, profileFloor: profile, raises: [] }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0

const KEYS = ['ejects', 'adopted', 'waivers', 'escapes', 'profileFloor', 'raises'] as const

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
  const format = raw['format'] ?? 0
  if (!isCount(format)) return bad('`format` must be a non-negative integer')
  if (format > BUDGET_FORMAT) {
    return bad(
      `format ${format} is newer than this basalt-ui reads (${BUDGET_FORMAT}); upgrade basalt-ui`,
    )
  }
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
  const known = new Set(['format', ...KEYS])
  const rest = Object.fromEntries(Object.entries(raw).filter(([key]) => !known.has(key)))
  return {
    format,
    budget: {
      ejects: ejects as number,
      adopted: adopted as number,
      waivers: waivers as number,
      escapes: escapes as number,
      profileFloor: profileFloor as Profile,
      raises,
      ...(Object.keys(rest).length > 0 ? { rest } : {}),
    },
  }
}

/** The canonical bytes: `format` first, fixed key order, unknown keys last, two-space indent, one trailing newline. */
export function serializeBudget(b: Budget): string {
  const { ejects, adopted, waivers, escapes, profileFloor, raises, rest } = b
  const body = {
    format: BUDGET_FORMAT,
    ejects,
    adopted,
    waivers,
    escapes,
    profileFloor,
    raises,
    ...rest,
  }
  return `${JSON.stringify(body, null, 2)}\n`
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

/** The ceiling `lint --raise` lifts; `ejects` has `eject --raise`, which counts what it ejects, and `waivers` follows the count. */
export const LINT_RAISABLE = ['escapes'] as const
export type LintRaisable = (typeof LINT_RAISABLE)[number]

/** The command that lifts one ceiling: the text a breach message hands the reader. */
export function raiseCommand(field: string): string {
  return field === 'ejects'
    ? '`basalt-ui eject <name> --reason "<why>" --raise "<named consumer>"`'
    : `\`basalt-ui lint --raise ${field} --consumer "<named consumer>"\``
}

/**
 * Lifts `field` to the counted figure and appends one `raises` row naming the consumer: the one way
 * `escapes` goes up. Nothing is written when the count is within the ceiling or the
 * consumer is not one non-empty line.
 */
export function raiseCeiling({
  field,
  count,
  consumer,
  dir = process.cwd(),
}: {
  field: LintRaisable
  count: number
  consumer: string
  dir?: string
}): BudgetRead {
  const who = consumer.trim()
  if (who === '' || /[\r\n]/.test(who)) {
    return { error: '--consumer must be one non-empty line naming who needs the raise' }
  }
  const current = readBudget(dir)
  if ('error' in current) return current
  const from = current.budget[field]
  if (count <= from) {
    return { error: `${field} is ${count}, within the ceiling ${from}: nothing to raise` }
  }
  const raises = [...current.budget.raises, { field, from, to: count, consumer: who }]
  const budget = { ...current.budget, [field]: count, raises }
  writeBudget(dir, budget)
  return { budget }
}

/** `1 waiver is` / `2 waivers are`: the counted figure and its verb agreeing in number (`adopted` has no plural). */
export function countedFigure(name: string, count: number): string {
  const noun = name === 'adopted' || count !== 1 ? name : name.replace(/s$/, '')
  return `${count} ${noun} ${count === 1 ? 'is' : 'are'}`
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
    spawnSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  if (git('rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`).status !== 0) {
    return { error: `${BUDGET_PATH}: base ref \`${baseRef}\` does not resolve; fetch it first` }
  }
  const shown = git('show', `${baseRef}:./${BUDGET_PATH}`)
  return shown.status === 0 ? shown.stdout : null
}

/**
 * Writes the counted `waivers` and `escapes` into `<dir>/.basalt/budget.json`. `waivers` always
 * lands: it follows the count. With no copy at `baseRef` (the migration PR) any escape count lands;
 * with one, an escape count above it is refused, the error names the raise, and nothing is written.
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
    const above = (['escapes'] as const).filter((k) => counts[k] > base.budget[k])
    if (above.length > 0) {
      const lines = above.map((k) => `${k} ${counts[k]} > ${base.budget[k]} at ${baseRef}`)
      return {
        error: `${BUDGET_PATH}: ${lines.join(', ')}; a ceiling only goes up with ${above.map(raiseCommand).join(' and ')}`,
      }
    }
  }

  const budget = { ...current.budget, waivers, escapes }
  writeBudget(dir, budget)
  return { budget }
}

/**
 * Records the counted waivers when they differ from the file: the ceiling follows the count, so the
 * change shows in the diff. Null when nothing changed or there is no budget to write.
 */
export function followWaivers(dir: string, count: number): { from: number; to: number } | null {
  const current = readBudget(dir)
  if ('error' in current || current.budget.waivers === count) return null
  writeBudget(dir, { ...current.budget, waivers: count })
  return { from: current.budget.waivers, to: count }
}

/** Rewrites a budget of an older format in the current one; true when it wrote. */
export function migrateBudget(dir: string): boolean {
  const current = readBudget(dir)
  if ('error' in current || (current.format ?? BUDGET_FORMAT) >= BUDGET_FORMAT) return false
  writeBudget(dir, current.budget)
  return true
}
