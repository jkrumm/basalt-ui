/**
 * Perf lane (quality-contract section 6, P9): counted React commits for one route switch and for a
 * 12-card `StatCard` ticker grid, held to `tests/quality/perf/budget.json`. Never milliseconds as a
 * gate: `ms` rows are recorded only.
 *
 * The fixtures are a `bun test` file (happy-dom, compiler off, fake clock); this lane runs it in a
 * child with `BASALT_PERF=1` and turns its report into summary rows. A failed run fails the lane.
 * `make check` never runs it: the test file does nothing without the flag.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Lane, LaneResult } from './types'

const ROOT = resolve(import.meta.dirname, '../..')
const TEST = 'packages/basalt-ui/tests/quality/perf'

type Entry = {
  commits: number
  perUnit: number[]
  ms: number
  ceiling: number
  firstMeasurement: boolean
}

const UNIT: Record<string, string> = {
  ticker: 'commits per tick',
  'route-switch': 'commits per switch',
}

export const perf: Lane = async (ctx): Promise<LaneResult> => {
  const dir = await mkdtemp(join(tmpdir(), 'basalt-perf-'))
  const out = join(dir, 'report.json')
  try {
    const proc = Bun.spawn(['bun', 'test', TEST], {
      cwd: ROOT,
      env: { ...process.env, BASALT_PERF: '1', BASALT_PERF_OUT: out },
      stdout: 'inherit',
      stderr: 'inherit',
    })
    if ((await proc.exited) !== 0) throw new Error(`perf fixtures failed (${TEST})`)
    const report = JSON.parse(await readFile(out, 'utf8')) as Record<string, Entry>
    const names = Object.keys(report).toSorted()
    const summary: LaneResult['summary'] = []
    for (const name of names) {
      const entry = report[name]!
      summary.push(
        { metric: `${name} commits`, value: entry.commits, unit: UNIT[name] ?? 'commits' },
        { metric: `${name} ceiling`, value: entry.ceiling, unit: 'commits' },
        {
          metric: `${name} duration (recorded, not gated)`,
          value: Math.round(entry.ms * 100) / 100,
          unit: 'ms',
        },
      )
    }
    return { lane: 'perf', summary, detail: { label: ctx.label, report } }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
