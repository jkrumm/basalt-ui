import { Badge } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { EventList } from '../../../src/dashboard/event-list'

declare global {
  interface Window {
    /** Prepends `n` older events to the fixture list (W44 event-list, oldest-first modes). */
    basaltElPrepend?: (n: number) => void
    /** Replaces the whole list with the newest `n` events (0 empties it). */
    basaltElSet?: (n: number) => void
    /** Appends `n` older events to the end (newest-first modes). */
    basaltElAppend?: (n: number) => void
    /** Flips the list to its loading skeleton and back, rows kept (refetch). */
    basaltElLoading?: (on: boolean) => void
  }
}

const NOW = new Date(2026, 2, 20, 18, 0)
const LONG =
  'rebuilt the nightly index after the upstream schema moved two columns, ' +
  'rebuilt the nightly index after the upstream schema moved two columns and then re-ran every dependent report to confirm nothing drifted'

type Item = {
  id: string
  at: Date
  actor: string
  title: string
  body?: string
  chips?: ReactNode
}

/** `n` events, 12 a day, newest first from `NOW`. Even steps carry a body and two chips. */
const LONG_NOTE =
  'Forgot the second wrap and caught it at the check, then re-ran every dependent report to confirm nothing drifted after the change'

/** Notes of 6..45 words with chips: some last line always ends where the last word fits but word + chips does not. */
function sweepItems(): Item[] {
  return Array.from({ length: 40 }, (_, i) => ({
    id: `sw${i}`,
    at: new Date(NOW.getTime() - i * 3_600_000),
    actor: 'Ada',
    title: `step ${i}`,
    body: `${'note'.repeat(1)} ${Array.from({ length: 5 + i }, (_, w) => `w${'x'.repeat(w % 5)}`).join(' ')} lastword`,
    chips: (
      <>
        <Badge>standard</Badge>
        <Badge color="green">merged</Badge>
      </>
    ),
  }))
}

function makeItems(n: number, from = 0, longNote = false): Item[] {
  return Array.from({ length: n }, (_, i) => {
    const k = from + i
    const at = new Date(NOW)
    at.setDate(at.getDate() - Math.floor(k / 12))
    at.setHours(17 - (k % 12), 10, 0, 0)
    return {
      id: `ev${k}`,
      at,
      actor: k % 3 === 0 ? 'Ada Lovelace' : 'Bo Wallenberg',
      title: k === 1 ? LONG : `ran step ${k}`,
      ...(k % 2 === 0 && {
        body: longNote ? LONG_NOTE : `detail for step ${k}`,
        chips: (
          <>
            <Badge>standard</Badge>
            <Badge color="green">merged</Badge>
          </>
        ),
      }),
    }
  })
}

export type EventListMode =
  | 'plain'
  | 'virtual'
  | 'plain-oldest'
  | 'virtual-oldest'
  | 'empty'
  | 'untimed'
  | 'wrap'
  | 'wrap-sweep'
  | 'threshold-oldest'
  | 'threshold'
  | 'timeline'
  | 'timeline-oldest'
  | 'loading'

/** Wave 44: `EventList` at both sizes, own scroll node (400 px) or against the shell scrollport. */
export function EventListFixture({ mode }: { mode: EventListMode }): ReactElement {
  const oldest = mode.endsWith('oldest')
  const count =
    mode === 'plain' || mode === 'plain-oldest' || mode === 'untimed' || mode === 'wrap'
      ? 150
      : mode === 'threshold' || mode === 'threshold-oldest'
        ? 200
        : mode === 'timeline-oldest'
          ? 57
          : 300
  const [items, setItems] = useState<Item[]>(() => {
    if (mode === 'wrap-sweep') return sweepItems()
    const list = makeItems(count, 0, mode === 'wrap')
    return oldest ? list.toReversed() : list
  })
  const [loadingOn, setLoadingOn] = useState(false)
  useEffect(() => {
    window.basaltElLoading = setLoadingOn
    window.basaltElPrepend = (n) =>
      setItems((prev) => [...makeItems(n, prev.length).toReversed(), ...prev])
    window.basaltElSet = (n) => setItems(oldest ? makeItems(n).toReversed() : makeItems(n))
    window.basaltElAppend = (n) => setItems((prev) => [...prev, ...makeItems(n, prev.length)])
  }, [oldest])
  return (
    <div data-testid="el-host">
      <EventList
        label="Events"
        now={NOW}
        items={mode === 'loading' || mode === 'empty' ? [] : items}
        loading={mode === 'loading' || loadingOn}
        density={mode.startsWith('timeline') ? 'timeline' : 'feed'}
        order={oldest ? 'oldest-first' : 'newest-first'}
        {...((mode === 'plain' || mode === 'timeline' || mode === 'timeline-oldest') && {
          earlier: { onLoad: () => {}, remaining: 5 },
        })}
        height={400}
        {...(mode === 'untimed' && { time: () => '' })}
      />
    </div>
  )
}
