import { Toast as BaseToast } from '@base-ui/react/toast'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { dialogs } from '../core/messages/dialogs'
import { useMessages } from '../core/messages/use-messages'
import { buttonVariants } from './button'

/**
 * The `ToastViewport` cva table: the fixed stack in the bottom-right corner (full width on a
 * phone), portalled and above every popup (`z-60`; popups are `z-50`). No axes.
 *
 * @example
 * toastViewportVariants()
 */
export const toastViewportVariants = cva(
  'fixed right-4 bottom-4 z-60 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 outline-none',
)

/**
 * The `Toast` cva table: a card on the popup surface with a `tone` edge. A toast without a tone is
 * `neutral`.
 *
 * @example
 * toastVariants({ tone: 'bad' })
 */
export const toastVariants = cva(
  'relative flex items-start gap-3 rounded-card border-s-2 bg-popover p-3 text-foreground shadow-overlay transition-[opacity,translate] duration-150 ease-standard data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:translate-y-2 data-ending-style:opacity-0 motion-reduce:transition-none',
  {
    variants: {
      tone: {
        neutral: 'border-s-border',
        good: 'border-s-good',
        warn: 'border-s-warn',
        bad: 'border-s-bad',
        info: 'border-s-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const toastParts = [
  'toast-viewport',
  'toast',
  'toast-title',
  'toast-description',
  'toast-close',
] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`mt-2`). Display belongs to the part. */
  className?: string
}

export type ToastViewportProps = Layout<BaseToast.Viewport.Props>
export type ToastProps = Layout<BaseToast.Root.Props> & VariantProps<typeof toastVariants>
export type ToastTitleProps = Layout<BaseToast.Title.Props>
export type ToastDescriptionProps = Layout<BaseToast.Description.Props>
export type ToastCloseProps = Layout<BaseToast.Close.Props>

/**
 * The live region that holds the toasts, portalled to the page edge above every popup. Named by
 * the `toast.viewport` message. It reads a Base UI toast manager, so it renders inside the
 * `ToastHost` that owns one; apps queue toasts with `notify` and never call the manager.
 *
 * @example
 * <ToastViewport>{toasts.map((toast) => <Toast key={toast.id} toast={toast}>...</Toast>)}</ToastViewport>
 */
export function ToastViewport({ className, ...props }: ToastViewportProps): ReactElement {
  const t = useMessages(dialogs)
  return (
    <BaseToast.Portal>
      <BaseToast.Viewport
        aria-label={t('toast.viewport')}
        {...props}
        data-slot="toast-viewport"
        className={cn(toastViewportVariants(), className)}
      />
    </BaseToast.Portal>
  )
}

/**
 * One toast: the surface with its `tone` edge. Pass the queue's toast object as `toast`.
 *
 * @useWhen a result needs a short, passing note the user can ignore (toast vs inline vs inbox)
 * @neverWhen the message must be read to continue (use `Dialog`) or belongs next to a field (use inline `FieldError`)
 *
 * @example
 * <Toast toast={toast} tone="good"><ToastTitle /><ToastClose /></Toast>
 */
export function Toast({ tone, className, ...props }: ToastProps): ReactElement {
  return (
    <BaseToast.Root
      {...props}
      data-slot="toast"
      className={cn(toastVariants({ tone }), className)}
    />
  )
}

/**
 * The toast's headline; it renders the toast's own title when given no children.
 *
 * @example
 * <ToastTitle />
 */
export function ToastTitle({ className, ...props }: ToastTitleProps): ReactElement {
  return (
    <BaseToast.Title
      {...props}
      data-slot="toast-title"
      className={cn('min-w-0 flex-1 text-sm font-medium', className)}
    />
  )
}

/**
 * The toast's detail line; it renders the toast's own description when given no children.
 *
 * @example
 * <ToastDescription />
 */
export function ToastDescription({ className, ...props }: ToastDescriptionProps): ReactElement {
  return (
    <BaseToast.Description
      {...props}
      data-slot="toast-description"
      className={cn('text-sm text-muted-foreground', className)}
    />
  )
}

/**
 * Dismisses the toast. With no children it is the corner glyph, named by the `toast.dismiss`
 * message.
 *
 * @example
 * <ToastClose />
 */
export function ToastClose({ className, children, ...props }: ToastCloseProps): ReactElement {
  const t = useMessages(dialogs)
  if (children !== undefined) {
    return (
      <BaseToast.Close {...props} data-slot="toast-close" className={cn('focus-ring', className)}>
        {children}
      </BaseToast.Close>
    )
  }
  return (
    <BaseToast.Close
      aria-label={t('toast.dismiss')}
      {...props}
      data-slot="toast-close"
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
    </BaseToast.Close>
  )
}
