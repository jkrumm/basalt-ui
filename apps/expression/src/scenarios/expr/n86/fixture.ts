/** Fixture for expr-n86: 17 hygiene checks after a weekly sweep, seeded so every build draws the same rows. */

export type CheckStatus = 'clean' | 'found' | 'skipped' | 'failed' | 'never'
export type CostClass = 'file' | 'tool' | 'make' | 'agent'
export type Cadence = 'daily' | 'weekly'

export type Check = {
  id: string
  status: CheckStatus
  /** Findings of the last run; null when the check measured nothing (skipped, failed, never run). */
  findings: number | null
  /** Whole days from the last run to `NOW`; null for a check that has never run. */
  ageDays: number | null
  detail: string
  cost: CostClass
  cadence: Cadence
}

const DAY = 86_400_000
/** The page's clock: the morning after the Saturday sweep. */
const NOW = Date.UTC(2026, 10, 22, 9, 0)
const SWEEP_DAY = Date.UTC(2026, 10, 21)

/** mulberry32: one seed gives one sequence. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Seed = Omit<Check, 'ageDays'> & { lastRun: number | null }

/** Daily checks ran this morning, weekly ones in the Saturday sweep; two skipped checks last ran earlier. */
function build(): Check[] {
  const rand = seeded(86)
  const minutes = (): number => Math.floor(rand() * 50) * 60_000
  const daily = (): number => NOW - 4 * 3_600_000 + minutes()
  const weekly = (): number => SWEEP_DAY + 3 * 3_600_000 + minutes()
  const seeds: Seed[] = [
    {
      id: 'unused-exports',
      status: 'found',
      findings: 12,
      lastRun: weekly(),
      detail: 'Exports that no other module imports, listed in the check report.',
      cost: 'tool',
      cadence: 'weekly',
    },
    {
      id: 'outdated-majors',
      status: 'found',
      findings: 3,
      lastRun: weekly(),
      detail: 'Dependencies a major version behind their latest release.',
      cost: 'tool',
      cadence: 'weekly',
    },
    {
      id: 'todo-no-issue',
      status: 'found',
      findings: 1,
      lastRun: daily(),
      detail: 'A TODO comment that names no issue.',
      cost: 'file',
      cadence: 'daily',
    },
    {
      id: 'docs-drift',
      status: 'found',
      findings: 1,
      lastRun: weekly(),
      detail: 'A docs page still names a flag the code removed.',
      cost: 'agent',
      cadence: 'weekly',
    },
    {
      id: 'migration-dry-run',
      status: 'failed',
      findings: null,
      lastRun: weekly(),
      detail: 'The database container exited with code 1 before the dry run began.',
      cost: 'make',
      cadence: 'weekly',
    },
    {
      id: 'image-scan',
      status: 'skipped',
      findings: null,
      lastRun: Date.UTC(2026, 7, 24, 3, 20),
      detail: 'No container runtime on this host, so the scan did not start.',
      cost: 'make',
      cadence: 'weekly',
    },
    {
      id: 'readme-review',
      status: 'skipped',
      findings: null,
      lastRun: SWEEP_DAY - 7 * DAY + 3 * 3_600_000 + minutes(),
      detail: 'The weekly agent budget was spent before this check came up.',
      cost: 'agent',
      cadence: 'weekly',
    },
    {
      id: 'perf-budget-trend',
      status: 'never',
      findings: null,
      lastRun: null,
      detail: 'Needs one baseline run before the trend can be drawn.',
      cost: 'agent',
      cadence: 'weekly',
    },
    {
      id: 'lockfile-in-sync',
      status: 'clean',
      findings: 0,
      lastRun: daily(),
      detail: 'Lockfile and manifests agree.',
      cost: 'file',
      cadence: 'daily',
    },
    {
      id: 'markdown-links',
      status: 'clean',
      findings: 0,
      lastRun: daily(),
      detail: 'Every relative link in the docs resolves.',
      cost: 'file',
      cadence: 'daily',
    },
    {
      id: 'agents-md-size',
      status: 'clean',
      findings: 0,
      lastRun: daily(),
      detail: 'The root agent file is under its byte cap.',
      cost: 'file',
      cadence: 'daily',
    },
    {
      id: 'secret-scan',
      status: 'clean',
      findings: 0,
      lastRun: daily(),
      detail: 'No credential-shaped string in tracked files.',
      cost: 'tool',
      cadence: 'daily',
    },
    {
      id: 'stale-branches',
      status: 'clean',
      findings: 0,
      lastRun: daily(),
      detail: 'No branch is older than its merge window.',
      cost: 'tool',
      cadence: 'daily',
    },
    {
      id: 'license-headers',
      status: 'clean',
      findings: 0,
      lastRun: weekly(),
      detail: 'Every source file carries its licence header.',
      cost: 'file',
      cadence: 'weekly',
    },
    {
      id: 'dependency-audit',
      status: 'clean',
      findings: 0,
      lastRun: weekly(),
      detail: 'No known advisory against a locked version.',
      cost: 'tool',
      cadence: 'weekly',
    },
    {
      id: 'type-coverage',
      status: 'clean',
      findings: 0,
      lastRun: weekly(),
      detail: 'Typed exports stay above the coverage floor.',
      cost: 'tool',
      cadence: 'weekly',
    },
    {
      id: 'build-repro',
      status: 'clean',
      findings: 0,
      lastRun: weekly(),
      detail: 'Two clean builds produce the same artefacts.',
      cost: 'make',
      cadence: 'weekly',
    },
  ]
  return seeds.map(({ lastRun, ...rest }) => ({
    ...rest,
    ageDays: lastRun === null ? null : Math.floor((NOW - lastRun) / DAY),
  }))
}

const SWEPT: readonly Check[] = build()

/** A project nobody has swept: the same 17 checks, none has run. */
const UNSWEPT: readonly Check[] = SWEPT.map((c) => ({
  ...c,
  status: 'never',
  findings: null,
  ageDays: null,
  detail: 'Waits for the first sweep.',
}))

/** `?fixture=unswept` is the never-swept project; any other value is the swept one. */
export function checksFor(fixture: string | undefined): readonly Check[] {
  return fixture === 'unswept' ? UNSWEPT : SWEPT
}
