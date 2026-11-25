import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { ControlScopeProvider, scopeClass, useControlScope } from '../core/control-scope'
import type { ControlScope } from '../core/control-scope'

// Fused edges: each child after the first overlaps its neighbour's border by 1 px and squares the
// corners it shares, so a row of three reads as one control with the outer radius only. A field
// drawn inside a wrapper (`Input` with `start`, `NativeSelect`, `Select`) squares the box inside it too.
const FUSE_X =
  '[&>*:not(:first-child)]:-ms-px [&>*:not(:first-child)]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none [&>:not(:first-child)>*]:rounded-s-none [&>:not(:last-child)>*]:rounded-e-none'
const FUSE_Y =
  '[&>*:not(:first-child)]:-mt-px [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none'
// The stacking order of a fused row: the hovered child above its neighbours, an invalid border above
// that, the focused child and its ring on top, so no neighbour paints over the edge that matters.
const STACK =
  '[&>*:hover]:z-1 [&>[aria-invalid=true]]:z-2 [&>[data-invalid]]:z-2 [&>:has([aria-invalid=true])]:z-2 [&>*:focus-visible]:z-3 [&>:has(:focus-visible)]:z-3'

// A stacked secondary button has only a drop shadow in light, so the one below covers its neighbour's
// edge; a hairline over each fused top edge keeps the buttons apart.
const DIVIDE_Y =
  '[&>*:not(:first-child)]:before:pointer-events-none [&>*:not(:first-child)]:before:absolute [&>*:not(:first-child)]:before:inset-x-0 [&>*:not(:first-child)]:before:top-0 [&>*:not(:first-child)]:before:h-px [&>*:not(:first-child)]:before:bg-border'

/**
 * The `ButtonGroup` cva table: buttons drawn as one, fused edges, the outer corners rounded and a
 * stacking order that keeps a hovered or focused button's edge and ring above its neighbours.
 *
 * @example
 * buttonGroupVariants({ orientation: 'vertical' })
 */
export const buttonGroupVariants = cva(`isolate items-stretch ${STACK}`, {
  variants: {
    // Stacked, every button takes the group's width: an icon button gives up its square for the column.
    orientation: {
      horizontal: `flex-row ${FUSE_X}`,
      vertical: `flex-col ${FUSE_Y} ${DIVIDE_Y} [&>*]:w-auto`,
    },
    fill: { true: 'flex w-full', false: 'inline-flex' },
  },
  defaultVariants: { orientation: 'horizontal', fill: false },
})

/**
 * The `ControlGroup` cva table: different controls on one line as one unit, 2 px apart. Only
 * buttons fuse (`ButtonGroup`); fields keep their own border, so an invalid edge or a focus ring is
 * never shared with a neighbour.
 *
 * @example
 * controlGroupVariants({ fill: true })
 */
export const controlGroupVariants = cva('gap-0.5', {
  variants: {
    orientation: { horizontal: 'flex-row items-center', vertical: 'flex-col items-stretch' },
    fill: { true: 'flex w-full', false: 'inline-flex' },
  },
  defaultVariants: { orientation: 'horizontal', fill: false },
})

/**
 * The `InputGroup` cva table: one field fused with addons outside its edge (a unit, a protocol, a
 * currency select). The field grows; the addons keep their width.
 *
 * @example
 * inputGroupVariants()
 */
export const inputGroupVariants = cva(
  `isolate flex w-full min-w-0 items-stretch ${FUSE_X} ${STACK} [&>*]:shrink-0 [&>:is([data-slot=input],[data-slot=password-input],[data-input-group],[data-slot=number-field],[data-slot=combobox],[data-slot=autocomplete])]:min-w-0 [&>:is([data-slot=input],[data-slot=password-input],[data-input-group],[data-slot=number-field],[data-slot=combobox],[data-slot=autocomplete])]:flex-auto`,
)

/**
 * The `InputAddon` cva table: a text cell on the field's edge, on the inset surface, at control height.
 *
 * @example
 * inputAddonVariants({ size: 'sm' })
 */
