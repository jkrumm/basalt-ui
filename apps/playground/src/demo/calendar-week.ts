/** The coming workweek: a fixed calendar fixture and the booked-time and free-block arithmetic over it. All times are minutes since midnight. */

export type Kind = 'meeting' | 'focus' | 'personal'

export type CalEvent = {
  id: string
  day: number
  start: number
  end: number
  title: string
  kind: Kind
  declined: boolean
}

export type Workday = { name: string; date: number; open: number; close: number }

export type Block = { from: number; to: number }

export type DayStat = {
  index: number
  day: Workday
  events: readonly CalEvent[]
  /** Events in display lanes: an overlapping event takes the next lane. */
  lanes: readonly (readonly CalEvent[])[]
  /** Minutes of working hours covered by an accepted event; an overlap counts once. */
  booked: number
  share: number
  longest: Block | null
}

export type Overlap = { day: number } & Block

export type Week = {
  days: readonly DayStat[]
  bookedTotal: number
  openTotal: number
  /** The day whose free block is the week's longest, or null when no day has one. */
  longestDay: DayStat | null
  overlaps: readonly Overlap[]
}

export const AXIS: readonly [number, number] = [9 * 60, 18 * 60]

export const WORKDAYS: readonly Workday[] = [
  { name: 'Mon', date: 23, open: 9 * 60, close: 17 * 60 + 30 },
  { name: 'Tue', date: 24, open: 9 * 60, close: 17 * 60 + 30 },
  { name: 'Wed', date: 25, open: 9 * 60, close: 17 * 60 + 30 },
  { name: 'Thu', date: 26, open: 9 * 60, close: 17 * 60 + 30 },
  { name: 'Fri', date: 27, open: 9 * 60, close: 13 * 60 },
]

const at = (clock: string): number => {
  const [h = '0', m = '0'] = clock.split(':')
  return Number(h) * 60 + Number(m)
}

const ev = (
  id: string,
  day: number,
  start: string,
  end: string,
  title: string,
  kind: Kind,
  declined = false,
): CalEvent => ({ id, day, start: at(start), end: at(end), title, kind, declined })

/** 36 events over four days: Tuesday afternoon is open, Wednesday is booked end to end with one overlap, Friday has none. */
const BASE: readonly CalEvent[] = [
  ev('m1', 0, '09:00', '09:15', 'Standup', 'meeting'),
  ev('m2', 0, '09:15', '10:30', 'Plan the release', 'focus'),
  ev('m3', 0, '10:30', '11:30', 'Design review', 'meeting'),
  ev('m4', 0, '11:30', '12:00', 'Vendor demo', 'meeting', true),
  ev('m5', 0, '12:00', '12:45', 'Lunch', 'personal'),
  ev('m6', 0, '13:00', '14:00', '1:1 with Anna', 'meeting'),
  ev('m7', 0, '14:00', '15:00', 'Customer call', 'meeting'),
  ev('m8', 0, '15:30', '17:00', 'API cleanup', 'focus'),
  ev('m9', 0, '17:00', '17:30', 'Dentist', 'personal'),

  ev('t1', 1, '09:00', '09:15', 'Standup', 'meeting'),
  ev('t2', 1, '09:15', '10:00', 'Inbox and reviews', 'focus'),
  ev('t3', 1, '10:00', '11:00', 'Sprint planning', 'meeting'),
  ev('t4', 1, '11:00', '11:30', 'Hiring sync', 'meeting'),
  ev('t5', 1, '11:30', '12:00', 'Retro prep', 'meeting'),
  ev('t6', 1, '12:00', '12:30', 'Lunch', 'personal'),
  ev('t7', 1, '14:00', '15:00', 'All-hands', 'meeting', true),

  ev('w1', 2, '09:00', '09:15', 'Standup', 'meeting'),
  ev('w2', 2, '09:15', '10:30', 'Architecture review', 'meeting'),
  ev('w3', 2, '10:00', '10:45', 'Bank appointment', 'personal'),
  ev('w4', 2, '10:45', '11:30', 'Candidate interview', 'meeting'),
  ev('w5', 2, '11:30', '12:30', 'Interview debrief', 'meeting'),
  ev('w6', 2, '12:30', '13:15', 'Lunch and learn', 'meeting'),
  ev('w7', 2, '13:15', '14:30', 'Roadmap workshop', 'meeting'),
  ev('w8', 2, '14:30', '15:30', 'Vendor sync', 'meeting'),
  ev('w9', 2, '15:30', '16:30', 'Pairing session', 'focus'),
  ev('w10', 2, '16:30', '17:15', 'Board prep', 'meeting'),
  ev('w11', 2, '17:15', '17:30', 'Wrap-up', 'meeting'),

  ev('h1', 3, '09:00', '09:15', 'Standup', 'meeting'),
  ev('h2', 3, '09:15', '11:15', 'Migration deep work', 'focus'),
  ev('h3', 3, '11:15', '12:00', 'Team sync', 'meeting'),
  ev('h4', 3, '12:00', '12:45', 'Lunch', 'personal'),
  ev('h5', 3, '13:00', '13:30', 'Vendor demo', 'meeting'),
  ev('h6', 3, '13:30', '14:30', 'Code review', 'focus'),
  ev('h7', 3, '15:00', '16:00', 'Quarterly review', 'meeting', true),
  ev('h8', 3, '16:00', '16:30', 'Metrics review', 'meeting'),
  ev('h9', 3, '16:45', '17:30', 'Physio', 'personal'),
]

