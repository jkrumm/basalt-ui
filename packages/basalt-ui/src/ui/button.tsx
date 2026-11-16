import { Button as BaseButton } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Button` cva table: the one source the generator reads for the type union, the `no-restyle`
 * contract and the props docs. Heights come from the density tokens (`h-ctl`); `pointer-coarse:`
 * lifts the visible control to the 44 px floor, and the small sizes keep 24 px visible with a 44 px
 * `::after` hit area.
 *
 * @example
 * buttonVariants({ variant: 'ghost', size: 'sm', shape: 'icon' }) // class string for a non-`Button` element
 */
export const buttonVariants = cva(
  'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-ctrl text-sm font-medium whitespace-nowrap select-none focus-ring transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 data-loading:cursor-progress',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'bg-secondary text-foreground shadow-raised hover:bg-accent forced-colors:border forced-colors:border-current',
        ghost: 'text-foreground hover:bg-accent',
        danger: 'bg-bad-tint text-bad hover:brightness-90',
      },
      size: {
        md: '',
        sm: 'text-xs after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11',
      },
      shape: { default: '', icon: '' },
    },
    compoundVariants: [
      { size: 'md', shape: 'default', class: 'h-ctl px-3 pointer-coarse:min-h-11' },
      { size: 'sm', shape: 'default', class: 'h-6 px-2' },
      { size: 'md', shape: 'icon', class: 'size-ctl pointer-coarse:size-11' },
      { size: 'sm', shape: 'icon', class: 'size-6' },
    ],
    defaultVariants: { variant: 'secondary', size: 'md', shape: 'default' },
  },
)

/**
 * The `Pressable` cva table. No colour axis: `Pressable` has no look of its own, it owns focus,
 * the hit area and a layout rhythm (`row`, `chip`).
 *
 * @example
 * pressableVariants({ size: 'chip' })
 */
export const pressableVariants = cva(
  'relative cursor-pointer focus-ring after:absolute after:inset-x-0 after:top-1/2 after:h-full after:min-h-6 after:-translate-y-1/2 pointer-coarse:after:min-h-11',
  {
    variants: {
      size: {
        none: '',
        row: 'flex min-h-row items-center gap-2 px-2',
        chip: 'inline-flex h-6 items-center gap-1 rounded-chip px-2',
      },
    },
    defaultVariants: { size: 'none' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const buttonParts = ['button', 'pressable'] as const

type BaseProps = Omit<BaseButton.Props, 'className'> & {
  /** Layout only (`w-full`, `flex-1`, `mt-2`). Height and display belong to `size` and `shape`. */
  className?: string
}
type ButtonAxes = VariantProps<typeof buttonVariants>

export type ButtonProps = BaseProps &
  Omit<ButtonAxes, 'shape'> & {
    /** Disables interaction and sets `aria-busy`, keeping focus on the button. */
    loading?: boolean
  } & (
    | { shape?: 'default' }
    // An icon-only button has no text to name it, so the name is required by type.
    | { shape: 'icon'; 'aria-label': string }
  )

/**
 * A button on Base UI. Works with no provider; polymorphism only through `render`.
 *
 * @example
 * <Button variant="primary" onClick={save}>Save</Button>
 * <Button shape="icon" aria-label="Close" render={<a href="/home" />} nativeButton={false} />
 */
export function Button({
  variant,
  size,
  shape,
  loading,
  disabled,
  focusableWhenDisabled,
  className,
  ...props
}: ButtonProps): ReactElement {
  return (
    <BaseButton
      {...props}
      disabled={disabled || loading}
      focusableWhenDisabled={focusableWhenDisabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading ? '' : undefined}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape }), className)}
    />
  )
}

export type PressableProps = BaseProps & VariantProps<typeof pressableVariants>

/**
 * A whole row, chip or disclosure that is one button. Styled by the caller; it owns focus, the
 * pointer-tier hit floor and `size` layout, and nothing else.
 *
 * @example
 * <Pressable size="chip" aria-pressed={active} className="text-xs aria-pressed:bg-selected" onClick={toggle}>
 *   {label}
 * </Pressable>
 */
export function Pressable({ size, className, ...props }: PressableProps): ReactElement {
  return (
    <BaseButton
      {...props}
      data-slot="pressable"
      className={cn(pressableVariants({ size }), className)}
    />
  )
}
