/**
 * The fixture of `/kit/projects`: 31 watched projects in six spaces, the shape of a factory console's
 * Projects table (docs/v3/issues/bench/bench-table-reading.json). Deterministic: every figure is a
 * function of the row's index, against one fixed clock, so a shot is the same shot.
 */

export const PROJECTS_NOW = Date.UTC(2026, 10, 22, 12, 0, 0)

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const SPACES = ['infra', 'tooling', 'personal', 'apps', 'work', 'other'] as const
export type Space = (typeof SPACES)[number]
export const SPACE_LABELS: Record<Space, string> = {
  infra: 'Infra',
  tooling: 'Tooling',
  personal: 'Personal',
  apps: 'Apps',
  work: 'Work',
  other: 'Other',
}

export const LAMPS = ['incident', 'regressed', 'checking', 'quiet'] as const
export type Lamp = (typeof LAMPS)[number]
export const LAMP_LABELS: Record<Lamp, string> = {
  incident: 'Incident open',
  regressed: 'Regressed in 7 days',
  checking: 'Checking: shipped, its watch is on',
  quiet: 'Quiet',
}
export const LAMP_TONES = {
  incident: 'bad',
  regressed: 'warn',
  checking: 'accent',
  quiet: 'neutral',
} as const satisfies Record<Lamp, string>

export type Project = {
  id: string
  name: string
  tag: string | null
  space: Space
  /** Open Issues now, the total of the three parts. */
  open: number
  running: number
  paused: number
  ready: number
  /** Shipped per six hours over the last 7 days, oldest first. */
  shipped: { value: number; at: Date }[]
  shippedTotal: number
  lastShipAt: string | null
  cycleMs: number | null
  cycleBeforeMs: number | null
  waitMs: number | null
  waitBeforeMs: number | null
  production: Lamp
  productionAt: string | null
  clean: number | null
  probes: number
  findingAt: string | null
  planDone: number | null
  planTotal: number
  leads: number
  seats: number
}

const NAMES: Record<Space, readonly string[]> = {
  infra: ['edge-proxy', 'backup-vault', 'dns-sync'],
  tooling: [
    'build-cache',
    'lint-kit',
    'deploy-bot',
    'log-shipper',
    'schema-gen',
    'test-grid',
    'release-train',
    'doc-press',
    'secret-relay',
    'metrics-hub',
  ],
  personal: [
    'trail-log',
    'recipe-box',
    'garden-plan',
    'photo-shelf',
    'reading-list',
    'budget-book',
    'run-tracker',
    'music-crate',
  ],
  apps: ['meteo-board', 'line-watch', 'chat-desk', 'pod-studio', 'image-forge', 'notes-web'],
  work: ['course-portal', 'grade-sync', 'exam-desk'],
  other: ['sandbox'],
}

const TAGS: Record<string, string> = {
  'lint-kit': 'npm',
  'schema-gen': 'npm',
  'run-tracker': 'ios',
  'notes-web': 'public',
}

/** A spread of 0 to n - 1 that looks irregular but is the same on every run. */
const pick = (i: number, salt: number, n: number): number => (i * 7 + salt * 13 + i * salt) % n

const ago = (ms: number): string => new Date(PROJECTS_NOW - ms).toISOString()

function project(name: string, space: Space, i: number): Project {
  const idle = i % 9 === 4 || space === 'other'
  const running = idle ? 0 : pick(i, 1, 4)
  const paused = idle ? 0 : pick(i, 2, 3) === 0 ? 1 : 0
  const ready = idle ? 0 : pick(i, 3, 6)
  // a working rhythm: a few closes per working stretch, quiet in between, busier projects higher
  const pace = (running + ready) / 4
  const shipped = Array.from({ length: 28 }, (_, b) => ({
    value: idle
      ? 0
      : Math.max(0, Math.round(pace * (1 + Math.sin((b + i) / 2.2)) - (b % 4 === 0 ? 1 : 0))),
    at: new Date(PROJECTS_NOW - (28 - b) * 6 * HOUR),
  }))
  const shippedTotal = shipped.reduce((sum, bin) => sum + bin.value, 0)
  const production: Lamp =
    i === 5 || i === 19
      ? 'incident'
      : i === 2 || i === 11 || i === 24
        ? 'regressed'
        : !idle && i % 4 === 1
          ? 'checking'
          : 'quiet'
  const probes = space === 'personal' ? 8 : 12
  const swept = i % 11 !== 7
  const clean = swept ? probes - (i % 5 === 3 ? 1 + pick(i, 4, 3) : 0) : null
  const planTotal = i % 6 === 5 ? 0 : 4 + pick(i, 5, 40) * (space === 'tooling' ? 12 : 1)
  return {
    id: name,
    name,
    tag: TAGS[name] ?? null,
    space,
    open: running + paused + ready,
    running,
    paused,
    ready,
    shipped,
    shippedTotal,
    lastShipAt:
      shippedTotal > 0 ? ago((1 + pick(i, 6, 40)) * HOUR) : idle ? null : ago((8 + i) * DAY),
    cycleMs: idle ? null : (20 + pick(i, 7, 50) * 9) * MINUTE,
    cycleBeforeMs: idle || i % 7 === 6 ? null : (20 + pick(i, 8, 50) * 9) * MINUTE,
    waitMs: idle ? null : (2 + pick(i, 9, 40)) * MINUTE * (i % 3 === 0 ? 30 : 1),
    waitBeforeMs: idle ? null : (2 + pick(i, 10, 40)) * MINUTE * (i % 3 === 0 ? 30 : 1),
    production,
    productionAt:
      production === 'incident'
        ? ago((2 + pick(i, 11, 20)) * HOUR)
        : production === 'regressed'
          ? ago((1 + pick(i, 12, 6)) * DAY)
          : null,
    clean,
    probes,
    findingAt: clean !== null && clean < probes ? ago((1 + pick(i, 13, 12)) * DAY) : null,
    planDone: planTotal === 0 ? null : Math.round((planTotal * (40 + pick(i, 14, 61))) / 100),
    planTotal,
    leads: idle ? 0 : Math.min(running, 3),
    seats: space === 'work' ? 2 : 4,
  }
}

/** The 31 projects in their spaces: Infra 3, Tooling 10, Personal 8, Apps 6, Work 3, Other 1. */
export const PROJECTS: readonly Project[] = SPACES.flatMap((space) => NAMES[space]).map((name, i) =>
  project(name, SPACES.find((space) => NAMES[space].includes(name)) ?? 'other', i),
)

/** The widest open count: one scale for every Now bar, so a long bar is a busy project. */
export const OPEN_SCALE = Math.max(1, ...PROJECTS.map((p) => p.open))

export const QUICK = ['all', 'red', 'hygiene', 'moving', 'idle'] as const
export type Quick = (typeof QUICK)[number]
export const QUICK_LABELS: Record<Quick, string> = {
  all: 'All',
  red: 'Alerts',
  hygiene: 'Hygiene gaps',
  moving: 'Moving',
  idle: 'Idle',
}

export function matchesQuick(p: Project, quick: Quick): boolean {
  switch (quick) {
    case 'all':
      return true
    case 'red':
      return p.production === 'incident' || p.production === 'regressed'
    case 'hygiene':
      return p.clean !== null && p.clean < p.probes
    case 'moving':
      return p.shippedTotal > 0
    case 'idle':
      return p.open === 0 && p.shippedTotal === 0
  }
}
