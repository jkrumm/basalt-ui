import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, CSSProperties, ReactElement } from 'react'
import { cn } from '../core/cn'
import type { SeriesGroup } from '../tokens'

/**
 * The `Status` cva table: a dot and its word. `tone` colors the dot; the word carries the verdict,
 * so the row never relies on color alone. `tone` is the closed vocabulary of `src/core/ports.ts`.
 *
 * @example
 * statusVariants({ tone: 'warn' }) // class string for a non-`Status` element
 */
export const statusVariants = cva(
  'inline-flex max-w-full items-center gap-1.5 text-sm whitespace-nowrap text-foreground before:size-2 before:shrink-0 before:rounded-full',
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
 * The `Swatch` cva table: a 10 px chip of one series color, the key beside a legend word. No
 * axes: the color is data and arrives as `color`, never as a class.
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
    /** The word. A status never carries color alone. */
    children: string
  }

/**
 * A dot and a word for a verdict: `Healthy`, `Degraded`. The dot is a pseudo-element and not read
 * out; the word is the state. A word wider than its box ends in an ellipsis.
 *
 * @useWhen one entity has a verdict word with a dot (Healthy, Degraded) in a row or a header
 * @neverWhen the word carries a count or a change (use CountBadge or DeltaBadge), or no word fits (a dot alone never ships)
 * @example
 * <Status tone="good">Healthy</Status>
 */
export function Status({ tone, className, children, ...props }: StatusProps): ReactElement {
  return (
    <span {...props} data-slot="status" className={cn(statusVariants({ tone }), className)}>
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

/**
 * A series color: a `BASALT.*` reference (`BASALT.good`, `BASALT.warn`) or a `groupTokens` ref. A raw
 * `#hex`, `rgb()` or color name does not type-check, nor does a plain string: mint the ref with
 * `groupTokens`.
 */
export type SwatchColor = `var(--basalt-${string})` | SeriesGroup[string]

export type SwatchProps = Layout & {
  /** The series color. Required: a swatch with no color is an empty box. */
  color: SwatchColor
}

/**
 * A chip of one series color for a legend or a list key. Decorative: the series name sits beside
 * it as text.
 *
 * @example
 * <Swatch color={BASALT.good} /> Revenue
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
