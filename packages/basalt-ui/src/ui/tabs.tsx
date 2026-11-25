import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { createContext, use } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { Tone } from '../core/ports'

/**
 * The `Tabs` cva table: the trigger height every part reads. `md` follows the density control
 * height (`--basalt-ctl-h`); `sm` is a fixed 24 px row for tabs inside a card header. A coarse pointer
 * adds a 44 px `::after` hit area around each trigger; the drawn height stays the density's.
 *
 * @example
 * tabsVariants({ size: 'sm' }) // class string for a non-`Tabs` element
 */
export const tabsVariants = cva(
  'flex flex-col gap-3 data-[orientation=vertical]:flex-row [--tabs-h:var(--basalt-ctl-h)]',
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

/** The look the triggers and the list read from their `Tabs`. */
type Look = 'line' | 'segment' | 'pill'
const LookContext = createContext<Look>('line')

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const tabsParts = ['tabs', 'tabs-list', 'tabs-trigger', 'tabs-content'] as const

type LayoutClass = {
  /** Layout only (`w-full`, `mt-2`, `max-w-md`). Height and display belong to `size`. */
  className?: string
}

export type TabsProps = Omit<BaseTabs.Root.Props, 'className'> &
  VariantProps<typeof tabsVariants> &
  LayoutClass & {
    /**
     * `line` (default) is triggers on a hairline with a brand underline: tabs that sit over their
     * panels. `segment` is a tinted track with one raised option, the look of `Segmented`: a view
     * switch that sits beside controls in a band or a header. `pill` is quiet triggers on no track,
     * the active one tinted inside a hairline: the view row of a list page, where a tab carries a
     * count. `segment` and `pill` are horizontal only.
     */
    variant?: Look
  }

/**
 * Tabs on Base UI: roving focus (ArrowLeft and ArrowRight in DOM order, Home and End), Enter or
 * Space activates, and the panel is linked by `aria-controls`. Works with no provider and renders
 * no indicator script, so it is safe on a static page.
 *
 * @useWhen the panels share one page and the reader switches between them in place
 * @neverWhen the choice changes the page (use InnerNav or a route), or it is a view switch of one figure (use Segmented)
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
export function Tabs({ size, variant = 'line', className, ...props }: TabsProps): ReactElement {
  return (
    <LookContext value={variant}>
      <BaseTabs.Root
        {...props}
        data-slot="tabs"
        data-variant={variant}
        className={cn(tabsVariants({ size }), className)}
      />
    </LookContext>
  )
}

export type TabsListProps = Omit<BaseTabs.List.Props, 'className'> & LayoutClass

/**
 * The row of triggers, on a hairline or (`variant="segment"`) in a tinted track. It scrolls sideways
 * when the triggers outgrow the page, so a narrow phone never widens the document.
 *
 * @example
 * <TabsList aria-label="Report sections"><TabsTrigger value="a">A</TabsTrigger></TabsList>
 */
export function TabsList({ className, ...props }: TabsListProps): ReactElement {
  const look = use(LookContext)
  return (
    <BaseTabs.List
      {...props}
      data-slot="tabs-list"
      className={cn(
        // `relative`: the list is its tabs' offset parent, so Base UI's scroll-into-view measures a
        // tab against the list and never scrolls a visible first tab out of view.
        'relative flex shrink-0 items-center overflow-x-auto',
        look === 'segment' && 'gap-0.5 rounded-ctrl bg-accent p-0.5 [scrollbar-width:none]',
        look === 'pill' && 'gap-1 [scrollbar-width:none]',
        look === 'line' &&
          'gap-1 shadow-[inset_0_-1px_0_var(--basalt-hairline)] data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch data-[orientation=vertical]:overflow-x-visible data-[orientation=vertical]:border-r data-[orientation=vertical]:shadow-none',
        className,
      )}
    />
  )
}

const DOT: Record<Tone, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  accent: 'bg-brand',
  neutral: 'bg-muted-foreground',
}

export type TabsTriggerProps = Omit<BaseTabs.Tab.Props, 'className'> &
  LayoutClass & {
    /** A count after the label, in muted tabular figures: how many records the panel holds. */
    count?: number
    /** Draws the count in the bad tone: the tab that needs the reader (overdue, failed). */
    attention?: boolean
    /** A dot in this tone before the label. */
    tone?: Tone
  }

/**
 * One tab. The active tab takes the ink color and a brand underline, or the selected fill when the
 * list is vertical (`segment`: a raised face; `pill`: a tint inside a hairline); a
 * disabled tab stays reachable by the arrow keys (it cannot be activated), as the WAI-ARIA tabs pattern asks.
 * A `count`, an `attention` tone and a `tone` dot draw the badge `PageBar`'s tabs draw, so a tab bar
 * inside a page matches the one in its band.
 *
 * @example
 * <TabsTrigger value="activity" count={12}>Activity</TabsTrigger>
 */
export function TabsTrigger({
  className,
  count,
  attention,
  tone,
  children,
  ...props
}: TabsTriggerProps): ReactElement {
  const look = use(LookContext)
  return (
    <BaseTabs.Tab
      {...props}
      data-slot="tabs-trigger"
      className={cn(
        'relative inline-flex shrink-0 items-center gap-1.5 px-3 font-medium whitespace-nowrap text-muted-foreground select-none focus-ring focus-visible:-outline-offset-2 transition-colors hover:text-foreground data-active:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11 motion-reduce:transition-none',
        look === 'segment' &&
          'h-[calc(var(--tabs-h)-0.25rem)] justify-center rounded-chip data-active:bg-secondary data-active:shadow-raised forced-colors:border forced-colors:border-current forced-colors:data-active:border-2',
        look === 'pill' &&
          'h-(--tabs-h) justify-center rounded-ctrl border border-transparent px-2.5 text-sm hover:bg-accent data-active:border-border data-active:bg-accent forced-colors:data-active:border-current',
        look === 'line' &&
          'h-(--tabs-h) border-b-2 border-transparent data-active:border-brand data-[orientation=vertical]:justify-start data-[orientation=vertical]:rounded-ctrl data-[orientation=vertical]:border-b-0 data-[orientation=vertical]:data-active:bg-selected',
        className,
      )}
    >
      {tone !== undefined && (
        <span
          aria-hidden="true"
          data-badge="dot"
          className={cn('size-1.5 shrink-0 rounded-full', DOT[tone])}
        />
      )}
      {children}
      {count !== undefined && (
        <span
          data-badge="count"
          data-attention={attention === true ? '' : undefined}
          className={cn(
            'text-xs font-normal tabular-nums',
            attention === true ? 'text-bad' : 'text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </BaseTabs.Tab>
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
