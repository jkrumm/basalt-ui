import { Separator as BaseSeparator } from '@base-ui/react/separator'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Separator` cva table: the hairline token, one device pixel on the surface it divides.
 * `horizontal` runs the full width of its container; `vertical` stretches to the height of its flex
 * row.
 *
 * @example
 * separatorVariants({ orientation: 'vertical' })
 */
export const separatorVariants = cva('shrink-0 bg-border', {
  variants: {
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'w-px self-stretch',
    },
  },
  defaultVariants: { orientation: 'horizontal' },
})

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const separatorParts = ['separator'] as const

export type SeparatorProps = Omit<BaseSeparator.Props, 'className' | 'children' | 'orientation'> &
  VariantProps<typeof separatorVariants> & {
    /** Layout only (`my-4`, `mx-2`). The hairline belongs to the part. */
    className?: string
  }

/**
 * A hairline between groups, on Base UI so it carries `role="separator"` and its orientation.
 *
 * @example
 * <Separator />
 * <Separator orientation="vertical" />
 */
export function Separator({ orientation, className, ...props }: SeparatorProps): ReactElement {
  return (
    <BaseSeparator
      {...props}
      orientation={orientation ?? 'horizontal'}
      data-slot="separator"
      className={cn(separatorVariants({ orientation }), className)}
    />
  )
}
