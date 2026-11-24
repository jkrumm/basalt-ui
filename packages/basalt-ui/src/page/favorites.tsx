/**
 * Favorites: the records a reader pinned to the rail. The shell owns the list (`AppShell
 * favorites`, a `FavoritesStore`) and hands it to the page layer through `FavoritesContext`, so a
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
import type { FavoriteEntry, FavoriteInput, FavoritesStore } from './contract'
import { useSizeClass } from './use-size-class'

/** What the shell provides: the list, and the three ways to change it. */
export type FavoritesApi = {
  readonly entries: readonly FavoriteEntry[]
  toggle(input: FavoriteInput): void
  remove(id: string): void
  move(from: number, to: number): void
}

export const FavoritesContext = createContext<FavoritesApi | null>(null)

// ---- Session glyphs ------------------------------------------------------------------------------

const glyphs = new Map<string, IconComponent>()
const glyphListeners = new Set<() => void>()
let glyphVersion = 0

/** Remembers the glyph a record offered, so the rail row can draw it this session. */
export function rememberFavoriteGlyph(id: string, icon: IconComponent | undefined): void {
  if (icon === undefined || glyphs.get(id) === icon) return
  glyphs.set(id, icon)
  glyphVersion += 1
  for (const listener of glyphListeners) listener()
}

/** The glyph remembered for a favorite, or `undefined`. Re-renders when one is remembered. */
export function useFavoriteGlyph(id: string): IconComponent | undefined {
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

function isEntry(value: unknown): value is FavoriteEntry {
  if (typeof value !== 'object' || value === null) return false
  const { id, label, href } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    typeof label === 'string' &&
    typeof href === 'string' &&
    isInAppPath(href)
  )
}

const NONE: readonly FavoriteEntry[] = []

/**
 * The default `FavoritesStore`: `persisted` under `basalt:<key>`. Whatever storage holds is
 * checked entry by entry, so a stale or edited value drops its bad rows and nothing else.
 */
export function persistedFavorites(key: string): FavoritesStore {
  const store = persisted<readonly unknown[]>(key, { version: 1, initial: NONE })
  let seen: readonly unknown[] | undefined
  let clean: readonly FavoriteEntry[] = NONE
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
 * Whether a record is a favorite and a function that flips it, or `null` outside an `AppShell`.
 * The glyph is remembered while the record is a favorite, so the rail row wears it.
 *
 * @useWhen a record needs its own favorite control (a menu row, a keyboard shortcut) rather than the star
 * @neverWhen the star `FavoriteToggle`, a `PageBar` `favorite` or a panel's `favorite` already draws what you need
 *
 * @example
 * const favorite = useFavorite({ id: 'issue-12', label: 'Issue 12', target: navTarget(linkOptions({ to: '/issues/12' })) })
 */
export function useFavorite(input: FavoriteInput): { on: boolean; toggle: () => void } | null {
  const api = useContext(FavoritesContext)
  const on = api?.entries.some((entry) => entry.id === input.id) ?? false
  useEffect(() => {
    if (on) rememberFavoriteGlyph(input.id, input.icon)
  }, [on, input.id, input.icon])
  if (api === null) return null
  return { on, toggle: () => api.toggle(input) }
}

const STAR = 'M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13l.7-4L2.2 6.3l4-.6L8 2z'

/** The star: outline while the record is not a favorite, filled while it is. */
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

export type FavoriteToggleProps = FavoriteInput & {
  /** Layout only. */
  className?: string
}

/**
 * The star button that adds a record to the rail's Favorites section and takes it off again. It is
 * a toggle (`aria-pressed`) named by the action it would do, and draws nothing outside an `AppShell`
 * or on a phone, where the rail that lists favorites is not drawn.
 * A `PageBar`, a `Peek` and a `Dock` draw it from their `favorite` prop; use the component itself
 * for a star of your own. `PageAside` takes no `favorite` prop.
 *
 * @useWhen a record's page or panel should offer to pin it to the rail
 * @neverWhen the app has no `AppShell`, or the pin is a per-user setting that belongs on a settings page
 *
 * @example
 * <FavoriteToggle id="issue-12" label="Issue 12" icon={Bug} target={navTarget(linkOptions({ to: '/issues/12' }))} />
 */
export function FavoriteToggle({ className, ...input }: FavoriteToggleProps): ReactElement | null {
  const t = useMessages(page)
  const favorite = useFavorite(input)
  // A phone has no rail to show the list in, so the star would pin to nothing it can see.
  const compact = useSizeClass() === 'compact'
  if (favorite === null || compact) return null
  const label = favorite.on ? t('page.unfavorite') : t('page.favorite')
  return (
    <Tooltip label={label}>
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={label}
        aria-pressed={favorite.on}
        className={cn(favorite.on && 'text-foreground', className)}
        onClick={favorite.toggle}
      >
        <StarGlyph filled={favorite.on} />
      </Button>
    </Tooltip>
  )
}
