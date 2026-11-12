import { useId } from 'react'
import type { ReactElement } from 'react'
import { headingSlug } from '../core/slug'
import type { SectionProps } from './contract'

/**
 * A titled part of a page: an `h2`, an optional controls slot on the same row and the body. The
 * section is a named region and a scroll anchor: its `id` is the slug of `title`, and its scroll
 * margin is `--page-sticky-top`, so a `#hash` jump, a skip link or `scrollIntoView` lands the
 * heading just below the page band instead of under it. Outside a `Page` the offset is zero.
 *
 * `controls` is the section's own control home (a range for one widget, a view switch): it never
 * holds page-wide filters, which belong to the `PageBar`.
 *
 * @useWhen a page has several parts that each need a heading, their own controls or an anchor
 * @neverWhen the part is a single card (the card has its own title) or the heading restates the page title
 *
 * @example
 * <Section title="Latency" controls={filterSlot([widgetRange])}>
 *   <ChartCard title="p95" chart={…} />
 * </Section>
 */
export function Section({ title, controls, children }: SectionProps): ReactElement {
  const headingId = useId()
  const anchor = headingSlug(title)
  return (
    <section
      id={anchor === '' ? undefined : anchor}
      data-slot="section"
      aria-labelledby={headingId}
      className="flex min-w-0 scroll-mt-(--page-sticky-top) flex-col gap-3"
    >
      <header className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h2
          id={headingId}
          className="m-0 min-w-0 flex-1 font-head text-md font-semibold tracking-tight text-foreground"
        >
          {title}
        </h2>
        {controls !== undefined && controls.count > 0 && (
          <div data-slot="section-controls" className="flex min-w-0 flex-wrap items-center gap-2">
            {controls.render()}
          </div>
        )}
      </header>
      {children}
    </section>
  )
}
