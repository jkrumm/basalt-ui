import { Progress as BaseProgress } from '@base-ui/react/progress'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'

/**
 * The `Progress` cva table: a 6 px rounded track and the fill inside it. `tone` colours the fill,
 * default `accent`; an indeterminate bar pulses (never under reduced motion).
 *
 * @example
 * progressVariants({ tone: 'good' }) // class string for a non-`Progress` element
 */
export const progressVariants = cva(
  'block h-1.5 w-full overflow-hidden rounded-full bg-selected *:h-full *:rounded-full *:transition-[width] data-indeterminate:*:w-full data-indeterminate:*:animate-pulse motion-reduce:data-indeterminate:*:animate-none',
  {
    variants: {
      tone: {
        neutral: '*:bg-muted-foreground',
        accent: '*:bg-brand-fill',
        good: '*:bg-good',
        warn: '*:bg-warn',
        bad: '*:bg-bad',
        info: '*:bg-info',
      },
    },
    defaultVariants: { tone: 'accent' },
  },
)

/**
 * The `Ring` cva table: a 48 px circular gauge with the percentage in its middle. `tone` colours
 * the arc, default `accent`. No `RingProgress` options: size and thickness are the table's.
 *
 * @example
 * ringVariants({ tone: 'warn' }) // class string for a non-`Ring` element
 */
export const ringVariants = cva('relative inline-grid size-12 shrink-0 place-items-center', {
  variants: {
    tone: {
      neutral: 'text-muted-foreground',
      accent: 'text-brand-fill',
      good: 'text-good',
      warn: 'text-warn',
      bad: 'text-bad',
      info: 'text-info',
    },
  },
  defaultVariants: { tone: 'accent' },
})

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const progressParts = ['progress', 'ring'] as const

/**
 * What the control is called. Required: a bar or a ring with no name is announced as "progress bar"
 * and nothing else. Either a string, or the id of the visible label that names it.
 */
export type ProgressName =
  | { 'aria-label': string; 'aria-labelledby'?: string }
  | { 'aria-labelledby': string; 'aria-label'?: string }

export type ProgressProps = Omit<
  BaseProgress.Root.Props,
  | 'className'
  | 'children'
  | 'render'
  | 'locale'
  | 'format'
  | 'aria-label'
  | 'aria-labelledby'
  | 'aria-valuetext'
  | 'getAriaValueText'
> &
  VariantProps<typeof progressVariants> &
  ProgressName & {
    /** Layout only (`max-w-xs`, `mt-2`). Height belongs to the table. */
    className?: string
  }

/** The fraction of `[min, max]` that `value` has covered, clamped to 0..1. */
const fractionOf = (value: number, min: number, max: number): number => {
  const fraction = (value - min) / (max - min)
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0
}

/**
 * A bar for work that has a measure. `value` runs from `min` (0) to `max` (100); `null` is
 * indeterminate. The percentage read out to assistive tech is formatted in the page locale
 * (`useFormat`), so it matches the digits elsewhere on the page.
 *
 * @example
 * <Progress value={42} aria-label="Upload" />
 * <Progress value={null} tone="info" aria-labelledby="import-heading" />
 */
export function Progress({
  tone,
  className,
  value,
  min = 0,
  max = 100,
  ...props
}: ProgressProps): ReactElement {
  const format = useFormat()
  return (
    <BaseProgress.Root
      {...props}
      value={value}
      min={min}
      max={max}
      getAriaValueText={(_formatted, current) =>
        current === null ? '' : format.percent(fractionOf(current, min, max))
      }
      data-slot="progress"
      className={cn(progressVariants({ tone }), className)}
    >
      <BaseProgress.Indicator />
    </BaseProgress.Root>
  )
}

export type RingProps = Omit<ComponentProps<'span'>, 'className' | 'children' | 'role' | 'color'> &
  VariantProps<typeof ringVariants> &
  ProgressName & {
    /** Layout only (`ml-auto`). Size belongs to the table. */
    className?: string
    /** The measure, `min` (0) to `max` (100). */
    value: number
    min?: number
    max?: number
    /** Decimal places printed in the middle, default 1 (`42,5 %` in `de-DE`). */
    digits?: number
  }

const RADIUS = 20
const STROKE = 4

/**
 * A circular gauge with its percentage printed in the middle, in the page locale (`useFormat`):
 * `42.5%` in `en`, `42,5 %` in `de-DE`. The replacement for Mantine's `RingProgress`.
 *
 * @example
 * <Ring value={42.5} aria-label="Storage used" tone="warn" />
 */
export function Ring({
  tone,
  className,
  value,
  min = 0,
  max = 100,
  digits = 1,
  ...props
}: RingProps): ReactElement {
  const format = useFormat()
  const fraction = fractionOf(value, min, max)
  const text = format.percent(fraction, { maximumFractionDigits: digits })
  return (
    <span
      {...props}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a native <progress> cannot draw an arc
      role="progressbar"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={text}
      data-slot="ring"
      className={cn(ringVariants({ tone }), className)}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-selected"
        />
        <circle
          cx="24"
          cy="24"
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${fraction * 100} 100`}
          className="stroke-current"
        />
      </svg>
      <span
        aria-hidden="true"
        className="relative text-micro font-medium tabular-nums text-foreground"
      >
        {text}
      </span>
    </span>
  )
}
