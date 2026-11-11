import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../core/cn'
import type { Delta } from '../core/ports'

/**
 * The `Lozenge` cva table: a tinted word chip. `tone` is the closed verdict vocabulary; the tint is
 * the tone's own colour at the theme's tint percentage, so text contrast is the token gate's.
 *
 * @example
 * lozengeVariants({ tone: 'good' }) // class string for a non-`Lozenge` element
 */
export const lozengeVariants = cva(
  'inline-flex h-5 shrink-0 items-center gap-1 rounded-chip px-1.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-selected text-muted-foreground',
        accent: 'bg-selected text-brand',
        good: 'bg-good-tint text-good',
        warn: 'bg-warn-tint text-warn',
        bad: 'bg-bad-tint text-bad',
        info: 'bg-info-tint text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

/**
 * The `CountBadge` cva table. Neutral until it asks for `attention`, the one emphasised form.
 *
 * @example
 * countBadgeVariants({ attention: true })
 */
export const countBadgeVariants = cva(
  'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-micro font-medium tabular-nums',
  {
    variants: {
      attention: {
        true: 'bg-brand-fill text-on-brand',
        false: 'bg-selected text-muted-foreground',
      },
    },
    defaultVariants: { attention: false },
  },
)

/**
 * The `DeltaBadge` cva table. `tone` is the verdict, resolved from `polarity` and the direction of
 * the value, never passed in.
 *
 * @example
 * deltaBadgeVariants({ tone: 'bad' })
 */
export const deltaBadgeVariants = cva(
  'inline-flex h-5 shrink-0 items-center gap-1 rounded-chip px-1.5 text-xs font-medium whitespace-nowrap tabular-nums',
  {
    variants: {
      tone: {
        good: 'bg-good-tint text-good',
        bad: 'bg-bad-tint text-bad',
        neutral: 'bg-selected text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const badgeParts = ['lozenge', 'count-badge', 'delta-badge'] as const

type BadgeProps<E extends 'span'> = Omit<ComponentProps<E>, 'className' | 'children'> & {
  /** Layout only (`ml-auto`, `absolute -top-1 -right-1`). */
  className?: string
}

export type LozengeProps = BadgeProps<'span'> &
  VariantProps<typeof lozengeVariants> & {
    /** The word. A lozenge never carries colour alone. */
    children: string
  }

/**
 * A tinted word chip for a state: `Draft`, `Overdue`.
 *
 * @example
 * <Lozenge tone="warn">Overdue</Lozenge>
 */
export function Lozenge({ tone, className, ...props }: LozengeProps): ReactElement {
  return (
    <span {...props} data-slot="lozenge" className={cn(lozengeVariants({ tone }), className)} />
  )
}

export type CountBadgeProps = BadgeProps<'span'> &
  VariantProps<typeof countBadgeVariants> & {
    count: number
    /** Counts above it read `99+`. */
    max?: number
  }

/**
 * A number in a chip. Neutral unless `attention`. A dot is this badge positioned by `className`.
 *
 * @example
 * <CountBadge count={12} />
 * <CountBadge count={3} attention aria-label="3 unread" />
 */
export function CountBadge({
  count,
  max = 99,
  attention,
  className,
  ...props
}: CountBadgeProps): ReactElement {
  return (
    <span
      {...props}
      data-slot="count-badge"
      className={cn(countBadgeVariants({ attention }), className)}
    >
      {count > max ? `${max}+` : count}
    </span>
  )
}

export type DeltaPolarity = Delta['polarity']
type Direction = 'up' | 'down' | 'zero'

/** Direction from the sign of a number, or of a string such as `+12%`, `-3.1` or `0`. */
function directionOf(value: Delta['value']): Direction {
  const number = typeof value === 'number' ? value : Number.parseFloat(value.replace('−', '-'))
  if (Number.isNaN(number)) return 'up'
  if (number === 0) return 'zero'
  return number > 0 ? 'up' : 'down'
}

/** The verdict: direction against polarity. `up-good` reads a rise as good, `up-bad` as bad. */
function verdictOf(direction: Direction, polarity: DeltaPolarity): 'good' | 'bad' | 'neutral' {
  if (direction === 'zero' || polarity === 'neutral') return 'neutral'
  const rising = direction === 'up'
  return rising === (polarity === 'up-good') ? 'good' : 'bad'
}

const GLYPH: Record<Direction, string> = {
  up: 'M4 9.5 8 5.5l4 4',
  down: 'M4 6.5 8 10.5l4-4',
  zero: 'M4.5 8h7',
}

const DIRECTION_WORD: Record<Direction, string> = {
  up: 'Up',
  down: 'Down',
  zero: 'No change',
}

export type DeltaBadgeProps = Omit<BadgeProps<'span'>, 'children'> & {
  value: Delta['value']
  /** Required: which direction is good. Guessing `up-good` is the bug, so there is no default. */
  polarity: DeltaPolarity
  /** The period the change is against (`vs last week`). */
  label?: string
}

/**
 * A change against a period. The arrow is the direction, the tint is the verdict; a zero change is
 * a neutral chip with a minus glyph, and a `neutral` polarity never takes a verdict colour.
 *
 * @example
 * <DeltaBadge value="+12%" polarity="up-good" label="vs last week" />
 * <DeltaBadge value={-3} polarity="up-bad" />
 */
export function DeltaBadge({
  value,
  polarity,
  label,
  className,
  ...props
}: DeltaBadgeProps): ReactElement {
  const direction = directionOf(value)
  const tone = verdictOf(direction, polarity)
  const verdict = tone === 'neutral' ? '' : tone === 'good' ? ', favourable' : ', unfavourable'
  return (
    <span
      {...props}
      data-slot="delta-badge"
      data-direction={direction}
      data-tone={tone}
      className={cn(deltaBadgeVariants({ tone }), className)}
    >
      <svg viewBox="0 0 16 16" className="size-3" fill="none" aria-hidden="true">
        <path
          d={GLYPH[direction]}
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">{`${DIRECTION_WORD[direction]}${verdict}: `}</span>
      {value}
      {label !== undefined && <span className="font-normal opacity-80">{label}</span>}
    </span>
  )
}
