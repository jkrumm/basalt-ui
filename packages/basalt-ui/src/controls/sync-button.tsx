/**
 * `SyncButton` — the ONE shape refresh/sync takes anywhere in a basalt app (law C12). It replaced
 * a per-consumer zoo: a `RefreshButton`, a `sync-control`, a reading `SyncButton` and a bare
 * `ActionIcon` in one app alone, each with its own age formatting and its own spinner.
 *
 * `scope` decides nothing about rendering — both scopes render the identical control. It records
 * WHERE the consumer mounts it, which is the decision that actually differs:
 * `scope: 'page'` → `PageBar.sync` (the page's own data), `scope: 'global'` → the shell's
 * `globalActions` (an app-wide sync). Keeping one component means the two can never drift apart
 * visually, and the prop keeps the intent readable at the call site (and queryable in the DOM via
 * `data-basalt-sync-scope`).
 */
import { Button, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import classes from './sync-button.module.css'

export type SyncButtonProps = {
  syncing: boolean
  /** Last successful completion. `undefined`/`null` renders no age at all. */
  lastCompletedAt?: number | Date | null
  onSync: () => void
  /** Documented placement, not a rendering switch — see this module's doc. */
  scope: 'page' | 'global'
  /** @default 'Sync' */
  label?: string
  /**
   * Last failure. Puts the control in the danger tone, carries the message in the tooltip (which
   * opens on hover, focus AND touch) and folds it into the button's accessible name, so the red is
   * never the only signal.
   */
  error?: string
}

/** How often the relative age re-renders. One interval, only while mounted. */
export const AGE_REFRESH_MS = 30_000

/**
 * Relative age, coarse on purpose: a sync indicator answers "is this stale?", not "how stale to
 * the second". Anything under a minute is `just now`, so the label stops flickering while a sync
 * has just landed.
 */
export function formatAge(ms: number): string {
  if (ms < 60_000) return 'just now'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function toMillis(at: number | Date | null | undefined): number | undefined {
  if (at === null || at === undefined) return undefined
  return at instanceof Date ? at.getTime() : at
}

/**
 * The age string, refreshed on an interval that exists ONLY while the component is mounted and
 * only while there is an age to show — a sync control on a background route costs no timer.
 *
 * The clock is read in the EFFECT, never during render. A global `SyncButton` in `globalActions`
 * renders inline in the shell header (no portal), so under SSR the server would emit `just now` and
 * a client hydrating a minute later would emit `1m ago` — a React text mismatch that discards the
 * subtree. Server and first client paint both omit the age; the effect fills it in after mount.
 * That also makes the interval the only thing that re-renders, so the old `setTick` counter is gone.
 */
function useRelativeAge(at: number | Date | null | undefined): string | undefined {
  const [age, setAge] = useState<string | undefined>(undefined)
  const timestamp = toMillis(at)

  useEffect(() => {
    if (timestamp === undefined) {
      setAge(undefined)
      return
    }
    const publish = (): void => {
      setAge(formatAge(Date.now() - timestamp))
    }
    publish()
    const id = setInterval(publish, AGE_REFRESH_MS)
    return () => clearInterval(id)
  }, [timestamp])

  return age
}

function RefreshGlyph({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={spinning ? classes.spin : undefined}
    >
      <path
        d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * @example
 * // page scope — the page's own data
 * <PageBar sync={{ syncing, lastCompletedAt, onSync: refetch }} />
 *
 * // global scope — the shell header
 * <BasaltShell globalActions={[{ key: 'sync', mobile: 'bar',
 *   node: <SyncButton scope="global" syncing={s} lastCompletedAt={t} onSync={run} /> }]} />
 */
export function SyncButton({
  syncing,
  lastCompletedAt,
  onSync,
  scope,
  label = 'Sync',
  error,
}: SyncButtonProps): ReactNode {
  const age = useRelativeAge(lastCompletedAt)
  // Below `sm` the age has no room beside the label, so the tooltip is where it lives; an `error`
  // outranks it on both viewports. ONE tooltip, one mount — never a `visibleFrom` twin (law C9).
  const tooltip = error ?? age

  return (
    // `events` is not a default: Mantine's Tooltip opens on HOVER only, so on the stock settings a
    // keyboard user and a phone user never reach the error — and the age's "the tooltip carries it
    // below `sm`" claim in the CSS was false on touch. `aria-label` is the belt to that braces: a
    // tooltip announces only while open, and an error has to be readable without one.
    <Tooltip
      label={tooltip ?? ''}
      disabled={tooltip === undefined}
      events={{ hover: true, focus: true, touch: true }}
      withArrow
    >
      <Button
        variant="default"
        data-basalt-sync-scope={scope}
        aria-busy={syncing}
        // NOT the native `disabled`. That attribute drops focus to <body> the moment a keyboard user
        // presses the button, so when the sync lands focus is gone and the next Tab restarts from
        // the top of the document — and an `aria-busy` element you cannot focus announces nothing.
        // `aria-disabled` + Mantine's `data-disabled` styling say the same thing and keep the button
        // where the user left it; the handler does the actual refusing.
        aria-disabled={syncing}
        {...(syncing && { 'data-disabled': true })}
        {...(error !== undefined && { 'aria-label': `${label} — ${error}` })}
        leftSection={<RefreshGlyph spinning={syncing} />}
        onClick={() => {
          if (!syncing) onSync()
        }}
        {...(error !== undefined && { color: 'red' })}
      >
        {label}
        {age !== undefined && <span className={classes.age}>{age}</span>}
      </Button>
    </Tooltip>
  )
}
