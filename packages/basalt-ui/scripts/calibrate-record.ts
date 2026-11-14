/**
 * `calibrate-record` — writes `docs/calibration/last.json` from six reviewer verdict files.
 *
 * Calibration is the proof that a rubric change did not silently move scores: six blind reviewer
 * runs (five seeded offenders and one known-good board, `apps/playground` `Calibrate*.tsx`) are
 * recorded against the sha256 of `agent/reviewer/rubric.md`. When the rubric changes, the hash
 * test (`tests/agent/calibration.test.ts`) goes red until the six runs are redone and recorded
 * again. The runs are owner-run; this script only reads the six verdict files they leave behind
 * (each the reviewer's `last.json`, rubric "Handing the result on") and calls no model.
 *
 * Usage: bun packages/basalt-ui/scripts/calibrate-record.ts <verdict.json> x6
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export const RUBRIC_PATH = resolve(import.meta.dir, '../agent/reviewer/rubric.md')
export const LAST_PATH = resolve(import.meta.dir, '../docs/calibration/last.json')

/** The six seeds and what a correct blind review of each says (the seed headers name the item). */
export const SEEDS = {
  'calibrate-good': { expected: 'pass', items: [] },
  'calibrate-delta-fill': { expected: 'fail', items: ['Craft 4', 'Expression 3'] },
  'calibrate-empty-half': { expected: 'fail', items: ['Craft 3'] },
  'calibrate-repeated-axis': { expected: 'fail', items: ['Expression 5'] },
  'calibrate-accent-tab': { expected: 'fail', items: ['Craft 4'] },
  'calibrate-banned-subtitle': { expected: 'fail', items: ['Communication 1'] },
} as const satisfies Record<string, { expected: 'pass' | 'fail'; items: readonly string[] }>

export type SeedName = keyof typeof SEEDS

export type SeedVerdict = {
  seed: SeedName
  verdict: 'pass' | 'fail'
  failed: string[]
  score: number | null
}

export type Calibration = { rubricHash: string; verdicts: SeedVerdict[] }

type Component = { name?: unknown; route?: unknown; verdict?: unknown; failed?: unknown }

export const hashRubric = (text: string): string => createHash('sha256').update(text).digest('hex')

const SEED_NAMES = Object.keys(SEEDS) as SeedName[]

/** The seed a verdict file reviewed: the one seed id its components' route or name carries. */
function seedOf(file: string, components: Component[]): SeedName {
  const text = components.map((c) => `${String(c.route)} ${String(c.name)}`).join(' ')
  const found = SEED_NAMES.filter((s) => text.includes(s))
  if (found.length !== 1)
    throw new Error(
      `${file}: expected exactly one seed id in the components, found ${found.length}`,
    )
  return found[0]!
}

/** One reviewer `last.json` → one per-seed verdict; a degraded or failed-closed run is refused. */
export function verdictOf(file: string, raw: string): SeedVerdict {
  const data = JSON.parse(raw) as {
    degraded?: unknown
    failedClosed?: unknown
    components?: unknown
    score?: unknown
  }
  if (data.degraded === true) throw new Error(`${file}: a DEGRADED run never calibrates`)
  if (data.failedClosed)
    throw new Error(`${file}: the run failed closed (${String(data.failedClosed)})`)
  if (!Array.isArray(data.components) || data.components.length === 0)
    throw new Error(`${file}: no components`)
  const components = data.components as Component[]
  const failed = components.flatMap((c) =>
    c.verdict === 'fail' && Array.isArray(c.failed) ? (c.failed as string[]) : [],
  )
  const anyFail = components.some((c) => c.verdict === 'fail')
  return {
    seed: seedOf(file, components),
    verdict: anyFail ? 'fail' : 'pass',
    failed: [...new Set(failed)],
    score: typeof data.score === 'number' ? data.score : null,
  }
}

/** Exactly six distinct seeds, in the fixed seed order. */
export function recordCalibration(
  files: readonly { file: string; raw: string }[],
  rubric: string,
): Calibration {
  if (files.length !== SEED_NAMES.length)
    throw new Error(`expected ${SEED_NAMES.length} verdict files, got ${files.length}`)
  const bySeed = new Map<SeedName, SeedVerdict>()
  for (const { file, raw } of files) {
    const verdict = verdictOf(file, raw)
    if (bySeed.has(verdict.seed)) throw new Error(`${file}: seed ${verdict.seed} given twice`)
    bySeed.set(verdict.seed, verdict)
  }
  return {
    rubricHash: hashRubric(rubric),
    verdicts: SEED_NAMES.map((s) => bySeed.get(s)!),
  }
}

if (import.meta.main) {
  try {
    const paths = process.argv.slice(2)
    const files = paths.map((p) => ({ file: p, raw: readFileSync(p, 'utf8') }))
    const calibration = recordCalibration(files, readFileSync(RUBRIC_PATH, 'utf8'))
    mkdirSync(dirname(LAST_PATH), { recursive: true })
    writeFileSync(LAST_PATH, `${JSON.stringify(calibration, null, 2)}\n`)
    console.log(`calibrate-record: wrote ${LAST_PATH} (${calibration.verdicts.length} seeds)`)
  } catch (error) {
    console.error(`calibrate-record: ${(error as Error).message}`)
    process.exit(1)
  }
}
