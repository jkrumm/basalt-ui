import { useRender } from '@base-ui/react/use-render'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'

/**
 * The `Card` cva table: the ringed card surface. `flush` drops the padding so a band or an inset
 * region can run edge to edge.
 *
 * @example
 * cardVariants({ flush: true }) // class string for a non-`Card` element
 */
export const cardVariants = cva('flex flex-col rounded-card bg-card text-foreground shadow-card', {
  variants: {
    flush: {
      true: 'p-0',
      false: 'p-4',
    },
  },
  defaultVariants: { flush: false },
})

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const cardParts = ['card'] as const

export type CardProps = Omit<useRender.ComponentProps<'div'>, 'className'> &
  VariantProps<typeof cardVariants> & {
    /** Layout only (`w-full`, `col-span-2`, `mt-4`). Display and padding belong to `flush`. */
    className?: string
  }

/**
 * The base card: a surface with a radius and a ring. Works with no provider; polymorphism only
 * through `render`.
 *
 * @example
 * <Card>Revenue</Card>
 * <Card flush render={<section aria-label="Orders" />}>…</Card>
 */
export function Card({ flush, className, render, ref, ...props }: CardProps): ReactElement {
  return useRender({
    render,
    ref,
    defaultTagName: 'div',
    props: {
      ...props,
      'data-slot': 'card',
      className: cn(cardVariants({ flush }), className),
    },
  })
}
