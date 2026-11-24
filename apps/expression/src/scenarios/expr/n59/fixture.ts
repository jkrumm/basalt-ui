/** Six homelab machines, a reading every 5 minutes for 24 hours, seeded and deterministic. */

export const MACHINE_IDS = ['forge', 'vault', 'stream', 'edge', 'pihole', 'lab'] as const
export type MachineId = (typeof MACHINE_IDS)[number]

export type Machine = {
  id: MachineId
  role: string
  cores: number
  memGb: number
  diskGb: number
}

export const MACHINES: Readonly<Record<MachineId, Machine>> = {
  forge: { id: 'forge', role: 'Build server', cores: 12, memGb: 32, diskGb: 1000 },
  vault: { id: 'vault', role: 'File storage', cores: 4, memGb: 64, diskGb: 24000 },
  stream: { id: 'stream', role: 'Media server', cores: 8, memGb: 16, diskGb: 8000 },
  edge: { id: 'edge', role: 'Reverse proxy', cores: 4, memGb: 8, diskGb: 250 },
  pihole: { id: 'pihole', role: 'DNS filter', cores: 4, memGb: 4, diskGb: 32 },
  lab: { id: 'lab', role: 'Test bench', cores: 16, memGb: 128, diskGb: 2000 },
}

/** One machine at one instant: CPU in %, memory and the fullest disk in GB, load average, network in Mb/s. */
export type Reading = {
  cpu: number
  memGb: number
  diskGb: number
  load: number
  netIn: number
  netOut: number
}

export type Sample = { at: number; read: Record<MachineId, Reading | null> }

/** `rest` is the case; `quiet` has nothing busy, full or silent; `pegged` pins the build server and its load far past the rest. */
export type Variant = 'rest' | 'quiet' | 'pegged'

const STEP_MS = 5 * 60_000
const SAMPLE_COUNT = 288
export const NOW = Date.UTC(2026, 10, 19, 22, 0)
/** The edge machine's last four readings are missing: silent for 20 minutes. */
const SILENT_SAMPLES = 4

export const BUSY_CPU = 85
export const FULL_PCT = 90

export function variantOf(name: string | undefined): Variant {
  if (name === 'quiet' || name === 'pegged') return name
  return 'rest'
}

/** A repeatable value in [0, 1) for a seed and an index. */
function rnd(seed: number, i: number): number {
  let t = (seed * 374761393 + i * 668265263) | 0
  t = Math.imul(t ^ (t >>> 13), 1274126177)
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}

/** A slow wobble plus a little grain, in [0, 1]. */
function wob(seed: number, i: number): number {
  return 0.55 * rnd(seed, i) + 0.45 * (0.5 + 0.5 * Math.sin(i / 7 + seed))
}

const r1 = (v: number): number => Math.round(v * 10) / 10
const r2 = (v: number): number => Math.round(v * 100) / 100
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const within = (h: number, from: number, to: number): boolean => h >= from && h < to

type Clock = { i: number; h: number }

function forge(c: Clock, v: Variant): Reading {
  const { i, h } = c
  let cpu = 8 + 5 * wob(1, i)
  if (within(h, 3, 4.5)) cpu = 60 + 14 * wob(2, i)
  if (v === 'quiet' && within(h, 18.5, 22.1)) cpu = 30 + 12 * wob(3, i)
  if (v === 'rest' && h >= 18.5 && h <= 22) cpu = 78 + (h - 18.5) * 4.2 + 3 * wob(3, i)
  if (v === 'pegged' && h >= 16 && h <= 22) cpu = 97 + 3 * wob(3, i)
  cpu = r1(clamp(cpu, 0, 100))
  const pull = within(h, 3, 3.3) || (v !== 'quiet' && within(h, 18.5, 19.2))
  return {
    cpu,
    memGb: r1(Math.min(32, 11 + cpu * 0.17 + (v === 'pegged' && cpu > 90 ? 4.5 : 0) + wob(4, i))),
    diskGb: Math.round(410 + (h > 4.5 ? 3 : 0)),
    load: r2(
      (cpu / 100) * 12 * 0.95 + (v === 'pegged' && h >= 16 ? (h - 16) * 7 : 0) + 0.3 * rnd(5, i),
    ),
    netIn: Math.round(pull ? 220 + 160 * wob(6, i) : 3 + 4 * wob(6, i)),
    netOut: r1(1 + 2 * wob(7, i)),
  }
}

