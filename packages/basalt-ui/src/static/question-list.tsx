import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { BLOCK_FRAME, BlockHead } from './blocks'
import { Glyph } from './glyphs'
import type { Slot } from './types'

/**
 * One question and its answer, as plain text so the same array can feed a `FAQPage` JSON-LD block;
 * an answer of several paragraphs is an array. `id` makes the question a link target.
 */
export type SiteQuestion = {
  question: string
  answer: string | readonly string[]
  id?: string
}

export type SiteQuestionListProps = {
  /** The section's `h2`. */
  title?: Slot
  description?: Slot
  questions: readonly SiteQuestion[]
  className?: string
}

/**
 * Questions and answers as native `<details>`: each opens on its own with no script, and the
 * browser's find-in-page opens the one that matches. The list takes its questions as data, so a
 * page can emit its own structured data from the same array; basalt emits none. From 64rem the
 * heading sits in a start column beside the list.
 *
 * @useWhen a landing or guide page answers the questions its readers ask before they start
 * @neverWhen the content is one long explanation (write it as prose with headings)
 *
 * @example
 * <SiteQuestionList
 *   title="Questions"
 *   questions={[{ question: 'Is it free?', answer: 'Yes, and open source.' }]}
 * />
 */
export function SiteQuestionList({
  title,
  description,
  questions,
  className,
}: SiteQuestionListProps): ReactElement {
  const hasHead = title !== undefined || description !== undefined
  return (
    <section data-slot="site-question-list" className={cn('@container', className)}>
      <div
        className={cn(
          BLOCK_FRAME,
          'grid grid-cols-[minmax(0,1fr)] gap-8 py-12 @[64rem]:py-16',
          hasHead && '@[64rem]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] @[64rem]:gap-16',
        )}
      >
        <BlockHead title={title} description={description} />
        <div className="flex flex-col border-y border-border">
          {questions.map((q) => (
            <details
              key={q.question}
              id={q.id}
              className="group/q border-b border-border last:border-b-0"
            >
              <summary className="focus-ring flex cursor-pointer list-none items-start justify-between gap-4 rounded-ctrl py-4 font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>{q.question}</span>
                <span className="mt-0.5 shrink-0 text-muted-foreground transition-transform duration-fast ease-standard group-open/q:rotate-90 rtl:-scale-x-100">
                  <Glyph name="chevron" />
                </span>
              </summary>
              <div className="flex max-w-[65ch] flex-col gap-3 pe-8 pb-5 text-muted-foreground">
                {(typeof q.answer === 'string' ? [q.answer] : q.answer).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
