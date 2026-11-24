import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { cva } from 'class-variance-authority'
import { createContext, useContext, useRef, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import {
  PANEL_BODY,
  PANEL_DIVIDER,
  PANEL_FOOTER,
  PANEL_HEADER,
  PANEL_TAG,
  PANEL_TITLE,
  PanelHandle,
  usePanelWidth,
} from '../core/panel'
import { cn } from '../core/cn'
import { ControlScopeProvider } from '../core/control-scope'
import { dialogs } from '../core/messages/dialogs'
import { useMessages } from '../core/messages/use-messages'
import { persisted } from '../core/persisted'
import type { ControlHandle } from '../core/ports'
import { buttonVariants } from './button'

type Placement = 'bottom' | 'right' | 'auto'
type Swipe = 'down' | 'right'

/**
 * A height a bottom sheet rests at besides its content height: `half` is 50 % of the viewport,
 * `full` is 90 % (the sheet never covers the status bar).
 */
export type SheetSnap = 'half' | 'full'

/** The viewport fractions Base UI's `snapPoints` takes (a number below 1 is a fraction of the height). */
const SNAP_FRACTION: Record<SheetSnap, number> = { half: 0.5, full: 0.9 }

/** The `auto` flip: bottom below this width, right from it (the `md` breakpoint, 840 px; pinned to `SIZE_CLASSES.medium` by sheet.test.tsx). */
const WIDE = '(min-width: 840px)'

/** What the content part reads from `Sheet`: the resolved edge and whether it rests at snap points. */
type SheetFrame = { placement: Placement; snapped: boolean }

const FrameContext = createContext<SheetFrame>({ placement: 'auto', snapped: false })

/** The narrowest a right sheet goes: a form's label and field side by side. */
const SHEET_MIN = 320
/** The widest: never closer than 3rem to the viewport's start edge. */
const SHEET_MAX = 'calc(100vw - 3rem)'

/** The width a right sheet was dragged to, on the device; `null` is the class's width. */
const sheetWidth = (): ReturnType<typeof persisted<number | null>> =>
  persisted<number | null>('panel:sheet:width', {
    version: 1,
    initial: null,
    schema: {
      '~standard': {
        validate: (value) =>
          value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0)
            ? { value: value as number | null }
            : { issues: [{ message: 'rejected' }] },
      },
    },
  })

/** The device's safe areas stay clear of the panel: the home indicator under a bottom sheet, the notch beside it. */
const BOTTOM_INSET =
  'pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]'
const RIGHT_INSET =
  'pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]'

/** A bottom sheet hugs its content up to 90 % of the viewport; with `snapPoints` it is that tall and rests lower. */
const BOTTOM = `mt-auto max-h-[90dvh] w-full rounded-t-card ${BOTTOM_INSET} translate-y-[var(--drawer-swipe-movement-y,0px)] data-starting-style:translate-y-full data-ending-style:translate-y-full`

/**
 * The `SheetContent` cva table: a panel that slides in from an edge, its header, body and footer
 * drawn inside it (no padding of its own). `bottom` hugs its content
 * up to 90dvh, `right` is a full-height column 360 px wide (a `w-80`, `w-90`, `w-120` or
 * `w-160` class in `className` picks 320, 360, 480 or 640), and `auto` is the `bottom` table: `Sheet`
 * resolves `auto` to `bottom` below the `md` breakpoint and `right` from it, and hands `SheetContent`
 * the result. The axis is set on `Sheet`, not on the content.
 *
 * @example
 * sheetContentVariants({ placement: 'right' }) // class string for a hand-built popup
 */
