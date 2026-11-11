import { NumberField as BaseNumberField } from '@base-ui/react/number-field'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `NumberField` cva table: a bordered row of decrement, text input and increment. Coarse
 * pointers get the 44 px floor and 16 px text (below that iOS Safari zooms the page on focus).
 *
 * @example
 * numberFieldVariants({ size: 'sm' })
 */
export const numberFieldVariants = cva(
  'flex w-full min-w-0 items-stretch rounded-ctrl border border-input bg-background text-foreground transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand data-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11',
  {
    variants: {
      size: {
        md: 'h-ctl',
        sm: 'h-6',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

// The border sits outside the buttons, so the `::after` overlay reaches over it: the hit target is
// the full row height, not the row height minus 2 px.
const stepperVariants = cva(
  'relative flex shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors select-none after:absolute after:inset-x-0 after:-inset-y-px hover:bg-accent hover:text-foreground data-disabled:cursor-not-allowed pointer-coarse:w-11',
  {
    variants: { size: { md: 'w-8', sm: 'w-6' } },
    defaultVariants: { size: 'md' },
  },
)

// The row has no `overflow-hidden` (it would clip the overlay), so the end buttons round their own
// outer corners to sit inside the border.
const EDGE_START = 'rounded-l-[calc(var(--radius-ctrl)-1px)]'
const EDGE_END = 'rounded-r-[calc(var(--radius-ctrl)-1px)]'

const entryVariants = cva(
  'min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none placeholder:text-faint pointer-coarse:text-base',
  {
    variants: { size: { md: 'px-3 text-sm', sm: 'px-2 text-xs' } },
    defaultVariants: { size: 'md' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const numberFieldParts = ['number-field'] as const

export type NumberFieldProps = Omit<
  BaseNumberField.Root.Props,
  'className' | 'children' | 'locale' | 'aria-label' | 'aria-labelledby' | 'aria-describedby'
> &
  VariantProps<typeof numberFieldVariants> & {
    /**
     * BCP 47 tag for the digits and separators, default `en`. Pass the same tag on server and client
     * so the text hydrates unchanged.
     */
    locale?: string
    /** Intl options for the displayed text (`{ style: 'currency', currency: 'EUR' }`). */
    format?: Intl.NumberFormatOptions
    /** Names the text input; a wrapping `<label>` or Base UI `Field.Label` does too. */
    'aria-label'?: string
    'aria-labelledby'?: string
    'aria-describedby'?: string
    placeholder?: string
    /** Layout only (`w-40`, `max-w-xs`). Height belongs to `size`. */
    className?: string
  }

const STEP_ICON = {
  viewBox: '0 0 12 12',
  className: 'size-3',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  'aria-hidden': true,
} as const

/**
 * A number input on Base UI with decrement and increment buttons; arrow keys step it, Shift steps
 * by `largeStep`. The text is formatted and parsed in `locale` (`1.234,5` in `de-DE`). Works with
 * no provider and joins a Base UI `Field` when wrapped in one.
 *
 * @example
 * <NumberField value={qty} onValueChange={setQty} min={0} aria-label="Quantity" />
 * <NumberField locale="de-DE" format={{ style: 'currency', currency: 'EUR' }} aria-label="Price" />
 */
export function NumberField({
  size,
  locale = 'en',
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  placeholder,
  ...props
}: NumberFieldProps): ReactElement {
  return (
    <BaseNumberField.Root
      {...props}
      locale={locale}
      data-slot="number-field"
      className={cn(numberFieldVariants({ size }), className)}
    >
      <BaseNumberField.Decrement className={cn(stepperVariants({ size }), EDGE_START)}>
        <svg {...STEP_ICON}>
          <path d="M2.5 6h7" />
        </svg>
      </BaseNumberField.Decrement>
      <BaseNumberField.Input
        className={entryVariants({ size })}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        placeholder={placeholder}
      />
      <BaseNumberField.Increment className={cn(stepperVariants({ size }), EDGE_END)}>
        <svg {...STEP_ICON}>
          <path d="M2.5 6h7M6 2.5v7" />
        </svg>
      </BaseNumberField.Increment>
    </BaseNumberField.Root>
  )
}
