import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, CSSProperties, ReactElement } from 'react'
import { cn } from '../core/cn'
import type { SeriesGroup } from '../tokens'

/**
 * The `Status` cva table: a dot and its word. `tone` colours the dot; the word carries the verdict,
 * so the row never relies on colour alone. `tone` is the closed vocabulary of `src/core/ports.ts`.
 *
 * @example
 * statusVariants({ tone: 'warn' }) // class string for a non-`Status` element
 */
export const statusVariants = cva(
  'inline-flex items-center gap-1.5 text-sm whitespace-nowrap text-foreground before:size-2 before:shrink-0 before:rounded-full',
  {
    variants: {
      tone: {
        neutral: 'before:bg-muted-foreground',
        accent: 'before:bg-brand-fill',
        good: 'before:bg-good',
        warn: 'before:bg-warn',
        bad: 'before:bg-bad',
        info: 'before:bg-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

/**
 * The `Swatch` cva table: a 10 px chip of one series colour, the key beside a legend word. No
 * axes: the colour is data and arrives as `color`, never as a class.
 *
 * @example
 * swatchVariants() // class string for a hand-built key
 */
export const swatchVariants = cva('inline-block size-2.5 shrink-0 rounded-chip bg-(--swatch)')

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const statusParts = ['status', 'swatch'] as const

type Layout = Omit<ComponentProps<'span'>, 'className' | 'children' | 'color' | 'style'> & {
  /** Layout only (`ml-auto`, `shrink-0`). */
  className?: string
}

export type StatusProps = Layout &
  VariantProps<typeof statusVariants> & {
    /** The word. A status never carries colour alone. */
    children: string
  }

/**
 * A dot and a word for a verdict: `Healthy`, `Degraded`. The dot is a pseudo-element and not read
 * out; the word is the state.
 *
 * @example
 * <Status tone="good">Healthy</Status>
 */
export function Status({ tone, className, ...props }: StatusProps): ReactElement {
  return <span {...props} data-slot="status" className={cn(statusVariants({ tone }), className)} />
}

/**
 * A series colour: a `VX.*` reference (`VX.good`, `VX.warn`) or a `groupTokens` ref. A raw
 * `#hex`, `rgb()` or colour name does not type-check, nor does a plain string: mint the ref with
 * `groupTokens`.
 */
export type SwatchColor = `var(--vx-${string})` | SeriesGroup[string]

export type SwatchProps = Layout & {
  /** The series colour. Required: a swatch with no colour is an empty box. */
  color: SwatchColor
}

/**
 * A chip of one series colour for a legend or a list key. Decorative: the series name sits beside
 * it as text.
 *
 * @example
 * <Swatch color={VX.good} /> Revenue
 */
export function Swatch({ color, className, ...props }: SwatchProps): ReactElement {
  return (
    <span
      {...props}
      aria-hidden="true"
      data-slot="swatch"
      className={cn(swatchVariants(), className)}
      style={{ '--swatch': color } as CSSProperties}
    />
  )
}
