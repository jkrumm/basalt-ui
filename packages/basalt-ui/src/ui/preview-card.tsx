import { PreviewCard as BasePreviewCard } from '@base-ui/react/preview-card'
import { createContext, useContext, useState } from 'react'
import type { PointerEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { ControlScopeProvider } from '../core/control-scope'
import { POPUP_POSITIONER, POPUP_POSITIONER_CLASS } from '../core/popup-position'
import { popoverContentVariants } from './popover'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const previewCardParts = ['preview-card-trigger', 'preview-card-content'] as const

/**
 * The attribute a trigger carries between a touch press and its click while its card is closed: the
 * first tap shows the card, so a document-level click handler (`usePeek`) leaves that click alone.
 */
const FIRST_TAP = 'data-preview-first-tap'

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-80`, `mt-2`). Height, display and stacking belong to the part. */
  className?: string
}

type Control = { open: boolean; set: (open: boolean) => void }

const ControlContext = createContext<Control | null>(null)

/** Where the card sits against its link. Collisions flip it; the card never leaves the screen. */
export type PreviewCardPlacement = Pick<
  BasePreviewCard.Positioner.Props,
  'anchor' | 'side' | 'align' | 'sideOffset' | 'alignOffset'
>

export type PreviewCardProps = {
  /** Controlled open state; pair it with `onOpenChange`. */
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}
export type PreviewCardTriggerProps = Layout<BasePreviewCard.Trigger.Props>
export type PreviewCardContentProps = Layout<BasePreviewCard.Popup.Props> &
  PreviewCardPlacement & {
    /** Where the card renders. Default `document.body`. */
    container?: BasePreviewCard.Portal.Props['container']
  }

/**
 * A rich card on a link, on Base UI: the card opens beside the link on mouse hover and on keyboard
 * focus, and on a first touch tap (the second tap follows the link); Escape, leaving, blur and an
 * outside press close it. It is always portalled above the page and works with no provider.
 *
 * It is a sighted shortcut to what the link opens: the card is not announced, so nothing may live
 * only in it, and it holds no interactive content. A word whose card should be read (a definition)
 * is an `InfoHint`; content that needs a press is a `Popover`; one line naming an icon is a `Tooltip`.
 * One declaration of a record feeds both this card and a `Peek`: `recordAt(kinds, href)` from
 * `basalt-ui/router` names the record a link points at.
 *
 * @useWhen a link to a record or a page should show a summary of it on hover, focus and tap, before it is followed
 * @neverWhen the content is a definition of a word (use `InfoHint`), a form or actions (use `Popover`) or a one-line label (use `Tooltip`)
 *
 * @example
 * <PreviewCard>
 *   <PreviewCardTrigger href="/issues/12">#12</PreviewCardTrigger>
 *   <PreviewCardContent>Retry the deploy. Open, owner unassigned.</PreviewCardContent>
 * </PreviewCard>
 */
export function PreviewCard({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: PreviewCardProps): ReactElement {
  const [inner, setInner] = useState(defaultOpen)
  const open = openProp ?? inner
  const set = (next: boolean): void => {
    setInner(next)
    onOpenChange?.(next)
  }
  return (
    <ControlContext value={{ open, set }}>
      <BasePreviewCard.Root open={open} onOpenChange={set}>
        {children}
      </BasePreviewCard.Root>
    </ControlContext>
  )
}

const touchLike = (event: PointerEvent): boolean => event.pointerType !== 'mouse'

/**
 * The link the card hangs off: an `<a>` that carries no look of its own, so give it the app's link
 * class. `delay` and `closeDelay` (ms) set the hover timing. A touch tap on it opens the card
 * instead of following the link; a tap while the card is open follows it, as does a click, Enter or
 * a press with a mouse, which also closes the card.
 *
 * @example
 * <PreviewCardTrigger href="/issues/12" delay={300}>#12</PreviewCardTrigger>
 */
export function PreviewCardTrigger({
  className,
  onPointerDown,
  onPointerCancel,
  onClick,
  ...props
}: PreviewCardTriggerProps): ReactElement {
  const control = useContext(ControlContext)
  return (
    <BasePreviewCard.Trigger
      {...props}
      data-slot="preview-card-trigger"
      className={cn('focus-ring rounded-chip', className)}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        if (control === null || control.open || !touchLike(event)) return
        event.currentTarget.setAttribute(FIRST_TAP, '')
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event)
        event.currentTarget.removeAttribute(FIRST_TAP)
      }}
      onClick={(event) => {
        onClick?.(event)
        const first = event.currentTarget.hasAttribute(FIRST_TAP)
        event.currentTarget.removeAttribute(FIRST_TAP)
        if (control === null || event.defaultPrevented) return
        if (!first) {
          if (control.open) control.set(false)
          return
        }
        event.preventDefault()
        control.set(true)
      }}
    />
  )
}

/**
 * The card, portalled and positioned by Base UI on the popup surface. It takes the summary: a few
 * lines of text and facts, no buttons or links, since a touch or keyboard user may never see it.
 *
 * @example
 * <PreviewCardContent side="bottom" align="start">Retry the deploy.</PreviewCardContent>
 */
export function PreviewCardContent({
  anchor,
  side,
  align,
  sideOffset = 6,
  alignOffset,
  container,
  className,
  children,
  ...props
}: PreviewCardContentProps): ReactElement {
  return (
    <ControlScopeProvider value={null}>
      <BasePreviewCard.Portal {...(container !== undefined && { container })}>
        <BasePreviewCard.Positioner
          {...(anchor !== undefined && { anchor })}
          {...(side !== undefined && { side })}
          {...(align !== undefined && { align })}
          {...(alignOffset !== undefined && { alignOffset })}
          {...POPUP_POSITIONER}
          sideOffset={sideOffset}
          className={POPUP_POSITIONER_CLASS}
        >
          <BasePreviewCard.Popup
            {...props}
            data-slot="preview-card-content"
            className={cn(popoverContentVariants(), className)}
          >
            {children}
          </BasePreviewCard.Popup>
        </BasePreviewCard.Positioner>
      </BasePreviewCard.Portal>
    </ControlScopeProvider>
  )
}
