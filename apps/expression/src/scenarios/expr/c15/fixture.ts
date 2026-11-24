/** Seeded, deterministic mailbox fixture: about 40 senders with mails a week and open rate over 90 days. */

export type Sender = {
  id: string
  name: string
  /** Mails a week, averaged over the 90 days. */
  perWeek: number
  /** Share of those mails opened, 0..100. */
  openPct: number
  mute: boolean
}

/** A sender is a clean-up candidate at this volume or more... */
export const MIN_PER_WEEK = 5
/** ...and opened under this share. */
export const MAX_OPEN_PCT = 10

type Kind = 'promo' | 'alert' | 'news' | 'person' | 'dormant' | 'edge'

/** Per kind: mails a week [min, max] and open rate [min, max] in percent. */
const KINDS: Record<Kind, { week: readonly [number, number]; open: readonly [number, number] }> = {
  promo: { week: [6, 34], open: [0, 8] },
  alert: { week: [8, 20], open: [14, 52] },
  news: { week: [1, 4], open: [38, 82] },
  person: { week: [0.3, 2], open: [70, 96] },
  dormant: { week: [0.5, 3], open: [0, 4] },
  edge: { week: [5, 8], open: [11, 17] },
}

const SENDERS: readonly (readonly [string, Kind])[] = [
  ['dealdrop.example', 'promo'],
  ['flashsale.example', 'promo'],
  ['shoplane.example', 'promo'],
  ['megamart.example', 'promo'],
  ['couponcrate.example', 'promo'],
  ['stylebox.example', 'promo'],
  ['travelnow.example', 'promo'],
  ['gadgetgrid.example', 'promo'],
  ['pizzaclub.example', 'promo'],
  ['rewardshub.example', 'promo'],
  ['cinemapass.example', 'promo'],
  ['jobalert.example', 'promo'],
  ['buildstatus.example', 'alert'],
  ['pagerduty.example', 'alert'],
  ['bankalerts.example', 'alert'],
  ['parcelwatch.example', 'alert'],
  ['calendarbot.example', 'alert'],
  ['socialping.example', 'edge'],
  ['forumdigest.example', 'edge'],
  ['learnfast.example', 'edge'],
  ['weeklybrief.example', 'news'],
  ['devnotes.example', 'news'],
  ['cityletter.example', 'news'],
  ['sciencedaily.example', 'news'],
  ['designweekly.example', 'news'],
  ['recipebox.example', 'news'],
  ['hello@family.example', 'person'],
  ['landlord.example', 'person'],
  ['dentist.example', 'person'],
  ['payroll.example', 'person'],
  ['taxoffice.example', 'person'],
  ['insurer.example', 'person'],
  ['oldgym.example', 'dormant'],
  ['webinarco.example', 'dormant'],
  ['surveyfarm.example', 'dormant'],
  ['conferencehq.example', 'dormant'],
  ['appstore-news.example', 'dormant'],
  ['loyaltyclub.example', 'dormant'],
  ['mapsdigest.example', 'person'],
  ['utilitybill.example', 'person'],
]

/** mulberry32: a small seeded generator, so every render and every shot sees the same mailbox. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (r: number, [lo, hi]: readonly [number, number]): number => lo + r * (hi - lo)
const roundWeek = (v: number): number => (v < 10 ? Math.round(v * 2) / 2 : Math.round(v))

const isMute = (perWeek: number, openPct: number): boolean =>
  perWeek >= MIN_PER_WEEK && openPct < MAX_OPEN_PCT

function generate(openFloor: number | null): Sender[] {
  const rand = seeded(1507)
  return SENDERS.map(([name, kind], i) => {
    const k = KINDS[kind]
    const perWeek = Math.max(0.5, roundWeek(between(rand(), k.week)))
    let openPct = Math.round(between(rand(), k.open))
    // The first promo senders are never opened at all: the zero the page must draw.
    if (kind === 'promo' && i % 3 === 0) openPct = 0
    if (openFloor !== null && perWeek >= MIN_PER_WEEK && openPct < openFloor) {
      openPct = openFloor + (i % 7)
    }
    return { id: `s${i}`, name, perWeek, openPct, mute: isMute(perWeek, openPct) }
  })
}

/** Candidates first, each group by mails a week: the order the list reads. */
function ranked(senders: readonly Sender[]): Sender[] {
  return [...senders].sort((a, b) => Number(b.mute) - Number(a.mute) || b.perWeek - a.perWeek)
}

const CACHE = new Map<string, readonly Sender[]>()

/**
 * `zero`: every sender that mails often is opened at least now and then, so the saving is nothing.
 * `extreme`: one sender mails 168 a week and is never opened.
 * The same array comes back for the same name: the chart focus resets when its items change identity.
 */
export function mailbox(name: string | undefined): readonly Sender[] {
  const key = name === 'zero' || name === 'extreme' ? name : 'default'
  const cached = CACHE.get(key)
  if (cached !== undefined) return cached
  const built = build(key)
  CACHE.set(key, built)
  return built
}

function build(key: 'zero' | 'extreme' | 'default'): readonly Sender[] {
  if (key === 'zero') return ranked(generate(MAX_OPEN_PCT + 2))
  if (key === 'extreme') {
    const extra: Sender = {
      id: 'sx',
      name: 'flashdeals-hourly.example',
      perWeek: 168,
      openPct: 0,
      mute: true,
    }
    return ranked([...generate(null), extra])
  }
  return ranked(generate(null))
}
