import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../core/cn'
import { NON_FINITE, useFormat } from '../core/format'

/**
 * The `Num` cva table: tabular numerals so a column of figures lines up, and a `tone` for the
 * verdict colour. `tone` is the closed vocabulary of `src/core/ports.ts`; the default inherits the
 * surrounding text colour.
 *
 * @example
 * numVariants({ tone: 'bad' }) // class string for a non-`Num` element
 */
export const numVariants = cva('tabular-nums', {
  variants: {
    tone: {
      neutral: 'text-muted-foreground',
      accent: 'text-brand',
      good: 'text-good',
      warn: 'text-warn',
      bad: 'text-bad',
      info: 'text-info',
    },
  },
})

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const numParts = ['num'] as const

export type NumProps = Omit<ComponentProps<'span'>, 'className' | 'children' | 'color'> &
  VariantProps<typeof numVariants> & {
    /** The figure. `null`, `undefined`, `NaN` and `±Infinity` print a muted dash. */
    value: number | null | undefined
    /** Intl options for the text (`{ style: 'percent' }`, `{ maximumFractionDigits: 0 }`). */
    format?: Intl.NumberFormatOptions
    /** Layout only (`ml-auto`, `text-right`). */
    className?: string
  }

/**
 * A figure in the page locale (`useFormat`) with tabular numerals. A value that is absent or not
 * finite prints a muted dash, never `NaN`, and keeps `tone` off so a missing figure never reads
 * as a verdict.
 *
 * @example
 * <Num value={1234.5} />
 * <Num value={delta} tone={delta < 0 ? 'bad' : 'good'} format={{ style: 'percent' }} />
 */
export function Num({ value, format, tone, className, ...props }: NumProps): ReactElement {
  const intl = useFormat()
  const present = typeof value === 'number' && Number.isFinite(value)
  return (
    <span
      {...props}
      data-slot="num"
      data-absent={present ? undefined : ''}
      className={cn(numVariants({ tone: present ? tone : 'neutral' }), className)}
    >
      {present ? intl.number(value, format) : NON_FINITE}
    </span>
  )
}
