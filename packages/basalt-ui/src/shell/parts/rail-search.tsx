/**
 * The rail's search row: a magnifier, "Search" and the shortcut, opening the app's own search.
 * Same slot geometry as a nav row, but it is a button and carries no `shell-rail-row` slot: it is
 * not a destination. Collapsed it is the icon alone, named by a tooltip.
 */
import type { ReactElement } from 'react'
import { useRailControl } from './grid'
import { Kbd } from '../../ui/kbd'
import { Tooltip } from '../../ui/tooltip'
import { RAIL_TEXT } from './rail-text'

export function RailSearch({ onOpen }: { onOpen: () => void }): ReactElement {
  const { collapsed } = useRailControl()
  return (
    <div className="mt-1.5">
      <Tooltip label={RAIL_TEXT.search} side="right" disabled={!collapsed}>
        <button
          type="button"
          data-slot="shell-rail-search"
          aria-label={RAIL_TEXT.search}
          onClick={onOpen}
          className="flex h-8 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-ctrl px-2.5 text-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-ring"
        >
          <span
            data-slot="shell-rail-row-icon"
            className="relative flex size-4 shrink-0 items-center justify-center"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-4"
            >
              <circle cx="7" cy="7" r="4.5" />
              <path d="m10.5 10.5 3 3" />
            </svg>
          </span>
          <span className="min-w-0 flex-1 truncate text-start @max-[120px]:sr-only">
            {RAIL_TEXT.search}
          </span>
          <span className="flex shrink-0 gap-0.5 @max-[120px]:hidden">
            <Kbd>Mod</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </Tooltip>
    </div>
  )
}
