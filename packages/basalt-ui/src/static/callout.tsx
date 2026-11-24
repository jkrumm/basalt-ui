import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { Tone } from '../core/ports'
import { alertVariants } from '../ui/alert'
import type { Slot } from './types'

export type SiteCalloutProps = {
  /** The tint and the glyph color. Default `'info'`. */
  tone?: Tone
  /** The visible headline. */
  title?: string
  /** What the note is, for a screen reader when there is no title ("Warning"). */
  toneLabel?: string
  children: Slot
  className?: string
}

const GLYPH: Record<Tone, string> = {
  bad: 'M8 4.5v4.5M8 11.5v.01',
  warn: 'M8 4.5v4.5M8 11.5v.01',
  good: 'M4.5 8.5 7 11l4.5-5.5',
  info: 'M8 7.5V11M8 5v.01',
  accent: 'M8 7.5V11M8 5v.01',
  neutral: 'M8 7.5V11M8 5v.01',
}

/**
 * A tinted note beside the prose: an `aside` with the `Alert` tint of its tone. Static content is
 * never announced, so it carries no live role. With no `title`, `toneLabel` names the kind of note
 * for a screen reader; both are the consumer's words.
 *
 * @useWhen an article carries a tip, a warning or a caveat beside its text
 * @neverWhen the message is about the state of an app screen (use `Alert`)
 *
 * @example
 * <SiteCallout tone="warn" title="Rate limited">60 requests a minute.</SiteCallout>
 */
export function SiteCallout({
  tone = 'info',
  title,
  toneLabel,
  children,
  className,
}: SiteCalloutProps): ReactElement {
  return (
    <aside
      data-slot="callout"
      data-tone={tone}
      className={cn(
        alertVariants({ tone }),
        'in-[.basalt-prose]:mt-(--basalt-rhythm-2)',
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="8" cy="8" r="6.25" />
        <path d={GLYPH[tone]} />
      </svg>
      <div className="flex min-w-0 flex-col gap-1 [&>:first-child]:mt-0 [&_p]:m-0">
        {title !== undefined ? (
          <p className="font-medium text-foreground">{title}</p>
        ) : (
          toneLabel !== undefined && <span className="sr-only">{toneLabel}</span>
        )}
        <div>{children}</div>
      </div>
    </aside>
  )
}
