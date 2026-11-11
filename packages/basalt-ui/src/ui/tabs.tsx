import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Tabs` cva table: the trigger height every part reads. `md` follows the density control
 * height (`--vx-ctl-h`); `sm` is a fixed 24 px row for tabs inside a card header. A coarse pointer
 * lifts both to the 44 px floor, so a trigger stays a touch target.
 *
 * @example
 * tabsVariants({ size: 'sm' }) // class string for a non-`Tabs` element
 */
export const tabsVariants = cva(
  'flex flex-col gap-3 data-[orientation=vertical]:flex-row [--tabs-h:var(--vx-ctl-h)]',
  {
    variants: {
      size: {
        md: '',
        sm: '[--tabs-h:1.5rem] text-xs',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const tabsParts = ['tabs', 'tabs-list', 'tabs-trigger', 'tabs-content'] as const

type LayoutClass = {
  /** Layout only (`w-full`, `mt-2`, `max-w-md`). Height and display belong to `size`. */
  className?: string
}

export type TabsProps = Omit<BaseTabs.Root.Props, 'className'> &
  VariantProps<typeof tabsVariants> &
  LayoutClass

/**
 * Tabs on Base UI: roving focus (ArrowLeft and ArrowRight in DOM order, Home and End), Enter or
 * Space activates, and the panel is linked by `aria-controls`. Works with no provider and renders
 * no indicator script, so it is safe on a static page.
 *
 * @example
 * <Tabs defaultValue="overview">
 *   <TabsList>
 *     <TabsTrigger value="overview">Overview</TabsTrigger>
 *     <TabsTrigger value="activity">Activity</TabsTrigger>
 *   </TabsList>
 *   <TabsContent value="overview">...</TabsContent>
 *   <TabsContent value="activity">...</TabsContent>
 * </Tabs>
 */
export function Tabs({ size, className, ...props }: TabsProps): ReactElement {
  return (
    <BaseTabs.Root {...props} data-slot="tabs" className={cn(tabsVariants({ size }), className)} />
  )
}

export type TabsListProps = Omit<BaseTabs.List.Props, 'className'> & LayoutClass

/**
 * The row of triggers on a hairline. It scrolls sideways when the triggers outgrow the page, so a
 * narrow phone never widens the document.
 *
 * @example
 * <TabsList aria-label="Report sections"><TabsTrigger value="a">A</TabsTrigger></TabsList>
 */
export function TabsList({ className, ...props }: TabsListProps): ReactElement {
  return (
    <BaseTabs.List
      {...props}
      data-slot="tabs-list"
      className={cn(
        'flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[orientation=vertical]:overflow-x-visible data-[orientation=vertical]:border-r data-[orientation=vertical]:border-b-0',
        className,
      )}
    />
  )
}

export type TabsTriggerProps = Omit<BaseTabs.Tab.Props, 'className'> & LayoutClass

/**
 * One tab. The active tab takes the ink colour and a brand underline; a disabled tab stays
 * reachable by the arrow keys (it cannot be activated), as the WAI-ARIA tabs pattern asks.
 *
 * @example
 * <TabsTrigger value="activity">Activity</TabsTrigger>
 */
export function TabsTrigger({ className, ...props }: TabsTriggerProps): ReactElement {
  return (
    <BaseTabs.Tab
      {...props}
      data-slot="tabs-trigger"
      className={cn(
        'relative -mb-px inline-flex h-(--tabs-h) shrink-0 cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-3 font-medium whitespace-nowrap text-muted-foreground select-none focus-ring transition-colors hover:text-foreground data-active:border-brand data-active:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-[orientation=vertical]:mr-[-1px] data-[orientation=vertical]:mb-0 data-[orientation=vertical]:justify-start data-[orientation=vertical]:border-r-2 data-[orientation=vertical]:border-b-0 pointer-coarse:min-h-11 motion-reduce:transition-none',
        className,
      )}
    />
  )
}

export type TabsContentProps = Omit<BaseTabs.Panel.Props, 'className'> & LayoutClass

/**
 * The panel of one tab. Only the active panel is mounted unless `keepMounted` is set, which keeps
 * the state of a form or a scroll position across tab switches.
 *
 * @example
 * <TabsContent value="activity" keepMounted>...</TabsContent>
 */
export function TabsContent({ className, ...props }: TabsContentProps): ReactElement {
  return (
    <BaseTabs.Panel
      {...props}
      data-slot="tabs-content"
      className={cn('min-w-0 flex-1 focus-ring', className)}
    />
  )
}
