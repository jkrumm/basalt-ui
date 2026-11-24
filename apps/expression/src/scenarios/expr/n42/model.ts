import { LIMIT } from './fixture'
import type { LineEvent, RouterFixture, Sample } from './fixture'

const HOUR_MINUTES = 60

/** Points of percent a load must climb in the hour before a drop to count as having risen. */
const RISE = 10

type Load = 'Memory' | 'CPU'

/** The loads whose check holds, named, in the order given. */
const named = (checks: readonly (readonly [Load, boolean])[]): Load[] =>
  checks.flatMap(([load, hit]) => (hit ? [load] : []))

/** What a drop followed: the change of each load over the hour up to the drop, in points of percent. */
export type DropLead = {
  at: Date
  memory: number
  cpu: number
  /** The loads that climbed at least `RISE` points, named. */
  rose: readonly Load[]
}

export type Summary = {
  now: Sample
  /** The loads over the limit right now, named; empty when the router is healthy. */
  over: readonly Load[]
  /** The last drop and the hour before it; null when the line did not drop. */
  last: DropLead | null
  medianMemory: number
  medianCpu: number
}

/** The reading of the minute `event` happened in. */
export const sampleAt = (samples: readonly Sample[], event: LineEvent): Sample | undefined =>
  samples.find((s) => s.at.getTime() === event.at.getTime())

/** Memory and CPU change over the hour up to `event`; null when the window holds no full hour before it. */
function leadOf(samples: readonly Sample[], event: LineEvent): DropLead | null {
  const stop = samples.findIndex((s) => s.at.getTime() === event.at.getTime())
  const stopSample = samples[stop]
  const startSample = samples[stop - HOUR_MINUTES]
  if (stopSample === undefined || startSample === undefined) return null
  const memory = stopSample.mem - startSample.mem
  const cpu = stopSample.cpu - startSample.cpu
  return {
    at: event.at,
    memory,
    cpu,
    rose: named([
      ['Memory', memory >= RISE],
      ['CPU', cpu >= RISE],
    ]),
  }
}

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

/** The answer to both questions, derived from the readings; null before there are any. */
export function summarise({ samples, events }: RouterFixture): Summary | null {
  const now = samples.at(-1)
  if (now === undefined) return null
  const lastDrop = events.findLast((e) => e.kind === 'drop')
  return {
    now,
    over: named([
      ['Memory', now.mem >= LIMIT],
      ['CPU', now.cpu >= LIMIT],
    ]),
    last: lastDrop === undefined ? null : leadOf(samples, lastDrop),
    medianMemory: median(samples.map((s) => s.mem)),
    medianCpu: median(samples.map((s) => s.cpu)),
  }
}
