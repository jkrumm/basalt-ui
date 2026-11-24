/**
 * A homelab's containers: 25 across three hosts, restart times for 7 days and memory sampled every
 * five minutes for 24 hours. Seeded and fixed to one clock, so every render draws the same fleet.
 * `?fixture=quiet` is a fleet with no restart and memory well under its limits; `?fixture=extreme`
 * is one container restarting every 24 minutes for the whole week, two pegged at their limit and a
 * name too long for its column.
 */

export type Host = 'nas' | 'mini' | 'edge'
export type ContainerState = 'running' | 'restarting' | 'exited'

export type Container = {
  id: string
  name: string
  image: string
  host: Host
  state: ContainerState
  /** `null`: no memory limit is set. */
  limitMiB: number | null
  /** Restart times, epoch ms, oldest first. */
  restartAt: readonly number[]
  /** Memory in use, MiB, one sample every five minutes, oldest first. */
  usedMiB: readonly number[]
}

export const NOW = Date.UTC(2026, 10, 19, 9, 0)
export const MIN = 60_000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR
const SAMPLES = 288

type Memory =
  | { kind: 'flat'; pct: number }
  | { kind: 'daily'; pct: number; amp: number }
  | { kind: 'leak'; from: number; to: number }
  | { kind: 'saw'; floor: number; every: number }

type Spec = {
  name: string
  image: string
  host: Host
  /** The limit in MiB, or `null` with `ref` as the size the usage is drawn against. */
  limit: number | null
  ref?: number
  mem: Memory
  /** Hours ago of each restart. */
  restarts?: readonly number[]
  /** A restart loop: every `everyMin` minutes for `hours`. */
  loop?: { hours: number; everyMin: number }
}

const SPECS: readonly Spec[] = [
  {
    name: 'immich-server',
    image: 'immich-server:v1.119',
    host: 'nas',
    limit: 4096,
    mem: { kind: 'daily', pct: 77, amp: 8 },
  },
  {
    name: 'immich-ml',
    image: 'immich-machine-learning:v1.119',
    host: 'nas',
    limit: 6144,
    mem: { kind: 'leak', from: 58, to: 97 },
    restarts: [30, 77, 121],
  },
  {
    name: 'postgres',
    image: 'pgvecto-rs:pg14',
    host: 'nas',
    limit: 2048,
    mem: { kind: 'flat', pct: 52 },
  },
  { name: 'redis', image: 'redis:7.4', host: 'nas', limit: 512, mem: { kind: 'flat', pct: 18 } },
  {
    name: 'jellyfin',
    image: 'jellyfin:10.10',
    host: 'nas',
    limit: 3072,
    mem: { kind: 'daily', pct: 56, amp: 12 },
  },
  { name: 'sonarr', image: 'sonarr:4.0', host: 'nas', limit: 1024, mem: { kind: 'flat', pct: 44 } },
  {
    name: 'radarr',
    image: 'radarr:5.11',
    host: 'nas',
    limit: 1024,
    mem: { kind: 'flat', pct: 48 },
    restarts: [51],
  },
  {
    name: 'qbittorrent',
    image: 'qbittorrent:5.0',
    host: 'nas',
    limit: 2048,
    mem: { kind: 'daily', pct: 64, amp: 8 },
    restarts: [6, 29, 53, 77, 101],
  },
  {
    name: 'paperless',
    image: 'paperless-ngx:2.13',
    host: 'nas',
    limit: 2048,
    mem: { kind: 'leak', from: 79, to: 92 },
    restarts: [140],
  },
  {
    name: 'nextcloud',
    image: 'nextcloud:30',
    host: 'nas',
    limit: null,
    ref: 1800,
    mem: { kind: 'daily', pct: 50, amp: 10 },
    restarts: [72, 73],
  },
  {
    name: 'grafana',
    image: 'grafana:11.3',
    host: 'mini',
    limit: 1024,
    mem: { kind: 'flat', pct: 66 },
  },
  {
    name: 'prometheus',
    image: 'prometheus:v2.55',
    host: 'mini',
    limit: 2048,
    mem: { kind: 'leak', from: 68, to: 91 },
    restarts: [100, 101],
  },
  { name: 'loki', image: 'loki:3.2', host: 'mini', limit: 2048, mem: { kind: 'flat', pct: 78 } },
  {
    name: 'home-assistant',
    image: 'home-assistant:2024.11',
    host: 'mini',
    limit: 1536,
    mem: { kind: 'daily', pct: 62, amp: 6 },
    restarts: [38],
  },
  {
    name: 'mosquitto',
    image: 'mosquitto:2.0',
    host: 'mini',
    limit: 128,
    mem: { kind: 'flat', pct: 12 },
  },
  {
    name: 'zigbee2mqtt',
    image: 'zigbee2mqtt:1.41',
    host: 'mini',
    limit: 256,
    mem: { kind: 'flat', pct: 41 },
    restarts: [3.2, 20, 47, 95, 110, 150],
  },
  {
    name: 'feed-fetcher',
    image: 'feed-fetcher:0.9.4',
    host: 'mini',
    limit: 512,
    mem: { kind: 'saw', floor: 18, every: 18 },
    loop: { hours: 19, everyMin: 18 },
    restarts: [100],
  },
  {
    name: 'node-exporter',
    image: 'node-exporter:1.8',
    host: 'mini',
    limit: null,
    ref: 60,
    mem: { kind: 'flat', pct: 50 },
  },
  {
    name: 'cadvisor',
    image: 'cadvisor:0.49',
    host: 'mini',
    limit: null,
    ref: 220,
    mem: { kind: 'flat', pct: 60 },
  },
  {
    name: 'dozzle',
    image: 'dozzle:8.8',
    host: 'mini',
    limit: null,
    ref: 40,
    mem: { kind: 'flat', pct: 50 },
  },
  {
    name: 'traefik',
    image: 'traefik:3.2',
    host: 'edge',
    limit: 256,
    mem: { kind: 'flat', pct: 38 },
  },
  {
    name: 'cloudflared',
    image: 'cloudflared:2024.11',
    host: 'edge',
    limit: 128,
    mem: { kind: 'flat', pct: 22 },
  },
  {
    name: 'adguard',
    image: 'adguardhome:0.107',
    host: 'edge',
    limit: 512,
    mem: { kind: 'flat', pct: 29 },
  },
  {
    name: 'uptime-kuma',
    image: 'uptime-kuma:1',
    host: 'edge',
    limit: 512,
    mem: { kind: 'daily', pct: 57, amp: 4 },
    restarts: [12],
  },
  {
    name: 'watchtower',
    image: 'watchtower:1.7',
    host: 'edge',
    limit: null,
    ref: 30,
    mem: { kind: 'flat', pct: 60 },
  },
]

