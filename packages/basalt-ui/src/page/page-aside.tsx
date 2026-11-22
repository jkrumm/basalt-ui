import { useContext, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { focusLost, focusMain } from '../common/focus'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { PanelHandle, usePanelWidth } from '../core/panel'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import type { RecordSequence } from '../core/ports'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import type { PageAsideProps } from './contract'
import type { ClaimHandle } from './core/claims'
import type { AsideSheetState } from './core/docking'
import { widthStore } from './core/panel-store'
import { PageContext, PageHostContext } from './page'
import { PanelBody, PanelHeader, PanelSteps, panelKeys, usePanelLabels } from './record-panel'

/** The default aside width in px; 320, 360, 480 and 640 are the sanctioned widths. */
export const DEFAULT_ASIDE_WIDTH = 360

/** The narrowest the reader can drag an aside to. */
export const ASIDE_MIN = 280

type PanelProps = {
  title: string
  width: number
  /** Shell only: `'auto'` docks beside main when it keeps its floor width, `'always'` on every non-compact class. */
  dock: 'always' | 'auto'
  /** The close button's handler; absent while the aside has nothing to close. */
  onClose?: (() => void) | undefined
  /**
   * Shell only: the page's open state and its setter, present when the aside is bound to `state`.
   * The panel never reads them; the shell's compact sheet does.
   */
  sheet?: AsideSheetState | undefined
  /** The shown detail's records: previous and next in the header. */
  records?: RecordSequence | undefined
  /** The width handle's callbacks; absent where the aside is a sheet. */
  onResize?: ((px: number | null) => void) | undefined
  onCommit?: ((px: number | null) => void) | undefined
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
  records,
  onResize,
  onCommit,
  children,
}: PanelProps): ReactElement {
  const t = useMessages(page)
  const labels = usePanelLabels()
  const panel = useRef<HTMLElement>(null)
  const style: PanelStyle = { '--page-aside-w': `${width}px` }
  // Escape inside the panel closes it. A control that used the key itself (a menu, a combobox
  // popup) has already prevented the default, and the key was theirs.
  const keys = (event: KeyboardEvent<HTMLElement>): void => panelKeys(event, { onClose, records })
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles from the controls inside; the landmark itself takes no input
    <aside
      ref={panel}
      onKeyDown={keys}
      data-slot="page-aside"
      data-dock={dock}
      aria-label={title}
      style={style}
      className="sticky top-0 flex h-dvh w-(--page-aside-w) max-w-full flex-col border-s border-border bg-background"
    >
      {onResize !== undefined && onCommit !== undefined && (
        <PanelHandle
          panel={panel}
          min={ASIDE_MIN}
          label={labels.resize}
          onResize={onResize}
          onCommit={onCommit}
        />
      )}
      <PanelHeader
        title={title}
        records={records}
        onClose={onClose}
        closeLabel={t('page.closeAside')}
      />
      <PanelBody>{children}</PanelBody>
    </aside>
  )
}

type ViewProps = Omit<PageAsideProps, 'state'> & {
  /** `undefined` is the default of the mode: open in a column, closed as a sheet. */
  open: boolean | undefined
  onOpenChange: (open: boolean) => void
  /** The aside has state to close it with. */
  closable: boolean
  /** The state is a string field holding the open record's id. */
  record?: boolean
}

const DETAIL_BOX = { height: 'fill', phase: 'ready' } as const

const noSubscribe = (): (() => void) => () => {}

/** Where the aside's own controls live: the docked panel and the sheet a phone raises. */
const ASIDE_SURFACE = '[data-slot="page-aside"], [role="dialog"]'

/**
 * Remembers the control that last had focus outside the aside while it is open (the row that opened
 * it, then the row whose record replaced it) and gives focus back to it when the aside closes, else
 * to the shell's main: closing removes the control that was focused (the close button), and focus
 * left on `<body>` makes the next Tab start at the skip link. Focus that already went somewhere real
 * (the reader moved on) stays there.
 */
function useReturnFocus(isOpen: boolean): void {
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(isOpen)
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return undefined
    const follow = (event: FocusEvent): void => {
      const { target } = event
      if (!(target instanceof HTMLElement) || target.closest(ASIDE_SURFACE) !== null) return
      opener.current = target
    }
    document.addEventListener('focusin', follow)
    return () => document.removeEventListener('focusin', follow)
  }, [isOpen])
  useIsomorphicLayoutEffect(() => {
    const was = wasOpen.current
    wasOpen.current = isOpen
    if (isOpen === was) return undefined
    if (isOpen) {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null
      return undefined
    }
    const target = opener.current
    opener.current = null
    // A frame later: the panel's own unmount can land after this effect.
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement
      const inPanel = active instanceof HTMLElement && active.closest('[data-slot="page-aside"]')
      if (!focusLost() && inPanel === null) return
      if (target?.isConnected === true) target.focus({ preventScroll: true })
      else focusMain()
    })
    return () => cancelAnimationFrame(frame)
  }, [isOpen])
}

