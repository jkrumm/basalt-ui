import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import type { Tone } from '../core/ports'

/**
 * The `Alert` cva table: a tinted block with a glyph, an optional title and a body. `tone` is the
 * closed vocabulary of `src/core/ports.ts`; the glyph and the title carry it as well as the tint.
 *
 * @example
 * alertVariants({ tone: 'bad' }) // class string for a non-`Alert` element
 */
export const alertVariants = cva(
  'flex w-full items-start gap-3 rounded-inset px-3 py-2.5 text-sm text-foreground',
  {
    variants: {
      tone: {
        neutral: 'bg-selected [&>svg]:text-muted-foreground',
        accent: 'bg-selected [&>svg]:text-brand',
        good: 'bg-good-tint [&>svg]:text-good',
        warn: 'bg-warn-tint [&>svg]:text-warn',
        bad: 'bg-bad-tint [&>svg]:text-bad',
        info: 'bg-info-tint [&>svg]:text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const alertParts = ['alert'] as const

/**
 * `bad` and `warn` interrupt (`alert`); the rest are polite (`status`). The role is the tone's, not
 * the caller's.
 */
const ROLE: Record<Tone, 'alert' | 'status'> = {
  bad: 'alert',
  warn: 'alert',
  good: 'status',
  info: 'status',
  accent: 'status',
  neutral: 'status',
}

const GLYPH: Record<Tone, string> = {
  bad: 'M8 4.5v4.5M8 11.5v.01',
  warn: 'M8 4.5v4.5M8 11.5v.01',
  good: 'M4.5 8.5 7 11l4.5-5.5',
  info: 'M8 7.5V11M8 5v.01',
  accent: 'M8 7.5V11M8 5v.01',
  neutral: 'M8 7.5V11M8 5v.01',
}

export type AlertProps = Omit<ComponentProps<'div'>, 'className' | 'children' | 'role' | 'title'> &
  VariantProps<typeof alertVariants> & {
    /** Layout only (`max-w-prose`, `mt-4`). */
    className?: string
    /** The short headline. */
    title?: string
    /** The body. */
    children: ReactNode
  }

/**
 * An inline message about the page's state. `bad` and `warn` carry `role="alert"` and are announced
 * at once; `good`, `info`, `accent` and `neutral` carry `role="status"` and are announced politely.
 * The role follows the tone and cannot be passed.
 *
 * @example
 * <Alert tone="bad" title="Sync failed">The last run stopped at step 3.</Alert>
 */
export function Alert({ tone, title, className, children, ...props }: AlertProps): ReactElement {
  const resolved: Tone = tone ?? 'neutral'
  return (
    <div
      {...props}
      role={ROLE[resolved]}
      data-slot="alert"
      className={cn(alertVariants({ tone }), className)}
    >
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d={GLYPH[resolved]} />
      </svg>
      <div className="flex min-w-0 flex-col gap-0.5 wrap-anywhere">
        {title !== undefined && <p className="font-medium">{title}</p>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}
