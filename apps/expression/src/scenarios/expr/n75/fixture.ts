/** Charter request page: a seeded, deterministic fixture. Every string a viewer reads lives in the .tsx files. */

export type Verdict = 'legit' | 'spam' | 'marketing'

export type Day = { at: Date; visitors: number; views: number }
export type Step = { key: string; name: string; count: number }
export type Inquiry = { id: string; at: string; verdict: Verdict; sender: string; topic: string }

export type Fixture = {
  days: readonly Day[]
  /** The four steps of one day's visit, site first. */
  steps: readonly Step[]
  funnelDay: Date
  /** The newest rows the list holds: `rows.length` of `total`. */
  rows: readonly Inquiry[]
  total: number
  counts: Readonly<Record<Verdict, number>>
  /** Inquiries in the 90 days before the window. */
  previous: number
  /** The day the tracker saw no visitor. */
  quietDay: Date
}

const DAYS = 90
const FIRST_DAY = Date.UTC(2026, 7, 22)
const DAY_MS = 86_400_000
const QUIET_INDEX = 41
const LIST_CAP = 200
const COUNTS: Record<Verdict, number> = { legit: 139, spam: 61, marketing: 36 }

/** mulberry32: the same seed draws the same page. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const SENDERS = [
  'Ines Vogel',
  'Tomas Aaltonen',
  'Marta Kowalski',
  'Henrik Dahl',
  'Sofia Marchetti',
  'Jonas Brandt',
  'Lea Fontaine',
  'Pieter de Wit',
  'Clara Neumann',
  'Mikael Strand',
]
const TOPICS: Record<Verdict, readonly string[]> = {
  legit: [
    'Day charter, 6 guests, Saturday',
    'Week charter, 4 guests, skipper wanted',
    'Sunset trip for 2, in two weeks',
    'Birthday on board, 12 guests',
    'Weekend charter, bareboat, 5 guests',
    'Fishing trip, 5 guests, early start',
    'Company outing, 14 guests, June',
  ],
  spam: [
    'Cheap watches, click the link',
    'You won a prize, claim it now',
    'Crypto offer, 300 percent returns',
    'Your account is locked, verify here',
  ],
  marketing: [
    'SEO ranking offer for your site',
    'Social media package, first month free',
    'Listing offer for a booking platform',
    'Photo shoot for your boats, 30 percent off',
  ],
}

function buildDays(random: () => number): Day[] {
  const weekend = [1.3, 0.9, 0.85, 0.9, 0.95, 1.05, 1.3]
  return Array.from({ length: DAYS }, (_, i) => {
    const at = new Date(FIRST_DAY + i * DAY_MS)
    if (i === QUIET_INDEX) return { at, visitors: 0, views: 0 }
    const visitors = Math.round(
      (100 + i * 0.3) * (weekend[at.getUTCDay()] ?? 1) * (0.88 + random() * 0.24),
    )
    return { at, visitors, views: Math.round(visitors * (1.8 + random() * 0.5)) }
  })
}

function buildInquiries(random: () => number): Inquiry[] {
  const verdicts: Verdict[] = [
    ...Array<Verdict>(COUNTS.legit).fill('legit'),
    ...Array<Verdict>(COUNTS.spam).fill('spam'),
    ...Array<Verdict>(COUNTS.marketing).fill('marketing'),
  ]
  for (let i = verdicts.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = verdicts[i] as Verdict
    verdicts[i] = verdicts[j] as Verdict
    verdicts[j] = swap
  }
  const dayOf = (n: number): number => {
    if (n < 4) return DAYS - 1
    const day = Math.floor(Math.sqrt(random()) * (DAYS - 1))
    return day === QUIET_INDEX ? day - 1 : day
  }
  const stamped = verdicts.map((verdict, n) => {
    const at = FIRST_DAY + dayOf(n) * DAY_MS + Math.floor(random() * DAY_MS)
    return { verdict, at }
  })
  stamped.sort((a, b) => a.at - b.at)
  return stamped.map(({ verdict, at }, n) => {
    const topics = TOPICS[verdict]
    return {
      id: `INQ-${String(n + 1).padStart(4, '0')}`,
      at: new Date(at).toISOString(),
      verdict,
      sender: SENDERS[Math.floor(random() * SENDERS.length)] as string,
      topic: topics[Math.floor(random() * topics.length)] as string,
    }
  })
}

/** `no-visits` puts the funnel on the day nobody visited: every step is 0. */
export function buildFixture(name: string | undefined): Fixture {
  const random = seeded(75)
  const days = buildDays(random)
  const all = buildInquiries(random)
  const funnelIndex = name === 'no-visits' ? QUIET_INDEX : DAYS - 1
  const funnelDay = (days[funnelIndex] as Day).at
  const site = (days[funnelIndex] as Day).visitors
  const sent = all.filter(
    (q) =>
      new Date(q.at).getTime() >= funnelDay.getTime() &&
      new Date(q.at).getTime() < funnelDay.getTime() + DAY_MS,
  ).length
  const sentToday = site === 0 ? 0 : sent
  const page = Math.round(site * 0.44)
  const form = site === 0 ? 0 : Math.max(sentToday + 5, Math.round(page * 0.18))
  return {
    days,
    steps: [
      { key: 'site', name: 'Site', count: site },
      { key: 'page', name: 'Request page', count: page },
      { key: 'form', name: 'Form started', count: form },
      { key: 'sent', name: 'Request sent', count: sentToday },
    ],
    funnelDay,
    rows: all.slice(-LIST_CAP).reverse(),
    total: all.length,
    counts: COUNTS,
    previous: 198,
    quietDay: (days[QUIET_INDEX] as Day).at,
  }
}
