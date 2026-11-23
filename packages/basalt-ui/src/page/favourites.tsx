/**
 * Favourites: the records a reader pinned to the rail. The shell owns the list (`AppShell
 * favourites`, a `FavouritesStore`) and hands it to the page layer through `FavouritesContext`, so a
 * record panel or a page bar can draw the toggle without importing the shell. Outside an `AppShell`
 * there is no context and the toggle draws nothing.
 *
 * A stored entry is `{ id, label, href }`: a `NavTarget` is opaque and a glyph is a component, so
 * neither is stored. The glyph a record offered lives for the session and the rail row falls back to
 * a star after a reload.
 */
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { page } from '../core/messages/page'
import { persisted } from '../core/persisted'
import { isInAppPath } from '../core/url'
import type { IconComponent } from '../core/ports'
import { Button } from '../ui/button'
import { Tooltip } from '../ui/tooltip'
import type { FavouriteEntry, FavouriteInput, FavouritesStore } from './contract'
import { useSizeClass } from './use-size-class'

/** What the shell provides: the list, and the three ways to change it. */
export type FavouritesApi = {
  readonly entries: readonly FavouriteEntry[]
  toggle(input: FavouriteInput): void
  remove(id: string): void
  move(from: number, to: number): void
}

export const FavouritesContext = createContext<FavouritesApi | null>(null)

// ---- Session glyphs ------------------------------------------------------------------------------

const glyphs = new Map<string, IconComponent>()
const glyphListeners = new Set<() => void>()
let glyphVersion = 0

/** Remembers the glyph a record offered, so the rail row can draw it this session. */
export function rememberFavouriteGlyph(id: string, icon: IconComponent | undefined): void {
  if (icon === undefined || glyphs.get(id) === icon) return
  glyphs.set(id, icon)
  glyphVersion += 1
  for (const listener of glyphListeners) listener()
}

/** The glyph remembered for a favourite, or `undefined`. Re-renders when one is remembered. */
export function useFavouriteGlyph(id: string): IconComponent | undefined {
  useSyncExternalStore(
    (listener) => {
      glyphListeners.add(listener)
      return () => glyphListeners.delete(listener)
    },
    () => glyphVersion,
    () => 0,
  )
  return glyphs.get(id)
}

// ---- The default store ---------------------------------------------------------------------------

function isEntry(value: unknown): value is FavouriteEntry {
  if (typeof value !== 'object' || value === null) return false
  const { id, label, href } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    typeof label === 'string' &&
    typeof href === 'string' &&
    isInAppPath(href)
  )
}

const NONE: readonly FavouriteEntry[] = []

/**
 * The default `FavouritesStore`: `persisted` under `basalt:<key>`. Whatever storage holds is
 * checked entry by entry, so a stale or edited value drops its bad rows and nothing else.
 */
export function persistedFavourites(key: string): FavouritesStore {
  const store = persisted<readonly unknown[]>(key, { version: 1, initial: NONE })
  let seen: readonly unknown[] | undefined
  let clean: readonly FavouriteEntry[] = NONE
  return {
    get() {
      const raw = store.get()
      if (raw !== seen) {
        seen = raw
        clean = Array.isArray(raw) ? raw.filter(isEntry) : NONE
      }
      return clean
    },
    set: (next) => store.set(next),
    subscribe: store.subscribe,
  }
}

// ---- Reading and toggling ------------------------------------------------------------------------

/**
 * Whether a record is a favourite and a function that flips it, or `null` outside an `AppShell`.
 * The glyph is remembered while the record is a favourite, so the rail row wears it.
 *
 * @useWhen a record needs its own favourite control (a menu row, a keyboard shortcut) rather than the star
 * @neverWhen the star `FavouriteToggle`, a `PageBar` `favourite` or a panel's `favourite` already draws what you need
 *
 * @example
 * const favourite = useFavourite({ id: 'issue-12', label: 'Issue 12', target: navTarget(linkOptions({ to: '/issues/12' })) })
 */
export function useFavourite(input: FavouriteInput): { on: boolean; toggle: () => void } | null {
  const api = useContext(FavouritesContext)
  const on = api?.entries.some((entry) => entry.id === input.id) ?? false
  useEffect(() => {
    if (on) rememberFavouriteGlyph(input.id, input.icon)
  }, [on, input.id, input.icon])
  if (api === null) return null
  return { on, toggle: () => api.toggle(input) }
}

const STAR = 'M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13l.7-4L2.2 6.3l4-.6L8 2z'

/** The star: outline while the record is not a favourite, filled while it is. */
export function StarGlyph({ filled }: { filled: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path
        d={STAR}
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

export type FavouriteToggleProps = FavouriteInput & {
  /** Layout only. */
  className?: string
}

/**
 * The star button that adds a record to the rail's Favourites section and takes it off again. It is
 * a toggle (`aria-pressed`) named by the action it would do, and draws nothing outside an `AppShell`
 * or on a phone, where the rail that lists favourites is not drawn.
 * A `PageBar`, a `Peek` and a `Dock` draw it from their `favourite` prop; use the component itself
 * for a star of your own. `PageAside` takes no `favourite` prop.
 *
 * @useWhen a record's page or panel should offer to pin it to the rail
 * @neverWhen the app has no `AppShell`, or the pin is a per-user setting that belongs on a settings page
 *
 * @example
 * <FavouriteToggle id="issue-12" label="Issue 12" icon={Bug} target={navTarget(linkOptions({ to: '/issues/12' }))} />
 */
export function FavouriteToggle({
  className,
  ...input
}: FavouriteToggleProps): ReactElement | null {
  const t = useMessages(page)
  const favourite = useFavourite(input)
  // A phone has no rail to show the list in, so the star would pin to nothing it can see.
  const compact = useSizeClass() === 'compact'
  if (favourite === null || compact) return null
  const label = favourite.on ? t('page.unfavourite') : t('page.favourite')
  return (
    <Tooltip label={label}>
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={label}
        aria-pressed={favourite.on}
        className={cn(favourite.on && 'text-foreground', className)}
        onClick={favourite.toggle}
      >
        <StarGlyph filled={favourite.on} />
      </Button>
    </Tooltip>
  )
}