function vault(c: Clock, v: Variant): Reading {
  const { i, h } = c
  const backup = within(h, 2, 3.25)
  const cpu = r1(backup ? 30 + 8 * wob(11, i) : 4 + 3 * wob(11, i))
  const end = v === 'quiet' ? 18700 : 22560
  const start = end - 90
  const used = h > 2.5 && h < 22.2 ? end : start
  return {
    cpu,
    memGb: r1(23 + wob(12, i)),
    diskGb: used,
    load: r2((cpu / 100) * 4 + 0.2 + 0.2 * rnd(13, i)),
    netIn: Math.round(backup ? 480 + 80 * wob(14, i) : 4 + 6 * wob(14, i)),
    netOut: r1(5 + 8 * wob(15, i)),
  }
}

function stream(c: Clock): Reading {
  const { i, h } = c
  const evening = within(h, 19, 22.1)
  const cpu = r1(evening ? 42 + 14 * wob(21, i) : 6 + 5 * wob(21, i))
  return {
    cpu,
    memGb: r1(8.8 + cpu * 0.03),
    diskGb: 5040 + (h > 12 ? 6 : 0),
    load: r2((cpu / 100) * 8),
    netIn: r1(8 + 5 * wob(22, i)),
    netOut: Math.round(evening ? 70 + 25 * wob(23, i) : 10 + 5 * wob(23, i)),
  }
}

function edge(c: Clock): Reading {
  const { i } = c
  return {
    cpu: r1(4 + 2 * wob(31, i)),
    memGb: r1(2.4 + 0.1 * wob(32, i)),
    diskGb: 78,
    load: r2(0.15 + 0.1 * wob(33, i)),
    netIn: Math.round(25 + 15 * wob(34, i)),
    netOut: Math.round(22 + 15 * wob(35, i)),
  }
}

function pihole(c: Clock): Reading {
  const { i } = c
  return {
    cpu: r1(1.5 + wob(41, i)),
    memGb: r2(0.9 + 0.05 * wob(42, i)),
    diskGb: 15,
    load: r2(0.05 + 0.04 * wob(43, i)),
    netIn: r1(1.5 + wob(44, i)),
    netOut: r1(1 + 0.6 * wob(45, i)),
  }
}

/** The test bench is idle overnight: zero load and a silent network. */
function lab(c: Clock): Reading {
  const { i, h } = c
  const day = within(h, 10, 17)
  const cpu = r1(day ? 30 + 25 * wob(51, i) : 0.4 + 0.6 * wob(51, i))
  const asleep = within(h, 0.5, 6)
  return {
    cpu,
    memGb: r1(22 + cpu * 0.2),
    diskGb: 1160,
    load: cpu < 1 ? 0 : r2((cpu / 100) * 16 * 0.8),
    netIn: asleep ? 0 : r1(day ? 12 + 10 * wob(52, i) : 1 + wob(52, i)),
    netOut: asleep ? 0 : r1(day ? 8 + 8 * wob(53, i) : 0.5 + wob(53, i)),
  }
}

export function samplesOf(variant: Variant): readonly Sample[] {
  return Array.from({ length: SAMPLE_COUNT }, (_, i) => {
    const at = NOW - (SAMPLE_COUNT - 1 - i) * STEP_MS
    const d = new Date(at)
    const c: Clock = { i, h: d.getUTCHours() + d.getUTCMinutes() / 60 }
    const silent = variant !== 'quiet' && i >= SAMPLE_COUNT - SILENT_SAMPLES
    return {
      at,
      read: {
        forge: forge(c, variant),
        vault: vault(c, variant),
        stream: stream(c),
        edge: silent ? null : edge(c),
        pihole: pihole(c),
        lab: lab(c),
      },
    }
  })
}

export const pctOf = (used: number, total: number): number => (used / total) * 100

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? hi) + hi) / 2
}

export type MachineNow = {
  id: MachineId
  reading: Reading | null
  /** The instant of its last reading, null while it never reported. */
  lastSeen: number | null
  silentMin: number
}

export function nowOf(samples: readonly Sample[]): readonly MachineNow[] {
  const end = samples.at(-1)?.at ?? NOW
  return MACHINE_IDS.map((id) => {
    const seen = [...samples].reverse().find((s) => s.read[id] !== null)
    const reading = samples.at(-1)?.read[id] ?? null
    return {
      id,
      reading,
      lastSeen: seen?.at ?? null,
      silentMin: reading === null && seen !== undefined ? Math.round((end - seen.at) / 60_000) : 0,
    }
  })
}
