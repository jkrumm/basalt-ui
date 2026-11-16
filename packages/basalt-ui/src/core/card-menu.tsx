import { useId } from 'react'
import type { ReactElement } from 'react'
import { AppLink } from './link'
import type { MenuEntry } from './phase'

const identOf = (id: string): string => id.replace(/[^\w-]/g, '')

const ITEM =
  'flex h-8 w-full cursor-pointer items-center rounded-ctrl border-0 bg-transparent px-2 text-left text-sm text-foreground no-underline hover:bg-accent focus-ring pointer-coarse:min-h-11'

/**
 * The menu every card frame draws from its `menu` data (`StatCard`, `DataPanel`, `ChartCard`): a
 * button that opens a native popover of actions. No overlay library, so a chartless card keeps its
 * size; the browser owns Escape, light dismiss and focus return.
 */
export function CardMenu({
  menu,
  label,
}: {
  menu: readonly MenuEntry[]
  label: string
}): ReactElement {
  const id = useId()
  const anchor = `--stat-menu-${identOf(id)}`
  const close = (): void => document.getElementById(id)?.hidePopover()
  return (
    <>
      <button
        type="button"
        aria-label={label}
        data-slot="stat-menu"
        popoverTarget={id}
        style={{ anchorName: anchor }}
        className="relative z-20 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-ctrl border-0 bg-secondary p-0 text-muted-foreground shadow-raised hover:text-foreground focus-ring forced-colors:border forced-colors:border-current after:absolute after:inset-0 pointer-coarse:after:-inset-2"
      >
        <svg viewBox="0 0 16 16" className="size-icon" fill="currentColor" aria-hidden="true">
          <circle cx="3.5" cy="8" r="1.25" />
          <circle cx="8" cy="8" r="1.25" />
          <circle cx="12.5" cy="8" r="1.25" />
        </svg>
      </button>
      <div
        id={id}
        popover="auto"
        style={{ positionAnchor: anchor }}
        className="m-0 min-w-40 rounded-inset border-0 bg-popover p-1 text-foreground shadow-overlay supports-[position-area:bottom]:m-2 supports-[position-area:bottom]:[position-area:bottom_span-left] supports-[position-area:bottom]:[position-try-fallbacks:flip-block]"
      >
        {menu.map((entry) =>
          'href' in entry ? (
            <AppLink key={entry.id} href={entry.href} className={ITEM}>
              {entry.label}
            </AppLink>
          ) : (
            <button
              key={entry.id}
              type="button"
              className={ITEM}
              onClick={() => {
                close()
                entry.onClick()
              }}
            >
              {entry.label}
            </button>
          ),
        )}
      </div>
    </>
  )
}
