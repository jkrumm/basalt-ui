/** A seeded team wiki: about 150 pages in 8 spaces, one space untouched for a year, a few stale pages among the most read. */

export type WikiPage = {
  id: string
  title: string
  space: string
  /** The owner's name, or 'No owner'. */
  ownerName: string
  hasOwner: boolean
  /** Epoch ms of the last edit. */
  edited: number
  ageDays: number
  /** Views in the last 30 days. */
  views: number
  stale: boolean
  /** Stale and read at least `READ_VIEWS` times: the pages the question is about. */
  stillRead: boolean
}

const NO_OWNER = 'No owner'
export const STALE_DAYS = 180
export const READ_VIEWS = 100
/** The wiki's own clock, so the fixture is the same on every run. */
const TODAY = Date.UTC(2026, 10, 19)

const DAY = 86_400_000

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

const PEOPLE = [
  'Mara Lindqvist',
  'Tobias Weber',
  'Aiko Tanaka',
  'Jonas Keller',
  'Priya Nair',
  'Lena Fischer',
  'Omar Haddad',
  'Sofia Rossi',
  'Daniel Park',
] as const

type SpaceSpec = {
  name: string
  count: number
  stems: readonly string[]
  owners: readonly (typeof PEOPLE)[number][]
  /** Share of pages with no owner. */
  unowned: number
  /** The space nobody has edited for a year: every page is at least this old. */
  untouchedSince?: number
}

const SPACES: readonly SpaceSpec[] = [
  {
    name: 'Engineering',
    count: 30,
    stems: [
      'Deploy',
      'Rollback',
      'Incident',
      'Database migration',
      'On-call',
      'Code review',
      'Release train',
      'Feature flags',
      'Logging',
      'Secrets rotation',
      'Build cache',
      'Service ownership',
    ],
    owners: ['Mara Lindqvist', 'Tobias Weber', 'Jonas Keller'],
    unowned: 0.07,
  },
  {
    name: 'Product',
    count: 22,
    stems: [
      'Roadmap',
      'Pricing',
      'Research interview',
      'Launch',
      'Beta programme',
      'Metrics',
      'Prioritisation',
      'Persona',
    ],
    owners: ['Aiko Tanaka', 'Priya Nair', 'Daniel Park'],
    unowned: 0.09,
  },
  {
    name: 'Support',
    count: 20,
    stems: [
      'Refund',
      'Escalation',
      'Macro',
      'Shift handover',
      'Status page',
      'Account recovery',
      'Chargeback',
      'Tone of voice',
    ],
    owners: ['Omar Haddad', 'Lena Fischer'],
    unowned: 0.15,
  },
  {
    name: 'Design',
    count: 16,
    stems: [
      'Brand',
      'Icon',
      'Prototype',
      'Accessibility',
      'Illustration',
      'Design review',
      'Type scale',
    ],
    owners: ['Priya Nair', 'Aiko Tanaka', 'Sofia Rossi'],
    unowned: 0.12,
  },
  {
    name: 'Sales',
    count: 18,
    stems: [
      'Discovery call',
      'Demo',
      'Quote',
      'Competitor',
      'Handover to success',
      'Territory',
      'Renewal',
    ],
    owners: ['Jonas Keller', 'Omar Haddad', 'Sofia Rossi'],
    unowned: 0.17,
  },
  {
    name: 'Security',
    count: 14,
    stems: [
      'Access review',
      'Phishing',
      'Laptop',
      'Vendor assessment',
      'Audit evidence',
      'Password manager',
    ],
    owners: ['Tobias Weber', 'Mara Lindqvist', 'Daniel Park'],
    unowned: 0.07,
  },
  {
    name: 'People',
    count: 12,
    stems: ['Onboarding', 'Expenses', 'Leave', 'Hiring panel', 'Probation', 'Travel'],
    owners: ['Lena Fischer'],
    unowned: 0.08,
  },
  {
    name: 'Partners',
    count: 18,
    stems: [
      'Reseller',
      'Co-marketing',
      'Certification',
      'Revenue share',
      'Portal',
      'Onboarding kit',
    ],
    owners: ['Jonas Keller', 'Omar Haddad'],
    unowned: 0.6,
    untouchedSince: 375,
  },
]

const KINDS = ['guide', 'runbook', 'checklist', 'FAQ', 'notes', 'overview', 'policy'] as const

