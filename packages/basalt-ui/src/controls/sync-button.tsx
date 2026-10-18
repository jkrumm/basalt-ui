/**
 * `SyncButton` — the ONE shape refresh/sync takes anywhere in a basalt app (law C12). It replaced
 * a per-consumer zoo: a `RefreshButton`, a `sync-control`, a reading `SyncButton` and a bare
 * `ActionIcon` in one app alone, each with its own age formatting and its own spinner.
 *
 * `scope` names the home, and the home decides the SHAPE — one component, two forms, so the age
 * formatting, the spinner, the error tone and the accessible name can never drift apart between
 * them (and the home stays queryable in the DOM via `data-basalt-sync-scope`):
 *
 * - `scope: 'global'` → the shell's `globalActions`. Icon-only on EVERY viewport, an `ActionIcon`
 *   carrying the spinning glyph. The shell header is 48px of width shared with the breadcrumb,
 *   `PageBar` row 1 and every other global action, so a labelled button there is the one that
 *   pushes a page's own actions into the kebab. The age and the error live in the tooltip; the
 *   accessible name is `label`.
 * - `scope: 'page'` → `PageBar.sync` (the page's own data). The labelled `Button` with the age
 *   inline beside it on desktop; below `sm` the label and the long age go and the glyph keeps a
 *   SHORT age (`2 m`) beside it — CSS only, one mount, never a `visibleFrom` twin (law C9).
 *
 * Because the label is hidden rather than unmounted below `sm`, the accessible name comes from
 * `aria-label` in BOTH forms: `display: none` text is out of the accessibility tree, so a page
 * button relying on its visible children would be an unnamed icon on a phone.
 */
import { ActionIcon, Button, Tooltip } from '@mantine/core'
import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { relativeTime } from '../format'
import { IconSlot } from '../theme/icon-slot'
import { RefreshGlyph } from './glyphs'
import classes from './sync-button.module.css'

export type SyncButtonProps = BasaltProps & {
  syncing: boolean
  /** Last successful completion. `undefined`/`null` renders no age at all. */
  lastCompletedAt?: number | Date | null
  onSync: () => void
  /** The home, and with it the shape: `'global'` is icon-only at every width, `'page'` is labelled
   * on desktop and icon-only below `sm` — see this module's doc. */
  scope: 'page' | 'global'
  /** Visible label at `scope: 'page'` on desktop, and the accessible name in every other form.
   * @default 'Sync' */
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

function toMillis(at: number | Date | null | undefined): number | undefined {
  if (at === null || at === undefined) return undefined
  return at instanceof Date ? at.getTime() : at
}

/**
 * The age string, refreshed on an interval that exists ONLY while the component is mounted and
 * only while there is an age to show — a sync control on a background route costs no timer.
 *
 * The clock is read through `useSyncExternalStore`, whose server snapshot omits the age. A global
 * `SyncButton` in `globalActions` renders inline in the shell header (no portal), so under SSR the
 * server would emit `now` and a client hydrating a minute later would emit `1 min. ago` — a React
 * text mismatch that discards the subtree. Server and hydrating paint both omit the age; React
 * re-renders with the client snapshot right after. The snapshot is the formatted label, a bucketed
 * string (`now`, `1 min. ago`, …), so it is stable across calls within a bucket and a tick only
 * re-renders when the label changes. With no timestamp there is no subscription and no timer.
 */
function useRelativeAge(
  at: number | Date | null | undefined,
  format: (timestamp: number) => string = (timestamp) =>
    relativeTime(timestamp, { style: 'short' }),
): string | undefined {
  const timestamp = toMillis(at)
  return useSyncExternalStore(
    timestamp === undefined ? subscribeNever : subscribeAgeTick,
    () => (timestamp === undefined ? undefined : format(timestamp)),
    () => undefined,
  )
}

const COMPACT_UNITS = [
  { short: 'd', seconds: 86_400 },
  { short: 'h', seconds: 3_600 },
  { short: 'm', seconds: 60 },
] as const

/**
 * The phone form's age: one number and one unit letter (`2 m`, `3 h`, `1 d`), small enough to ride
 * beside the glyph in the square button at 390. Under a minute it is the locale's own "now", the
 * same bucket the long age uses, so the two never disagree about whether a sync just landed.
 */
function compactAge(timestamp: number): string {
  const seconds = Math.max(0, (Date.now() - timestamp) / 1000)
  const unit = COMPACT_UNITS.find((u) => seconds >= u.seconds)
  if (unit === undefined) return relativeTime(timestamp, { style: 'short' })
  return `${Math.floor(seconds / unit.seconds)} ${unit.short}`
}

const subscribeNever = (): (() => void) => () => {}

function subscribeAgeTick(onTick: () => void): () => void {
  const id = setInterval(onTick, AGE_REFRESH_MS)
  return () => clearInterval(id)
}

/**
 * The age label follows the `BasaltProvider` / `defineFormat` locale. It is read when the label is
 * formatted, so a locale switch shows on the next age tick or re-render (no new subscription).
 *
 * @example
 * // page scope — the page's own data
 * <PageBar sync={{ syncing, lastCompletedAt, onSync: refetch }} />
 *
 * // global scope — the shell header, icon-only at every width
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
  className,
  style,
}: SyncButtonProps): ReactNode {
  const age = useRelativeAge(lastCompletedAt)
  const shortAge = useRelativeAge(lastCompletedAt, compactAge)
  // Wherever the label is not painted — every `global` mount, and a `page` mount below `sm` — the
  // tooltip is where the age lives; an `error` outranks it everywhere. ONE tooltip, one mount.
  const tooltip = error ?? age
  // The accessible name in both forms. The visible label is `display: none` below `sm`, which takes
  // it out of the accessibility tree, and an error must be readable without opening a tooltip.
  const name = error !== undefined ? `${label} — ${error}` : label

  const control = {
    'data-basalt-sync-scope': scope,
    'aria-busy': syncing,
    // NOT the native `disabled`. That attribute drops focus to <body> the moment a keyboard user
    // presses the button, so when the sync lands focus is gone and the next Tab restarts from
    // the top of the document — and an `aria-busy` element you cannot focus announces nothing.
    // `aria-disabled` + Mantine's `data-disabled` styling say the same thing and keep the button
    // where the user left it; the handler does the actual refusing.
    'aria-disabled': syncing,
    'aria-label': name,
    ...(syncing && { 'data-disabled': true }),
    ...(error !== undefined && { color: 'red' }),
    onClick: () => {
      if (!syncing) onSync()
    },
  }

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
      {scope === 'global' ? (
        <ActionIcon
          variant="default"
          {...control}
          {...(className !== undefined && { className })}
          {...(style !== undefined && { style })}
        >
          <IconSlot>
            <RefreshGlyph className={syncing ? classes.spin : undefined} />
          </IconSlot>
        </ActionIcon>
      ) : (
        <Button
          variant="default"
          className={cx(classes.pageButton, className)}
          {...(age !== undefined && { 'data-with-age': true })}
          {...(style !== undefined && { style })}
          leftSection={
            <IconSlot>
              <RefreshGlyph className={syncing ? classes.spin : undefined} />
            </IconSlot>
          }
          {...control}
        >
          <span className={classes.label}>{label}</span>
          {age !== undefined && <span className={classes.age}>{age}</span>}
          {shortAge !== undefined && (
            <span className={classes.ageCompact} data-sync-age="compact">
              {shortAge}
            </span>
          )}
        </Button>
      )}
    </Tooltip>
  )
}