export const inputAddonVariants = cva(
  'inline-flex items-center rounded-ctrl border border-input bg-inset text-muted-foreground whitespace-nowrap select-none',
  {
    variants: {
      size: {
        md: 'h-ctl px-3 text-sm',
        sm: 'h-6 px-2 text-xs',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const controlGroupParts = [
  'button-group',
  'control-group',
  'input-group',
  'input-addon',
] as const

/** A group's own axes, else the enclosing group's: a group nested in a group keeps its size. */
function useInherited(
  size: ControlScope['size'],
  variant: ControlScope['variant'],
): Pick<ControlScope, 'size' | 'variant'> {
  const parent = useControlScope()
  return { size: size ?? parent?.size, variant: variant ?? parent?.variant }
}

type GroupAxes = {
  /** Sets every child's `size`; a child's own `size` wins. */
  size?: ControlScope['size']
  /** `vertical` stacks the children. */
  orientation?: 'horizontal' | 'vertical'
  /** The group takes its box's width and every child grows; `className="grow-0"` keeps one at its own width. */
  fill?: boolean
  /** Names the group when it has a meaning of its own ("Text style"). */
  'aria-label'?: string
  'aria-labelledby'?: string
  /** Layout only (`ml-auto`, `max-w-md`). */
  className?: string
  children: ReactNode
}

/** A group is a `<fieldset>`: the native group role, and `disabled` on it disables every child. */
type FieldsetProps = Omit<ComponentPropsWithoutRef<'fieldset'>, 'className' | 'children' | 'role'>
// A fieldset brings a border, padding, a margin and a min-content floor; a group draws none of them.
const FIELDSET = 'm-0 min-w-0 border-0 p-0'

export type ButtonGroupProps = FieldsetProps &
  GroupAxes & {
    /** Sets every button's `variant`; a button's own `variant` wins. */
    variant?: ControlScope['variant']
  }

/**
 * Buttons shown as one: fused edges, the outer corners rounded, in a `<fieldset>`. The group sets
 * `size` and `variant` for its buttons; a button that passes its own keeps it. Tab still visits each
 * button in order; for one tab stop with arrow keys, use `Toolbar`.
 *
 * @useWhen two to five actions on one object that read as one control: previous, today, next; bold, italic, underline
 * @neverWhen the buttons pick one of several values (use Segmented), or they act on different things (space them in a ControlGroup or a Toolbar)
 * @example
 * <ButtonGroup aria-label="Period">
 *   <Button shape="icon" aria-label="Previous"><ChevronLeft /></Button>
 *   <Button>Today</Button>
 *   <Button shape="icon" aria-label="Next"><ChevronRight /></Button>
 * </ButtonGroup>
 */
export function ButtonGroup({
  size,
  variant,
  orientation = 'horizontal',
  fill = false,
  className,
  children,
  ...props
}: ButtonGroupProps): ReactElement {
  const scope = useInherited(size, variant)
  return (
    <fieldset
      {...props}
      data-slot="button-group"
      data-orientation={orientation}
      data-size={scope.size}
      className={cn(FIELDSET, buttonGroupVariants({ orientation, fill }), className)}
    >
      <ControlScopeProvider value={{ ...scope, fill }}>{children}</ControlScopeProvider>
    </fieldset>
  )
}

export type ControlGroupProps = FieldsetProps &
  GroupAxes & {
    /** Sets the `variant` of the buttons in the group; a button's own `variant` wins. */
    variant?: ControlScope['variant']
  }

/**
 * Several different controls on one line as one unit, 2 px apart: a select, an input and a button.
 * The group sets `size` for every child (and `variant` for its buttons); a child that passes its own
 * keeps it. Inside the group a field sizes to its content, and with `fill` every child grows.
 *
 * @useWhen controls that together make one request: a field and the select that scopes it, a search and its submit
 * @neverWhen the controls are filters of a list (use FilterSet), or one field with a unit or a button of its own (use Input start and end, or InputGroup)
 * @example
 * <ControlGroup fill aria-label="Find">
 *   <NativeSelect aria-label="Field" options={FIELDS} className="grow-0" />
 *   <Input aria-label="Query" placeholder="Find filters" />
 *   <Button shape="icon" aria-label="Search"><ArrowRight /></Button>
 * </ControlGroup>
 */
export function ControlGroup({
  size,
  variant,
  orientation = 'horizontal',
  fill = false,
  className,
  children,
  ...props
}: ControlGroupProps): ReactElement {
  const scope = useInherited(size, variant)
  return (
    <fieldset
      {...props}
      data-slot="control-group"
      data-orientation={orientation}
      data-size={scope.size}
      className={cn(FIELDSET, controlGroupVariants({ orientation, fill }), className)}
    >
      <ControlScopeProvider value={{ ...scope, fill }}>{children}</ControlScopeProvider>
    </fieldset>
  )
}

export type InputGroupProps = FieldsetProps & Omit<GroupAxes, 'orientation' | 'fill'>

/**
 * One field fused with addons on its edge: an `InputAddon` with text (`https://`, `EUR`), a
 * `NativeSelect` or a `Button`. The field grows, the addons keep their width; the group sets `size`
 * for all of them. Name the field so it includes the addon's meaning (`aria-label="Price in EUR"`):
 * the addon text is not part of the field's label.
 *
 * @useWhen a field whose value is read with a fixed prefix or suffix outside it, or a unit picked beside it
 * @neverWhen the unit fits inside the field (use Input end), or the controls are separate requests (use ControlGroup)
 * @example
 * <InputGroup>
 *   <InputAddon>https://</InputAddon>
 *   <Input aria-label="Website, without https://" autoComplete="url" />
 * </InputGroup>
 */
export function InputGroup({ size, className, children, ...props }: InputGroupProps): ReactElement {
  const parent = useControlScope()
  const scope = useInherited(size, undefined)
  return (
    <fieldset
      {...props}
      data-slot="input-group"
      data-size={scope.size}
      className={cn(FIELDSET, inputGroupVariants(), scopeClass(parent), className)}
    >
      <ControlScopeProvider value={{ ...scope, fill: false }}>{children}</ControlScopeProvider>
    </fieldset>
  )
}

export type InputAddonProps = Omit<ComponentPropsWithoutRef<'span'>, 'className'> &
  VariantProps<typeof inputAddonVariants> & {
    /** Layout only (`min-w-16`). Height belongs to `size`. */
    className?: string
  }

/**
 * A text cell on an `InputGroup` field's edge: a prefix or a unit the user does not type.
 *
 * @example
 * <InputAddon>kg</InputAddon>
 */
export function InputAddon({ size, className, ...props }: InputAddonProps): ReactElement {
  const scope = useControlScope()
  return (
    <span
      {...props}
      data-slot="input-addon"
      className={cn(inputAddonVariants({ size: size ?? scope?.size }), className)}
    />
  )
}
