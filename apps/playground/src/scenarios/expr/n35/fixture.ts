/** The coming workweek (Mon 23 to Fri 27 November 2026): working hours per day and about 35 calendar events, seeded and deterministic. */

export type Kind = 'meeting' | 'focus' | 'personal'

export type CalEvent = {
  id: string
  day: string
  start: number
  end: number
  title: string
  kind: Kind
  declined: boolean
}

/** A workday and its working hours, in minutes since midnight. */
export type WorkDay = { key: string; label: string; open: number; close: number }

export type Week = { days: readonly WorkDay[]; events: readonly CalEvent[] }

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

const open = minutes('09:00')

const DAYS: readonly WorkDay[] = [
  { key: '2026-11-23', label: 'Mon 23', open, close: minutes('17:00') },
  { key: '2026-11-24', label: 'Tue 24', open, close: minutes('17:00') },
  { key: '2026-11-25', label: 'Wed 25', open, close: minutes('17:00') },
  { key: '2026-11-26', label: 'Thu 26', open, close: minutes('17:00') },
  { key: '2026-11-27', label: 'Fri 27', open, close: minutes('13:00') },
]

type Row = readonly [
  day: number,
  start: string,
  end: string,
  title: string,
  kind: Kind,
  declined?: true,
]

/** Friday has no event; Tuesday is booked solid, two of its events overlap and two others sit outside working hours; Thursday's longest free stretch has two declined events inside it. */
const ROWS: readonly Row[] = [
  [0, '08:00', '08:45', 'School run', 'personal'],
  [0, '09:00', '09:15', 'Team standup', 'meeting'],
  [0, '09:30', '10:30', 'Sprint planning', 'meeting'],
  [0, '10:30', '12:00', 'API review', 'focus'],
  [0, '12:00', '12:45', 'Lunch walk', 'personal'],
  [0, '12:45', '13:00', 'PR triage', 'focus'],
  [0, '13:00', '13:30', '1:1 with Priya', 'meeting'],
  [0, '13:30', '14:30', 'Design sync', 'meeting'],
  [0, '14:00', '15:00', 'Vendor demo', 'meeting', true],
  [0, '15:00', '16:30', 'Migration plan', 'focus'],
  [0, '16:30', '17:00', 'Release check-in', 'meeting'],
  [1, '08:30', '09:00', 'Coffee with mentor', 'personal'],
  [1, '09:00', '09:15', 'Team standup', 'meeting'],
  [1, '09:15', '10:45', 'Quarterly business review with the regional leads', 'meeting'],
  [1, '10:00', '11:00', 'Customer call', 'meeting'],
  [1, '11:00', '12:30', 'Roadmap workshop', 'meeting'],
  [1, '12:30', '13:00', 'Lunch', 'personal'],
  [1, '13:00', '15:00', 'Interview loop', 'meeting'],
  [1, '15:00', '17:00', 'Board prep', 'meeting'],
  [1, '17:00', '17:45', 'Gym', 'personal'],
  [2, '09:00', '09:15', 'Team standup', 'meeting'],
  [2, '09:15', '09:30', 'PR triage', 'focus'],
  [2, '09:30', '11:00', 'Incident write-up', 'focus'],
  [2, '11:00', '11:30', 'Hiring sync', 'meeting'],
  [2, '11:30', '12:30', 'Lunch with Sam', 'personal'],
  [2, '16:00', '16:30', 'Dentist', 'personal'],
  [2, '16:30', '17:00', 'Weekly metrics', 'meeting'],
  [2, '17:15', '18:00', 'Call with parents', 'personal'],
  [3, '08:15', '08:45', 'Run', 'personal'],
  [3, '09:00', '09:15', 'Team standup', 'meeting'],
  [3, '09:30', '11:00', 'Architecture review', 'meeting'],
  [3, '11:00', '12:00', 'Spec writing', 'focus'],
  [3, '12:00', '12:30', 'Lunch', 'personal'],
  [3, '14:00', '15:30', 'Offsite planning', 'meeting', true],
  [3, '15:30', '16:30', 'Team retro', 'meeting', true],
]

/** Meetings that fill every gap but a short one, for `?fixture=packed`: no day keeps a free block of an hour. */
const FILLERS: readonly Row[] = [
  [0, '14:30', '15:00', '', 'meeting'],
  [2, '12:30', '16:00', '', 'meeting'],
  [3, '12:30', '16:45', '', 'meeting'],
  [4, '09:00', '12:30', '', 'meeting'],
]

const FILLER_TITLES = ['Customer onsite', 'Planning day', 'Incident review', 'Partner workshop']

/** A small seeded generator (mulberry32), so the same seed always draws the same titles. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function toEvents(rows: readonly Row[]): CalEvent[] {
  return rows.map(([day, start, end, title, kind, declined], i) => ({
    id: `e${String(i + 1).padStart(2, '0')}`,
    day: DAYS[day]?.key ?? '',
    start: minutes(start),
    end: minutes(end),
    title,
    kind,
    declined: declined === true,
  }))
}

/** The week for a `?fixture=` name: the default week, or `packed` (the extreme: nothing free past half an hour). */
export function weekFor(fixture: string | undefined): Week {
  if (fixture !== 'packed') return { days: DAYS, events: toEvents(ROWS) }
  const next = seeded(2611)
  const titled = FILLERS.map((row): Row => {
    const [day, start, end, , kind] = row
    return [
      day,
      start,
      end,
      FILLER_TITLES[Math.floor(next() * FILLER_TITLES.length)] ?? 'Meeting',
      kind,
    ]
  })
  return { days: DAYS, events: toEvents([...ROWS, ...titled]) }
}