/** Pages the question is about, placed by hand so the extremes are on screen. */
const PINNED: readonly {
  space: string
  title: string
  ageDays: number
  views: number
  owner: string | null
}[] = [
  {
    space: 'Engineering',
    title: 'Engineering handbook',
    ageDays: 6,
    views: 2140,
    owner: 'Mara Lindqvist',
  },
  { space: 'Support', title: 'VPN setup guide', ageDays: 312, views: 340, owner: null },
  { space: 'People', title: 'Expense policy', ageDays: 241, views: 288, owner: 'Lena Fischer' },
  { space: 'Security', title: 'Incident escalation matrix', ageDays: 205, views: 214, owner: null },
  {
    space: 'Engineering',
    title: 'API authentication v1',
    ageDays: 402,
    views: 187,
    owner: 'Jonas Keller',
  },
  {
    space: 'Support',
    title: 'Customer refund process',
    ageDays: 268,
    views: 146,
    owner: 'Omar Haddad',
  },
  {
    space: 'Design',
    title: 'Brand asset downloads',
    ageDays: 198,
    views: 121,
    owner: 'Priya Nair',
  },
  {
    space: 'Partners',
    title: 'Partner pricing sheet',
    ageDays: 431,
    views: 109,
    owner: null,
  },
  { space: 'Product', title: 'Launch checklist', ageDays: 12, views: 480, owner: 'Aiko Tanaka' },
  { space: 'People', title: 'Onboarding week one', ageDays: 33, views: 455, owner: 'Lena Fischer' },
]

function build(): WikiPage[] {
  const rand = seeded(49)
  const pages: Omit<WikiPage, 'id' | 'edited' | 'stale' | 'stillRead'>[] = []
  for (const space of SPACES) {
    const combos = space.stems.flatMap((s) => KINDS.map((k) => `${s} ${k}`))
    // Fisher-Yates over the combinations, so titles in a space never repeat.
    for (let i = combos.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      const a = combos[i]
      const b = combos[j]
      if (a === undefined || b === undefined) continue
      combos[i] = b
      combos[j] = a
    }
    const pinned = PINNED.filter((p) => p.space === space.name)
    for (let n = 0; n < space.count; n++) {
      const pin = pinned[n]
      if (pin !== undefined) {
        pages.push({
          title: pin.title,
          space: space.name,
          ownerName: pin.owner ?? NO_OWNER,
          hasOwner: pin.owner !== null,
          ageDays: pin.ageDays,
          views: pin.views,
        })
        continue
      }
      const stale = space.untouchedSince !== undefined || rand() < 0.2
      const ageDays =
        space.untouchedSince !== undefined
          ? space.untouchedSince + Math.floor(rand() * 260)
          : stale
            ? STALE_DAYS + 1 + Math.floor(rand() * 330)
            : Math.floor(rand() ** 1.6 * STALE_DAYS)
      const spread = Math.exp((rand() + rand() + rand() - 1.5) * 2.2)
      const views = stale
        ? rand() < 0.3 || space.untouchedSince !== undefined
          ? Math.floor(rand() * 4)
          : Math.min(READ_VIEWS - 12, Math.round(6 * spread))
        : Math.min(READ_VIEWS * 4, Math.round(22 * spread))
      const owner =
        rand() < space.unowned
          ? null
          : (space.owners[Math.floor(rand() * space.owners.length)] ?? null)
      pages.push({
        title: combos[n] ?? `${space.name} page ${n}`,
        space: space.name,
        ownerName: owner ?? NO_OWNER,
        hasOwner: owner !== null,
        ageDays,
        views,
      })
    }
  }
  return pages.map((p, i) => ({
    ...p,
    id: `p-${String(i + 1).padStart(3, '0')}`,
    edited: TODAY - p.ageDays * DAY,
    stale: p.ageDays > STALE_DAYS,
    stillRead: p.ageDays > STALE_DAYS && p.views >= READ_VIEWS,
  }))
}

const ALL = build()

/** `clean`: every page edited inside the stale window, so nothing is stale. Otherwise the wiki as it is. */
export function wikiPages(fixture: string | undefined): readonly WikiPage[] {
  if (fixture !== 'clean') return ALL
  return ALL.map((p) => {
    if (!p.stale) return p
    const ageDays = p.ageDays % STALE_DAYS
    return { ...p, ageDays, edited: TODAY - ageDays * DAY, stale: false, stillRead: false }
  })
}
