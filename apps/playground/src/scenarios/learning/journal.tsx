import { Avatar, Badge, Button } from '@mantine/core'
import { EventList } from 'basalt-ui'
import { VX } from 'basalt-ui/tokens'
import { useState } from 'react'
import { ErrorNote } from '../../demo/fixtures/error-note'
import { KNOT_TITLE, LEARNING_TODAY } from '../learning-data'
import type { JournalEntry } from '../learning-data'
import { noop, retryCopy } from '../shot-state'
import type { ShotState } from '../shot-state'

/** The newest sessions shown first, and loaded per "Show earlier" click. */
const PAGE = 40

/** An entry logged without a time sits at noon for grouping; the odd millisecond marks it so its
 * time column can read as no time instead of an invented 12:00. */
const UNTIMED_MS = 1

/** The fixture dates are calendar fields, so build local instants from them: day grouping then
 * reads the same in every timezone. */
const localAt = (e: JournalEntry): Date => {
  const [y = 0, m = 1, d = 1] = e.date.split('-').map(Number)
  const [h = 12, mi = 0] = (e.time ?? '12:00').split(':').map(Number)
  return new Date(y, m - 1, d, h, mi, 0, e.time === undefined ? UNTIMED_MS : 0)
}

/** An untimed entry renders no time at all. */
const clock = (at: Date): string =>
  at.getMilliseconds() === UNTIMED_MS
    ? ''
    : at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const TODAY = new Date(
  LEARNING_TODAY.getUTCFullYear(),
  LEARNING_TODAY.getUTCMonth(),
  LEARNING_TODAY.getUTCDate(),
  23,
  0,
)

/** The practice journal of rb's knot detail: the newest 40 sessions, grouped by day and newest first
 * within each, "Show earlier" opening 40 more (past 200 rows the list windows against the page
 * scrollport). The page is about one knot, so a row says what happened, not which knot. */
export function LearningJournal({
  entries,
  shotState,
}: {
  entries: readonly JournalEntry[]
  shotState: ShotState | undefined
}) {
  const [shown, setShown] = useState(PAGE)
  if (shotState === 'error') {
    return <ErrorNote title="Journal unavailable" cause={retryCopy('journal')} onRetry={noop} />
  }
  // The fixture is newest-first by day but unsorted inside a day.
  const sorted = entries.map((e) => ({ e, at: localAt(e) })).sort((a, b) => +b.at - +a.at)
  const remaining = Math.max(0, sorted.length - shown)
  return (
    <EventList
      label="Practice journal"
      now={TODAY}
      time={clock}
      loading={shotState === 'loading'}
      loadingRows={Math.min(entries.length, shown)}
      empty={{
        title: `No sessions logged for ${KNOT_TITLE}`,
        description: 'Log a practice session to start the record.',
        action: (
          <Button variant="default" size="xs" onClick={noop}>
            Log a session
          </Button>
        ),
      }}
      {...(remaining > 0 && {
        earlier: { remaining, onLoad: () => setShown((n) => n + PAGE) },
      })}
      items={sorted.slice(0, shown).map(({ e, at }) => {
        const who = e.partnerLabel ?? 'Solo'
        return {
          id: String(e.id),
          at,
          leading: (
            <Avatar
              size={20}
              radius="xl"
              variant="default"
              styles={{ placeholder: { fontSize: VX.text.micro } }}
            >
              {who.charAt(0)}
            </Avatar>
          ),
          actor: who,
          title: `practised for ${e.durationMin} min`,
          ...(e.notes !== null && { body: e.notes }),
          ...(e.rating !== null && { chips: <Badge>{`rated ${e.rating}/5`}</Badge> }),
        }
      })}
    />
  )
}
