import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { Prose } from '../page/prose'
import { Glyph } from './glyphs'
import { TocList, tocEntries } from './toc'
import type { SiteLink, Slot, TocEntry } from './types'

export type SiteArticleProps = {
  /** The page's one `h1`. */
  title: Slot
  /** The standfirst under the title. */
  description?: Slot
  /** A line of facts under the description: a date, a reading time, an author. Your words. */
  meta?: Slot
  /** The table of contents: a rail beside the body on a wide layout, a disclosure above it on a narrow one. */
  toc?: readonly TocEntry[]
  /** The TOC's heading and landmark name ("On this page"); the TOC renders only with it. */
  tocLabel?: string
  /** The deepest heading level the TOC lists. Default 3. */
  tocDepth?: number
  /** A section navigation (a docs sidebar): a start column on a wide layout, a disclosure on a narrow one. */
  nav?: Slot
  /** The section navigation's landmark name and disclosure label ("Docs"); the nav renders only with it. */
  navLabel?: string
  /** The article body: Markdown or MDX output, styled by element. */
  children: Slot
  /** Under the body: a `SitePager`, an edit link. */
  footer?: Slot
  className?: string
}

function Disclosure({ label, children }: { label: string; children: Slot }): ReactElement {
  return (
    <details className="group/disc rounded-inset border border-border bg-card text-sm">
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-inset px-3 py-2 font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <Glyph
          name="chevron"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open/disc:rotate-90 rtl:-scale-x-100"
        />
        {label}
      </summary>
      <div className="border-t border-border px-1 py-2">{children}</div>
    </details>
  )
}

/**
 * The frame of an article or a docs page: title block, body in `Prose`, an optional table of
 * contents and an optional section navigation. The layout keys on its own container: the TOC rail
 * joins from 64rem, the section column from 80rem; below each, the same list sits in a native
 * `<details>` above the body. No script, no scroll tracking.
 *
 * @useWhen a long-form page (article, guide, docs entry) is rendered as static HTML
 * @neverWhen the page is an app screen (use `Page`), or the TOC must follow the scroll (use `ArticleLayout` from `basalt-ui/page`)
 *
 * @example
 * <SiteArticle title="Estimating with story points" toc={entries} tocLabel="On this page">
 *   <Content />
 * </SiteArticle>
 */
export function SiteArticle({
  title,
  description,
  meta,
  toc,
  tocLabel,
  tocDepth,
  nav,
  navLabel,
  children,
  footer,
  className,
}: SiteArticleProps): ReactElement {
  const entries = toc === undefined ? [] : tocEntries(toc, tocDepth)
  const hasToc = tocLabel !== undefined && entries.length > 0
  const hasNav = nav !== undefined && navLabel !== undefined
  return (
    <div data-slot="article-layout" className={cn('@container', className)}>
      <div
        className={cn(
          'mx-auto grid max-w-[80rem] grid-cols-[minmax(0,1fr)] gap-x-12 px-4 py-10 @regular:px-6 @wide:py-14',
          hasToc && '@[64rem]:grid-cols-[minmax(0,72ch)_14rem] @[64rem]:justify-center',
          hasNav && '@[80rem]:grid-cols-[14rem_minmax(0,72ch)_14rem] @[80rem]:justify-between',
        )}
      >
        {hasNav && (
          <nav
            aria-label={navLabel}
            className="row-span-4 hidden @[80rem]:sticky @[80rem]:top-20 @[80rem]:block @[80rem]:self-start"
          >
            {nav}
          </nav>
        )}
        <header
          className={cn('flex min-w-0 flex-col gap-3 pb-6', hasNav && '@[80rem]:col-start-2')}
        >
          {hasNav && (
            <div className="mb-2 @[80rem]:hidden">
              <Disclosure label={navLabel ?? ''}>
                <nav aria-label={navLabel} className="px-2">
                  {nav}
                </nav>
              </Disclosure>
            </div>
          )}
          <h1 className="font-head text-display font-semibold text-balance text-foreground">
            {title}
          </h1>
          {description !== undefined && (
            <p className="max-w-[60ch] text-lg text-muted-foreground">{description}</p>
          )}
          {meta !== undefined && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-faint">
              {meta}
            </div>
          )}
        </header>
        {hasToc && (
          <div className={cn('pb-6 @[64rem]:hidden', hasNav && '@[80rem]:col-start-2')}>
            <Disclosure label={tocLabel}>
              <TocList entries={entries} />
            </Disclosure>
          </div>
        )}
        <div
          className={cn(
            'min-w-0',
            hasNav && '@[80rem]:col-start-2',
            hasToc && '@[64rem]:row-start-2',
          )}
        >
          <Prose>{children}</Prose>
          {footer !== undefined && (
            <div className="mt-12 border-t border-border pt-6">{footer}</div>
          )}
        </div>
        {hasToc && (
          <nav
            aria-label={tocLabel}
            className={cn(
              'hidden flex-col gap-2 @[64rem]:sticky @[64rem]:top-20 @[64rem]:col-start-2 @[64rem]:row-start-1 @[64rem]:row-span-3 @[64rem]:flex @[64rem]:self-start',
              hasNav && '@[80rem]:col-start-3',
            )}
          >
            <p className="font-mono text-micro tracking-wider text-faint uppercase">{tocLabel}</p>
            <TocList entries={entries} />
          </nav>
        )}
      </div>
    </div>
  )
}

export type SitePagerProps = {
  prev?: SiteLink
  next?: SiteLink
  /** The eyebrow words over each link ("Previous", "Next"). */
  prevLabel: string
  nextLabel: string
  /** The landmark's accessible name ("Pages"). */
  label: string
}

/**
 * Previous and next links at the foot of a docs page or a guide, each with its own eyebrow word.
 *
 * @useWhen a page sits in an ordered series (docs, a multi-part guide) and the reader moves to its neighbours
 * @neverWhen the page stands alone, or the series lives in an app (use the router's links)
 *
 * @example
 * <SitePager label="Pages" prevLabel="Previous" nextLabel="Next" next={{ href: '/docs/tokens', label: 'Tokens' }} />
 */
export function SitePager({
  prev,
  next,
  prevLabel,
  nextLabel,
  label,
}: SitePagerProps): ReactElement {
  const cell = (link: SiteLink, eyebrow: string, side: 'prev' | 'next'): ReactElement => (
    <a
      href={link.href}
      className={cn(
        'focus-ring flex flex-col gap-1 rounded-inset border border-border px-4 py-3 no-underline hover:bg-accent',
        side === 'next' && 'col-start-2 items-end text-end',
      )}
    >
      <span className="font-mono text-micro tracking-wider text-faint uppercase">{eyebrow}</span>
      <span className="font-head text-md font-medium text-foreground">{link.label}</span>
    </a>
  )
  return (
    <nav aria-label={label} data-slot="pager" className="grid grid-cols-2 gap-4">
      {prev !== undefined && cell(prev, prevLabel, 'prev')}
      {next !== undefined && cell(next, nextLabel, 'next')}
    </nav>
  )
}
