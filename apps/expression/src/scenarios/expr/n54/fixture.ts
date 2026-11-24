/**
 * The work inbox over 14 days, UTC: about 600 messages from two mailboxes, five Teams channels and
 * the calendar. The window ends at midnight after Thu 19 Nov, so every day is complete and "this
 * week" is the last 7 of them (Fri 13 to Thu 19). Platform alerts tripled on Mon 16 Nov, and mail
 * older than 7 days that nobody tagged is still in the inbox. Seeded, so every build draws the same
 * messages.
 */

export const DAY_MS = 86_400_000
/** The window's end: midnight after the last complete day, Thu 19 Nov 2026 UTC. */
export const WINDOW_END = Date.UTC(2026, 10, 20)
export const DAYS = 14
export const WINDOW_START = WINDOW_END - DAYS * DAY_MS
/** Messages received before this are older than 7 days. */
export const WEEK_START = WINDOW_END - 7 * DAY_MS
/** The Monday platform alerts tripled on. */
export const SURGE_DAY = Date.UTC(2026, 10, 16)

export type SourceId =
  | 'work'
  | 'shared'
  | 'alerts'
  | 'releases'
  | 'design'
  | 'support'
  | 'general'
  | 'calendar'

export type Source = {
  id: SourceId
  name: string
  kind: 'Mailbox' | 'Teams channel' | 'Calendar'
  /** Messages on an ordinary weekday. */
  rate: number
  /** The share of this week's mail nobody tagged. */
  untagged: number
  senders: readonly string[]
}

export const SOURCES: readonly Source[] = [
  {
    id: 'work',
    name: 'Work inbox',
    kind: 'Mailbox',
    rate: 17,
    untagged: 0.42,
    senders: ['Priya Nair', 'Jonas Weber', 'Ines Costa', 'Omar Haddad', 'Lena Fischer'],
  },
  {
    id: 'shared',
    name: 'Shared mailbox',
    kind: 'Mailbox',
    rate: 8,
    untagged: 0.5,
    senders: ['Billing desk', 'Vendor portal', 'Kai Lindqvist', 'HR notices'],
  },
  {
    id: 'alerts',
    name: 'Platform alerts',
    kind: 'Teams channel',
    rate: 7,
    untagged: 0.2,
    senders: ['Pager bot', 'Deploy bot', 'Mara Okafor'],
  },
  {
    id: 'support',
    name: 'Support',
    kind: 'Teams channel',
    rate: 6,
    untagged: 0.35,
    senders: ['Tomas Berg', 'Aiko Tanaka', 'Helpdesk bot', 'Sam Reyes'],
  },
  {
    id: 'releases',
    name: 'Releases',
    kind: 'Teams channel',
    rate: 3,
    untagged: 0.1,
    senders: ['Release bot', 'Noor Ahmed'],
  },
  {
    id: 'design',
    name: 'Design',
    kind: 'Teams channel',
    rate: 3,
    untagged: 0.3,
    senders: ['Elif Demir', 'Rui Santos', 'Figma bot'],
  },
  {
    id: 'general',
    name: 'General',
    kind: 'Teams channel',
    rate: 2,
    untagged: 0.6,
    senders: ['Office team', 'Jonas Weber', 'Ines Costa'],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    kind: 'Calendar',
    rate: 4,
    untagged: 0.05,
    senders: ['Priya Nair', 'Omar Haddad', 'Lena Fischer'],
  },
]

export type Message = {
  id: string
  source: SourceId
  sender: string
  receivedAt: number
  tags: readonly string[]
  read: boolean
}

const TAGS = ['Action', 'FYI', 'Billing', 'Customer', 'Release', 'Waiting']

/** mulberry32: one small seeded generator, so a fixture is the same on every run. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Shape = {
  /** Multiplies the alerts' Monday: 3 is the tripled day, 12 the flood. */
  surge: number
  /** Scales the untagged share of mail received this week. */
  untaggedScale: number
  /** Scales the untagged share of older mail, 0 for an inbox the team has cleared. */
  olderScale: number
}

const SHAPES: Record<string, Shape> = {
  default: { surge: 3, untaggedScale: 1, olderScale: 0.3 },
  /** Every message tagged: a zero for untagged, no mail older than 7 days left. */
  tidy: { surge: 1, untaggedScale: 0, olderScale: 0 },
  /** One source twelve times its day: the heat scale and the ranking take an extreme. */
  flood: { surge: 12, untaggedScale: 1, olderScale: 0.3 },
}

/** The messages of a named fixture; an unknown name is the default week. */
export function messagesNamed(name: string | undefined): readonly Message[] {
  const shape = SHAPES[name ?? 'default'] ?? SHAPES['default']
  if (shape === undefined) return []
  const rand = seeded(54)
  const out: Message[] = []
  for (const source of SOURCES) {
    for (let d = 0; d < DAYS; d += 1) {
      const dayStart = WINDOW_START + d * DAY_MS
      const weekday = new Date(dayStart).getUTCDay()
      const weekend = weekday === 0 || weekday === 6
      const surge = source.id === 'alerts' && dayStart === SURGE_DAY ? shape.surge : 1
      const mean = source.rate * (weekend ? 0.25 : 1) * surge
      const count = Math.round(mean * (0.85 + 0.3 * rand()))
      const old = dayStart < WEEK_START
      const odds = source.untagged * (old ? shape.olderScale : shape.untaggedScale)
      for (let i = 0; i < count; i += 1) {
        const untagged = rand() < odds
        const first = TAGS[Math.floor(rand() * TAGS.length)] ?? 'FYI'
        const second = TAGS[Math.floor(rand() * TAGS.length)] ?? 'FYI'
        out.push({
          id: `${source.id}-${d}-${i}`,
          source: source.id,
          sender: source.senders[Math.floor(rand() * source.senders.length)] ?? '',
          receivedAt: dayStart + Math.floor(rand() * DAY_MS),
          tags: untagged ? [] : rand() < 0.3 ? [first, second] : [first],
          read: rand() < (old ? 0.92 : 0.55),
        })
      }
    }
  }
  return out
}