/** Fills the open afternoons and the empty Friday, so the longest free block shrinks to half an hour. */
const FILLERS: readonly CalEvent[] = [
  ev('p1', 1, '12:45', '15:00', 'Customer workshop', 'meeting'),
  ev('p2', 1, '15:00', '17:15', 'Incident review', 'meeting'),
  ev('p3', 3, '14:30', '16:00', 'Planning offsite', 'meeting'),
  ev('p4', 4, '09:00', '12:45', 'Quarter close', 'meeting'),
]

/** `?fixture=`: `packed` fills every gap (the answer is small), `clear` declines every event (nothing booked). */
export function eventsFor(fixture: string | undefined): readonly CalEvent[] {
  if (fixture === 'packed') return [...BASE, ...FILLERS]
  if (fixture === 'clear') return BASE.map((e) => ({ ...e, declined: true }))
  return BASE
}

const byStart = (a: CalEvent, b: CalEvent): number => a.start - b.start || a.end - b.end

function toLanes(events: readonly CalEvent[]): CalEvent[][] {
  const lanes: CalEvent[][] = []
  for (const e of [...events].sort(byStart)) {
    const lane = lanes.find((l) => (l.at(-1)?.end ?? 0) <= e.start)
    if (lane) lane.push(e)
    else lanes.push([e])
  }
  return lanes
}

/** The accepted events' spans inside working hours, merged. */
function busy(events: readonly CalEvent[], day: Workday): Block[] {
  const merged: Block[] = []
  const spans = events
    .filter((e) => !e.declined)
    .map((e) => ({ from: Math.max(e.start, day.open), to: Math.min(e.end, day.close) }))
    .filter((b) => b.to > b.from)
    .sort((a, b) => a.from - b.from)
  for (const span of spans) {
    const last = merged.at(-1)
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to)
    else merged.push({ ...span })
  }
  return merged
}

/** The longest gap between busy spans inside working hours; the earliest wins a tie. */
function longestFree(spans: readonly Block[], day: Workday): Block | null {
  let cursor = day.open
  let best: Block | null = null
  for (const next of [...spans, { from: day.close, to: day.close }]) {
    if (next.from - cursor > (best ? best.to - best.from : 0))
      best = { from: cursor, to: next.from }
    cursor = Math.max(cursor, next.to)
  }
  return best
}

function overlapsOf(events: readonly CalEvent[], day: number): Overlap[] {
  const accepted = events.filter((e) => !e.declined).sort(byStart)
  return accepted.flatMap((a, i) =>
    accepted.slice(i + 1).flatMap((b) => {
      const from = Math.max(a.start, b.start)
      const to = Math.min(a.end, b.end)
      return to > from ? [{ day, from, to }] : []
    }),
  )
}

export function buildWeek(events: readonly CalEvent[]): Week {
  const days = WORKDAYS.map((day, index): DayStat => {
    const own = events.filter((e) => e.day === index)
    const spans = busy(own, day)
    const booked = spans.reduce((sum, b) => sum + b.to - b.from, 0)
    return {
      index,
      day,
      events: own,
      lanes: toLanes(own),
      booked,
      share: booked / (day.close - day.open),
      longest: longestFree(spans, day),
    }
  })
  const length = (d: DayStat): number => (d.longest ? d.longest.to - d.longest.from : 0)
  const longestDay = days.reduce<DayStat | null>(
    (best, d) => (length(d) > (best ? length(best) : 0) ? d : best),
    null,
  )
  return {
    days,
    bookedTotal: days.reduce((sum, d) => sum + d.booked, 0),
    openTotal: WORKDAYS.reduce((sum, d) => sum + d.close - d.open, 0),
    longestDay,
    overlaps: days.flatMap((d) => overlapsOf(d.events, d.index)),
  }
}
