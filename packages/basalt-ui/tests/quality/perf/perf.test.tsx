/**
 * The perf lane (quality-contract section 6, P9): counted React commits for a route switch and for
 * a 12-card ticker grid, gated by `budget.json`. Runs only when `BASALT_PERF=1` (`make evidence`
 * sets it through `scripts/evidence/perf.ts`); `make check` never reaches it. Happy-dom, no Chrome:
 * a commit count does not depend on layout.
 */
import { act, render } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, jest, test } from 'bun:test'
import { writeFileSync } from 'node:fs'

import { cleanupApp } from '../../../src/testing/render-app'
import { installDomShims } from '../../../src/testing/dom-shims'
import { settled } from '../../../src/testing/settled'
import {
  CARDS,
  TICK_MS,
  TickerGrid,
  makeRouteApp,
  newClient,
  seedPages,
  seedTicker,
} from './fixtures'
import { commitCounter, ceilingOf, readBudget, recordFirstMeasurement } from './harness'
import type { PerfReport } from './harness'

const enabled = process.env['BASALT_PERF'] === '1'
const report: PerfReport = {}
const TICKS = 5

beforeAll(() => {
  if (enabled) installDomShims()
})
afterEach(() => {
  cleanupApp()
  jest.useRealTimers()
})

/** Mounts the grid on a fake clock, discards the mount, then returns commits for each of TICKS ticks. */
async function tickerCommits(offender: boolean): Promise<{ perTick: number[]; ms: number }> {
  jest.useFakeTimers({ now: 1_000_000 })
  const client = newClient()
  seedTicker(client)
  const counter = commitCounter()
  await act(async () => {
    render(<TickerGrid client={client} counter={counter} offender={offender} />)
  })
  counter.reset()
  const perTick: number[] = []
  for (let t = 0; t < TICKS; t += 1) {
    const before = counter.count()
    await act(async () => {
      jest.advanceTimersByTime(TICK_MS)
      // Query's notify batch is a 0 ms timer set while the tick fires; bun's clock does not run a
      // timer scheduled inside the advance that was due at its end, so flush it explicitly.
      jest.advanceTimersByTime(0)
    })
    perTick.push(counter.count() - before)
  }
  return { perTick, ms: counter.ms() }
}

function record(name: string, perUnit: number[], ms: number): number {
  const measured = Math.max(...perUnit)
  const firstMeasurement = readBudget()[name] === undefined
  const ceiling = recordFirstMeasurement(name, measured)
  report[name] = { commits: measured, perUnit, ms, ceiling, firstMeasurement }
  return ceiling
}

describe.skipIf(!enabled)('perf lane', () => {
  test('ticker: 12 StatCards on a 1 s ticker commit within the ceiling per tick', async () => {
    const { perTick, ms } = await tickerCommits(false)
    expect(new Set(perTick).size).toBe(1) // deterministic: every tick costs the same
    const ceiling = record('ticker', perTick, ms)
    expect(Math.max(...perTick)).toBeLessThanOrEqual(ceiling)
  })

  test('ticker offender: one extra commit per card per tick breaks the ceiling', async () => {
    const baseline = readBudget()['ticker']?.measured ?? (await tickerCommits(false)).perTick[0]!
    const { perTick } = await tickerCommits(true)
    expect(Math.max(...perTick)).toBeGreaterThanOrEqual(baseline + CARDS)
    expect(Math.max(...perTick)).toBeGreaterThan(ceilingOf(baseline))
  })

  test('route switch: overview to detail commits within the ceiling', async () => {
    const client = newClient()
    seedPages(client)
    const counter = commitCounter()
    const { router, App } = makeRouteApp(client, counter)
    await act(async () => {
      render(<App />)
    })
    await settled({ router, queryClient: client })
    const perSwitch: number[] = []
    let ms = 0
    for (const to of ['/detail', '/', '/detail', '/']) {
      counter.reset()
      await act(async () => {
        await router.navigate({ to })
      })
      await settled({ router, queryClient: client })
      perSwitch.push(counter.count())
      ms += counter.ms()
    }
    expect(new Set(perSwitch).size).toBe(1)
    const ceiling = record('route-switch', perSwitch, ms)
    expect(Math.max(...perSwitch)).toBeLessThanOrEqual(ceiling)
  })

  test('writes the report the evidence lane reads', () => {
    const out = process.env['BASALT_PERF_OUT']
    if (out) writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`)
    expect(Object.keys(report).length).toBeGreaterThan(0)
  })
})