/** mulberry32: one small seeded generator per container, so a spec change moves only its own noise. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function restartTimes(spec: Spec, rand: () => number): number[] {
  const times = (spec.restarts ?? []).map((h) => NOW - h * HOUR)
  const { loop } = spec
  if (loop !== undefined) {
    for (let t = NOW - loop.hours * HOUR; t < NOW - 2 * MIN; t += loop.everyMin * MIN) {
      times.push(Math.round(t + (rand() - 0.5) * 4 * MIN))
    }
  }
  return times.sort((a, b) => a - b)
}

/** Memory as a percentage of the spec's size at sample `i` of 288 (the last is now). */
function memoryPct(
  mem: Memory,
  i: number,
  restartAt: readonly number[],
  rand: () => number,
): number {
  const t = NOW - (SAMPLES - 1 - i) * 5 * MIN
  const noise = (rand() - 0.5) * 2
  if (mem.kind === 'flat') return mem.pct + noise * 1.5
  if (mem.kind === 'daily') {
    const hour = new Date(t).getUTCHours() + new Date(t).getUTCMinutes() / 60
    return mem.pct + mem.amp * Math.sin(((hour - 8) / 24) * 2 * Math.PI) + noise
  }
  if (mem.kind === 'leak') return mem.from + ((mem.to - mem.from) * i) / (SAMPLES - 1) + noise * 0.4
  const last = restartAt.filter((r) => r <= t).at(-1) ?? t - 9 * MIN
  return Math.min(100, mem.floor + (82 * (t - last)) / ((mem.every - 4) * MIN))
}

function build(spec: Spec, index: number, overrides: Partial<Spec> = {}): Container {
  const s = { ...spec, ...overrides }
  const rand = seeded(1000 + index)
  const restartAt = restartTimes(s, rand)
  const size = s.limit ?? s.ref ?? 100
  const usedMiB = Array.from({ length: SAMPLES }, (_, i) => {
    const pct = Math.max(1, Math.min(100, memoryPct(s.mem, i, restartAt, rand)))
    return Math.round((pct / 100) * size * 10) / 10
  })
  const last = restartAt.at(-1)
  const looping = s.loop !== undefined && last !== undefined && NOW - last < HOUR
  return {
    id: s.name,
    name: s.name,
    image: s.image,
    host: s.host,
    state: looping ? 'restarting' : 'running',
    limitMiB: s.limit,
    restartAt,
    usedMiB,
  }
}

const FLEET: readonly Container[] = SPECS.map((spec, i) => build(spec, i))

const EXTREME: readonly Container[] = SPECS.map((spec, i) => {
  if (spec.name === 'feed-fetcher')
    return build(spec, i, { loop: { hours: 168, everyMin: 24 }, restarts: [] })
  if (spec.name === 'immich-ml') return build(spec, i, { mem: { kind: 'leak', from: 99, to: 100 } })
  if (spec.name === 'prometheus') return build(spec, i, { mem: { kind: 'flat', pct: 100 } })
  if (spec.name === 'dozzle') {
    return build(spec, i, {
      name: 'registry-mirror-garbage-collector-nightly',
      image: 'registry:2.8.3',
    })
  }
  return build(spec, i)
})

/** No restart in the week and every container under 70 % of its limit. */
const QUIET: readonly Container[] = FLEET.map((c, i) => {
  const peak = c.limitMiB === null ? 0 : Math.max(...c.usedMiB) / c.limitMiB
  // Distinct ceilings under 70 %, so no two dots share a peak.
  const scale = peak > 0.7 ? (0.7 - i * 0.004) / peak : 1
  return {
    ...c,
    state: 'running',
    restartAt: [],
    usedMiB: c.usedMiB.map((m) => Math.round(m * scale * 10) / 10),
  }
})

/** The containers of `?fixture=<name>`; an unknown name is the standard fleet. */
export function fleetNamed(name: string | undefined): readonly Container[] {
  if (name === 'quiet') return QUIET
  if (name === 'extreme') return EXTREME
  return FLEET
}
