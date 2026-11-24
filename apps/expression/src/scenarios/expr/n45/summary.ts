/** What the page reads from a fleet: one row per container, and the counts the hero and the footer state. */
import { DAY, HOUR, MIN, NOW, fleetNamed } from './fixture'
import type { Container, ContainerState, Host } from './fixture'

/** Restarts in the week at or past which a container restarts often. */
export const OFTEN = 4
/** Peak memory, in percent of the limit, at or past which a container is near it. */
export const NEAR = 90
/** A restart loop: this many restarts inside the last two hours. */
const LOOP_RESTARTS = 3

export type Row = {
  id: string
  name: string
  image: string
  host: Host
  state: ContainerState
  /** Restarts in the last 7 days. */
  restarts: number
  /** Restarts per day, oldest day first; the last is the day ending now. */
  perDay: readonly number[]
  lastRestart: number | null
  limitMiB: number | null
  /** The highest sample of the last 24 h in percent of the limit; `null` with no limit. */
  peakPct: number | null
  /** Memory in use now, MiB. */
  usedMiB: number
  /** The 24 h samples in percent of the limit; empty with no limit. */
  pct: readonly number[]
  loop: boolean
  often: boolean
  near: boolean
  /** Past either line: the one status hue. */
  flagged: boolean
}

export type Summary = {
  /** Worst first: loops, then restarts, then peak memory. */
  rows: readonly Row[]
  /** The containers that have a limit, by peak memory rising: the chart's items. */
  plotted: readonly Row[]
  hosts: number
  loops: number
  near: number
  noLimit: number
  /** When the longest restart loop began, epoch ms. */
  loopSince: number | null
}

const round1 = (n: number): number => Math.round(n * 10) / 10

function rowOf(c: Container): Row {
  const week = c.restartAt.filter((t) => t > NOW - 7 * DAY)
  const perDay = Array.from({ length: 7 }, (_, d) => {
    const to = NOW - (6 - d) * DAY
    return week.filter((t) => t > to - DAY && t <= to).length
  })
  const { limitMiB } = c
  const pct = limitMiB === null ? [] : c.usedMiB.map((m) => round1((m / limitMiB) * 100))
  const peakPct = limitMiB === null ? null : Math.max(...pct)
  const loop = week.filter((t) => t > NOW - 2 * HOUR).length >= LOOP_RESTARTS
  const often = week.length >= OFTEN
  const near = peakPct !== null && peakPct >= NEAR
  return {
    id: c.id,
    name: c.name,
    image: c.image,
    host: c.host,
    state: c.state,
    restarts: week.length,
    perDay,
    lastRestart: week.at(-1) ?? null,
    limitMiB,
    peakPct,
    usedMiB: c.usedMiB.at(-1) ?? 0,
    pct,
    loop,
    often,
    near,
    flagged: loop || often || near,
  }
}

/** The start of the run of restarts, none more than 40 minutes after the one before, that ends now. */
function loopStart(c: Container): number | null {
  const times = c.restartAt
  let start: number | null = null
  for (let i = times.length - 1; i >= 0; i -= 1) {
    const t = times[i] ?? 0
    const next = times[i + 1] ?? NOW
    if (next - t > 40 * MIN) break
    start = t
  }
  return start
}

const CACHE = new Map<string | undefined, Summary>()

/** The summary of `?fixture=<name>`, built once so the focus keeps one array of items; `'none'` is a fleet that reported nothing. */
export function summaryNamed(name: string | undefined): Summary {
  const cached = CACHE.get(name)
  if (cached !== undefined) return cached
  const made = summarize(name === 'none' ? [] : fleetNamed(name))
  CACHE.set(name, made)
  return made
}

function summarize(fleet: readonly Container[]): Summary {
  const rows = fleet.map(rowOf)
  const sorted = [...rows].sort(
    (a, b) =>
      Number(b.loop) - Number(a.loop) ||
      b.restarts - a.restarts ||
      (b.peakPct ?? -1) - (a.peakPct ?? -1),
  )
  const looping = fleet.filter((c) => rows.some((r) => r.id === c.id && r.loop))
  const starts = looping.map(loopStart).filter((t): t is number => t !== null)
  return {
    rows: sorted,
    plotted: rows
      .filter((r) => r.peakPct !== null)
      .sort((a, b) => (a.peakPct ?? 0) - (b.peakPct ?? 0)),
    hosts: new Set(rows.map((r) => r.host)).size,
    loops: rows.filter((r) => r.loop).length,
    near: rows.filter((r) => r.near).length,
    noLimit: rows.filter((r) => r.limitMiB === null).length,
    loopSince: starts.length === 0 ? null : Math.min(...starts),
  }
}
