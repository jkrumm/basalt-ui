import { Toolbar as BaseToolbar } from '@base-ui/react/toolbar'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { buttonVariants } from './button'

/**
 * The `Toolbar` cva table: one row of controls at control height that wraps instead of overflowing.
 * Heights come from the density tokens, the same ones `ui/button` reads, so a `Select` trigger, a
 * `Segmented` and a `ToolbarButton` share a baseline.
 *
 * @example
 * toolbarVariants() // class string for a non-`Toolbar` element
 */
export const toolbarVariants = cva('flex min-h-ctl flex-wrap items-center gap-2')

/**
 * The `ToolbarGroup` cva table: controls that belong together, exactly one `ui/button` high (the
 * coarse-pointer floor included) so a group never makes the row taller than a lone button.
 *
 * @example
 * toolbarGroupVariants()
 */
export const toolbarGroupVariants = cva(
  'inline-flex h-ctl items-center gap-1 pointer-coarse:min-h-11',
)

/**
 * The `ToolbarSeparator` cva table: a vertical hairline between groups, shorter than the row.
 *
 * @example
 * toolbarSeparatorVariants()
 */
export const toolbarSeparatorVariants = cva('mx-1 h-5 w-px shrink-0 self-center bg-border')

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const toolbarParts = [
  'toolbar',
  'toolbar-group',
  'toolbar-button',
  'toolbar-separator',
] as const

/** The accessible name a toolbar must carry: a label, or the id of one. */
export type ToolbarName = { 'aria-label': string } | { 'aria-labelledby': string }

export type ToolbarProps = Omit<BaseToolbar.Root.Props, 'className'> &
  ToolbarName & {
    /** Layout only (`w-full`, `justify-between`). Height belongs to the part. */
    className?: string
  }

/**
 * A row of controls with roving focus: Tab enters the row once, the arrow keys move between its
 * controls (a button, a `Segmented`, a `Select` trigger through `ToolbarButton render`). Works
 * with no provider.
 *
 * @example
 * <Toolbar aria-label="View">
 *   <ToolbarGroup aria-label="Zoom"><ToolbarButton size="icon" aria-label="Zoom in">+</ToolbarButton></ToolbarGroup>
 *   <ToolbarSeparator />
 *   <ToolbarButton>Export</ToolbarButton>
 * </Toolbar>
 */
export function Toolbar({ className, ...props }: ToolbarProps): ReactElement {
  return (
    <BaseToolbar.Root {...props} data-slot="toolbar" className={cn(toolbarVariants(), className)} />
  )
}

export type ToolbarGroupProps = Omit<BaseToolbar.Group.Props, 'className'> & {
  /** Layout only (`ml-auto`). Height belongs to the part. */
  className?: string
}

/**
 * Controls that belong together, `role="group"` at the height of a `Button`. Name it with
 * `aria-label` when the group has meaning of its own.
 *
 * @example
 * <ToolbarGroup aria-label="Align"><ToolbarButton>Left</ToolbarButton><ToolbarButton>Right</ToolbarButton></ToolbarGroup>
 */
export function ToolbarGroup({ className, ...props }: ToolbarGroupProps): ReactElement {
  return (
    <BaseToolbar.Group
      {...props}
      data-slot="toolbar-group"
      className={cn(toolbarGroupVariants(), className)}
    />
  )
}

type ButtonAxes = VariantProps<typeof buttonVariants>
type IconSize = 'icon' | 'icon-sm'

export type ToolbarButtonProps = Omit<BaseToolbar.Button.Props, 'className'> &
  Omit<ButtonAxes, 'size'> & {
    /** Layout only (`ml-auto`). Height and display belong to `size`. */
    className?: string
  } & (
    | { size?: Exclude<ButtonAxes['size'], IconSize> }
    // An icon-only button has no text to name it, so the name is required by type.
    | { size: IconSize; 'aria-label': string }
  )

/**
 * A button that takes part in the toolbar's roving focus, looking like a `Button` (ghost by
 * default). With `render` it makes another control a roving item and leaves that control its own
 * look: `render={<SelectTrigger aria-label="Zoom" />}`.
 *
 * @example
 * <ToolbarButton onClick={save}>Save</ToolbarButton>
 * <ToolbarButton render={<SelectTrigger aria-label="Zoom">{...}</SelectTrigger>} />
 */
export function ToolbarButton({
  variant = 'ghost',
  size,
  className,
  render,
  ...props
}: ToolbarButtonProps): ReactElement {
  return (
    <BaseToolbar.Button
      {...props}
      render={render}
      data-slot="toolbar-button"
      className={
        render === undefined ? cn(buttonVariants({ variant, size }), className) : className
      }
    />
  )
}

export type ToolbarSeparatorProps = Omit<
  BaseToolbar.Separator.Props,
  'className' | 'orientation'
> & {
  /** Layout only (`mx-2`). */
  className?: string
}

/**
 * A hairline between groups. Its orientation follows the toolbar's, so it needs no prop.
 *
 * @example
 * <ToolbarSeparator />
 */
export function ToolbarSeparator({ className, ...props }: ToolbarSeparatorProps): ReactElement {
  return (
    <BaseToolbar.Separator
      {...props}
      data-slot="toolbar-separator"
      className={cn(toolbarSeparatorVariants(), className)}
    />
  )
}
