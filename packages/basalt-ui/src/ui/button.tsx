import { Button as BaseButton } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { GROUPED_SMALL_BUTTON, buttonScopeClass, useControlScope } from '../core/control-scope'

/**
 * The `Button` cva table: the one source the generator reads for the type union, the `no-restyle`
 * contract and the props docs. Heights come from the density tokens (`h-ctl`) on every pointer: a
 * button is never taller on a phone. A coarse pointer gets a 44 px `::after` hit area around it. An
 * icon button also takes inline margin under a coarse pointer (8 px at `md`, 10 px at `sm`), so its
 * 44 px wide `::after` sits inside the button's own margin box and adds no scrollable overflow to
 * the scroller it ends (a row of links, a code frame).
 *
 * @example
 * buttonVariants({ variant: 'ghost', size: 'sm', shape: 'icon' }) // class string for a non-`Button` element
 */
export const buttonVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center gap-1.5 rounded-ctrl text-sm font-medium whitespace-nowrap select-none focus-ring transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 data-loading:cursor-progress',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80',
        secondary:
          'bg-secondary text-foreground shadow-raised hover:bg-accent active:bg-accent active:brightness-95 forced-colors:border forced-colors:border-current',
        ghost: 'text-foreground hover:bg-accent active:bg-accent active:brightness-95',
        danger: 'bg-bad-tint text-bad hover:brightness-90 active:brightness-80',
      },
      size: {
        md: 'after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11',
        sm: 'text-xs after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11',
      },
      shape: { default: '', icon: '' },
    },
    compoundVariants: [
      { size: 'md', shape: 'default', class: 'h-ctl px-3' },
      { size: 'sm', shape: 'default', class: 'h-6 px-2' },
      {
        size: 'md',
        shape: 'icon',
        class: 'size-ctl pointer-coarse:mx-2 pointer-coarse:after:-inset-x-2',
      },
      {
        size: 'sm',
        shape: 'icon',
        class: 'size-6 pointer-coarse:mx-2.5 pointer-coarse:after:-inset-x-2.5',
      },
    ],
    defaultVariants: { variant: 'secondary', size: 'md', shape: 'default' },
  },
)

/**
 * The `Pressable` cva table. No color axis: `Pressable` has no look of its own, it owns focus,
 * the hit area and a layout rhythm (`row`, `chip`).
 *
 * @example
 * pressableVariants({ size: 'chip' })
 */
export const pressableVariants = cva(
  'relative focus-ring after:absolute after:inset-x-0 after:top-1/2 after:h-full after:min-h-6 after:-translate-y-1/2 pointer-coarse:after:min-h-11',
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

/**
 * A button inside a group: its axes fall back to the group's, a small one lifts to the 44 px floor
 * of its neighbours under a coarse pointer (alone it keeps 24 px drawn and a 44 px `::after`), and
 * a small icon drops the coarse inline margin that would open a gap in a fused row.
 */
function useScopedAxes(
  variant: ButtonAxes['variant'],
  size: ButtonAxes['size'],
): { variant: ButtonAxes['variant']; size: ButtonAxes['size']; scoped: string | undefined } {
  const scope = useControlScope()
  const resolved = size ?? scope?.size
  return {
    variant: variant ?? scope?.variant,
    size: resolved,
    scoped:
      scope === null
        ? undefined
        : cn(buttonScopeClass(scope), resolved === 'sm' && GROUPED_SMALL_BUTTON),
  }
}

/** The `loading` spinner: a 16 px arc that turns, still for reduced motion, centred over the label. */
function Spinner(): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      data-button-spinner=""
      className="absolute inset-0 m-auto size-icon animate-spin motion-reduce:animate-none"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

type BaseProps = Omit<BaseButton.Props, 'className'> & {
  /** Layout only (`w-full`, `flex-1`, `mt-2`). Height and display belong to `size` and `shape`. */
  className?: string
}
type ButtonAxes = VariantProps<typeof buttonVariants>

export type ButtonProps = BaseProps &
  Omit<ButtonAxes, 'shape'> & {
    /**
     * Disables interaction, sets `aria-busy` and draws a spinner over the label; the label keeps its
     * place (transparent, still the accessible name), so the button never changes width.
     */
    loading?: boolean
  } & (
    | { shape?: 'default' }
    // An icon-only button has no text to name it, so the name is required by type.
    | { shape: 'icon'; 'aria-label': string }
  )

/**
 * A button on Base UI. Works with no provider; polymorphism only through `render`.
 *
 * @useWhen an action the user takes: save, delete, open
 * @neverWhen the target is another page (use a link, or `render` a link through Button), or the control is a choice (use Switch, Segmented or Select)
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
  children,
  ...props
}: ButtonProps): ReactElement {
  const axes = useScopedAxes(variant, size)
  return (
    <BaseButton
      {...props}
      disabled={disabled || loading}
      focusableWhenDisabled={focusableWhenDisabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading ? '' : undefined}
      data-slot="button"
      className={cn(
        buttonVariants({ variant: axes.variant, size: axes.size, shape }),
        axes.scoped,
        className,
      )}
    >
      {loading === true ? (
        <>
          <Spinner />
          <span className="inline-flex items-center gap-1.5 opacity-0">{children}</span>
        </>
      ) : (
        children
      )}
    </BaseButton>
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
