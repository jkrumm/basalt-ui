import { Input as BaseInput } from '@base-ui/react/input'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Input` cva table. Coarse pointers get the 44 px floor and 16 px text (below that iOS Safari
 * zooms the page on focus).
 *
 * @example
 * inputVariants({ size: 'sm' })
 */
export const inputVariants = cva(
  'w-full min-w-0 rounded-ctrl border border-input bg-background text-foreground placeholder:text-faint focus-ring transition-colors aria-invalid:border-bad data-disabled:cursor-not-allowed data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
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
export const inputParts = ['input'] as const

export type InputProps = Omit<BaseInput.Props, 'className' | 'size'> &
  VariantProps<typeof inputVariants> & {
    /** Layout only (`w-full`, `max-w-xs`, `flex-1`). Height belongs to `size`. */
    className?: string
  }

/**
 * A text input on Base UI. Works with no provider and joins a Base UI `Field` when wrapped in one.
 *
 * @example
 * <Input value={q} onValueChange={setQ} placeholder="Search" />
 * <Input size="sm" aria-label="Quantity" inputMode="numeric" />
 */
export function Input({ size, className, ...props }: InputProps): ReactElement {
  return (
    <BaseInput {...props} data-slot="input" className={cn(inputVariants({ size }), className)} />
  )
}
