import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'
import type { Format } from '../core/format'
import { live } from '../core/messages/live'
import { useMessages } from '../core/messages/use-messages'
import { Button } from '../ui/button'

/** How often the age re-renders. One shared interval, only while a button is mounted. */
export const AGE_REFRESH_MS = 30_000

export type RefreshButtonProps = {
  /** True while a refresh runs: the button is busy and refuses a second press. */
  syncing: boolean
  /** Last successful completion. `undefined` or `null` renders no age at all. */
  lastCompletedAt?: number | Date | null
  onSync: () => void
  /**
   * The home, and with it the shape: `'global'` is icon-only at every width (the shell header),
   * `'page'` is labelled with the age beside it from 840 px up, glyph and short age below.
   */
  scope: 'page' | 'global'
  /** The visible label of the `'page'` form and the accessible name of every form. Default `Refresh`. */
  label?: string
  /** The last failure: names the button (`Refresh — <error>`) and shows in its tooltip. */
  error?: string
  /** Layout only (`ml-auto`, `shrink-0`). */
  className?: string
}

const COMPACT_UNITS = [
  { unit: 'day', seconds: 86_400 },
  { unit: 'hour', seconds: 3_600 },
  { unit: 'minute', seconds: 60 },
] as const

/** `2m`, `3h`, `2d`: one number and a narrow unit in the locale; under a minute the locale's "now". */
function compactAge(f: Format, at: number, now: number): string {
  const seconds = Math.max(0, (now - at) / 1000)
  const step = COMPACT_UNITS.find((u) => seconds >= u.seconds)
  if (step === undefined) return f.relative(at, now)
  return f.number(Math.floor(seconds / step.seconds), {
    style: 'unit',
    unit: step.unit,
    unitDisplay: 'narrow',
  })
}

const noop = (): void => {}

/**
 * The clock the age is read from, in epoch ms; `0` (no age) on the server, during hydration, and
 * while `enabled` is false. It ticks only while a timestamp exists, so a button that never
 * completed holds no interval.
 */
function useAgeClock(enabled: boolean): number {
  const clock = useRef(0)
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!enabled) return noop
      clock.current = Date.now()
      const id = setInterval(() => {
        clock.current = Date.now()
        onChange()
      }, AGE_REFRESH_MS)
      onChange()
      return () => clearInterval(id)
    },
    [enabled],
  )
  return useSyncExternalStore(
    subscribe,
    () => (enabled ? clock.current : 0),
    () => 0,
  )
}

function Glyph({ spinning }: { spinning: boolean }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn('size-icon', spinning && 'animate-spin motion-reduce:animate-none')}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The one shape refresh takes: spread `useFreshness().button` for the app's queries, or pass a
 * server job's own `syncing`, `lastCompletedAt`, `onSync` and `error`. The age (`2 min. ago`) is
 * absent on the server and on the first client paint, so it cannot mismatch on hydration. While
 * `syncing` the glyph spins and a second press is refused without losing focus; an `error` is part
 * of the accessible name and the tooltip, never colour alone. On paper the button is hidden and a
 * line "Updated <date and time>" states when the data was taken.
 *
 * @useWhen a page or the shell header offers a refresh of live data, with how old it is
 * @neverWhen the action is not a refresh (use `Button`) or the data never changes (omit it)
 *
 * @example
 * <RefreshButton scope="global" {...useFreshness().button} />
 *
 * @example
 * <RefreshButton scope="page" syncing={job.running} lastCompletedAt={job.lastCompletedAt} onSync={job.start} />
 */
export function RefreshButton({
  syncing,
  lastCompletedAt,
  onSync,
  scope,
  label,
  error,
  className,
}: RefreshButtonProps): ReactElement {
  const t = useMessages(live)
  const f = useFormat()
  const at = lastCompletedAt instanceof Date ? lastCompletedAt.getTime() : lastCompletedAt
  const shown = at ?? undefined
  const now = useAgeClock(shown !== undefined)
  const age = now > 0 && shown !== undefined ? f.relative(shown, now) : undefined
  const short = now > 0 && shown !== undefined ? compactAge(f, shown, now) : undefined
  const text = label ?? t('live.refresh')
  const name = error === undefined ? text : `${text} — ${error}`
  const press = (): void => {
    if (!syncing) onSync()
  }

  return (
    <>
      {scope === 'global' ? (
        <Button
          variant="ghost"
          size="icon"
          data-slot="refresh-button"
          data-scope={scope}
          aria-label={name}
          title={error ?? age}
          loading={syncing}
          onClick={press}
          className={cn('print:hidden', error !== undefined && 'text-bad', className)}
        >
          <Glyph spinning={syncing} />
        </Button>
      ) : (
        <Button
          variant="secondary"
          data-slot="refresh-button"
          data-scope={scope}
          title={error ?? age}
          loading={syncing}
          onClick={press}
          className={cn(
            'max-md:px-2 pointer-coarse:min-w-11 print:hidden',
            error !== undefined && 'text-bad',
            className,
          )}
        >
          <Glyph spinning={syncing} />
          {/* The label stays in the name below 840 px (sr-only), so name and visible text agree. */}
          <span className="max-md:sr-only">{text}</span>
          {age !== undefined && (
            <span
              data-slot="refresh-button-age"
              className="text-xs text-muted-foreground max-md:hidden"
            >
              {age}
            </span>
          )}
          {short !== undefined && (
            <span
              data-slot="refresh-button-age"
              data-age="compact"
              className="text-xs whitespace-nowrap text-muted-foreground md:hidden"
            >
              {short}
            </span>
          )}
          {error !== undefined && <span className="sr-only">{` — ${error}`}</span>}
        </Button>
      )}
      {shown !== undefined && (
        <span data-slot="refresh-button-print" className="hidden text-xs print:inline">
          {t('live.updated', shown)}
        </span>
      )}
    </>
  )
}
