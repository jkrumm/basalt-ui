import { useEffect, useId, useRef } from 'react'
import type { ReactElement } from 'react'
import { bindContextTrigger, contextHandlers } from './context-trigger'
import type { ContextPoint } from './context-trigger'
import { AppLink } from './link'
import type { MenuEntry } from './phase'

const identOf = (id: string): string => id.replace(/[^\w-]/g, '')

const ITEM =
  'flex h-8 w-full cursor-pointer items-center rounded-ctrl border-0 bg-transparent px-2 text-left text-sm text-foreground no-underline hover:bg-accent focus-ring pointer-coarse:min-h-11'

/** The card the menu belongs to: a right click anywhere on it opens the menu. */
const HOST = '[data-surface="card"], [data-slot="flow-group"]'
const VIEWPORT_GAP = 8

/** Sits an open popover at a point, flipped and clamped so it stays on screen. */
function placeAt(popover: HTMLElement, at: ContextPoint): void {
  const { style } = popover
  style.setProperty('position-area', 'none')
  style.setProperty('position-try-fallbacks', 'none')
  style.setProperty('inset', 'auto')
  style.setProperty('margin', '0')
  popover.showPopover()
  const { width, height } = popover.getBoundingClientRect()
  const room = {
    x: window.innerWidth - width - VIEWPORT_GAP,
    y: window.innerHeight - height - VIEWPORT_GAP,
  }
  const left = Math.max(VIEWPORT_GAP, Math.min(at.x, room.x))
  const top = at.y > room.y ? Math.max(VIEWPORT_GAP, at.y - height) : at.y
  style.setProperty('left', `${left}px`)
  style.setProperty('top', `${top}px`)
}

const PLACEMENT = ['position-area', 'position-try-fallbacks', 'inset', 'margin', 'left', 'top']

/**
 * The menu every card frame draws from its `menu` data (`StatCard`, `DataPanel`, `ChartCard`): a
 * button that opens a native popover of actions. No overlay library, so a chartless card keeps its
 * size; the browser owns Escape, light dismiss and focus return. A right click, a long press or
 * Shift+F10 on the card opens the same popover at the pointer; `contextMenu={false}` leaves the
 * browser's menu. While it is open the card carries `data-popup-open`.
 */
export function CardMenu({
  menu,
  label,
  contextMenu = true,
}: {
  menu: readonly MenuEntry[]
  label: string
  contextMenu?: boolean
}): ReactElement {
  const id = useId()
  const anchor = `--stat-menu-${identOf(id)}`
  const close = (): void => document.getElementById(id)?.hidePopover()
  const button = useRef<HTMLButtonElement>(null)
  const enabled = useRef(contextMenu)
  useEffect(() => {
    enabled.current = contextMenu
  })
  useEffect(() => {
    const host = button.current?.closest<HTMLElement>(HOST) ?? null
    const popover = document.getElementById(id)
    if (host === null || popover === null) return
    const onToggle = (event: Event): void => {
      if ((event as ToggleEvent).newState !== 'closed') return
      host.removeAttribute('data-popup-open')
      for (const name of PLACEMENT) popover.style.removeProperty(name)
    }
    const unbind = bindContextTrigger(
      host,
      contextHandlers(() => ({
        onOpen: (at) => {
          popover.hidePopover()
          placeAt(popover, at)
          host.setAttribute('data-popup-open', '')
        },
        disabled: !enabled.current,
      })),
    )
    popover.addEventListener('toggle', onToggle)
    return () => {
      unbind()
      popover.removeEventListener('toggle', onToggle)
      host.removeAttribute('data-popup-open')
    }
  }, [id])
  return (
    <>
      <button
        ref={button}
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
