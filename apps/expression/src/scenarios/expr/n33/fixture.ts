/** Hygiene fixture for scenario expr-n33: about 20 probes and 30 open findings, seeded so a shot is the same shot. */

export type ProbeState = 'fail' | 'stale' | 'never' | 'pass'
export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Probe = {
  id: string
  name: string
  state: ProbeState
  lastRun: string | null
  findings: number
}

export type Finding = {
  id: string
  title: string
  probe: string
  severity: Severity
  ageDays: number
}

export type Hygiene = { probes: readonly Probe[]; findings: readonly Finding[] }

/** A fixed clock, so relative times read the same in every shot. */
export const NOW = Date.UTC(2026, 10, 17, 12, 0, 0)

const HOUR = 3_600_000

/** mulberry32: a small seeded generator. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PROBES: readonly (readonly [string, ProbeState])[] = [
  ['Build', 'pass'],
  ['Typecheck', 'pass'],
  ['Lint', 'pass'],
  ['Unit tests', 'fail'],
  ['End-to-end smoke', 'fail'],
  ['Bundle size', 'pass'],
  ['Dependency audit', 'fail'],
  ['License check', 'pass'],
  ['Deploy health', 'pass'],
  ['Docs links', 'stale'],
  ['Changelog', 'pass'],
  ['CI runtime', 'pass'],
  ['Coverage floor', 'fail'],
  ['Secrets scan', 'pass'],
  ['Migration dry run', 'stale'],
  ['Accessibility', 'pass'],
  ['Visual diff', 'never'],
  ['Release dry run', 'never'],
  ['Mirror sync', 'pass'],
  ['Backup restore', 'pass'],
]

const SEVERITIES: readonly Severity[] = [
  'critical',
  'high',
  'high',
  'medium',
  'medium',
  'medium',
  'low',
  'low',
]

const ISSUES: readonly string[] = [
  'Flaky retry exceeds its budget',
  'Threshold regressed past the floor',
  'Unpinned version in the lockfile',
  'Cold start times out',
  'Owner missing from the manifest',
  'Output differs between runners',
  'Fixture drifted from production',
  'Report not uploaded',
  'Cache key never invalidates',
  'Skipped case left in the suite',
]

/** Where the 30 findings land: mostly the failing and stale probes, a few on passing ones. */
const SPREAD = [1, 0, 1, 5, 4, 2, 4, 1, 1, 3, 0, 1, 3, 0, 3, 1, 0, 0, 0, 0] as const

/** The rest fixture. `extreme` makes one finding four years old; `clean` is every probe passing with nothing open. */
export function hygieneFor(fixture: string | undefined): Hygiene {
  if (fixture === 'clean') {
    return {
      probes: PROBES.map(([name], i) => ({
        id: `p${i}`,
        name,
        state: 'pass',
        lastRun: new Date(NOW - (i + 1) * HOUR).toISOString(),
        findings: 0,
      })),
      findings: [],
    }
  }
  const rand = seeded(33)
  const findings: Finding[] = []
  SPREAD.forEach((count, p) => {
    const probe = PROBES[p]?.[0] ?? ''
    for (let k = 0; k < count; k++) {
      const n = findings.length
      findings.push({
        id: `F-${210 + n}`,
        title: ISSUES[(n * 7 + p) % ISSUES.length] ?? ISSUES[0] ?? '',
        probe,
        severity: SEVERITIES[Math.floor(rand() * SEVERITIES.length)] ?? 'low',
        ageDays: Math.floor(rand() * rand() * 97),
      })
    }
  })
  findings.sort((a, b) => b.ageDays - a.ageDays)
  const oldest = findings[0]
  const newest = findings[findings.length - 1]
  if (oldest)
    findings[0] = { ...oldest, severity: 'critical', ageDays: fixture === 'extreme' ? 1460 : 96 }
  if (newest) findings[findings.length - 1] = { ...newest, ageDays: 0 }
  const probes: Probe[] = PROBES.map(([name, state], i) => ({
    id: `p${i}`,
    name,
    state,
    lastRun:
      state === 'never'
        ? null
        : new Date(
            NOW -
              (state === 'stale'
                ? (9 + Math.floor(rand() * 12)) * 24
                : 1 + Math.floor(rand() * 20)) *
                HOUR,
          ).toISOString(),
    findings: findings.filter((f) => f.probe === name).length,
  }))
  const order: Record<ProbeState, number> = { fail: 0, stale: 1, never: 2, pass: 3 }
  probes.sort((a, b) => order[a.state] - order[b.state] || b.findings - a.findings)
  return { probes, findings }
}
