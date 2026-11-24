import type { Kind, Week } from './fixture'

export type SpanKey = Kind | 'declined' | 'longest'

/** One mark on the week track: a calendar event, or a free block between events. */
export type Span = {
  id: string
  day: string
  start: number
  end: number
  title: string
  /** What lists and announcements call it: the title, plus ", declined". */
  name: string
  /** The track series this span is drawn in. */
  key: SpanKey
  free: boolean
  declined: boolean
  /** "Tue 10:00 to 11:00" */
  when: string
  kindLabel: string
  length: string
}

export type DayStat = { key: string; label: string; work: number; booked: number }

export type Analysis = {
  days: readonly DayStat[]
  /** Events and free blocks in week order: the one array the focus, the track and the list share. */
  spans: readonly Span[]
  events: readonly Span[]
  longest: Span | null
  booked: number
  work: number
  declined: number
}

export const clock = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** "4 h 30 min", "8 h", "45 min": the one duration style of the page. */
export function hm(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

const KIND_LABEL: Record<Kind, string> = {
  meeting: 'Meeting',
  focus: 'Focus',
  personal: 'Personal',
}

/** Booked minutes are the accepted events inside working hours, each minute once however many events cover it; free blocks are the unbooked runs. */
export function analyse(week: Week): Analysis {
  const days: DayStat[] = []
  const eventSpans: Span[] = []
  const blocks: Span[] = []
  let declined = 0

  for (const day of week.days) {
    const label = day.label
    const name = label.slice(0, 3)
    const events = week.events.filter((e) => e.day === day.key).sort((a, b) => a.start - b.start)
    const busy = new Set<number>()
    for (const e of events) {
      if (e.declined) continue
      for (let m = Math.max(e.start, day.open); m < Math.min(e.end, day.close); m++) busy.add(m)
    }
    days.push({ key: day.key, label, work: day.close - day.open, booked: busy.size })

    const free: Span[] = []
    for (let m = day.open; m < day.close; m++) {
      if (busy.has(m)) continue
      const last = free.at(-1)
      if (last !== undefined && last.end === m) {
        last.end = m + 1
        continue
      }
      free.push({
        id: `free-${day.key}-${m}`,
        day: day.key,
        start: m,
        end: m + 1,
        title: 'Free block',
        name: 'Free block',
        key: 'longest',
        free: true,
        declined: false,
        when: '',
        kindLabel: 'Free block',
        length: '',
      })
    }
    for (const block of free) {
      block.when = `${name} ${clock(block.start)} to ${clock(block.end)}`
      block.length = hm(block.end - block.start)
    }
    blocks.push(...free)

    for (const e of events) {
      if (e.declined) declined++
      eventSpans.push({
        id: e.id,
        day: e.day,
        start: e.start,
        end: e.end,
        title: e.title,
        name: e.declined ? `${e.title}, declined` : e.title,
        key: e.declined ? 'declined' : e.kind,
        free: false,
        declined: e.declined,
        when: `${name} ${clock(e.start)} to ${clock(e.end)}`,
        kindLabel: KIND_LABEL[e.kind],
        length: hm(e.end - e.start),
      })
    }
  }

  const longest = blocks.reduce<Span | null>(
    (best, b) => (best === null || b.end - b.start > best.end - best.start ? b : best),
    null,
  )
  if (longest !== null) {
    longest.key = 'longest'
    longest.title = 'Longest free block'
    longest.name = 'Longest free block'
  }
  const ordered = [...eventSpans, ...(longest === null ? [] : [longest])].sort(
    (a, b) => a.day.localeCompare(b.day) || a.start - b.start,
  )
  return {
    days,
    spans: ordered,
    events: ordered.filter((s) => !s.free),
    longest,
    booked: days.reduce((sum, d) => sum + d.booked, 0),
    work: days.reduce((sum, d) => sum + d.work, 0),
    declined,
  }
}
