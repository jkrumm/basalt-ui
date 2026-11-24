/**
 * The rail's Favorites section: the records the reader starred, as rows under a label band. It
 * draws nothing until the list holds an entry. Expanded, the rows reorder (`SortableList`: drag the
 * handle, or focus it and use the arrow keys) and each carries a remove button; collapsed they are
 * plain icon rows with a tooltip, like every other row. The row is a link through the installed
 * `LinkComponent`; the entry's `href` is checked to be an in-app path when it is read.
 */
import { useRouterState } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { AppLink } from '../../core/link'
import { cn } from '../../core/cn'
import { FavoritesContext, StarGlyph, useFavoriteGlyph } from '../../page/favorites'
import type { FavoritesApi } from '../../page/favorites'
import type { FavoriteEntry } from '../../page/contract'
import { Button } from '../../ui/button'
import { SortableList } from '../../ui/sortable-list'
import { Tooltip } from '../../ui/tooltip'
import { useContext } from 'react'
import { useRailControl } from './grid'
import { RAIL_ROW } from './rail-rows'
import { RAIL_TEXT } from './rail-text'

const LABEL =
  'flex h-6 w-full items-center gap-1.5 px-2.5 text-micro font-medium tracking-wide text-faint uppercase @max-[120px]:hidden'

function Glyph({ entry }: { entry: FavoriteEntry }): ReactElement {
  const Icon = useFavoriteGlyph(entry.id)
  return (
    <span
      data-slot="shell-rail-row-icon"
      className="relative flex size-4 shrink-0 items-center justify-center"
    >
      {Icon !== undefined ? (
        // oxlint-disable-next-line react/static-components -- the glyph is a component the record passed in, remembered by id: stable across renders
        <Icon className="size-4" aria-hidden />
      ) : (
        <StarGlyph filled={false} />
      )}
    </span>
  )
}

function FavoriteLink({
  entry,
  current,
  className,
}: {
  entry: FavoriteEntry
  current: boolean
  className?: string
}): ReactElement {
  return (
    <AppLink
      href={entry.href}
      data-slot="shell-rail-row"
      data-favorite={entry.id}
      {...(current && { 'aria-current': 'page' as const })}
      className={cn(RAIL_ROW, className)}
    >
      <Glyph entry={entry} />
      <span className="min-w-0 flex-1 truncate text-start @max-[120px]:sr-only">{entry.label}</span>
    </AppLink>
  )
}

function ExpandedRows({ api, here }: { api: FavoritesApi; here: string }): ReactElement {
  return (
    <SortableList
      label={RAIL_TEXT.favorites}
      items={api.entries}
      itemLabel={(entry) => entry.label}
      onMove={({ from, to }) => api.move(from, to)}
      className="gap-px [&_[data-sortable=handle]]:absolute [&_[data-sortable=handle]]:end-8 [&_[data-sortable=handle]]:z-10 [&_[data-sortable=handle]]:pointer-fine:opacity-0 [&_[data-sortable=handle]:focus-visible]:opacity-100 [&_li:hover_[data-sortable=handle]]:opacity-100 [&_li:focus-within_[data-sortable=handle]]:opacity-100"
    >
      {(entry) => (
        <span className="group/fav flex min-w-0 flex-1 items-center">
          <FavoriteLink entry={entry} current={entry.href === here} className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            shape="icon"
            aria-label={RAIL_TEXT.removeFavorite(entry.label)}
            data-slot="shell-favorite-remove"
            className="absolute end-1 opacity-0 group-focus-within/fav:opacity-100 group-hover/fav:opacity-100"
            onClick={() => api.remove(entry.id)}
          >
            <StarGlyph filled />
          </Button>
        </span>
      )}
    </SortableList>
  )
}

function CollapsedRows({ api, here }: { api: FavoritesApi; here: string }): ReactElement {
  return (
    <div className="flex flex-col gap-px">
      {api.entries.map((entry) => (
        <Tooltip key={entry.id} label={entry.label} side="right">
          <FavoriteLink entry={entry} current={entry.href === here} />
        </Tooltip>
      ))}
    </div>
  )
}

/** The section, or nothing while no record is a favorite or outside an `AppShell`. */
export function RailFavorites(): ReactElement | null {
  const api = useContext(FavoritesContext)
  const { collapsed } = useRailControl()
  const here = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).href })
  if (api === null || api.entries.length === 0) return null
  return (
    <section data-slot="shell-rail-favorites" className="mt-1.5 flex flex-col">
      <h2 data-slot="shell-rail-section-label" className={LABEL}>
        {RAIL_TEXT.favorites}
      </h2>
      {collapsed ? <CollapsedRows api={api} here={here} /> : <ExpandedRows api={api} here={here} />}
    </section>
  )
}
