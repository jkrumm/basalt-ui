import { Popover as BasePopover } from '@base-ui/react/popover'
import { cva } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `PopoverContent` cva table: a floating panel on the popup surface, 288 px wide unless a width
 * class on `className` says otherwise, never wider or taller than the room the browser leaves
 * (`--available-width`, `--available-height`). It grows from the trigger.
 *
 * @example
 * popoverContentVariants() // class string for a hand-built popup
 */
export const popoverContentVariants = cva(
  'max-h-(--available-height) w-72 max-w-(--available-width) origin-(--transform-origin) overflow-y-auto rounded-ctrl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-overlay outline-none transition-[opacity,scale] duration-150 ease-standard data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none',
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

export type PopoverProps = BasePopover.Root.Props
export type PopoverTriggerProps = Layout<BasePopover.Trigger.Props>
export type PopoverContentProps = Layout<BasePopover.Popup.Props> &
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
export function Popover(props: PopoverProps): ReactElement {
  return <BasePopover.Root {...props} />
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
  return (
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
          data-slot="popover-content"
          className={cn(popoverContentVariants(), className)}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}
