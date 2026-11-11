import { Collapsible as BaseCollapsible } from '@base-ui/react/collapsible'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const collapsibleParts = [
  'collapsible',
  'collapsible-trigger',
  'collapsible-content',
] as const

type LayoutClass = {
  /** Layout only (`w-full`, `mt-2`). */
  className?: string
}

export type CollapsibleProps = Omit<BaseCollapsible.Root.Props, 'className'> & LayoutClass

/**
 * One show and hide region on Base UI, controlled with `open` or left to `defaultOpen`. Works with
 * no provider. For a list of sections that belong together use `Accordion`.
 *
 * @example
 * <Collapsible>
 *   <CollapsibleTrigger>Advanced options</CollapsibleTrigger>
 *   <CollapsibleContent>...</CollapsibleContent>
 * </Collapsible>
 */
export function Collapsible({ className, ...props }: CollapsibleProps): ReactElement {
  return <BaseCollapsible.Root {...props} data-slot="collapsible" className={className} />
}

export type CollapsibleTriggerProps = Omit<BaseCollapsible.Trigger.Props, 'className'> & LayoutClass

/**
 * The button that toggles the region. It has no look of its own: it owns focus and the pointer-tier
 * hit floor, and the caller styles the content (or passes a `Button` through `render`).
 *
 * @example
 * <CollapsibleTrigger className="text-sm font-medium">Advanced options</CollapsibleTrigger>
 */
export function CollapsibleTrigger({ className, ...props }: CollapsibleTriggerProps): ReactElement {
  return (
    <BaseCollapsible.Trigger
      {...props}
      data-slot="collapsible-trigger"
      className={cn(
        'relative cursor-pointer rounded-ctrl focus-ring data-disabled:pointer-events-none data-disabled:opacity-50 after:absolute after:inset-x-0 after:top-1/2 after:h-full after:min-h-6 after:-translate-y-1/2 pointer-coarse:after:min-h-11',
        className,
      )}
    />
  )
}

export type CollapsibleContentProps = Omit<BaseCollapsible.Panel.Props, 'className'> & LayoutClass

/**
 * The region. It animates its height from the measured content and skips the animation under
 * reduced motion. `hiddenUntilFound` lets the browser's find in page open it on a match;
 * `keepMounted` keeps it in the DOM while closed so inner state survives.
 *
 * @example
 * <CollapsibleContent hiddenUntilFound>Standard shipping takes 3 to 5 days.</CollapsibleContent>
 */
export function CollapsibleContent({ className, ...props }: CollapsibleContentProps): ReactElement {
  return (
    <BaseCollapsible.Panel
      {...props}
      data-slot="collapsible-content"
      className={cn(
        'h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 ease-standard motion-reduce:transition-none [&[hidden]:not([hidden="until-found"])]:hidden data-ending-style:h-0 data-starting-style:h-0',
        className,
      )}
    />
  )
}
