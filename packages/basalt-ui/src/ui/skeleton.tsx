import { cva } from 'class-variance-authority'
import type { ComponentProps, ReactElement } from 'react'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { base } from '../core/messages/base'

/**
 * The `Skeleton` cva table: one line of the text it stands for. Its height is `1lh`, the line height
 * of the text style it sits in, so a skeleton and the content that replaces it are the same height
 * and the page does not shift when the data lands. The pulse runs only for a visitor who has not
 * asked for reduced motion.
 *
 * @example
 * skeletonVariants() // class string for a hand-built placeholder
 */
export const skeletonVariants = cva(
  'block h-lh w-full rounded-sm bg-selected motion-safe:animate-pulse',
)

/**
 * The `Spinner` cva table: a ring one line high. It is `1lh` square and top-aligned, so a spinner in
 * a line of text leaves the line as tall as it was. It turns only for a visitor who has not asked
 * for reduced motion; otherwise it is the static arc.
 *
 * @example
 * spinnerVariants() // class string for a hand-built spinner
 */
export const spinnerVariants = cva(
  'inline-block h-lh w-lh shrink-0 align-top text-muted-foreground [&>svg]:size-full motion-safe:[&>svg]:animate-spin',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const skeletonParts = ['skeleton', 'spinner'] as const

export type SkeletonProps = Omit<ComponentProps<'div'>, 'className' | 'children'> & {
  /** Layout only (`w-32`, `w-2/3`). Height is one line of the surrounding text style. */
  className?: string
}

/**
 * A placeholder for one line of loading content. Match the content's text style on the skeleton or
 * its parent (`text-sm`, `text-lg`) and its height equals the content's; set the width with
 * `className`. Stack several for a paragraph. It is hidden from assistive tech: name the loading
 * region with `aria-busy` and a status, not each box.
 *
 * @example
 * <Skeleton className="w-40 text-lg" />
 */
export function Skeleton({ className, ...props }: SkeletonProps): ReactElement {
  return (
    <div
      {...props}
      aria-hidden="true"
      data-slot="skeleton"
      className={cn(skeletonVariants(), className)}
    />
  )
}

export type SpinnerProps = Omit<ComponentProps<'output'>, 'className' | 'children'> & {
  /** Layout only (`ml-2`, `text-brand`). Size is one line of the surrounding text style. */
  className?: string
}

/**
 * A loading ring, announced as a status named `Loading` (the `base.spinner.loading` message).
 * Works with no provider.
 *
 * @example
 * <Button disabled><Spinner />Saving</Button>
 */
export function Spinner({ className, ...props }: SpinnerProps): ReactElement {
  const t = useMessages(base)
  return (
    <output
      aria-label={t('base.spinner.loading')}
      {...props}
      data-slot="spinner"
      className={cn(spinnerVariants(), className)}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </output>
  )
}
