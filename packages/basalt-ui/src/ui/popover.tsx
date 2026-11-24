import { Popover as BasePopover } from '@base-ui/react/popover'
import { cva } from 'class-variance-authority'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { ControlScopeProvider } from '../core/control-scope'
import { ListSheet } from './list-sheet'
import {
  OverlayProvider,
  SHEET_LIST_CLASS,
  SHEET_POSITIONER,
  SHEET_POSITIONER_CLASS,
  useOverlay,
  useOverlayRoot,
  useSheetPresent,
} from './overlay-presenter'
import type { OverlayPresent } from './overlay-presenter'

/**
 * The `PopoverContent` cva table: a floating panel on the popup surface, 288 px wide unless a width
 * class on `className` says otherwise, never wider or taller than the room the browser leaves
 * (`--available-width`, `--available-height`). It grows from the trigger.
 *
 * @example
 * popoverContentVariants() // class string for a hand-built popup
 */
export const popoverContentVariants = cva(
  'max-h-(--available-height) w-72 max-w-(--available-width) origin-(--transform-origin) overflow-y-auto rounded-ctrl border border-border bg-popover p-3 text-sm shadow-overlay outline-none transition-[opacity,scale] duration-fast ease-enter data-ending-style:ease-exit data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const popoverParts = ['popover-trigger', 'popover-content'] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-96`, `mt-2`). Height, display and stacking belong to the part. */
  className?: string
}

/** The accessible name a popover panel must carry: a label, or the id of one. */
export type PopoverName = { 'aria-label': string } | { 'aria-labelledby': string }

/** Where the panel sits against its anchor. Collisions flip it; the panel never leaves the screen. */
export type PopoverPlacement = Pick<
  BasePopover.Positioner.Props,
  'anchor' | 'side' | 'align' | 'sideOffset' | 'alignOffset'
>

export type PopoverProps = BasePopover.Root.Props & {
  /**
   * How the panel opens: `auto` keeps it anchored, and on a phone (compact width, coarse pointer)
   * lifts it into a bottom sheet only when it would not fit the viewport; `popup` and `sheet` force one.
   */
  present?: OverlayPresent
}
export type PopoverTriggerProps = Layout<BasePopover.Trigger.Props>
export type PopoverContentProps = Layout<Omit<BasePopover.Popup.Props, 'ref'>> &
  PopoverPlacement &
  PopoverName & {
    /** Where the panel renders. Default `document.body`. */
    container?: BasePopover.Portal.Props['container']
  }

/**
 * A floating panel anchored to its trigger on Base UI: click or Enter opens it, Escape and an
 * outside click close it, focus moves in and returns, and it is always portalled above the page.
 * Open state stays with the caller (`open`/`onOpenChange`) or the trigger. Works with no provider.
 *
 * Which job, which part: a modal decision, `Dialog`; edit beside the page, `Sheet`; name an icon,
 * `Tooltip`; a list of actions, `Menu`; anywhere else, `Popover`. Rich content on hover is
 * `PopoverTrigger openOnHover`: it opens on touch press too, so nothing hides from a phone.
 *
 * @useWhen a panel of any content hangs off one trigger and is not a decision (a filter pill, a rich hover card, a small form)
 * @neverWhen the content is a list of actions (use `Menu`) or a one-line hint on an icon (use `Tooltip`)
 *
 * @example
 * <Popover>
 *   <PopoverTrigger render={<Button />}>Filters</PopoverTrigger>
 *   <PopoverContent aria-label="Filters">...</PopoverContent>
 * </Popover>
 */
export function Popover({
  present = 'auto',
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: PopoverProps): ReactElement {
  const phone = useSheetPresent('auto')
  // `auto` on a phone starts anchored and escalates when the panel does not fit; it resets on close.
  const [grown, setGrown] = useState(false)
  const presenter = useOverlayRoot<
    Parameters<NonNullable<BasePopover.Root.Props['onOpenChange']>>[1]
  >({
    present: present === 'auto' ? (phone && grown ? 'sheet' : 'popup') : present,
    open,
    defaultOpen,
    onOpenChange,
  })
  const isOpen = presenter.overlay.open
  if (!isOpen && grown) setGrown(false)
  const overlay = {
    ...presenter.overlay,
    ...(present === 'auto' && phone && !grown && { escalate: () => setGrown(true) }),
  }
  return (
    <OverlayProvider value={overlay}>
      <BasePopover.Root {...props} {...presenter.root} />
    </OverlayProvider>
  )
}

/**
 * On a phone a panel that scrolls inside its anchored room asks for a sheet: its content is taller
 * than the viewport leaves it. Measured once the popup is positioned.
 */
function escalateWhenClipped(escalate: (() => void) | undefined): (el: HTMLElement | null) => void {
  return (el) => {
    if (el === null || escalate === undefined) return
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (el.scrollHeight > el.clientHeight + 1) escalate()
      }),
    )
  }
}

/**
 * The element that opens a `Popover`. It carries no look of its own: pass `render={<Button />}`.
 * `openOnHover` (with `delay` and `closeDelay`) opens the panel on hover as well as on press.
 *
 * @example
 * <PopoverTrigger render={<Button />} openOnHover>Details</PopoverTrigger>
 */
export function PopoverTrigger({ className, ...props }: PopoverTriggerProps): ReactElement {
  return (
    <BasePopover.Trigger
      {...props}
      data-slot="popover-trigger"
      className={cn('focus-ring', className)}
    />
  )
}

const nameOf = (props: PopoverName): { 'aria-label': string } | { 'aria-labelledby': string } =>
  'aria-label' in props
    ? { 'aria-label': props['aria-label'] }
    : { 'aria-labelledby': props['aria-labelledby'] }

/**
 * The panel, portalled and positioned by Base UI. It must be named: pass `aria-label` or
 * `aria-labelledby`, or a missing name fails to type-check. `finalFocus` and `initialFocus` name
 * where focus goes when it closes and opens.
 *
 * @example
 * <PopoverContent aria-label="Filters" side="bottom" align="start">...</PopoverContent>
 */
export function PopoverContent({
  anchor,
  side,
  align,
  sideOffset = 4,
  alignOffset,
  container,
  className,
  children,
  ...props
}: PopoverContentProps): ReactElement {
  const overlay = useOverlay()
  if (overlay?.sheet === true) {
    return (
      <ListSheet name={nameOf(props)} portal={BasePopover.Portal}>
        <BasePopover.Positioner style={SHEET_POSITIONER} className={SHEET_POSITIONER_CLASS}>
          <BasePopover.Popup
            {...props}
            data-slot="popover-content"
            className={cn(SHEET_LIST_CLASS, 'p-3 text-sm')}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </ListSheet>
    )
  }
  return (
    <ControlScopeProvider value={null}>
      <BasePopover.Portal {...(container !== undefined && { container })}>
        <BasePopover.Positioner
          {...(anchor !== undefined && { anchor })}
          {...(side !== undefined && { side })}
          {...(align !== undefined && { align })}
          {...(alignOffset !== undefined && { alignOffset })}
          sideOffset={sideOffset}
          className="z-50 outline-none"
        >
          <BasePopover.Popup
            {...props}
            ref={escalateWhenClipped(overlay?.escalate)}
            data-slot="popover-content"
            className={cn(popoverContentVariants(), className)}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </ControlScopeProvider>
  )
}
