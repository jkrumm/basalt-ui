import { Box } from '@mantine/core'
import type { ReactElement } from 'react'
import { EventList } from '../../../src/dashboard/event-list'
import { BasaltDataTable, createColumnHelper } from '../../../src/table'

export type W52ListsMode = 'timeline' | 'feed9' | 'slack' | 'fold' | 'tooltip'

const NOW = new Date(2026, 9, 14, 18, 0)

/** `n` events oldest first: the first `split` on the day before, the rest on `NOW`'s day. */
function events(n: number, split: number) {
  return Array.from({ length: n }, (_, i) => {
    const at = new Date(NOW)
    if (i < split) at.setDate(at.getDate() - 1)
    at.setHours(8 + i, 40, 0, 0)
    return {
      id: `e${i}`,
      at,
      actor: i % 2 === 0 ? 'warden' : 'dispatch',
      title:
        i % 2 === 0 ? 'queued → running' : 'Proposed raising the cap with a per-queue override.',
      body: i % 3 === 0 ? 'Slot free' : undefined,
    }
  })
}

type Outage = { started: Date; minutes: number; scope: string; cause: string }
const outage = createColumnHelper<Outage>()
const OUTAGES: Outage[] = [
  {
    started: new Date(2026, 9, 13),
    minutes: 23,
    scope: 'Payment failed',
    cause: 'ISP upstream fault',
  },
  { started: new Date(2026, 9, 12), minutes: 6, scope: 'WAN', cause: 'Line retrain' },
  { started: new Date(2026, 9, 10), minutes: 47, scope: 'WAN', cause: 'ISP upstream fault' },
]
const OUTAGE_COLUMNS = [
  outage.accessor('started', { header: 'Started', meta: { kind: 'relative-time' } }),
  outage.accessor('minutes', { header: 'Duration (min)', meta: { kind: 'number' } }),
  outage.accessor('scope', { header: 'Scope', meta: { kind: 'text' } }),
  outage.accessor('cause', { header: 'Cause' }),
]

type Session = { exercise: string; date: Date; result: string; volume: number }
const session = createColumnHelper<Session>()
const SESSIONS: Session[] = [
  { exercise: 'Squat', date: new Date(2026, 9, 13), result: 'PR', volume: 4200 },
  { exercise: 'Bench', date: new Date(2026, 9, 11), result: 'Held', volume: 3100 },
  { exercise: 'Row', date: new Date(2026, 9, 9), result: 'Missed', volume: 2800 },
]
const SESSION_COLUMNS = [
  session.accessor('exercise', { header: 'Exercise', meta: { kind: 'entity', priority: 1 } }),
  session.accessor('date', { header: 'Date', meta: { kind: 'relative-time', priority: 2 } }),
  session.accessor('result', { header: 'Result', meta: { kind: 'status', priority: 3 } }),
  session.accessor('volume', { header: 'Volume', meta: { kind: 'number', priority: 4 } }),
]

type Wide = { name: string; a: number; b: number; c: string; d: string }
const wide = createColumnHelper<Wide>()
const WIDE: Wide[] = [{ name: 'Alpha', a: 1, b: 2, c: 'one', d: 'two' }]
const WIDE_COLUMNS = [
  wide.accessor('name', { header: 'Name', meta: { kind: 'entity' } }),
  wide.accessor('a', { header: 'Cause of the outage', meta: { kind: 'number', priority: 5 } }),
  wide.accessor('b', { header: 'Owner', meta: { kind: 'number', priority: 4 } }),
  wide.accessor('c', { header: 'Notes', meta: { priority: 3 } }),
  wide.accessor('d', { header: 'Region', meta: { priority: 2 } }),
]

/** Wave 52 lists: the item timeline cue, a nine-row feed, the table slack, the fold label and the time tooltip. */
export function W52ListsFixture({ mode }: { mode: W52ListsMode }): ReactElement {
  if (mode === 'timeline') {
    return (
      <div data-testid="w52-host">
        <EventList
          label="History"
          now={NOW}
          density="timeline"
          order="oldest-first"
          height={300}
          items={events(5, 4)}
        />
      </div>
    )
  }
  if (mode === 'feed9') {
    return (
      <div data-testid="w52-host">
        <EventList label="Feed" now={NOW} items={events(9, 0).toReversed()} />
      </div>
    )
  }
  if (mode === 'slack') {
    return (
      <Box data-testid="w52-host" w={1100}>
        <div data-testid="w52-outages">
          <BasaltDataTable data={OUTAGES} columns={OUTAGE_COLUMNS} title="Outages" />
        </div>
        <div data-testid="w52-sessions">
          <BasaltDataTable data={SESSIONS} columns={SESSION_COLUMNS} title="Sessions" />
        </div>
      </Box>
    )
  }
  if (mode === 'fold') {
    return (
      <Box data-testid="w52-host" maw={360}>
        <BasaltDataTable data={WIDE} columns={WIDE_COLUMNS} title="Folded" />
      </Box>
    )
  }
  return (
    <Box data-testid="w52-host" w={700}>
      <BasaltDataTable data={OUTAGES} columns={OUTAGE_COLUMNS} title="Outages" />
    </Box>
  )
}
