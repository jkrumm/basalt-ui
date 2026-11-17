/**
 * The parts `Peek` and `Dock` share: one header (tag, title, `Open full page`, pin, close), one
 * scrolling body and the focus rule. Internal: each panel owns its element, position and motion.
 */
import type { ReactElement, ReactNode } from 'react'
import { focusLost, focusMain } from '../common/focus'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { AppLink } from '../core/link'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import type { NavTarget } from '../core/ports'
import { Button, buttonVariants } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'

export type RecordPanelHeaderProps = {
  title: string
  tag?: string | undefined
  fullPage?: string | NavTarget | undefined
  onClose: () => void
  /** Draws the pin button. */
  onPin?: (() => void) | undefined
}

/**
 * Takes focus into the panel when it mounts and gives it back to what had it when it unmounts,
 * else to the shell's main: closing removes the panel, and focus left on `<body>` makes the next
 * Tab start at the skip link. Focus that already went somewhere real (the reader moved on) stays.
 */
export function useFocusIn(panel: { current: HTMLElement | null }, mounted: boolean): void {
  useIsomorphicLayoutEffect(() => {
    if (!mounted) return undefined
    const el = panel.current
    const active = document.activeElement
    const opener = active instanceof HTMLElement && active !== document.body ? active : null
    el?.focus({ preventScroll: true })
    return () => {
      const now = document.activeElement
      const inside = now instanceof HTMLElement && el?.contains(now) === true
      if (!focusLost() && !inside) return
      if (opener?.isConnected === true) opener.focus({ preventScroll: true })
      else focusMain()
    }
  }, [panel, mounted])
}

/** The header: the record's tag and title, then its full-page link, the pin and the close button. */
export function RecordPanelHeader({
  title,
  tag,
  fullPage,
  onClose,
  onPin,
}: RecordPanelHeaderProps): ReactElement {
  const t = useMessages(page)
  return (
    <header className="flex shrink-0 items-center gap-2 px-4 pt-3 pb-2">
      {tag !== undefined && <span className="font-mono text-xs text-muted-foreground">{tag}</span>}
      <h2 className="m-0 min-w-0 flex-1 truncate font-head text-sm font-semibold text-foreground">
        {title}
      </h2>
      <div className="flex items-center gap-1" data-peek="off">
        {fullPage !== undefined && (
          <AppLink
            href={fullPage}
            data-slot="peek-full-page"
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            {t('page.openFullPage')}
          </AppLink>
        )}
        {onPin !== undefined && (
          <Button
            variant="ghost"
            size="sm"
            shape="icon"
            aria-label={t('page.pinPanel')}
            data-slot="peek-pin"
            onClick={onPin}
          >
            <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
              <path
                d="M10 2l4 4-2 .5-2.5 2.5.5 3-1 1-2.5-2.5L3 14l-1-1 3.5-3.5L3 7l1-1 3 .5L9.5 4 10 2z"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          shape="icon"
          aria-label={t('page.closePeek')}
          onClick={onClose}
        >
          <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </Button>
      </div>
    </header>
  )
}

/** The panel's scrolling body. */
export function RecordPanelBody({ children }: { children?: ReactNode }): ReactElement {
  return <ScrollArea className="flex-1 overscroll-contain px-4 pb-4">{children}</ScrollArea>
}
