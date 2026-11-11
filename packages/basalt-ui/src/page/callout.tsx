import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { Alert } from '../ui/alert'

/** One of the four callout kinds; each maps onto the `Alert` tone of the same name. */
export type CalloutKind = 'info' | 'good' | 'warn' | 'bad'

export type CalloutProps = {
  /** Semantic kind: drives the tint, the glyph and the announcement. Default `'info'`. */
  kind?: CalloutKind
  title?: string
  /** Layout only (`my-6`). */
  className?: string
  children: ReactNode
}

// The kind as a word for assistive tech, so a title-less callout is never tint-only.
const KIND_WORD: Record<CalloutKind, string> = {
  info: 'Info',
  good: 'Success',
  warn: 'Warning',
  bad: 'Error',
}

/**
 * A tinted note inside an article, keyed to a semantic kind. A thin mapping onto `Alert`: the kind
 * is the tone, `title` is the alert's title. Without a title the kind is named in a screen-reader
 * word instead. The 2.x `icon` prop is gone; the glyph follows the kind.
 *
 * @useWhen an article or reply carries a note, tip, warning or error beside its prose
 * @neverWhen the message is about the state of the page or a form (use Alert directly)
 *
 * @example
 * <Callout kind="warn" title="Heads up">
 *   <p>This endpoint is rate-limited to 60 requests/minute.</p>
 * </Callout>
 */
export function Callout({ kind = 'info', title, className, children }: CalloutProps): ReactElement {
  return (
    <Alert
      tone={kind}
      {...(title !== undefined && { title })}
      className={cn('in-[.vx-prose]:mt-(--vx-rhythm-2)', className)}
    >
      {title === undefined && (
        <span className="sr-only" data-callout-kind-word="">
          {KIND_WORD[kind]}
        </span>
      )}
      {children}
    </Alert>
  )
}
