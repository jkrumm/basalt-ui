import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../core/cn'
import type { Delta } from '../core/ports'

/**
 * The `Lozenge` cva table: a tinted word chip. `tone` is the closed verdict vocabulary; the tint is
 * the tone's own color at the theme's tint percentage, so text contrast is the token gate's.
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
 * The `DeltaBadge` cva table: a 24 px pill. `tone` is the verdict, resolved from `polarity` and the
 * direction of the value, never passed in; the text is the tone's own ink on its tint, gated at
 * 4.5:1 (`badge.contrast.test.ts` names the measured ratios). `neutral` takes the primary ink on the
 * selected fill, so it clears 4.5:1 on every card ground.
 *
 * @example
 * deltaBadgeVariants({ tone: 'bad' })
 */
export const deltaBadgeVariants = cva(
  'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium whitespace-nowrap tabular-nums',
  {
    variants: {
      tone: {
        good: 'bg-good-tint text-good',
        bad: 'bg-bad-tint text-bad',
        neutral: 'bg-selected text-foreground',
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
    /** The word. A lozenge never carries color alone. */
    children: string
  }

/**
 * A tinted word chip for a state: `Draft`, `Overdue`.
 *
 * @useWhen a state, a count or a change needs a small chip beside a label: `Lozenge` for a word, `CountBadge` for a number, `DeltaBadge` for a change against a period
 * @neverWhen the verdict is a dot and a word on one entity (use Status), or the chip would carry color alone
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
type Direction = 'up' | 'down' | 'zero' | 'none'

/**
 * Direction from the sign of a number, or of a string such as `+12%`, `-3.1` or `0`. A string with no
 * sign (a count, a share or a word: `2 of 3 scheduled`, `53 % of all`) is no change against anything, so
 * it has no direction and draws no arrow.
 */
function directionOf(value: Delta['value']): Direction {
  // The sign and the first number, whatever symbol sits between them: `-€5.66`, `+12%`, `−3.1`.
  const number =
    typeof value === 'number'
      ? value
      : Number.parseFloat(value.replace('−', '-').replaceAll(/[^\d.+-]/g, ''))
  if (Number.isNaN(number)) return 'none'
  if (number === 0) return 'zero'
  if (typeof value === 'string' && !/[+\-−]/.test(value)) return 'none'
  return number > 0 ? 'up' : 'down'
}

/** The verdict: direction against polarity. `up-good` reads a rise as good, `up-bad` as bad. */
function verdictOf(direction: Direction, polarity: DeltaPolarity): 'good' | 'bad' | 'neutral' {
  if (direction === 'zero' || direction === 'none' || polarity === 'neutral') return 'neutral'
  const rising = direction === 'up'
  return rising === (polarity === 'up-good') ? 'good' : 'bad'
}

/** Up-right, down-right and a minus: the arrow names the direction, the tint the verdict. A value with no sign has no glyph. */
const GLYPH: Record<Exclude<Direction, 'none'>, string> = {
  up: 'M4.5 11.5 11.5 4.5M5.5 4.5h6v6',
  down: 'M4.5 4.5 11.5 11.5M11.5 5.5v6h-6',
  zero: 'M4 8h8',
}

const DIRECTION_WORD: Record<Exclude<Direction, 'none'>, string> = {
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
 * a neutral chip with a minus glyph, a `neutral` polarity never takes a verdict color, and a string
 * with no sign (`2 of 3 scheduled`, `53 % of all`) is a neutral chip with no arrow.
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
      {direction !== 'none' && (
        <>
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" aria-hidden="true">
            <path
              d={GLYPH[direction]}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="sr-only">{`${DIRECTION_WORD[direction]}${verdict}: `}</span>
        </>
      )}
      {value}
      {label !== undefined && <span className="font-normal opacity-80">{label}</span>}
    </span>
  )
}
