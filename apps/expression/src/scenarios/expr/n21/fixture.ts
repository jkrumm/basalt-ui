export type Kind = 'reboot' | 'cable swap' | 'port move'
export type Handling = 'rebooted' | 'other' | 'alone'

export type LineAction = {
  id: string
  at: Date
  actor: string
  kind: Kind
  /** An automated action that was held back and logged as a note instead. */
  withheld: boolean
  note: string | null
}

export type Outage = {
  id: string
  start: Date
  end: Date
  minutes: number
  handling: Handling
  /** The watchdog held its reboot back and nobody else acted: the control for a rebooted drop. */
  held: boolean
  /** What happened, in one line, for the list and the announcement. */
  what: string
}

export type LineLog = { outages: readonly Outage[]; actions: readonly LineAction[] }

const MIN = 60_000
const START = Date.UTC(2026, 4, 17)
const DAYS = 183
const PEOPLE = ['Ada', 'Jonas']
const AUTOMATION = 'Watchdog'
const HELD = ['a person was on the line', 'restarted under 2 h ago']

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clock = (d: Date): string => d.toISOString().slice(11, 16)

function build(seed: number, count: number, extreme: boolean, withActions: boolean): LineLog {
  const rand = mulberry32(seed)
  const outages: Outage[] = []
  const actions: LineAction[] = []
  const slot = (DAYS * 24 * 60) / count
  for (let i = 0; i < count; i++) {
    const startMin = Math.floor(i * slot + rand() * slot * 0.8)
    const base = Math.max(2, Math.round(Math.exp(Math.log(9) + (rand() - 0.5) * 1.8)))
    const minutes = extreme && i === Math.floor(count * 0.6) ? 1140 : base
    const start = new Date(START + startMin * MIN)
    const end = new Date(start.getTime() + minutes * MIN)
    const mine: LineAction[] = []
    const add = (
      offset: number,
      actor: string,
      kind: Kind,
      withheld: boolean,
      note: string | null,
    ): void => {
      const at = new Date(start.getTime() + offset * MIN)
      const a = { id: `a${actions.length + 1}`, at, actor, kind, withheld, note }
      actions.push(a)
      mine.push(a)
    }
    if (withActions) {
      // The watchdog decides at minute 5 of every drop still down, and holds back about 4 in 10:
      // the held-back drops are the control, so reboot and left-alone drops are comparable.
      if (minutes > 5) {
        const held = rand() < 0.4
        add(5, AUTOMATION, 'reboot', held, held ? (HELD[i % HELD.length] ?? null) : null)
      }
      if (minutes === 1140) add(300, 'Ada', 'cable swap', false, null)
      else if (minutes > 14 && rand() < 0.12) {
        add(Math.round(minutes / 2), PEOPLE[i % 2] ?? 'Ada', 'port move', false, null)
      }
    }
    const done = mine.filter((a) => !a.withheld)
    const reboot = done.find((a) => a.kind === 'reboot')
    const other = done.find((a) => a.kind !== 'reboot')
    const held = mine.find((a) => a.withheld)
    const handling: Handling = other ? 'other' : reboot ? 'rebooted' : 'alone'
    const what = other
      ? `${other.kind[0]?.toUpperCase()}${other.kind.slice(1)} by ${other.actor} at ${clock(other.at)}`
      : reboot
        ? `Reboot by ${reboot.actor} at ${clock(reboot.at)}`
        : held
          ? `Reboot held back: ${held.note}`
          : 'Left alone'
    outages.push({
      id: `o${i + 1}`,
      start,
      end,
      minutes,
      handling,
      held: handling === 'alone' && held !== undefined,
      what,
    })
  }
  actions.sort((a, b) => a.at.getTime() - b.at.getTime())
  return { outages, actions }
}

/** Default: 42 drops over six months and the action log, one 19 h outage the cable swap ended. */
export const FULL_LOG: LineLog = build(21, 42, true, true)

/** `?fixture=quiet`: five short drops and no executed action, so a reboot has nothing to be compared on. */
export const QUIET_LOG: LineLog = { outages: build(7, 5, false, false).outages, actions: [] }

export const EMPTY_LOG: LineLog = { outages: [], actions: [] }

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}
