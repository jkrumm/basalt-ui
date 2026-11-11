import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cva } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Tooltip` cva table: a one-line label on the popup surface, never wider than 20 rem. It is
 * not hoverable and never takes pointer events, so it cannot cover what it names.
 *
 * @example
 * tooltipVariants() // class string for a hand-built popup
 */
export const tooltipVariants = cva(
  'pointer-events-none max-w-xs origin-(--transform-origin) rounded-chip border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-overlay transition-[opacity,scale] duration-150 ease-standard data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 data-instant:transition-none motion-reduce:transition-none',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const tooltipParts = ['tooltip'] as const

export type TooltipProps = Pick<
  BaseTooltip.Root.Props,
  'open' | 'defaultOpen' | 'onOpenChange' | 'disabled'
> &
  Pick<BaseTooltip.Positioner.Props, 'side' | 'align' | 'sideOffset'> & {
    /** The text. A string, so it can never hold anything a touch or screen-reader user cannot reach. */
    label: string
    /** The element the label names; it receives the hover and focus handlers. Give it a visible focus. */
    children: ReactElement
    /** Milliseconds of hover before it opens. Default 600. */
    delay?: number
    /** Milliseconds before it closes once the pointer leaves. Default 0. */
    closeDelay?: number
    /** Layout only (`max-w-sm`). Display and stacking belong to the part. */
    className?: string
  }

/**
 * A short label on a trigger, on Base UI: it opens on hover after `delay` and on keyboard focus at
 * once, closes on Escape, blur or leave, and is always portalled above the page. The label is a
 * string and a visual aid only: it is not the trigger's accessible name, so an icon-only button
 * keeps its own `aria-label`. Works with no provider.
 *
 * Which job, which part: name an icon, `Tooltip`; rich or interactive content on hover or press,
 * `Popover` (`PopoverTrigger openOnHover`); a list of actions, `Menu`; explain a frame, its `info`
 * prop.
 *
 * @useWhen an icon or a clipped value needs a one-line name on hover and focus
 * @neverWhen the content is interactive, longer than a line, or the only place a fact lives (use `Popover`)
 *
 * @example
 * <Tooltip label="Copy link"><Button size="icon" aria-label="Copy link"><LinkIcon /></Button></Tooltip>
 */
export function Tooltip({
  label,
  children,
  delay = 600,
  closeDelay,
  side,
  align,
  sideOffset = 6,
  className,
  ...root
}: TooltipProps): ReactElement {
  return (
    <BaseTooltip.Root {...root}>
      <BaseTooltip.Trigger
        render={children}
        delay={delay}
        {...(closeDelay !== undefined && { closeDelay })}
      />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner
          {...(side !== undefined && { side })}
          {...(align !== undefined && { align })}
          sideOffset={sideOffset}
          className="z-50"
        >
          <BaseTooltip.Popup data-slot="tooltip" className={cn(tooltipVariants(), className)}>
            {label}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}
