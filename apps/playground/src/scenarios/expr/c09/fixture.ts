/**
 * c09 fixture: five deployed versions of one service over the last two weeks and a request success
 * rate sampled every six hours. One version degrades the rate and is rolled back, the newest is
 * live. Seeded and clock-free: "today" is a fixed instant.
 */
import { seeded } from '../../fixture-utils'

export const NOW = Date.UTC(2026, 10, 14, 12)
const HOUR = 3_600_000
const START = Date.UTC(2026, 10, 1, 6)
const STEP = 6 * HOUR

export type VersionStatus = 'superseded' | 'rolled-back' | 'live'

export type Version = {
  name: string
  deployedAt: number
  /** When the next version took over (or the rollback happened); `null` for the live one. */
  endedAt: number | null
  status: VersionStatus
}

export const VERSIONS: readonly Version[] = [
  {
    name: 'v2.8.0',
    deployedAt: START,
    endedAt: Date.UTC(2026, 10, 4, 10),
    status: 'superseded',
  },
  {
    name: 'v2.9.0',
    deployedAt: Date.UTC(2026, 10, 4, 10),
    endedAt: Date.UTC(2026, 10, 7, 15),
    status: 'superseded',
  },
  {
    name: 'v2.10.0',
    deployedAt: Date.UTC(2026, 10, 7, 15),
    endedAt: Date.UTC(2026, 10, 9, 9),
    status: 'rolled-back',
  },
  {
    name: 'v2.9.1',
    deployedAt: Date.UTC(2026, 10, 9, 9),
    endedAt: Date.UTC(2026, 10, 12, 14),
    status: 'superseded',
  },
  {
    name: 'v2.11.0',
    deployedAt: Date.UTC(2026, 10, 12, 14),
    endedAt: null,
    status: 'live',
  },
]

/** The success-rate target the chart draws a rule at. */
export const TARGET = 98

export type Sample = { at: Date; rate: number; version: Version }

export const FIXTURE_NAMES = ['outage'] as const
export type FixtureName = (typeof FIXTURE_NAMES)[number]

export const isFixtureName = (value: unknown): value is FixtureName =>
  FIXTURE_NAMES.some((n) => n === value)

const BASE: Readonly<Record<string, number>> = {
  'v2.8.0': 98.4,
  'v2.9.0': 98.9,
  'v2.9.1': 98.7,
  'v2.11.0': 99.2,
}

const round1 = (v: number): number => Math.round(v * 10) / 10

function versionAt(at: number): Version {
  return VERSIONS.findLast((v) => v.deployedAt <= at) ?? (VERSIONS[0] as Version)
}

/** `outage`: one sample of the rolled-back version reads 0, the extreme the axis must hold. */
export function buildSamples(fixture: FixtureName | undefined): Sample[] {
  const random = seeded(909)
  const samples: Sample[] = []
  for (let at = START; at <= NOW; at += STEP) {
    const version = versionAt(at)
    const noise = (random() - 0.5) * 0.7
    let rate: number
    if (version.status === 'rolled-back' && version.endedAt !== null) {
      // Degrades from 97 on deploy toward 83 at the rollback.
      const progress = (at - version.deployedAt) / (version.endedAt - version.deployedAt)
      rate = 97 - 14 * progress + noise * 2
    } else {
      rate = (BASE[version.name] ?? 98.5) + noise
    }
    samples.push({ at: new Date(at), rate: Math.min(100, round1(rate)), version })
  }
  if (fixture !== 'outage') return samples
  const hit = samples.findLast((s) => s.version.status === 'rolled-back')
  return samples.map((s) => (s === hit ? { ...s, rate: 0 } : s))
}

export type VersionStats = { version: Version; mean: number; low: number; samples: number }

export function statsFor(samples: readonly Sample[]): VersionStats[] {
  return VERSIONS.map((version) => {
    const rates = samples.filter((s) => s.version === version).map((s) => s.rate)
    const mean = rates.length === 0 ? 0 : rates.reduce((a, b) => a + b, 0) / rates.length
    return {
      version,
      mean,
      low: rates.length === 0 ? 0 : Math.min(...rates),
      samples: rates.length,
    }
  })
}
