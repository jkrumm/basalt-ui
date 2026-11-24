import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog'
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { ControlScopeProvider } from '../core/control-scope'
import { dialogs } from '../core/messages/dialogs'
import { useMessages } from '../core/messages/use-messages'
import type { IconComponent } from '../core/ports'
import { Button, buttonVariants } from './button'
import { useSheetPresent } from './overlay-presenter'
import type { OverlayPresent } from './overlay-presenter'

/**
 * The `DialogContent` cva table: a centered panel on the popup surface, always above the page
 * (`z-50` is on the viewport that holds it). `size` sets the width; the height follows the content
 * and scrolls past the viewport. `wide` (64 rem) holds a wide form or a document viewer; `split` is
 * the wizard panel: 68.75 rem by 43.75 rem, no padding, its panes fill it. Every size is capped by
 * the viewport.
 *
 * @example
 * dialogContentVariants({ size: 'lg' }) // class string for a hand-built popup
 */
export const dialogContentVariants = cva(
  'relative flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-4 overflow-y-auto rounded-card bg-popover p-4 text-foreground shadow-overlay outline-none transition-[opacity,scale] duration-fast ease-enter data-ending-style:ease-exit data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none',
  {
    variants: {
      size: {
        sm: 'max-w-sm',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        wide: 'max-w-5xl',
        split: 'h-175 max-w-275 gap-0 overflow-hidden p-0',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/**
 * The `AlertDialogContent` cva table: the `sm` panel of `DialogContent`, which a confirmation never
 * outgrows. No axes.
 *
 * @example
 * alertDialogContentVariants()
 */
export const alertDialogContentVariants = cva(
  'relative flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-card bg-popover p-4 text-foreground shadow-overlay outline-none transition-[opacity,scale] duration-fast ease-enter data-ending-style:ease-exit data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const dialogParts = [
  'dialog-trigger',
  'dialog-content',
  'dialog-title',
  'dialog-description',
  'dialog-close',
  'alert-dialog-trigger',
  'alert-dialog-content',
] as const

const BACKDROP_BASE =
  'fixed inset-0 z-50 transition-opacity duration-fast data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none'
/** A `Dialog` leaves the page readable behind it: the canvas at half strength. */
const WASH = `${BACKDROP_BASE} bg-scrim-wash`
/** An `AlertDialog` asks for an answer: the strong scrim. */
const SCRIM = `${BACKDROP_BASE} bg-scrim`
const VIEWPORT =
  'fixed inset-0 z-50 grid place-items-center overflow-hidden p-4 data-ending-style:pointer-events-none'
/** The phone's form: the panel rises from the bottom edge, nearly the full height. */
const SHEET_VIEWPORT =
  'fixed inset-0 z-50 flex items-end overflow-hidden data-ending-style:pointer-events-none'
const SHEET_POPUP =
  'relative flex h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full max-w-none flex-col gap-4 overflow-y-auto rounded-t-card bg-popover p-4 pr-[calc(1rem+env(safe-area-inset-right))] pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] text-foreground shadow-overlay outline-none transition-transform duration-slow ease-standard data-ending-style:translate-y-full data-starting-style:translate-y-full motion-reduce:transition-none'

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-full`, `mt-2`). Display and height belong to the part. */
  className?: string
}

/** The name and the optional lead-in every dialog panel starts with. */
type Heading = {
  /** The accessible name and the visible heading. Required: a dialog without one fails to type-check. */
  title: ReactNode
  /** One sentence under the title; it also describes the dialog to assistive tech. */
  description?: ReactNode
}

export type DialogProps = BaseDialog.Root.Props
export type DialogTriggerProps = Layout<BaseDialog.Trigger.Props>
/** One typed action of a viewer's header: an icon button named by its `label`. */
export type DialogAction = {
  /** The accessible name and the tooltip. */
  label: string
  /** Any component with the `IconComponent` shape (`icon={Download}`). */
  icon: IconComponent
  onClick: () => void
  /** `danger` for a destructive action such as delete. Default `default`. */
  tone?: 'default' | 'danger'
}

export type DialogContentProps = Layout<Omit<BaseDialog.Popup.Props, 'title'>> &
  Heading &
  VariantProps<typeof dialogContentVariants> & {
    /** A muted line under the title, such as a file's size and date. Not rendered at `size="split"`. */
    meta?: ReactNode
    /** Icon actions between the title and the close, at most four. Not rendered at `size="split"`. */
    actions?: readonly DialogAction[]
    /**
     * The panel holds a form (or, at `size="split"`, the wizard): on a phone (compact width,
     * coarse pointer) it opens as a full-height sheet from the bottom instead of centred. A confirm
     * stays centred. `present` overrides.
     */
    form?: boolean
    /** Forces the presentation: `popup` centred, `sheet` full height from the bottom, `auto` by `form` and the viewport. */
    present?: OverlayPresent
  }
export type DialogTitleProps = Layout<BaseDialog.Title.Props>
export type DialogDescriptionProps = Layout<BaseDialog.Description.Props>
export type DialogCloseProps = Layout<BaseDialog.Close.Props>
export type AlertDialogProps = BaseAlertDialog.Root.Props
export type AlertDialogTriggerProps = Layout<BaseAlertDialog.Trigger.Props>
export type AlertDialogContentProps = Layout<Omit<BaseAlertDialog.Popup.Props, 'title'>> & Heading

/**
 * A modal dialog on Base UI: focus is trapped, Escape and the corner close dismiss it, and it is
 * always portalled above the page. Open state stays with the caller (`open`/`onOpenChange`) or the
 * trigger. Works with no provider.
 *
 * @useWhen a modal decision or a short form interrupts the page; a destructive confirm is `AlertDialog` (modal decision: `Dialog`, edit beside the page: `Sheet`, name an icon: `Tooltip`, anywhere else: `Popover`)
 * @neverWhen the content is a long edit beside the page (use `Sheet`) or a hint on a trigger (use `Popover` or `Tooltip`)
 *
 * @example
 * <Dialog>
 *   <DialogTrigger render={<Button />}>Rename</DialogTrigger>
 *   <DialogContent title="Rename project" description="Shown in the sidebar.">
 *     <Input aria-label="Name" />
 *   </DialogContent>
 * </Dialog>
 */
export function Dialog(props: DialogProps): ReactElement {
  return <BaseDialog.Root {...props} />
}

/**
 * The element that opens a `Dialog`. It carries no look of its own: pass `render={<Button />}`.
 *
 * @example
 * <DialogTrigger render={<Button />}>Open</DialogTrigger>
 */
export function DialogTrigger({ className, ...props }: DialogTriggerProps): ReactElement {
  return (
    <BaseDialog.Trigger
      {...props}
      data-slot="dialog-trigger"
      className={cn('focus-ring', className)}
    />
  )
}

/**
 * The dialog panel with its backdrop, a light wash of the canvas so the page stays readable behind
 * it. `title` is required and names the dialog; `description` is optional. The corner close button
 * is part of the panel and named by the `dialog.close` message. A viewer adds `meta` (a muted line)
 * and `actions` (icon buttons) to the header. `size="split"` is the wizard panel: no header and no
 * padding, the title and description are read by assistive tech only, and the children (a
 * `WizardDialog`) draw their own top bar with a `DialogClose`.
 *
 * @example
 * <DialogContent title="Delete project" size="sm">Body</DialogContent>
 */
export function DialogContent({
  title,
  description,
  meta,
  actions,
  size,
  form,
  present,
  className,
  children,
  ...props
}: DialogContentProps): ReactElement {
  const split = size === 'split'
  const sheet = useSheetPresent(present ?? (form === true || split ? 'auto' : 'popup'))
  return (
    <ControlScopeProvider value={null}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop forceRender className={WASH} />
        <BaseDialog.Viewport className={sheet ? SHEET_VIEWPORT : VIEWPORT}>
          <BaseDialog.Popup
            {...props}
            data-slot="dialog-content"
            {...(sheet && { 'data-present': 'sheet' })}
            className={cn(
              sheet
                ? cn(SHEET_POPUP, split && 'gap-0 overflow-hidden p-0')
                : dialogContentVariants({ size }),
              className,
            )}
          >
            {split ? (
              <>
                <DialogTitle className="sr-only">{title}</DialogTitle>
                {description === undefined ? null : (
                  <DialogDescription className="sr-only">{description}</DialogDescription>
                )}
              </>
            ) : (
              <header className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <DialogTitle>{title}</DialogTitle>
                  {description === undefined ? null : (
                    <DialogDescription>{description}</DialogDescription>
                  )}
                  {meta === undefined ? null : (
                    <p className="m-0 text-xs text-muted-foreground">{meta}</p>
                  )}
                </div>
                {actions === undefined ? null : (
                  <div className="flex shrink-0 items-center gap-1">
                    {actions.map((action) => (
                      <HeaderAction key={action.label} action={action} />
                    ))}
                  </div>
                )}
                <DialogClose />
              </header>
            )}
            {children}
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </ControlScopeProvider>
  )
}

function HeaderAction({ action }: { action: DialogAction }): ReactElement {
  const Icon = action.icon
  return (
    <Button
      variant={action.tone === 'danger' ? 'danger' : 'ghost'}
      size="sm"
      shape="icon"
      aria-label={action.label}
      title={action.label}
      onClick={action.onClick}
    >
      <Icon className="size-icon" aria-hidden="true" />
    </Button>
  )
}

/**
 * The dialog's heading. `DialogContent` renders it from its `title`; use it directly only inside
 * a hand-built popup.
 *
 * @example
 * <DialogTitle>Rename project</DialogTitle>
 */
export function DialogTitle({ className, ...props }: DialogTitleProps): ReactElement {
  return (
    <BaseDialog.Title
      {...props}
      data-slot="dialog-title"
      className={cn('text-base font-medium text-foreground', className)}
    />
  )
}

/**
 * The dialog's lead-in sentence. `DialogContent` renders it from its `description`.
 *
 * @example
 * <DialogDescription>Shown in the sidebar.</DialogDescription>
 */
export function DialogDescription({ className, ...props }: DialogDescriptionProps): ReactElement {
  return (
    <BaseDialog.Description
      {...props}
      data-slot="dialog-description"
      className={cn('text-sm text-muted-foreground', className)}
    />
  )
}

/**
 * Closes the dialog. With no children it is the corner glyph, named by the `dialog.close` message;
 * with children it is a bare close trigger: pass `render={<Button />}` for a Cancel button.
 *
 * @example
 * <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
 */
export function DialogClose({ className, children, ...props }: DialogCloseProps): ReactElement {
  const t = useMessages(dialogs)
  if (children !== undefined) {
    return (
      <BaseDialog.Close {...props} data-slot="dialog-close" className={cn('focus-ring', className)}>
        {children}
      </BaseDialog.Close>
    )
  }
  return (
    <BaseDialog.Close
      aria-label={t('dialog.close')}
      {...props}
      data-slot="dialog-close"
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
    </BaseDialog.Close>
  )
}

/**
 * A confirmation that needs an explicit answer: it has no corner close and an outside click does
 * not dismiss it. Use it for a destructive confirm; otherwise use `Dialog`.
 *
 * @example
 * <AlertDialog>
 *   <AlertDialogTrigger render={<Button variant="danger" />}>Delete</AlertDialogTrigger>
 *   <AlertDialogContent title="Delete project?" description="This cannot be undone.">
 *     <DialogClose render={<Button variant="danger" />}>Delete</DialogClose>
 *   </AlertDialogContent>
 * </AlertDialog>
 */
export function AlertDialog(props: AlertDialogProps): ReactElement {
  return <BaseAlertDialog.Root {...props} />
}

/**
 * The element that opens an `AlertDialog`. It carries no look of its own: pass `render`.
 *
 * @example
 * <AlertDialogTrigger render={<Button variant="danger" />}>Delete</AlertDialogTrigger>
 */
export function AlertDialogTrigger({ className, ...props }: AlertDialogTriggerProps): ReactElement {
  return (
    <BaseAlertDialog.Trigger
      {...props}
      data-slot="alert-dialog-trigger"
      className={cn('focus-ring', className)}
    />
  )
}

/**
 * The alert panel: required `title`, optional `description`, and the answers as children (each a
 * `DialogClose`).
 *
 * @example
 * <AlertDialogContent title="Delete project?">...</AlertDialogContent>
 */
export function AlertDialogContent({
  title,
  description,
  className,
  children,
  ...props
}: AlertDialogContentProps): ReactElement {
  return (
    <ControlScopeProvider value={null}>
      <BaseAlertDialog.Portal>
        <BaseAlertDialog.Backdrop forceRender className={SCRIM} />
        <BaseAlertDialog.Viewport className={VIEWPORT}>
          <BaseAlertDialog.Popup
            {...props}
            data-slot="alert-dialog-content"
            className={cn(alertDialogContentVariants(), className)}
          >
            <div className="flex flex-col gap-1">
              <DialogTitle>{title}</DialogTitle>
              {description === undefined ? null : (
                <DialogDescription>{description}</DialogDescription>
              )}
            </div>
            {children === undefined ? null : (
              <div className="flex justify-end gap-2">{children}</div>
            )}
          </BaseAlertDialog.Popup>
        </BaseAlertDialog.Viewport>
      </BaseAlertDialog.Portal>
    </ControlScopeProvider>
  )
}
