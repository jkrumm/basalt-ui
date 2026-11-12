import { useContext, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import { Button } from '../ui/button'
import { ScrollArea } from '../ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import type { PageAsideProps } from './contract'
import type { ClaimHandle } from './core/claims'
import { PageContext, PageHostContext } from './page'

/** The default aside width in px; 320, 360, 480 and 640 are the sanctioned widths. */
export const DEFAULT_ASIDE_WIDTH = 360

type PanelProps = {
  title: string
  width: number
  /** Shell only: `'auto'` docks beside main when it keeps its floor width, `'always'` on every non-compact class. */
  dock: 'always' | 'auto'
  /** The close button's handler; absent while the aside has nothing to close. */
  onClose?: (() => void) | undefined
  children?: ReactNode
}

type PanelStyle = CSSProperties & { '--page-aside-w': string }

/**
 * The aside's chrome: header, close button and a scrolling body. Internal: `PageAside` renders it
 * into the shell-less column and hands the same element to the shell's aside region, which reads
 * `width` and `dock` off its props.
 */
export function PageAsidePanel({
  title,
  width,
  dock,
  onClose,
  children,
}: PanelProps): ReactElement {
  const t = useMessages(page)
  const style: PanelStyle = { '--page-aside-w': `${width}px` }
  return (
    // theme-allow hidden-inline-style — one custom property carries the measured width; no layout is styled inline
    <aside
      data-slot="page-aside"
      data-dock={dock}
      aria-label={title}
      style={style}
      className="sticky top-0 flex h-dvh w-(--page-aside-w) max-w-full flex-col border-s border-border bg-background"
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="m-0 min-w-0 flex-1 truncate font-head text-sm font-semibold text-foreground">
          {title}
        </h2>
        {onClose !== undefined && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('page.closeAside')}
            data-aside-close=""
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
        )}
      </header>
      <ScrollArea className="flex-1 p-4">{children}</ScrollArea>
    </aside>
  )
}

type ViewProps = Omit<PageAsideProps, 'state'> & {
  /** `undefined` is the default of the mode: open in a column, closed as a sheet. */
  open: boolean | undefined
  onOpenChange: (open: boolean) => void
  /** The aside has state to close it with. */
  closable: boolean
}

const DETAIL_BOX = { height: 'fill', phase: 'ready' } as const

const noSubscribe = (): (() => void) => () => {}

function AsideView({
  title,
  width = DEFAULT_ASIDE_WIDTH,
  dock = 'auto',
  open,
  onOpenChange,
  closable,
  children,
}: ViewProps): ReactElement | null {
  const context = useContext(PageContext)
  const host = useContext(PageHostContext)
  const id = useId()
  const handle = useRef<ClaimHandle<boolean> | null>(null)
  const snapshot = useSyncExternalStore(
    context?.asides.subscribe ?? noSubscribe,
    () => context?.asides.getSnapshot(),
    () => undefined,
  )

  const detail = context?.detail ?? null
  // Outside any `Page` there is no column to measure: render in flow, open.
  // Under a shell the region's docking rule decides, not the page width.
  const wide = host !== null || (context?.wide ?? true)
  const isOpen = detail !== null || (open ?? wide)
  const owns = snapshot?.owner === undefined || snapshot.owner.id === id

  useIsomorphicLayoutEffect(() => {
    if (context === null) return undefined
    const claim = context.asides.claim(id, false)
    handle.current = claim
    return () => {
      handle.current = null
      claim.release()
    }
  }, [context, id])

  useIsomorphicLayoutEffect(() => {
    handle.current?.update(!isOpen)
  }, [isOpen])

  const hideDetail = context?.hideDetail
  // Closing a shown detail returns to the aside's own content; it never closes the aside itself.
  const close = (): void => {
    if (detail !== null) hideDetail?.()
    else onOpenChange(false)
  }
  const shownTitle = detail?.title ?? title
  const body: ReactNode = detail === null ? children : detail.body(DETAIL_BOX)
  const closes = detail !== null || closable ? close : undefined

  useIsomorphicLayoutEffect(() => {
    if (host === null || !owns || !isOpen) return undefined
    return host.claim(
      'aside',
      <PageAsidePanel title={shownTitle} width={width} dock={dock} onClose={closes}>
        {body}
      </PageAsidePanel>,
      id,
    )
  })

  if (!owns || host !== null) return null

  if (context !== null && !wide) {
    return (
      <Sheet
        open={isOpen}
        onOpenChange={(next) => {
          if (next) onOpenChange(true)
          else close()
        }}
      >
        <SheetTrigger render={<Button variant="secondary" data-aside-trigger="" />}>
          {title}
        </SheetTrigger>
        <SheetContent title={shownTitle}>{body}</SheetContent>
      </Sheet>
    )
  }

  if (!isOpen) return null
  const panel = (
    <PageAsidePanel title={shownTitle} width={width} dock={dock} onClose={closes}>
      {body}
    </PageAsidePanel>
  )
  if (context === null) return panel
  return context.asideSlot === null ? null : createPortal(panel, context.asideSlot)
}

function LocalAside(props: PageAsideProps): ReactElement | null {
  const [open, setOpen] = useState<boolean | undefined>(undefined)
  return <AsideView {...props} open={open} onOpenChange={setOpen} closable={false} />
}

function BoundAside({
  state,
  ...props
}: PageAsideProps & { state: NonNullable<PageAsideProps['state']> }): ReactElement | null {
  const [open, setOpen] = state.use()
  return <AsideView {...props} open={open} onOpenChange={setOpen} closable />
}

/**
 * The page's second surface: an inspector or detail panel beside the content. `title` is required
 * and is both the header and the landmark's `aria-label`. One per page; a second raises a dev
 * warning and the newest owns the region.
 *
 * Where it renders follows the context. Under an `AppShell` it claims the shell's aside region,
 * which docks beside main (`dock="auto"`, the default, only while main keeps its floor width) or
 * overlays it, and is zero-wide while no aside is mounted. Without a shell it is a second column
 * from the `wide` container tier and a `Sheet` below it, opened by a button where the aside is
 * written, so a page places it after its content. `state` is the open state (a device or URL
 * field); without it the column is always open and the sheet is closed until the button opens it.
 * `PageAside` also hosts the page's `DetailHost`: a table row or list item can show its detail in
 * the aside instead of a sheet of its own.
 *
 * @useWhen a screen inspects or edits one record beside its list, or shows the detail of a record without leaving the page
 * @neverWhen the panel holds page-wide filters (use the PageBar controls) or two panels are needed (one aside per page)
 *
 * @example
 * <PageAside title="Run details" width={360} state={store.field.inspector} mobile="sheet">
 *   <RunFacts run={run} />
 * </PageAside>
 */
export function PageAside(props: PageAsideProps): ReactElement | null {
  const { state, ...rest } = props
  return state === undefined ? <LocalAside {...rest} /> : <BoundAside {...rest} state={state} />
}
