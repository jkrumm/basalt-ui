/**
 * S5 fixture data: one learning record, shaped like rb's knot detail and journal (`JournalEntry`).
 * Invented, seeded and deterministic — a screenshot and a reload read the same entries. The 320
 * entries are deliberate: they cross the EventList's ~200-row virtualisation threshold. Every figure
 * the page states is derived here so it cannot drift from the journal it summarises.
 */
import { fmtDay, fmtInt, seeded } from './fixture-utils'

/** The reading date. Fixed, so Today/Yesterday labels never move under a screenshot. */
export const LEARNING_TODAY = new Date(Date.UTC(2026, 9, 16))
const DAY_MS = 86_400_000

export const KNOT_TITLE = 'Alpine butterfly'
const KNOT_SLUG = 'alpine-butterfly'

export type JournalEntry = {
  id: number
  knotSlug: string
  knotTitle: string
  /** `YYYY-MM-DD`, UTC. */
  date: string
  /** `HH:MM`; absent when the session was logged without a time. */
  time?: string
  /** `null` for a solo session. */
  partnerLabel: string | null
  /** 1–5, or `null` when the session was not rated. */
  rating: number | null
  durationMin: number
  notes: string | null
}

const ENTRY_COUNT = 320
const PARTNERS = ['Mara', 'Jonas', 'Ines', 'Tobias', 'Lea'] as const
const NOTES = [
  'Dressed it faster than last time.',
  'Lost the loop twice, third try held.',
  'Checked the dish before loading.',
  'Rope was stiff, slow to set.',
  'Tied it with gloves on.',
  'Taught it to a beginner and it stuck.',
  'Clean on the first pull test.',
  'Forgot the second wrap, caught it at the check.',
  'Practised eyes closed.',
  'Rushed it and the strands crossed.',
  'Back to basics: slow and symmetrical.',
  'Good form, slightly long tail.',
] as const

const pad = (n: number): string => String(n).padStart(2, '0')
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

function buildJournal(): JournalEntry[] {
  const rand = seeded(5150)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T
  const sessions: Omit<JournalEntry, 'id'>[] = []
  // Walk back from the reading date until the quota is met; a quiet stretch is a run of skipped days.
  let skipUntil = -1
  for (let back = 0; sessions.length < ENTRY_COUNT; back += 1) {
    if (back === skipUntil) skipUntil = -1
    if (back === 190) skipUntil = back + 11
    if (skipUntil > back) continue
    if (rand() >= 0.5) continue
    const roll = rand()
    const perDay = roll < 0.55 ? 1 : roll < 0.9 ? 2 : 3
    const date = isoDay(LEARNING_TODAY.getTime() - back * DAY_MS)
    // Minutes of the day, latest first: the order the journal lists a day in.
    const slots = Array.from(
      { length: perDay },
      () => (6 + Math.floor(rand() * 15)) * 60 + 5 * Math.floor(rand() * 12),
    ).toSorted((a, b) => b - a)
    for (const slot of slots) {
      const rated = rand() < 0.88
      const timed = rand() < 0.75
      const partnered = rand() < 0.4
      const noted = rand() < 0.55
      const rating = rated ? Math.round(2.6 + rand() * 2.4) : null
      sessions.push({
        knotSlug: KNOT_SLUG,
        knotTitle: KNOT_TITLE,
        date,
        ...(timed && { time: `${pad(Math.floor(slot / 60))}:${pad(slot % 60)}` }),
        partnerLabel: partnered ? pick(PARTNERS) : null,
        rating,
        durationMin: 5 * (2 + Math.floor(rand() * 9)),
        notes: noted ? pick(NOTES) : null,
      })
    }
  }
  const newestFirst = sessions.slice(0, ENTRY_COUNT)
  // Ids ascend with time, so the newest entry carries the highest.
  return newestFirst.map((s, i) => ({ id: ENTRY_COUNT - i, ...s }))
}

/** Newest first, as rb's journal endpoint returns it. */
export const JOURNAL: readonly JournalEntry[] = buildJournal()
/** The knot's last five sessions: the compact history list on the knot page. */
export const LAST_SESSIONS: readonly JournalEntry[] = JOURNAL.slice(0, 5)

const rated = JOURNAL.flatMap((e) => (e.rating === null ? [] : [e.rating]))
const monthPrefix = isoDay(LEARNING_TODAY.getTime()).slice(0, 7)

export const SESSIONS_LOGGED = JOURNAL.length
export const FIRST_DATE = JOURNAL.at(-1)?.date ?? ''
export const LAST_DATE = JOURNAL[0]?.date ?? ''
export const MEAN_RATING = rated.reduce((a, b) => a + b, 0) / rated.length
export const RATED_COUNT = rated.length
export const MINUTES_THIS_MONTH = JOURNAL.filter((e) => e.date.startsWith(monthPrefix)).reduce(
  (a, e) => a + e.durationMin,
  0,
)
export const SESSIONS_THIS_MONTH = JOURNAL.filter((e) => e.date.startsWith(monthPrefix)).length
export const PARTNER_COUNT = new Set(
  JOURNAL.flatMap((e) => (e.partnerLabel === null ? [] : [e.partnerLabel])),
).size
/** Whole days from the last session to the reading date. */
export const DAYS_SINCE_LAST = Math.round(
  (LEARNING_TODAY.getTime() - Date.parse(LAST_DATE)) / DAY_MS,
)
/** Spaced-repetition review: a fixed interval after the last session. */
export const NEXT_REVIEW_DAYS = 4
export const NEXT_REVIEW = new Date(Date.parse(LAST_DATE) + NEXT_REVIEW_DAYS * DAY_MS)

const parseDay = (iso: string): Date => new Date(`${iso}T00:00:00Z`)
/** `16 Oct`, or `16 Oct 2025` once the date is not in the reading year. */
export const fmtLearningDay = (iso: string): string => {
  const d = parseDay(iso)
  const base = fmtDay(d)
  return d.getUTCFullYear() === LEARNING_TODAY.getUTCFullYear()
    ? base
    : `${base} ${d.getUTCFullYear()}`
}
export const fmtLearningDate = (date: Date): string => fmtLearningDay(isoDay(date.getTime()))

/** `3 h 20 min`, `45 min`. */
export const fmtMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${fmtInt(m)} min`
  return m === 0 ? `${fmtInt(h)} h` : `${fmtInt(h)} h ${m} min`
}

/** `today`, `yesterday`, `5 days ago`. */
export const fmtSince = (days: number): string =>
  days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
