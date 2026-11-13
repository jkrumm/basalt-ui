import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'
import { live } from '../core/messages/live'
import { useMessages } from '../core/messages/use-messages'
import type { ConnectionView } from '../core/ports'
import { useNow } from '../core/use-now'
import { Pressable } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

/** How often the ages in the open popover re-read the clock. */
const POPOVER_TICK_MS = 5_000

export type ConnectionIndicatorProps = {
  /** The live view: `useConnection()`. Required, so the indicator never reads a QueryClient itself. */
  connection: ConnectionView
  /** Layout only (`ml-auto`, `shrink-0`). */
  className?: string
}

type Shown = {
  word:
    | 'live.connected'
    | 'live.polling'
    | 'live.reconnecting'
    | 'live.offline'
    | 'live.unauthorized'
  glyph: 'dot' | 'ring' | 'dashed' | 'slash' | 'bang'
  tone: string
}

/** One state to show: the glyph shape differs per state so it is never colour alone. */
function shownOf({ state, stream }: ConnectionView): Shown {
  if (state === 'offline') return { word: 'live.offline', glyph: 'slash', tone: 'text-bad' }
  if (stream === 'unauthorized') {
    return { word: 'live.unauthorized', glyph: 'bang', tone: 'text-bad' }
  }
  if (state === 'live') return { word: 'live.connected', glyph: 'dot', tone: 'text-good' }
  if (stream === 'retrying') {
    return { word: 'live.reconnecting', glyph: 'dashed', tone: 'text-warn' }
  }
  return { word: 'live.polling', glyph: 'ring', tone: 'text-muted-foreground' }
}

function Glyph({ shape }: { shape: Shown['glyph'] }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      data-glyph={shape}
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {shape === 'dot' && <circle cx="8" cy="8" r="3.5" fill="currentColor" stroke="none" />}
      {shape === 'ring' && <circle cx="8" cy="8" r="4.25" />}
      {shape === 'dashed' && <circle cx="8" cy="8" r="4.25" strokeDasharray="2.2 2.2" />}
      {shape === 'slash' && (
        <>
          <circle cx="8" cy="8" r="5" />
          <path d="M4.5 11.5l7-7" />
        </>
      )}
      {shape === 'bang' && (
        <>
          <path d="M8 3.5v5.5" />
          <circle cx="8" cy="12" r="0.6" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

/** The popover rows. A component of its own so the clock ticks only while the panel is open. */
function Detail({ connection }: { connection: ConnectionView }): ReactElement {
  const t = useMessages(live)
  const f = useFormat()
  const now = useNow(POPOVER_TICK_MS)
  const age = (at: number | undefined): string =>
    at === undefined ? t('live.never') : f.relative(at, now)
  const rows: readonly (readonly [string, string])[] = [
    [t('live.stream'), t('live.streamState', connection.stream)],
    [t('live.lastEvent'), age(connection.lastFrameAt)],
    [t('live.dataAge'), age(connection.lastUpdatedAt)],
  ]
  return (
    <dl
      data-slot="connection-indicator-detail"
      className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5"
    >
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt className="text-muted-foreground">{name}</dt>
          <dd className="m-0 text-right tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * The state of the app's data connection: a glyph and a word (`Live`, `Polling`, `Reconnecting`,
 * `Offline`, `Signed out`), and a popover with the stream state, the age of the last event and the
 * age of the data. Below 840 px the word is read by assistive tech only and each state keeps its
 * own glyph (filled dot, ring, dashed ring, slashed circle, bang), so state is never colour alone;
 * the hit area is 44 px on a coarse pointer. A polite live region announces a state change, not the
 * age ticking. Hidden on paper.
 *
 * @useWhen a live surface shows whether its data is streaming, polling or cut off, in the end slot of the page bar
 * @neverWhen the verdict is about a record, not the connection (use `Status`)
 *
 * @example
 * <ConnectionIndicator connection={useConnection()} />
 */
export function ConnectionIndicator({
  connection,
  className,
}: ConnectionIndicatorProps): ReactElement {
  const t = useMessages(live)
  const shown = shownOf(connection)
  const word = t(shown.word)
  return (
    <div
      data-slot="connection-indicator"
      data-state={connection.state}
      className={cn('inline-flex print:hidden', className)}
    >
      <Popover>
        <PopoverTrigger
          render={
            <Pressable
              data-trigger=""
              size="chip"
              className={cn('gap-1.5 text-xs font-medium hover:bg-accent', shown.tone)}
            />
          }
        >
          <Glyph shape={shown.glyph} />
          <span className="text-foreground max-md:sr-only">{word}</span>
        </PopoverTrigger>
        <PopoverContent aria-label={t('live.name')} align="end">
          <Detail connection={connection} />
        </PopoverContent>
      </Popover>
      <output className="sr-only">{word}</output>
    </div>
  )
}