export const sheetContentVariants = cva(
  'relative flex flex-col overflow-hidden bg-popover text-foreground shadow-overlay outline-none transition-transform duration-slow ease-standard data-swiping:transition-none motion-reduce:transition-none',
  {
    variants: {
      placement: {
        bottom: BOTTOM,
        right: `ml-auto h-full w-90 max-w-full ${RIGHT_INSET} translate-x-[var(--drawer-swipe-movement-x,0px)] data-starting-style:translate-x-full data-ending-style:translate-x-full`,
        auto: BOTTOM,
      },
    },
    defaultVariants: { placement: 'auto' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const sheetParts = [
  'sheet-trigger',
  'sheet-content',
  'sheet-grabber',
  'sheet-title',
  'sheet-close',
] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-120`, `mt-2`). Display and height belong to the part. */
  className?: string
}

type SheetBase = Omit<
  BaseDrawer.Root.Props,
  'swipeDirection' | 'snapPoints' | 'snapPoint' | 'defaultSnapPoint' | 'onSnapPointChange'
> & {
  /** The edge it opens from. `auto` is the bottom on a phone and the right edge from 840 px. */
  placement?: Placement
  /**
   * Where a bottom sheet rests besides its content height, smallest first: `['half', 'full']` opens
   * at half the viewport and drags to 90 %; a drag down from the lowest point dismisses. Unset, the
   * sheet has one rest, at its content height capped at 90dvh. A right sheet ignores it.
   */
  snapPoints?: readonly SheetSnap[]
}

/** A boolean handle is open while `true`; a string handle (a URL field naming a record) while non-empty. */
export type SheetState = ControlHandle<boolean> | ControlHandle<string>

export type SheetProps =
  | (SheetBase & { state?: undefined })
  | (Omit<SheetBase, 'open' | 'defaultOpen' | 'onOpenChange'> & {
      /** Open while the handle is `true` (boolean) or non-empty (string); closing calls `clear()`. */
      state: SheetState
      open?: never
      defaultOpen?: never
      onOpenChange?: never
    })
export type SheetTriggerProps = Layout<BaseDrawer.Trigger.Props>
export type SheetContentProps = Layout<Omit<BaseDrawer.Popup.Props, 'title'>> & {
  /** The accessible name and the visible heading. Required. */
  title: ReactNode
  /** A short mono tag before the title (`#12`). */
  tag?: string | undefined
  /** Controls drawn in the header before the close button: a record's previous and next, a link. */
  actions?: ReactNode
  /** A band under the scrolling body for a form's actions. */
  footer?: ReactNode
}
export type SheetTitleProps = Layout<BaseDrawer.Title.Props>
export type SheetCloseProps = Layout<BaseDrawer.Close.Props>

/** The `auto` width flip as an external store: the server and the hydration pass read `false`. */
const subscribeWide = (notify: () => void): (() => void) => {
  // the one viewport read a primitive makes: the swipe axis
  const query = window.matchMedia(WIDE)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
// the same swipe-axis read
const readWide = (): boolean => window.matchMedia(WIDE).matches
const serverWide = (): boolean => false

/**
 * A panel beside the page on Base UI Drawer: edit a record without leaving it. `placement="auto"`
 * moves it with the width: one media query read picks the edge and the swipe-to-dismiss axis, and
 * it reads as narrow on the server and during hydration, so server and client markup never differ.
 * Open state stays with the caller or the trigger, or binds to a handle: `state` is a boolean field
 * (open while true) or a string field (open while non-empty, the record a URL names), and closing
 * calls its `clear()`, as `PageAside`'s `state` does. A string-bound sheet opens by writing the
 * field (a `SheetTrigger` cannot name a record), a boolean-bound one also by its trigger. Works with no provider.
 *
 * @useWhen a record is edited or inspected beside the page and the page behind stays in view (modal decision: `Dialog`)
 * @neverWhen the question is a yes or no (use `Dialog`, or `AlertDialog` for a destructive confirm)
 *
 * @example
 * <Sheet>
 *   <SheetTrigger render={<Button />}>Edit</SheetTrigger>
 *   <SheetContent title="Edit record">Form</SheetContent>
 * </Sheet>
 *
 * @example
 * // The open record is the URL field `edit`: open while it is set, Close clears it.
 * <Sheet state={store.field.edit}>
 *   <SheetContent title="Edit order">Form</SheetContent>
 * </Sheet>
 */
export function Sheet(props: SheetProps): ReactElement {
  const { state, ...rest } = props
  return state === undefined ? <PlainSheet {...rest} /> : <BoundSheet {...rest} state={state} />
}

/** Reads the handle by its value's type: a hook cannot be conditional, so the bound form is its own component. */
function BoundSheet({
  state,
  ...props
}: Omit<SheetBase, 'open' | 'defaultOpen' | 'onOpenChange'> & { state: SheetState }): ReactElement {
  const [value, set] = (state as ControlHandle<boolean | string>).use()
  const open = typeof value === 'string' ? value !== '' : value
  return (
    <PlainSheet
      {...props}
      open={open}
      onOpenChange={(next) => {
        if (next) {
          if (typeof value === 'boolean') set(true)
        } else {
          state.clear()
        }
      }}
    />
  )
}

function PlainSheet({ placement = 'auto', snapPoints, ...props }: SheetBase): ReactElement {
  const wide = useSyncExternalStore(subscribeWide, readWide, serverWide)
  const resolved: Placement = placement === 'auto' ? (wide ? 'right' : 'bottom') : placement
  const swipe: Swipe = resolved === 'right' ? 'right' : 'down'
  const snapped = resolved !== 'right' && snapPoints !== undefined && snapPoints.length > 0
  const frame: SheetFrame = { placement: resolved, snapped }
  return (
    <FrameContext value={frame}>
      <BaseDrawer.Root
        {...props}
        swipeDirection={swipe}
        {...(snapped && {
          snapPoints: snapPoints.map((snap) => SNAP_FRACTION[snap]),
          defaultSnapPoint: SNAP_FRACTION[snapPoints[0]!],
        })}
      />
    </FrameContext>
  )
}

/**
 * The element that opens a `Sheet`. It carries no look of its own: pass `render={<Button />}`.
 *
 * @example
 * <SheetTrigger render={<Button />}>Edit</SheetTrigger>
 */
export function SheetTrigger({ className, ...props }: SheetTriggerProps): ReactElement {
  return (
    <BaseDrawer.Trigger
      {...props}
      data-slot="sheet-trigger"
      className={cn('focus-ring', className)}
    />
  )
}

/**
 * The sheet panel with its backdrop, drawn in the one panel anatomy `Peek`, `Dock` and
 * `PageAside` share: a header at the bar height (`tag`, `title`, `actions`, the close button), a
 * body that scrolls and an optional `footer` band for a form's actions. `title` is required and
 * names the sheet; the corner close button is named by the `sheet.close` message. On the right
 * edge a handle on its start edge resizes it (pointer, or ArrowLeft and ArrowRight on the focused
 * handle, Enter or a double click to reset), and the device remembers the width.
 *
 * @example
 * <SheetContent title="Edit record" footer={<Button type="submit">Save</Button>}>Form</SheetContent>
 */
export function SheetContent({
  title,
  tag,
  actions,
  footer,
  className,
  style,
  ref,
  children,
  ...props
}: SheetContentProps): ReactElement {
  const { placement, snapped } = useContext(FrameContext)
  const t = useMessages(dialogs)
  const popup = useRef<HTMLDivElement | null>(null)
  const width = usePanelWidth({ store: sheetWidth(), name: 'sheet', min: SHEET_MIN })
  const right = placement === 'right'
  const sized: CSSProperties | undefined = right
    ? { maxWidth: SHEET_MAX, ...(width.width !== null && { width: `${width.width}px` }) }
    : undefined
  return (
    <ControlScopeProvider value={null}>
      <KeyboardAware enabled={!right}>
        <BaseDrawer.Portal>
          <BaseDrawer.Backdrop
            forceRender
            className="fixed inset-0 z-50 bg-scrim transition-opacity duration-slow data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none"
          />
          <BaseDrawer.Viewport className="fixed inset-0 z-50 flex overflow-hidden data-ending-style:pointer-events-none">
            <BaseDrawer.Popup
              {...props}
              ref={(el: HTMLDivElement | null) => {
                popup.current = el
                if (typeof ref === 'function') ref(el)
                else if (ref) ref.current = el
              }}
              data-slot="sheet-content"
              style={typeof style === 'function' ? style : { ...style, ...sized }}
              className={cn(
                sheetContentVariants({ placement }),
                snapped &&
                  'h-[90dvh] max-h-none pb-[calc(env(safe-area-inset-bottom)+var(--drawer-snap-point-offset,0px))] translate-y-[calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px))]',
                className,
              )}
            >
              {!right && GRABBER}
              {right && (
                <PanelHandle
                  panel={popup}
                  min={SHEET_MIN}
                  label={t('sheet.resize')}
                  onResize={width.resize}
                  onCommit={width.commit}
                />
              )}
              <BaseDrawer.Content className="flex min-h-0 flex-1 flex-col">
                <header data-panel="header" className={PANEL_HEADER}>
                  {tag !== undefined && <span className={PANEL_TAG}>{tag}</span>}
                  <SheetTitle className={PANEL_TITLE}>{title}</SheetTitle>
                  <div className="flex shrink-0 items-center gap-1">
                    {actions}
                    {actions !== undefined && actions !== null && (
                      <span aria-hidden="true" className={PANEL_DIVIDER} />
                    )}
                    <SheetClose data-panel="close" />
                  </div>
                </header>
                {/* A native scroll, so the sheet renders only its own slots. */}
                <div
                  data-panel="body"
                  className={cn(PANEL_BODY, 'flex flex-col gap-4 overflow-y-auto')}
                >
                  {children}
                </div>
                {footer !== undefined && footer !== null && footer !== false && (
                  <div data-panel="footer" className={PANEL_FOOTER}>
                    {footer}
                  </div>
                )}
              </BaseDrawer.Content>
            </BaseDrawer.Popup>
          </BaseDrawer.Viewport>
        </BaseDrawer.Portal>
      </KeyboardAware>
    </ControlScopeProvider>
  )
}

/**
 * A bottom sheet's form fields lift above the software keyboard: Base UI scrolls the body to the
 * focused field and keeps the footer clear of the keyboard. A right sheet needs none.
 */
function KeyboardAware({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}): ReactElement {
  return enabled ? (
    <BaseDrawer.VirtualKeyboardProvider>{children}</BaseDrawer.VirtualKeyboardProvider>
  ) : (
    <>{children}</>
  )
}

/** The pill on a bottom sheet's top edge: it says the panel drags, and it is a drag handle in itself. */
const GRABBER = (
  <div
    data-slot="sheet-grabber"
    aria-hidden="true"
    className="flex h-6 shrink-0 touch-none items-end justify-center pb-1"
  >
    <span className="h-1 w-9 rounded-full bg-line" />
  </div>
)

/**
 * The sheet's heading. `SheetContent` renders it from its `title`.
 *
 * @example
 * <SheetTitle>Edit record</SheetTitle>
 */
export function SheetTitle({ className, ...props }: SheetTitleProps): ReactElement {
  return (
    <BaseDrawer.Title
      {...props}
      data-slot="sheet-title"
      className={cn('text-base font-medium text-foreground', className)}
    />
  )
}

/**
 * Closes the sheet. With no children it is the corner glyph, named by the `sheet.close` message;
 * with children it is a bare close trigger: pass `render={<Button />}` for a Cancel button.
 *
 * @example
 * <SheetClose render={<Button variant="ghost" />}>Cancel</SheetClose>
 */
export function SheetClose({ className, children, ...props }: SheetCloseProps): ReactElement {
  const t = useMessages(dialogs)
  if (children !== undefined) {
    return (
      <BaseDrawer.Close {...props} data-slot="sheet-close" className={cn('focus-ring', className)}>
        {children}
      </BaseDrawer.Close>
    )
  }
  return (
    <BaseDrawer.Close
      aria-label={t('sheet.close')}
      {...props}
      data-slot="sheet-close"
      className={cn(buttonVariants({ variant: 'ghost', size: 'sm', shape: 'icon' }), className)}
    >
      <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
        <path
          d="M4 4l8 8M12 4l-8 8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </BaseDrawer.Close>
  )
}
