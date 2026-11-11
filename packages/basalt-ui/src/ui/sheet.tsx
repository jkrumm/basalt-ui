import { Drawer as BaseDrawer } from '@base-ui/react/drawer'
import { cva } from 'class-variance-authority'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { dialogs } from '../core/messages/dialogs'
import { useMessages } from '../core/messages/use-messages'
import { buttonVariants } from './button'

type Placement = 'bottom' | 'right' | 'auto'
type Swipe = 'down' | 'right'

/** The `auto` flip: bottom below this width, right from it (the `md` breakpoint, 840 px). */
const WIDE = '(min-width: 840px)'

const PlacementContext = createContext<Placement>('auto')

/**
 * The `SheetContent` cva table: a panel that slides in from an edge. `bottom` caps its height at
 * `min(72dvh,560px)`, `right` is a full-height column 360 px wide (a `w-80`, `w-90`, `w-120` or
 * `w-160` class in `className` picks 320, 360, 480 or 640), and `auto` is `bottom` below the `md`
 * breakpoint and `right` from it. The axis is set on `Sheet`, not on the content.
 *
 * @example
 * sheetContentVariants({ placement: 'right' }) // class string for a hand-built popup
 */
export const sheetContentVariants = cva(
  'relative flex flex-col gap-4 overflow-y-auto bg-popover p-4 text-foreground shadow-overlay outline-none transition-transform duration-300 ease-standard data-swiping:transition-none motion-reduce:transition-none',
  {
    variants: {
      placement: {
        bottom:
          'mt-auto max-h-[min(72dvh,560px)] w-full rounded-t-card translate-y-[var(--drawer-swipe-movement-y,0px)] data-starting-style:translate-y-full data-ending-style:translate-y-full',
        right:
          'ml-auto h-full w-90 max-w-full translate-x-[var(--drawer-swipe-movement-x,0px)] data-starting-style:translate-x-full data-ending-style:translate-x-full',
        auto: 'mt-auto max-h-[min(72dvh,560px)] w-full rounded-t-card translate-y-[var(--drawer-swipe-movement-y,0px)] data-starting-style:translate-y-full data-ending-style:translate-y-full md:mt-0 md:ml-auto md:h-full md:max-h-none md:w-90 md:max-w-full md:rounded-t-none md:translate-x-[var(--drawer-swipe-movement-x,0px)] md:data-starting-style:translate-x-full md:data-starting-style:translate-y-0 md:data-ending-style:translate-x-full md:data-ending-style:translate-y-0',
      },
    },
    defaultVariants: { placement: 'auto' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const sheetParts = ['sheet-trigger', 'sheet-content', 'sheet-title', 'sheet-close'] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-120`, `mt-2`). Display and height belong to the part. */
  className?: string
}

export type SheetProps = Omit<BaseDrawer.Root.Props, 'swipeDirection'> & {
  /** The edge it opens from. `auto` is the bottom on a phone and the right edge from 840 px. */
  placement?: Placement
}
export type SheetTriggerProps = Layout<BaseDrawer.Trigger.Props>
export type SheetContentProps = Layout<Omit<BaseDrawer.Popup.Props, 'title'>> & {
  /** The accessible name and the visible heading. Required. */
  title: ReactNode
}
export type SheetTitleProps = Layout<BaseDrawer.Title.Props>
export type SheetCloseProps = Layout<BaseDrawer.Close.Props>

const swipeOf = (placement: Placement): Swipe => {
  if (placement === 'bottom') return 'down'
  if (placement === 'right') return 'right'
  // theme-allow raw-breakpoint — the one viewport read a primitive makes: the swipe axis, at open
  return window.matchMedia(WIDE).matches ? 'right' : 'down'
}

/**
 * A panel beside the page on Base UI Drawer: edit a record without leaving it. `placement="auto"`
 * moves it with CSS; the swipe-to-dismiss axis is read once when it opens, so server and client
 * markup never differ. Open state stays with the caller or the trigger. Works with no provider.
 *
 * @useWhen a record is edited or inspected beside the page and the page behind stays in view (modal decision: `Dialog`)
 * @neverWhen the question is a yes or no (use `Dialog`, or `AlertDialog` for a destructive confirm)
 *
 * @example
 * <Sheet>
 *   <SheetTrigger render={<Button />}>Edit</SheetTrigger>
 *   <SheetContent title="Edit record">Form</SheetContent>
 * </Sheet>
 */
export function Sheet({
  placement = 'auto',
  onOpenChange,
  open,
  defaultOpen,
  ...props
}: SheetProps): ReactElement {
  const [swipe, setSwipe] = useState<Swipe>(placement === 'right' ? 'right' : 'down')
  const startsOpen = open ?? defaultOpen ?? false

  // A sheet that is open from the first paint has had no open event to read the width on.
  useEffect(() => {
    if (startsOpen) setSwipe(swipeOf(placement))
    // oxlint-disable-next-line react/exhaustive-deps -- once on mount; later opens read in onOpenChange
  }, [])

  return (
    <PlacementContext value={placement}>
      <BaseDrawer.Root
        {...props}
        {...(open === undefined ? {} : { open })}
        {...(defaultOpen === undefined ? {} : { defaultOpen })}
        swipeDirection={swipe}
        onOpenChange={(next, details) => {
          if (next) setSwipe(swipeOf(placement))
          onOpenChange?.(next, details)
        }}
      />
    </PlacementContext>
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
 * The sheet panel with its backdrop. `title` is required and names the sheet; the corner close
 * button is named by the `sheet.close` message.
 *
 * @example
 * <SheetContent title="Edit record" className="md:w-120">Form</SheetContent>
 */
export function SheetContent({
  title,
  className,
  children,
  ...props
}: SheetContentProps): ReactElement {
  const placement = useContext(PlacementContext)
  return (
    <BaseDrawer.Portal>
      <BaseDrawer.Backdrop
        forceRender
        className="fixed inset-0 z-50 bg-scrim transition-opacity duration-300 data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none"
      />
      <BaseDrawer.Viewport className="fixed inset-0 z-50 flex overflow-hidden data-ending-style:pointer-events-none">
        <BaseDrawer.Popup
          {...props}
          data-slot="sheet-content"
          className={cn(sheetContentVariants({ placement }), className)}
        >
          <BaseDrawer.Content className="flex min-h-0 flex-1 flex-col gap-4">
            <header className="flex items-start gap-3">
              <SheetTitle className="min-w-0 flex-1">{title}</SheetTitle>
              <SheetClose />
            </header>
            {children}
          </BaseDrawer.Content>
        </BaseDrawer.Popup>
      </BaseDrawer.Viewport>
    </BaseDrawer.Portal>
  )
}

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
      className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), className)}
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
