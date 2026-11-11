import { Accordion as BaseAccordion } from '@base-ui/react/accordion'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const accordionParts = [
  'accordion',
  'accordion-item',
  'accordion-trigger',
  'accordion-content',
] as const

type LayoutClass = {
  /** Layout only (`w-full`, `max-w-md`, `mt-4`). */
  className?: string
}

export type AccordionProps<Value = unknown> = Omit<BaseAccordion.Root.Props<Value>, 'className'> &
  LayoutClass

/**
 * A stack of disclosure sections on Base UI: one trigger per item, one item open at a time unless
 * `multiple` is set. Works with no provider.
 *
 * `hiddenUntilFound` hides a closed panel with `hidden="until-found"`, so the browser's find in
 * page searches it and opens it on a match (it wins over `keepMounted`). `keepMounted` keeps a
 * closed panel in the DOM, so a form or a scroll position inside it survives a close.
 *
 * @example
 * <Accordion hiddenUntilFound defaultValue={['shipping']}>
 *   <AccordionItem value="shipping">
 *     <AccordionTrigger>Shipping</AccordionTrigger>
 *     <AccordionContent>Standard shipping takes 3 to 5 business days.</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 */
export function Accordion<Value = unknown>({
  className,
  ...props
}: AccordionProps<Value>): ReactElement {
  return (
    <BaseAccordion.Root
      {...props}
      data-slot="accordion"
      className={cn('flex w-full flex-col', className)}
    />
  )
}

export type AccordionItemProps = Omit<BaseAccordion.Item.Props, 'className'> & LayoutClass

/**
 * One section: a trigger and its panel, closed from the next section by a hairline.
 *
 * @example
 * <AccordionItem value="returns">...</AccordionItem>
 */
export function AccordionItem({ className, ...props }: AccordionItemProps): ReactElement {
  return (
    <BaseAccordion.Item
      {...props}
      data-slot="accordion-item"
      className={cn('border-b border-border last:border-b-0', className)}
    />
  )
}

export type AccordionTriggerProps = Omit<BaseAccordion.Trigger.Props, 'className'> & LayoutClass

/**
 * The button that opens an item, inside the item's heading. The chevron turns while the panel is
 * open. A coarse pointer lifts the row to the 44 px floor.
 *
 * @example
 * <AccordionTrigger>Returns</AccordionTrigger>
 */
export function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionTriggerProps): ReactElement {
  return (
    <BaseAccordion.Header className="flex">
      <BaseAccordion.Trigger
        {...props}
        data-slot="accordion-trigger"
        className={cn(
          'group flex min-h-row flex-1 cursor-pointer items-center justify-between gap-3 rounded-ctrl px-2 py-2 text-left text-sm font-medium text-foreground focus-ring transition-colors hover:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11 motion-reduce:transition-none',
          className,
        )}
      >
        {children}
        <svg
          viewBox="0 0 16 16"
          className="size-icon shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180 motion-reduce:transition-none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  )
}

export type AccordionContentProps = Omit<BaseAccordion.Panel.Props, 'className'> & LayoutClass

/**
 * The panel of an item. It animates its height from the measured content and skips the animation
 * under reduced motion. `hiddenUntilFound` and `keepMounted` can be set here per item, or once on
 * `Accordion`.
 *
 * @example
 * <AccordionContent>Items can be returned within 30 days.</AccordionContent>
 */
export function AccordionContent({
  className,
  children,
  ...props
}: AccordionContentProps): ReactElement {
  return (
    <BaseAccordion.Panel
      {...props}
      data-slot="accordion-content"
      className={cn(
        'h-(--accordion-panel-height) overflow-hidden text-sm text-muted-foreground transition-[height] duration-150 ease-standard motion-reduce:transition-none [&[hidden]:not([hidden="until-found"])]:hidden data-ending-style:h-0 data-starting-style:h-0',
        className,
      )}
    >
      <div className="px-2 pb-3">{children}</div>
    </BaseAccordion.Panel>
  )
}
