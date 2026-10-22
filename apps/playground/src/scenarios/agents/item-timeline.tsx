import { Badge, Button } from '@mantine/core'
import { EventList } from 'basalt-ui'
import type { DispatchEvent, OperationEvent, TimelineEvent } from '../agents-data'
import { TODAY } from '../agents-data'
import { ErrorNote } from '../../demo/fixtures/error-note'
import { noop, retryCopy } from '../shot-state'
import type { ShotState } from '../shot-state'

/** The fixture instants are UTC; rebuild them as local ones from the same calendar fields so a shot
 * reads the same in every timezone. */
const local = (d: Date): Date =>
  new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes())

const NOW = local(TODAY)

const DISPATCH_COLOR: Record<DispatchEvent['status'], string> = {
  merged: 'green',
  failed: 'red',
  closed: 'gray',
  open: 'blue',
}
const OUTCOME_COLOR: Record<OperationEvent['outcome'], string> = {
  ok: 'green',
  failed: 'red',
  skipped: 'gray',
}

/** A neutral glyph per kind: a ring (transition), a diamond (dispatch), a square (operation). The
 * newest row's glyph is filled. */
function KindGlyph({ kind, filled }: { kind: TimelineEvent['kind']; filled: boolean }) {
  const fill = filled ? 'currentColor' : 'none'
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      {kind === 'transition' && (
        <circle cx="5" cy="5" r="3.5" fill={fill} stroke="currentColor" strokeWidth="1.25" />
      )}
      {kind === 'dispatch' && (
        <path
          d="M5 1 9 5 5 9 1 5Z"
          fill={fill}
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      )}
      {kind === 'operation' && (
        <rect
          x="1.75"
          y="1.75"
          width="6.5"
          height="6.5"
          rx="1"
          fill={fill}
          stroke="currentColor"
          strokeWidth="1.25"
        />
      )}
    </svg>
  )
}

function describe(e: TimelineEvent) {
  switch (e.kind) {
    case 'transition':
      return {
        actor: 'warden',
        title: `${e.from === null ? 'created as' : `${e.from} →`} ${e.to}`,
        body: e.reason,
        chips: undefined,
      }
    case 'dispatch':
      return {
        actor: 'dispatch',
        title: e.verdict,
        body: undefined,
        chips: (
          <>
            <Badge>{e.tier}</Badge>
            <Badge color={DISPATCH_COLOR[e.status]}>{e.status}</Badge>
          </>
        ),
      }
    case 'operation':
      return {
        actor: e.op,
        title: e.repo,
        body: undefined,
        chips: <Badge color={OUTCOME_COLOR[e.outcome]}>{e.outcome}</Badge>,
      }
    default:
      return e satisfies never
  }
}

/** One warden item's history: oldest first (warden's order) in a 440 px box that opens on the newest
 * event, grouped by day, with the last `events.length` of `total` and "Show earlier" for the rest. */
export function ItemTimeline({
  events,
  total,
  shotState,
}: {
  events: readonly TimelineEvent[]
  total: number
  shotState: ShotState | undefined
}) {
  if (shotState === 'error') {
    return (
      <ErrorNote
        title="Could not load history"
        cause={retryCopy('warden history')}
        onRetry={noop}
      />
    )
  }
  const shown = shotState === 'empty' ? [] : events
  const earlier = total - shown.length
  return (
    <EventList
      label="Item history"
      density="timeline"
      order="oldest-first"
      height={440}
      now={NOW}
      loading={shotState === 'loading'}
      loadingRows={6}
      {...(earlier > 0 && { earlier: { onLoad: noop, remaining: earlier } })}
      empty={{
        title: 'No history yet',
        description:
          'This item has not changed state or run anything. Events appear here as warden handles it.',
        action: (
          <Button variant="default" size="xs" onClick={noop}>
            Dispatch a run
          </Button>
        ),
      }}
      items={shown.map((e, i) => {
        const d = describe(e)
        return {
          id: e.id,
          at: local(e.at),
          leading: <KindGlyph kind={e.kind} filled={i === shown.length - 1} />,
          actor: d.actor,
          title: d.title,
          ...(d.body !== undefined && { body: d.body }),
          ...(d.chips !== undefined && { chips: d.chips }),
        }
      })}
    />
  )
}
