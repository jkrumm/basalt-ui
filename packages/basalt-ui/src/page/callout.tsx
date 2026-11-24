import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import type { Tone } from '../core/ports'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import { Alert } from '../ui/alert'

export type CalloutProps = {
  /** Semantic tone, the values of `Alert`: drives the tint, the glyph and the announcement. Default `'info'`. */
  tone?: Tone
  title?: string
  /** Layout only (`my-6`). */
  className?: string
  children: ReactNode
}

/**
 * A tinted note inside an article, keyed to a semantic tone. A thin mapping onto `Alert`: `tone`
 * is the alert's tone, `title` is its title. Without a title the tone is named in a screen-reader
 * word instead (`neutral` and `accent` are plain notes and take none). The 2.x `icon` prop is gone;
 * the glyph follows the tone.
 *
 * @useWhen an article or reply carries a note, tip, warning or error beside its prose
 * @neverWhen the message is about the state of the page or a form (use Alert directly)
 *
 * @example
 * <Callout tone="warn" title="Heads up">
 *   <p>This endpoint is rate-limited to 60 requests/minute.</p>
 * </Callout>
 */
export function Callout({ tone, title, className, children }: CalloutProps): ReactElement {
  const t = useMessages(page)
  const resolved = tone ?? 'info'
  const kindWord = {
    info: t('page.kindInfo'),
    good: t('page.kindGood'),
    warn: t('page.kindWarn'),
    bad: t('page.kindBad'),
    accent: undefined,
    neutral: undefined,
  }[resolved]
  return (
    <Alert
      tone={resolved}
      {...(title !== undefined && { title })}
      className={cn('in-[.basalt-prose]:mt-(--basalt-rhythm-2)', className)}
    >
      {title === undefined && kindWord !== undefined && (
        <span className="sr-only" data-callout-kind-word="">
          {kindWord}
        </span>
      )}
      {children}
    </Alert>
  )
}
