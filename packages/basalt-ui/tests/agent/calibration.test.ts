/**
 * sk-9b: the calibration hash test and the `calibrate-record` script.
 *
 * `docs/calibration/last.json` records six blind reviewer verdicts against the hash of
 * `agent/reviewer/rubric.md`. No file is "not calibrated": skipped, never counted as a pass. A
 * stale hash or fewer than six per-seed verdicts is red until the owner re-records the six runs.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'

import {
  LAST_PATH,
  RUBRIC_PATH,
  SEEDS,
  hashRubric,
  recordCalibration,
} from '../../scripts/calibrate-record'
import type { Calibration } from '../../scripts/calibrate-record'

const rubric = readFileSync(RUBRIC_PATH, 'utf8')

/** Every reason a recorded calibration is stale; empty means current. */
export function staleReasons(last: Partial<Calibration>, rubricText: string): string[] {
  const reasons: string[] = []
  if (last.rubricHash !== hashRubric(rubricText))
    reasons.push('rubricHash differs from agent/reviewer/rubric.md: re-record the six blind runs')
  const seeds = new Set((last.verdicts ?? []).map((v) => v.seed))
  const missing = Object.keys(SEEDS).filter((s) => !seeds.has(s as keyof typeof SEEDS))
  if ((last.verdicts ?? []).length < 6 || missing.length > 0)
    reasons.push(`fewer than six per-seed verdicts (missing: ${missing.join(', ') || 'none'})`)
  return reasons
}

const run = (seed: string, verdict: 'pass' | 'fail', failed: string[] = []): string =>
  JSON.stringify({
    version: 1,
    degraded: false,
    failedClosed: null,
    components: [{ name: seed, route: `/scenarios/${seed}`, verdict, failed }],
    score: verdict === 'pass' ? 100 : 75,
  })

const fixtures = Object.entries(SEEDS).map(([seed, { expected, items }]) => ({
  file: `${seed}.json`,
  raw: run(seed, expected, [...items]),
}))

describe('calibration hash', () => {
  const reportsNotCalibrated = !existsSync(LAST_PATH)
  if (reportsNotCalibrated) {
    it.skip('not-calibrated: docs/calibration/last.json is absent (owner-run recording pending)', () => {})
    return
  }
  it('is recorded against the current rubric with six per-seed verdicts', () => {
    const last = JSON.parse(readFileSync(LAST_PATH, 'utf8')) as Calibration
    expect(staleReasons(last, rubric)).toEqual([])
  })
})

describe('staleReasons', () => {
  const current = recordCalibration(fixtures, rubric)

  it('passes a recording of the current rubric', () => {
    expect(staleReasons(current, rubric)).toEqual([])
  })

  it('is red when the rubric changed after recording', () => {
    expect(staleReasons(current, `${rubric}\nA new item.`)).toHaveLength(1)
  })

  it('is red with fewer than six verdicts', () => {
    const five = { ...current, verdicts: current.verdicts.slice(1) }
    expect(staleReasons(five, rubric).join()).toContain('fewer than six')
  })
})

describe('calibrate-record', () => {
  it('writes the current rubric hash and six per-seed verdicts in seed order', () => {
    const out = recordCalibration(fixtures.toReversed(), rubric)
    expect(out.rubricHash).toBe(hashRubric(rubric))
    expect(out.verdicts.map((v) => v.seed)).toEqual(Object.keys(SEEDS) as (keyof typeof SEEDS)[])
    expect(out.verdicts[0]).toMatchObject({ seed: 'calibrate-good', verdict: 'pass', failed: [] })
    expect(out.verdicts[1]).toMatchObject({ verdict: 'fail', failed: ['Craft 4', 'Expression 3'] })
  })

  it('refuses a count other than six, a repeated seed, and a degraded run', () => {
    expect(() => recordCalibration(fixtures.slice(1), rubric)).toThrow('expected 6')
    const twice = [...fixtures.slice(1), fixtures[1]!]
    expect(() => recordCalibration(twice, rubric)).toThrow('given twice')
    const degraded = { file: 'd.json', raw: run('calibrate-good', 'pass').replace('false', 'true') }
    expect(() => recordCalibration([degraded, ...fixtures.slice(1)], rubric)).toThrow('DEGRADED')
  })

  it('calls no model: no fetch and no SDK import in the script', () => {
    const source = readFileSync(`${import.meta.dir}/../../scripts/calibrate-record.ts`, 'utf8')
    expect(source).not.toMatch(/\bfetch\(|@anthropic-ai|from 'openai'|child_process/)
  })
})
