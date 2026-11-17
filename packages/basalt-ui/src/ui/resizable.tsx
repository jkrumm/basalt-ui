import { Group, Panel, Separator } from 'react-resizable-panels'
import type { GroupProps, PanelProps, SeparatorProps } from 'react-resizable-panels'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const resizableParts = [
  'resizable-panel-group',
  'resizable-panel',
  'resizable-handle',
] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`h-96`, `border`). The part owns the flex axis, the overflow and the divider. */
  className?: string
}

export type ResizablePanelGroupProps = Layout<GroupProps>
export type ResizablePanelProps = Layout<PanelProps>
export type ResizableHandleProps = Layout<SeparatorProps> & {
  /** Draws a small grip on the divider, for a split a reader may not know can be dragged. */
  grip?: boolean
}

/**
 * Panels side by side (`orientation="horizontal"`, the default) or stacked (`"vertical"`) with a
 * draggable, keyboard-reachable divider between each pair, on `react-resizable-panels`. It fills its
 * parent (100% wide and high), so give the parent a height. Sizes are percentages of the group; a
 * bare number is px and a `"20rem"` string is its unit. Nothing is persisted: the app passes
 * `defaultLayout` and saves in `onLayoutChanged`, which is also what keeps a server render from
 * shifting (percent sizes are rendered as `flex-grow` ratios).
 *
 * @useWhen two or more regions share one box and the reader should choose how much room each gets (a list and its detail, an editor and its output)
 * @neverWhen a panel only appears over the page without sharing it (a `Peek` or a `Sheet`), or its width is fixed (a plain flex row)
 *
 * @example
 * <ResizablePanelGroup orientation="horizontal" className="h-96">
 *   <ResizablePanel id="list" minSize="20%" defaultSize="35%"><List /></ResizablePanel>
 *   <ResizableHandle />
 *   <ResizablePanel id="detail"><Detail /></ResizablePanel>
 * </ResizablePanelGroup>
 */
export function ResizablePanelGroup(props: ResizablePanelGroupProps): ReactElement {
  return <Group data-slot="resizable-panel-group" {...props} />
}

/**
 * One region of a `ResizablePanelGroup`. It clips its content instead of scrolling it, so the page
 * keeps one scrollport: put a `ScrollArea` inside when the content is longer than the panel (the
 * library's own default would draw a second scrollbar). `minSize`, `maxSize`, `defaultSize` and
 * `collapsible` take the library's units; give every panel an `id` when a layout is saved.
 *
 * @useWhen a region inside a `ResizablePanelGroup` needs a size, a minimum or a collapsed state
 * @neverWhen the region sits outside a `ResizablePanelGroup`
 *
 * @example
 * <ResizablePanel id="detail" minSize="30%"><Detail /></ResizablePanel>
 */
export function ResizablePanel({ style, ...rest }: ResizablePanelProps): ReactElement {
  return <Panel data-slot="resizable-panel" style={{ overflow: 'clip', ...style }} {...rest} />
}

const GRIP =
  'z-10 shrink-0 rounded-full bg-faint group-aria-[orientation=vertical]/handle:h-6 group-aria-[orientation=vertical]/handle:w-1 group-aria-[orientation=horizontal]/handle:h-1 group-aria-[orientation=horizontal]/handle:w-6'

/**
 * The divider between two panels: a hairline that turns brand on hover, while it is dragged and on
 * keyboard focus. It is a `role="separator"` the reader can focus; ArrowLeft and ArrowRight (ArrowUp
 * and ArrowDown in a vertical group) move it 5% of the group, Home and End go to the panel's
 * minimum and maximum. The pointer target is larger than the line (10px, 20px on touch).
 *
 * @useWhen two `ResizablePanel`s sit next to each other in a `ResizablePanelGroup`
 * @neverWhen it is a static hairline between content (use `Separator`)
 *
 * @example
 * <ResizableHandle grip />
 */
export function ResizableHandle({
  className,
  grip,
  children,
  ...rest
}: ResizableHandleProps): ReactElement {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'group/handle relative flex shrink-0 items-center justify-center bg-border outline-none focus-ring',
        'aria-[orientation=vertical]:w-px aria-[orientation=horizontal]:h-px',
        'transition-colors motion-reduce:transition-none data-[separator=hover]:bg-brand data-[separator=active]:bg-brand focus-visible:bg-brand',
        className,
      )}
      {...rest}
    >
      {children ?? (grip === true ? <span aria-hidden="true" className={GRIP} /> : null)}
    </Separator>
  )
}
