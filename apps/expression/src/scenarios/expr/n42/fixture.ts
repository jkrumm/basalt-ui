/**
 * Router health fixture (scenario expr-n42): one sample a minute for 24 hours, the line events
 * with their times, and the router's own facts. Seeded, so every build draws the same minutes.
 *
 * - rest: two drops. The 04:18 drop met a flat router; the 16:42 drop followed an hour in which
 *   memory climbed from 47 % to 82 %, and its resync spiked the CPU to 96 %.
 * - quiet (`?fixture=quiet`): the line held all day, so there are no events at all.
 * - pegged (`?fixture=pegged`): the router is over its limit right now, memory and CPU both at 100 %.
 */

export type Sample = { at: Date; cpu: number; mem: number }
export type LineEventKind = 'drop' | 'resync'
export type LineEvent = { id: string; at: Date; kind: LineEventKind }
export type RouterFixture = {
  samples: readonly Sample[]
  events: readonly LineEvent[]
  uptimeMinutes: number
  firmware: string
}

export const NOW = Date.UTC(2026, 10, 17, 20, 0)
const SAMPLES = 1440
const MINUTE = 60_000
const START = NOW - (SAMPLES - 1) * MINUTE

/** The healthy ceiling, in percent, for both CPU and memory. */
export const LIMIT = 80

const clock = (hour: number, minute: number): number => Date.UTC(2026, 10, 17, hour, minute)
const minuteOf = (ms: number): number => Math.round((ms - START) / MINUTE)

/** A small seeded generator: the same seed gives the same router every time. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Shape = {
  cpu: number[]
  mem: number[]
}

/** The quiet router: a low CPU that breathes with the evening, memory a steady half full. */
function baseline(random: () => number): Shape {
  const cpu: number[] = []
  const mem: number[] = []
  let drift = 0
  for (let i = 0; i < SAMPLES; i++) {
    const hour =
      new Date(START + i * MINUTE).getUTCHours() + new Date(START + i * MINUTE).getUTCMinutes() / 60
    const evening = Math.max(0, Math.sin(((hour - 15) / 9) * Math.PI)) * 3
    drift = drift * 0.85 + (random() - 0.5) * 1.6
    cpu.push(8 + evening + drift)
    mem.push(47 + Math.sin(i / 210) * 1.2 + (random() - 0.5) * 0.8)
  }
  return { cpu, mem }
}

/** Memory climbing to `to` over the hour up to `end`, then released when the line daemon restarts. */
function climb(shape: Shape, random: () => number, end: number, to: number): void {
  const stop = minuteOf(end)
  const from = shape.mem[stop - 60] ?? 47
  for (let k = 0; k <= 60; k++) {
    const share = k / 60
    shape.mem[stop - 60 + k] = from + (to - from) * share ** 1.15 + (random() - 0.5) * 1.4
  }
  shape.mem[stop] = to
  shape.mem[stop + 1] = (to + from) / 2
  shape.mem[stop + 2] = from + 2
}

/** The CPU the resync costs: a spike that decays over the next minutes. */
function spike(shape: Shape, resync: number, peak: number): void {
  const start = minuteOf(resync)
  const decay = [1, 0.7, 0.38, 0.2]
  decay.forEach((share, k) => {
    const base = shape.cpu[start + k] ?? 8
    shape.cpu[start + k] = base + (peak - base) * share
  })
}

const round = (value: number): number => Math.min(100, Math.max(0, Math.round(value)))

function build(events: readonly LineEvent[], shape: Shape, uptimeMinutes: number): RouterFixture {
  const samples = shape.cpu.map((cpu, i) => ({
    at: new Date(START + i * MINUTE),
    cpu: round(cpu),
    mem: round(shape.mem[i] ?? 0),
  }))
  return { samples, events, uptimeMinutes, firmware: '1.4.2' }
}

const event = (id: string, kind: LineEventKind, ms: number): LineEvent => ({
  id,
  kind,
  at: new Date(ms),
})

const FIRMWARE_UPTIME = 38 * 1440 + 4 * 60

function rest(): RouterFixture {
  const random = seeded(4217)
  const shape = baseline(random)
  climb(shape, random, clock(16, 42), 82)
  spike(shape, clock(16, 46), 96)
  spike(shape, clock(4, 21), 88)
  const events = [
    event('drop-0418', 'drop', clock(4, 18)),
    event('resync-0421', 'resync', clock(4, 21)),
    event('drop-1642', 'drop', clock(16, 42)),
    event('resync-1646', 'resync', clock(16, 46)),
  ]
  return build(events, shape, FIRMWARE_UPTIME)
}

function quiet(): RouterFixture {
  return build([], baseline(seeded(4217)), FIRMWARE_UPTIME)
}

/** Over its limit now: memory and CPU both climb through the last hour to 100 %. */
function pegged(): RouterFixture {
  const shape = baseline(seeded(4217))
  const first = SAMPLES - 180
  for (let i = first; i < SAMPLES; i++) {
    const share = (i - first) / 180
    shape.mem[i] = 47 + (100 - 47) * Math.min(1, share * 1.15)
  }
  for (let i = SAMPLES - 40; i < SAMPLES; i++) shape.cpu[i] = 100
  const events = [
    event('drop-0418', 'drop', clock(4, 18)),
    event('resync-0421', 'resync', clock(4, 21)),
  ]
  return build(events, shape, FIRMWARE_UPTIME)
}

/** The `?fixture=` names this scenario knows; any other name draws the rest state. */
export function routerFixture(name: string | undefined): RouterFixture {
  if (name === 'quiet') return quiet()
  if (name === 'pegged') return pegged()
  return rest()
}