function AsideView({
  title,
  width = DEFAULT_ASIDE_WIDTH,
  dock = 'auto',
  open,
  onOpenChange,
  closable,
  record = false,
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

  const chosen = usePanelWidth({
    store: widthStore(`aside:${width}`),
    name: `aside:${width}`,
    min: ASIDE_MIN,
  })
  const shownWidth = chosen.width ?? width
  const detail = context?.detail ?? null
  // Outside any `Page` there is no column to measure: render in flow, open.
  // Under a shell the region's docking rule decides, not the page width.
  const wide = host !== null || (context?.wide ?? true)
  const isOpen = detail !== null || (open ?? wide)
  const owns = snapshot?.owner === undefined || snapshot.owner.id === id
  useReturnFocus(isOpen)

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
  // A bound aside follows its field: the field going from set to unset (a navigation that drops
  // it, Back, `clear()`) takes the shown detail with it. A detail the field never named stays.
  const wasSet = useRef(closable && open === true)
  useIsomorphicLayoutEffect(() => {
    const was = wasSet.current
    wasSet.current = closable && open === true
    if (was && closable && open === false && detail !== null) hideDetail?.()
  })
  // Closing a shown detail returns to the aside's own content; it never closes the aside itself.
  const close = (): void => {
    if (detail !== null) hideDetail?.()
    else onOpenChange(false)
  }
  const shownTitle = detail?.title ?? title
  const body: ReactNode = detail === null ? children : detail.body(DETAIL_BOX)
  const closes = detail !== null || closable ? close : undefined

  // A bound aside under a shell claims even while closed: on a phone the header button that opens
  // the sheet needs the claim, and the shell drops a closed claim from the docked region.
  const sheet: AsideSheetState | undefined = closable
    ? {
        open: detail !== null ? true : open,
        onOpenChange: (next) => {
          if (next) onOpenChange(true)
          else close()
        },
        record,
      }
    : undefined

  useIsomorphicLayoutEffect(() => {
    if (host === null || !owns || !(isOpen || closable)) return undefined
    return host.claim(
      'aside',
      <PageAsidePanel
        title={shownTitle}
        width={shownWidth}
        dock={dock}
        onClose={closes}
        sheet={sheet}
        records={detail?.records}
        onResize={chosen.resize}
        onCommit={chosen.commit}
      >
        {body}
      </PageAsidePanel>,
      id,
    )
  })

  if (!owns || host !== null) return null

  if (context !== null && !wide) {
    // A record aside with no record open has nothing for the button to show.
    if (record && !isOpen) return null
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
        <SheetContent
          title={shownTitle}
          actions={
            detail?.records === undefined ? undefined : <PanelSteps records={detail.records} />
          }
        >
          {body}
        </SheetContent>
      </Sheet>
    )
  }

  if (!isOpen) return null
  const panel = (
    <PageAsidePanel
      title={shownTitle}
      width={shownWidth}
      dock={dock}
      onClose={closes}
      records={detail?.records}
      onResize={chosen.resize}
      onCommit={chosen.commit}
    >
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
  const [value, set] = state.use()
  // A string field holds the open record's id: open while it holds one, and a close clears it.
  // Opening is the row's job (it writes the id), so `onOpenChange(true)` writes nothing.
  if (typeof value === 'string') {
    const onOpenChange = (next: boolean): void => {
      if (!next) state.clear()
    }
    return <AsideView {...props} open={value !== ''} onOpenChange={onOpenChange} closable record />
  }
  return (
    <AsideView {...props} open={value} onOpenChange={set as (open: boolean) => void} closable />
  )
}

/**
 * The page's second surface: an inspector or detail panel beside the content. `title` is required
 * and is both the header and the landmark's `aria-label`. One per page; a second raises a dev
 * warning and the newest owns the region. An inspector's body of properties is a `Facts` list, and
 * the record it inspects is a string field passed as `state`.
 *
 * Where it renders follows the context. Under an `AppShell` it claims the shell's aside region,
 * which docks beside main (`dock="auto"`, the default, only while main keeps its floor width) or
 * overlays it, and is zero-wide while no aside is mounted. Without a shell it is a second column
 * from the `wide` container tier and a `Sheet` below it, opened by a button where the aside is
 * written, so a page places it after its content. `state` is the open state (a device or URL
 * boolean field, or a string field holding the open record's id: open while it holds a value, a
 * close clears it); without it the column is always open and the sheet is closed until the button opens it.
 * A bound aside follows its field: when the field unsets (a navigation that drops it, Back,
 * `clear()`), the detail shown in the aside goes with it.
 * `PageAside` also hosts the page's `DetailHost`: a table row or list item can show its detail in
 * the aside instead of a sheet of its own, with previous and next through the table's rows.
 * It draws the one panel anatomy `Peek`, `Dock` and a right `Sheet` share, and a handle on its start
 * edge resizes it (pointer, ArrowLeft and ArrowRight, Enter or a double click back to `width`); the
 * device remembers the width per declared `width`.
 *
 * @useWhen a screen inspects or edits one record beside its list, or shows the detail of a record without leaving the page
 * @neverWhen the panel holds page-wide filters (use the PageBar controls) or two panels are needed (one aside per page)
 *
 * @example
 * <PageAside title="Run details" width={360} state={store.field.run} mobile="sheet">
 *   <Facts rows={[{ label: 'Version', value: run.version }]} />
 * </PageAside>
 */
export function PageAside(props: PageAsideProps): ReactElement | null {
  const { state, ...rest } = props
  return state === undefined ? <LocalAside {...rest} /> : <BoundAside {...rest} state={state} />
}
